// POST /api/weather/batch
// Returns weather forecast for up to MAX_LOCATIONS lat/lng coordinates in one request.
// Checks WeatherCache for each location; fetches from Open-Meteo in parallel for misses.
// Per-location failures are swallowed and returned as null — the batch never fails entirely.
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { Prisma } from "@/lib/generated/prisma/client";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds per location
const MAX_LOCATIONS = 100;
// Maximum concurrent Open-Meteo requests to avoid overwhelming the free tier
const CONCURRENCY = 10;

type Location = { id: string; lat: number; lng: number };

// Fetch Open-Meteo for a single coordinate; returns null on any error.
async function fetchOpenMeteo(lat: number, lng: number): Promise<Prisma.InputJsonValue | null> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode"
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      console.error("[POST /api/weather/batch] Open-Meteo error", res.status, lat, lng);
      return null;
    }
    return (await res.json()) as Prisma.InputJsonValue;
  } catch (err) {
    console.error("[POST /api/weather/batch] Open-Meteo fetch failed", lat, lng, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Run an array of async tasks with a maximum concurrency limit.
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).locations)) {
    return Response.json({ error: "locations array is required" }, { status: 400 });
  }

  const rawLocations = (body as Record<string, unknown>).locations as unknown[];

  if (rawLocations.length === 0) {
    return Response.json({ results: {} });
  }

  if (rawLocations.length > MAX_LOCATIONS) {
    return Response.json(
      { error: `Too many locations — maximum is ${MAX_LOCATIONS}` },
      { status: 400 }
    );
  }

  // Validate each location entry
  const validLocations: Location[] = [];
  for (const raw of rawLocations) {
    if (typeof raw !== "object" || raw === null) {
      return Response.json({ error: "Each location must be an object" }, { status: 400 });
    }
    const loc = raw as Record<string, unknown>;
    if (typeof loc.id !== "string" || !loc.id) {
      return Response.json({ error: "Each location must have a non-empty string id" }, { status: 400 });
    }
    // Number() is stricter than parseFloat() — rejects partial strings like "123abc".
    // Locations from the client come as numbers, but guard against stringified values.
    const lat = typeof loc.lat === "number" ? loc.lat : Number(loc.lat || NaN);
    const lng = typeof loc.lng === "number" ? loc.lng : Number(loc.lng || NaN);
    if (isNaN(lat) || isNaN(lng)) {
      return Response.json({ error: `Location "${loc.id}": lat and lng must be valid numbers` }, { status: 400 });
    }
    if (lat < -90 || lat > 90) {
      return Response.json({ error: `Location "${loc.id}": lat must be between -90 and 90` }, { status: 400 });
    }
    if (lng < -180 || lng > 180) {
      return Response.json({ error: `Location "${loc.id}": lng must be between -180 and 180` }, { status: 400 });
    }
    validLocations.push({ id: loc.id, lat, lng });
  }

  // Deduplicate by id — first occurrence wins. Duplicate ids from a single
  // request would cause last-write-wins on results[loc.id] and trigger
  // redundant Open-Meteo calls for the same coordinate.
  const seenIds = new Set<string>();
  const uniqueLocations = validLocations.filter(({ id }) => {
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const now = new Date();

  try {
    // Batch cache lookup — fetch all valid non-expired entries in one query
    const cachedRecords = await prisma.weatherCache.findMany({
      where: {
        OR: uniqueLocations.map(({ lat, lng }) => ({ lat, lng })),
        expiresAt: { gt: now },
      },
    });

    // Index cached results by "lat:lng" key for O(1) lookup
    const cacheMap = new Map<string, Prisma.JsonValue>(
      cachedRecords.map((r) => [`${r.lat}:${r.lng}`, r.forecastJson])
    );

    const results: Record<string, Prisma.InputJsonValue | null> = {};

    // Separate hits from misses
    const misses: Location[] = [];
    for (const loc of uniqueLocations) {
      const key = `${loc.lat}:${loc.lng}`;
      if (cacheMap.has(key)) {
        results[loc.id] = cacheMap.get(key)!;
      } else {
        misses.push(loc);
      }
    }

    if (misses.length > 0) {
      // Fetch Open-Meteo for all misses in parallel (bounded by CONCURRENCY)
      const fetched = await pLimit(
        misses.map((loc) => () => fetchOpenMeteo(loc.lat, loc.lng)),
        CONCURRENCY
      );

      // Attach all results (null for failed fetches)
      for (let i = 0; i < misses.length; i++) {
        results[misses[i].id] = fetched[i];
      }

      // Batch all successful fetches into a single transaction — avoids N concurrent
      // upserts that exhaust the DB connection pool under large miss counts.
      const cacheWrites = misses
        .map((loc, i) => ({ loc, forecastJson: fetched[i] }))
        .filter((item): item is { loc: Location; forecastJson: Prisma.InputJsonValue } =>
          item.forecastJson !== null
        );

      if (cacheWrites.length > 0) {
        const fetchedAt = new Date();
        const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
        try {
          await prisma.$transaction([
            prisma.weatherCache.deleteMany({
              where: { OR: cacheWrites.map(({ loc }) => ({ lat: loc.lat, lng: loc.lng })) },
            }),
            prisma.weatherCache.createMany({
              data: cacheWrites.map(({ loc, forecastJson }) => ({
                lat: loc.lat,
                lng: loc.lng,
                fetchedAt,
                expiresAt,
                forecastJson,
              })),
            }),
          ]);
        } catch (cacheErr) {
          console.error("[POST /api/weather/batch] Cache write failed", cacheErr);
        }
      }
    }

    return Response.json({ results });
  } catch (e) {
    console.error("[POST /api/weather/batch]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
