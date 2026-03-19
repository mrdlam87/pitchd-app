// POST /api/search
// NL query → Claude Haiku → ranked campsite results
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@/lib/generated/prisma/enums";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const anthropic = new Anthropic();

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
// Rough degrees-per-km at Australian latitudes — accurate enough for bounding box
const DEG_PER_KM = 1 / 111;
// 2-hour cache TTL
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
// Number of campsites to return after proximity ranking
const RESULT_LIMIT = 20;
// Default search radius when Claude can't infer one
const DEFAULT_RADIUS_KM = 300;
// Hard cap on radius — prevents a hallucinated large value causing a near-full-table scan
const MAX_RADIUS_KM = 1000;
// Amenity keys Claude is allowed to return — filter out hallucinated values
const ALLOWED_AMENITIES = ["dog_friendly", "fishing", "hiking", "swimming"];

interface ParsedIntent {
  amenities: string[];
  dateFrom: string | null;
  dateTo: string | null;
  radiusKm: number;
}

function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase().trim()).digest("hex");
}

// Haversine distance (km) — used to sort results by proximity to user
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function parseIntentWithClaude(query: string): Promise<ParsedIntent> {
  const today = new Date().toISOString().split("T")[0];

  // 10-second timeout — prevents the request hanging if the Anthropic API is slow
  const message = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system: "JSON-only. No explanation, no markdown. Output only a single JSON object.",
    messages: [
      {
        role: "user",
        content: `Parse this Australian camping search query and extract structured intent.
<query>${query}</query>
Today: ${today}

Return ONLY this JSON shape:
{"amenities":[],"dateFrom":null,"dateTo":null,"radiusKm":300}

Rules:
- amenities: array of matching keys from [dog_friendly, fishing, hiking, swimming] — empty array if none mentioned
- dateFrom / dateTo: ISO date strings (YYYY-MM-DD) if dates are mentioned, otherwise null. "this weekend" = upcoming Saturday and Sunday.
- radiusKm: inferred drive radius in km (1hr ≈ 80km, 2hr ≈ 160km, 3hr ≈ 240km). Default 300 if not mentioned.`,
      },
    ],
  }, { timeout: 10_000 });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude returned invalid JSON");

  const parsed = JSON.parse(text.slice(start, end + 1));

  return {
    amenities: Array.isArray(parsed.amenities)
      ? (parsed.amenities as unknown[]).filter((a): a is string => typeof a === "string" && ALLOWED_AMENITIES.includes(a))
      : [],
    dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : null,
    dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : null,
    radiusKm: Math.min(
      typeof parsed.radiusKm === "number" && parsed.radiusKm > 0
        ? parsed.radiusKm
        : DEFAULT_RADIUS_KM,
      MAX_RADIUS_KM
    ),
  };
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, lat, lng } = body as Record<string, unknown>;

  if (!query || typeof query !== "string" || query.trim() === "") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  if (query.trim().length > 500) {
    return Response.json({ error: "query is too long" }, { status: 400 });
  }

  // Number() is stricter than parseFloat() — rejects partial strings like "123abc".
  // Explicit check for undefined/null/"" before Number() so that valid 0 coordinates
  // (equator / prime meridian) are not incorrectly rejected. Neither ?? nor || work:
  //   ?? passes "" through as Number("") = 0 (falsy but not nullish)
  //   || treats 0 as falsy, so lat:0 → NaN → 400
  const userLat = (lat === undefined || lat === null || lat === "") ? NaN : Number(lat);
  const userLng = (lng === undefined || lng === null || lng === "") ? NaN : Number(lng);

  if (isNaN(userLat) || isNaN(userLng)) {
    return Response.json({ error: "lat and lng are required" }, { status: 400 });
  }

  // Exclude poles (±90) — cos(±90°) ≈ 6e-17, which makes lngDelta effectively infinite
  if (userLat <= -90 || userLat >= 90 || userLng < -180 || userLng > 180) {
    return Response.json({ error: "lat/lng out of range" }, { status: 400 });
  }

  try {
    const queryHash = hashQuery(query);
    const now = new Date();

    // Check SearchCache first — avoid repeat Claude API calls for identical queries
    const cached = await prisma.searchCache.findUnique({
      where: { queryHash },
    });

    let parsedIntent: ParsedIntent;

    if (cached && cached.expiresAt > now) {
      // Cache hit — reuse stored intent.
      // Sanitise on read: a tampered or pre-migration cache entry could have bad values.
      // Use a spread to avoid mutating the Prisma result object directly.
      const raw = cached.parsedIntentJson as unknown as ParsedIntent;
      const rawRadius = typeof raw.radiusKm === "number" && raw.radiusKm > 0
        ? raw.radiusKm
        : DEFAULT_RADIUS_KM;
      parsedIntent = {
        ...raw,
        // Cap radiusKm to prevent a large cached value from causing a table scan
        radiusKm: Math.min(rawRadius, MAX_RADIUS_KM),
        // Re-filter amenities in case the cache entry predates the ALLOWED_AMENITIES list
        amenities: Array.isArray(raw.amenities)
          ? raw.amenities.filter((a): a is string => typeof a === "string" && ALLOWED_AMENITIES.includes(a))
          : [],
        // Sanitise date fields — pass through only strings
        dateFrom: typeof raw.dateFrom === "string" ? raw.dateFrom : null,
        dateTo: typeof raw.dateTo === "string" ? raw.dateTo : null,
      };
    } else {
      // Cache miss — call Claude Haiku to parse intent
      parsedIntent = await parseIntentWithClaude(query.trim());

      // Store in SearchCache with 2-hour TTL.
      // Upsert handles the case where an expired record already exists for this hash.
      // Fire-and-forget — a transient DB failure here shouldn't fail the request.
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
      prisma.searchCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          queryText: query.trim(),
          parsedIntentJson: parsedIntent as object,
          expiresAt,
        },
        update: {
          queryText: query.trim(),
          parsedIntentJson: parsedIntent as object,
          expiresAt,
        },
      }).catch((err) => console.error("[search] cache write failed", err));
    }

    // Build a bounding box around the user's location using the intent-derived radius.
    // lng delta accounts for longitude convergence at AU latitudes (~30°S).
    const latDelta = parsedIntent.radiusKm * DEG_PER_KM;
    const lngDelta =
      parsedIntent.radiusKm * DEG_PER_KM / Math.cos((userLat * Math.PI) / 180);

    const campsites = await prisma.campsite.findMany({
      where: {
        syncStatus: SyncStatus.active,
        lat: { gte: userLat - latDelta, lte: userLat + latDelta },
        lng: { gte: userLng - lngDelta, lte: userLng + lngDelta },
        ...(parsedIntent.amenities.length > 0 && {
          amenities: {
            some: {
              amenityType: {
                key: { in: parsedIntent.amenities },
              },
            },
          },
        }),
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        region: true,
        blurb: true,
        amenities: {
          select: {
            amenityType: {
              select: {
                key: true,
                label: true,
                icon: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Rank by proximity to the user, return top RESULT_LIMIT
    const ranked = campsites
      .map((c) => ({
        ...c,
        amenities: c.amenities.map((a) => a.amenityType),
        distanceKm: distanceKm(userLat, userLng, c.lat, c.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, RESULT_LIMIT);

    return Response.json({ campsites: ranked, parsedIntent });
  } catch (e) {
    console.error("[POST /api/search]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
