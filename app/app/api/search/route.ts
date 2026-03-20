// POST /api/search
// NL query → Claude Haiku → ranked campsite results
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@/lib/generated/prisma/enums";
import {
  parseIntentWithClaude,
  isValidIsoDate,
  ALLOWED_AMENITIES,
  DEFAULT_DRIVE_TIME_HRS,
  MAX_DRIVE_TIME_HRS,
  type ParsedIntent,
} from "@/lib/parseIntent";
import { createHash } from "crypto";
import type { Prisma } from "@/lib/generated/prisma/client";

// Re-export so existing tests can import ALLOWED_AMENITIES from this module
export { ALLOWED_AMENITIES } from "@/lib/parseIntent";

// Rough degrees-per-km at Australian latitudes — accurate enough for bounding box
const DEG_PER_KM = 1 / 111;
// 2-hour cache TTL
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
// Number of campsites to return after proximity ranking
const RESULT_LIMIT = 20;
// Max rows fetched from DB before Haversine sort — guards against large bounding boxes
// pulling thousands of rows into memory. Well above RESULT_LIMIT to preserve ranking quality.
const DB_FETCH_LIMIT = 200;
// Converts drive time hours to a search radius in km (1hr ≈ 80km)
const KM_PER_HOUR = 80;
// DEFAULT_DRIVE_TIME_HRS and MAX_DRIVE_TIME_HRS imported from @/lib/parseIntent

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
      const raw = cached.parsedIntentJson as unknown as ParsedIntent;
      const rawDriveTime =
        typeof raw.driveTimeHrs === "number" && raw.driveTimeHrs > 0
          ? raw.driveTimeHrs
          : DEFAULT_DRIVE_TIME_HRS;
      parsedIntent = {
        location: typeof raw.location === "string" ? raw.location : null,
        driveTimeHrs: Math.min(rawDriveTime, MAX_DRIVE_TIME_HRS),
        // Re-filter amenities in case the cache entry predates the ALLOWED_AMENITIES list
        amenities: Array.isArray(raw.amenities)
          ? raw.amenities.filter(
              (a): a is string =>
                typeof a === "string" &&
                ALLOWED_AMENITIES.includes(a)
            )
          : [],
        // Sanitise date fields — must be ISO format (YYYY-MM-DD), not free-text
        startDate:
          typeof raw.startDate === "string" && isValidIsoDate(raw.startDate)
            ? raw.startDate
            : null,
        endDate:
          typeof raw.endDate === "string" && isValidIsoDate(raw.endDate)
            ? raw.endDate
            : null,
        sortBy:
          raw.sortBy === "proximity" || raw.sortBy === "relevance"
            ? raw.sortBy
            : null,
      };
    } else {
      // Cache miss — call Claude Haiku to parse intent
      // TODO M7: add per-user rate limiting to prevent cost abuse before wider launch
      parsedIntent = await parseIntentWithClaude(query.trim());

      // Store in SearchCache with 2-hour TTL.
      // Upsert handles the case where an expired record already exists for this hash.
      // Awaited so the write completes before the response returns (prevents test races).
      // .catch() swallows transient DB failures — a failed write still returns a 200.
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
      await prisma.searchCache.upsert({
        where: { queryHash },
        create: {
          queryHash,
          queryText: query.trim(),
          parsedIntentJson: parsedIntent as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
        update: {
          queryText: query.trim(),
          parsedIntentJson: parsedIntent as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
      }).catch((err) => console.error("[search] cache write failed", err));
    }

    // parsedIntent.location (e.g. "Blue Mountains") is extracted and returned to the client
    // but not yet used to shift the search centre — geocoding is deferred to a later milestone.
    // Until then, userLat/userLng (the user's GPS coordinates) remain the search origin.

    // Derive search radius from drive time. Cap to prevent near-full-table scans.
    const radiusKm = Math.min(parsedIntent.driveTimeHrs * KM_PER_HOUR, MAX_DRIVE_TIME_HRS * KM_PER_HOUR);

    // Build a bounding box around the user's location using the intent-derived radius.
    // lng delta accounts for longitude convergence at AU latitudes (~30°S).
    const latDelta = radiusKm * DEG_PER_KM;
    const lngDelta =
      radiusKm * DEG_PER_KM / Math.cos((userLat * Math.PI) / 180);

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
      take: DB_FETCH_LIMIT,
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
