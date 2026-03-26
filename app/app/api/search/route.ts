// POST /api/search
// NL query → Claude Haiku → ranked campsite results
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@/lib/generated/prisma/enums";
import {
  parseIntentWithClaude,
  isValidIsoDate,
  MAX_DRIVE_TIME_HRS,
  KM_PER_HOUR,
  type ParsedIntent,
} from "@/lib/parseIntent";
import { hashQuery, getCachedIntent, setCachedIntent } from "@/lib/searchCache";
import { haversineKm } from "@/lib/distance";
import { requireAuth } from "@/lib/apiAuth";
import { fetchWeatherForCandidates, combinedScore, extractForecastDays } from "@/lib/weatherRanking";

// Re-export for callers that import from the route rather than from the lib directly.
// The route is the public API surface for search — keeping this here avoids breaking
// any future callers that import ALLOWED_AMENITIES alongside POST.
export { ALLOWED_AMENITIES } from "@/lib/parseIntent";

// Rough degrees-per-km at Australian latitudes — accurate enough for bounding box
const DEG_PER_KM = 1 / 111;

// Nominatim rate limit: 1 req/s per IP (OSM usage policy). At beta scale this is fine
// because geocoding only runs on SearchCache misses — repeated queries for the same location
// string hit the cache and skip this call entirely. If traffic grows, consider caching
// geocode results separately (location string → lat/lng) with a longer TTL.
// Max location string length guards against unexpectedly large query params.
const MAX_LOCATION_LENGTH = 200;

// Geocodes a place name to lat/lng using Nominatim (OSM) — free, no API key required.
// Returns null if the lookup fails or returns no results so the caller can fall back
// gracefully to the user's GPS coordinates.
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (location.length > MAX_LOCATION_LENGTH) return null;
  try {
    const params = new URLSearchParams({
      q: location,
      format: "json",
      limit: "1",
      countrycodes: "au",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { "User-Agent": "Pitchd/1.0 (pitchd-app.vercel.app)" },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    const geocodedLat = Number(data[0].lat);
    const geocodedLng = Number(data[0].lon);
    if (isNaN(geocodedLat) || isNaN(geocodedLng)) return null;
    return { lat: geocodedLat, lng: geocodedLng };
  } catch {
    return null;
  }
}

// Number of campsites to return after final combined ranking
const RESULT_LIMIT = 20;
// Max rows fetched from DB before Haversine sort — guards against large bounding boxes
// pulling thousands of rows into memory. Well above RESULT_LIMIT to preserve ranking quality.
const DB_FETCH_LIMIT = 200;
// Number of proximity candidates passed to weather enrichment. Larger than RESULT_LIMIT
// so weather can promote great-weather sites that would otherwise just miss the cut.
const WEATHER_CANDIDATES = 50;
// MAX_DRIVE_TIME_HRS and KM_PER_HOUR imported from @/lib/parseIntent
// hashQuery, getCachedIntent, setCachedIntent imported from @/lib/searchCache

export async function POST(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, lat, lng, startDate: bodyStartDate, endDate: bodyEndDate } = body as Record<string, unknown>;

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

    // Check SearchCache first — avoid repeat Claude API calls for identical queries
    let parsedIntent: ParsedIntent | null = await getCachedIntent(queryHash);

    if (!parsedIntent) {
      // Cache miss — call Claude Haiku to parse intent
      // TODO M7: add per-user rate limiting to prevent cost abuse before wider launch
      parsedIntent = await parseIntentWithClaude(query.trim());

      // Store result in SearchCache with 2-hour TTL.
      // Awaited so the write completes before the response returns (prevents test races).
      // .catch() swallows transient DB failures — a failed write still returns a 200.
      await setCachedIntent(queryHash, query.trim(), parsedIntent)
        .catch((err) => console.error("[search] cache write failed", err));
    }

    // If the query mentions a location, geocode it and use as the search centre.
    // Falls back to the user's GPS coordinates if geocoding fails or returns no result.
    let searchLat = userLat;
    let searchLng = userLng;
    if (parsedIntent.location) {
      const geocoded = await geocodeLocation(parsedIntent.location);
      if (geocoded) {
        searchLat = geocoded.lat;
        searchLng = geocoded.lng;
      }
    }

    // Derive search radius from drive time. The Math.min is defence-in-depth — driveTimeHrs
    // is already capped at MAX_DRIVE_TIME_HRS in parseIntentWithClaude and the cache sanitiser,
    // so this guard only fires if those layers are bypassed (e.g. a future code path).
    const radiusKm = Math.min(parsedIntent.driveTimeHrs * KM_PER_HOUR, MAX_DRIVE_TIME_HRS * KM_PER_HOUR);

    // Build a bounding box around the search centre using the intent-derived radius.
    // lng delta accounts for longitude convergence at AU latitudes (~30°S).
    const latDelta = radiusKm * DEG_PER_KM;
    const lngDelta =
      radiusKm * DEG_PER_KM / Math.cos((searchLat * Math.PI) / 180);

    const campsites = await prisma.campsite.findMany({
      where: {
        syncStatus: SyncStatus.active,
        lat: { gte: searchLat - latDelta, lte: searchLat + latDelta },
        lng: { gte: searchLng - lngDelta, lte: searchLng + lngDelta },
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

    // Body-supplied dates override the AI-inferred dates for weather scoring.
    // This lets the filter panel pass explicit dates when the user selects them manually.
    // Invalid or missing body dates fall back to parsedIntent dates (or today+tomorrow default).
    const rankStartDate: string | null =
      typeof bodyStartDate === "string" && isValidIsoDate(bodyStartDate)
        ? bodyStartDate
        : parsedIntent.startDate;
    const rankEndDate: string | null =
      typeof bodyEndDate === "string" && isValidIsoDate(bodyEndDate)
        ? bodyEndDate
        : parsedIntent.endDate;

    // Step 1: Proximity-rank all DB results
    const withDistance = campsites.map((c) => ({
      ...c,
      amenities: c.amenities.map((a) => a.amenityType),
      distanceKm: haversineKm(searchLat, searchLng, c.lat, c.lng),
    }));
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    // Step 2: Fetch weather for the top WEATHER_CANDIDATES proximity candidates.
    // Using more than RESULT_LIMIT gives weather a chance to promote great-weather
    // sites that would otherwise just miss the cut.
    const candidates = withDistance.slice(0, WEATHER_CANDIDATES);
    const weatherMap = await fetchWeatherForCandidates(
      candidates.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })),
    );

    // Step 3: Re-rank by combined proximity + weather score, return top RESULT_LIMIT.
    // Attach the filtered WeatherDay[] to each campsite so the client can render
    // weather badges immediately — no extra round-trip to /api/weather/batch needed.
    const ranked = candidates
      .map((c) => {
        const forecast = weatherMap.get(c.id) ?? null;
        const days = extractForecastDays(forecast, rankStartDate, rankEndDate);
        return {
          campsite: c,
          score: combinedScore(c.distanceKm, radiusKm, forecast, rankStartDate, rankEndDate),
          days,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT)
      .map(({ campsite, days }) => ({ ...campsite, weather: days.length > 0 ? days : null }));

    return Response.json({ campsites: ranked, parsedIntent });
  } catch (e) {
    console.error("[POST /api/search]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
