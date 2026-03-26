// Weather-aware ranking utilities for POST /api/search.
// Handles fetching weather for a set of campsite candidates (cache-first),
// extracting the relevant forecast days, and computing a combined score.

import { prisma } from "@/lib/prisma";
import { weatherScore } from "@/lib/weatherScore";
import { DAY_NAMES } from "@/types/map";
import type { WeatherDay } from "@/types/map";
import type { Prisma } from "@/lib/generated/prisma/client";

// Raw JSON value read from the DB or Open-Meteo — treated as opaque by the scoring layer.
type ForecastJson = Prisma.JsonValue | null;

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// Per-request Open-Meteo timeout
const FETCH_TIMEOUT_MS = 5_000;
// Total time budget for the weather enrichment step — if exceeded, we use
// whatever has been fetched so far and fall back to neutral for the rest.
const WEATHER_STEP_TIMEOUT_MS = 8_000;
// Maximum concurrent Open-Meteo requests
const CONCURRENCY = 10;

// Weight for the combined score: proximity 60%, weather 40%.
// Proximity remains the dominant signal so results don't feel
// radically different from the current proximity-only ranking.
const PROXIMITY_WEIGHT = 0.6;
const WEATHER_WEIGHT = 0.4;

// Neutral weather score used as a fallback when forecast data is unavailable.
// 50 represents "unknown" — neither penalised nor boosted.
const NEUTRAL_WEATHER_SCORE = 50;

// ─── Open-Meteo parsing ──────────────────────────────────────────────────────

/**
 * Parses an Open-Meteo forecast JSON blob into an array of WeatherDay objects.
 * Optionally filters to days within [startDate, endDate] (inclusive, ISO strings).
 * Falls back to today + tomorrow when no date range is supplied — a narrow
 * 2-day window used for ranking when no trip dates are known. This intentionally
 * differs from the client-side extractWeatherForecast (Map.tsx) which defaults
 * to MAX_FORECAST_DAYS (4) for browse-mode card display.
 * Returns an empty array if the shape is unexpected.
 */
export function extractForecastDays(
  forecastJson: unknown,
  startDate: string | null,
  endDate: string | null,
): WeatherDay[] {
  if (typeof forecastJson !== "object" || forecastJson === null) return [];
  const f = forecastJson as Record<string, unknown>;
  if (typeof f.daily !== "object" || f.daily === null) return [];
  const d = f.daily as Record<string, unknown>;
  if (
    !Array.isArray(d.time) ||
    !Array.isArray(d.temperature_2m_max) ||
    !Array.isArray(d.temperature_2m_min) ||
    !Array.isArray(d.precipitation_sum) ||
    !Array.isArray(d.weathercode)
  ) return [];

  const probArr = Array.isArray(d.precipitation_probability_max)
    ? (d.precipitation_probability_max as unknown[])
    : null;

  // Default window: today + tomorrow (matching half-drawer card display)
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  const from = startDate ?? today;
  const to = endDate ?? tomorrow;

  const days: WeatherDay[] = [];
  for (let i = 0; i < (d.time as unknown[]).length; i++) {
    const dateStr = d.time[i];
    if (typeof dateStr !== "string") continue;
    if (dateStr < from || dateStr > to) continue;

    const tempMax = d.temperature_2m_max[i];
    const tempMin = d.temperature_2m_min[i];
    const precipitationSum = d.precipitation_sum[i];
    const weatherCode = d.weathercode[i];
    if (
      typeof tempMax !== "number" ||
      typeof tempMin !== "number" ||
      typeof precipitationSum !== "number" ||
      typeof weatherCode !== "number"
    ) continue;

    const dow = new Date(dateStr + "T00:00:00").getDay();
    const precipProbRaw = probArr?.[i];
    days.push({
      date: dateStr,
      dayName: DAY_NAMES[dow],
      tempMax,
      tempMin,
      precipitationSum,
      precipProbability: typeof precipProbRaw === "number" ? precipProbRaw : null,
      weatherCode,
    });
  }
  return days;
}

// ─── Proximity score ─────────────────────────────────────────────────────────

/**
 * Converts a Haversine distance into a 0–100 score relative to the search radius.
 * A campsite at the centre gets 100; one at the radius boundary gets ~0.
 * Clamped to [0, 100] — campsites outside the radius don't appear in results.
 */
export function proximityScore(distanceKm: number, radiusKm: number): number {
  if (radiusKm <= 0) return 100;
  return Math.max(0, Math.min(100, 100 - (distanceKm / radiusKm) * 100));
}

// ─── Combined score ──────────────────────────────────────────────────────────

/**
 * Combines proximity and weather into a single 0–100 ranking score.
 * Higher is better. Campsites without weather data get NEUTRAL_WEATHER_SCORE (50).
 */
export function combinedScore(
  distanceKm: number,
  radiusKm: number,
  forecast: unknown,
  startDate: string | null,
  endDate: string | null,
): number {
  const prox = proximityScore(distanceKm, radiusKm);
  const days = extractForecastDays(forecast, startDate, endDate);
  const weather = days.length > 0 ? weatherScore(days) : NEUTRAL_WEATHER_SCORE;
  return PROXIMITY_WEIGHT * prox + WEATHER_WEIGHT * weather;
}

// ─── Batch weather fetch ─────────────────────────────────────────────────────

type Location = { id: string; lat: number; lng: number };

async function fetchOneOpenMeteo(lat: number, lng: number): Promise<Prisma.JsonValue | null> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "16");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      console.error("[weatherRanking] Open-Meteo error", res.status, lat, lng);
      return null;
    }
    return (await res.json()) as Prisma.JsonValue;
  } catch (err) {
    console.error("[weatherRanking] Open-Meteo fetch failed", lat, lng, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
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

/**
 * Fetches weather for a set of locations.
 * Checks WeatherCache first; fetches from Open-Meteo for misses.
 * The entire step is bounded by WEATHER_STEP_TIMEOUT_MS — if it times out,
 * whatever has been fetched is returned (uncached sites get null → neutral score).
 * Never throws.
 *
 * Returns a Map<id, forecastJson | null>.
 */
export async function fetchWeatherForCandidates(
  locations: Location[],
): Promise<Map<string, ForecastJson>> {
  const resultMap = new Map<string, ForecastJson>(
    locations.map((l) => [l.id, null]),
  );

  if (locations.length === 0) return resultMap;

  const now = new Date();

  // Step 1: Batch cache lookup
  let cachedRecords: { lat: number; lng: number; forecastJson: ForecastJson }[] = [];
  try {
    cachedRecords = await prisma.weatherCache.findMany({
      where: {
        OR: locations.map(({ lat, lng }) => ({ lat, lng })),
        expiresAt: { gt: now },
      },
      select: { lat: true, lng: true, forecastJson: true },
    });
  } catch (err) {
    console.error("[weatherRanking] Cache lookup failed", err);
    // Proceed with all as misses
  }

  const cacheMap = new Map<string, ForecastJson>(
    cachedRecords.map((r) => [`${r.lat}:${r.lng}`, r.forecastJson]),
  );

  const misses: Location[] = [];
  for (const loc of locations) {
    const key = `${loc.lat}:${loc.lng}`;
    if (cacheMap.has(key)) {
      resultMap.set(loc.id, cacheMap.get(key)!);
    } else {
      misses.push(loc);
    }
  }

  if (misses.length === 0) return resultMap;

  // Step 2: Fetch Open-Meteo for misses, bounded by total timeout
  const fetchTask = (async () => {
    const fetched = await pLimit(
      misses.map((loc) => () => fetchOneOpenMeteo(loc.lat, loc.lng)),
      CONCURRENCY,
    );

    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);

    await Promise.all(
      misses.map(async (loc, i) => {
        const forecastJson = fetched[i];
        resultMap.set(loc.id, forecastJson);
        if (forecastJson !== null) {
          try {
            await prisma.weatherCache.upsert({
              where: { lat_lng: { lat: loc.lat, lng: loc.lng } },
              update: { fetchedAt, expiresAt, forecastJson },
              create: { lat: loc.lat, lng: loc.lng, fetchedAt, expiresAt, forecastJson },
            });
          } catch (cacheErr) {
            console.error("[weatherRanking] Cache write failed", loc.lat, loc.lng, cacheErr);
          }
        }
      }),
    );
  })();

  const timeoutPromise = new Promise<void>((resolve) =>
    setTimeout(resolve, WEATHER_STEP_TIMEOUT_MS),
  );

  // Race: if the fetch step finishes first, great. If the timeout fires,
  // we return whatever has been populated in resultMap so far.
  // fetchTask may continue running after we return — any remaining resultMap.set()
  // calls are harmless (caller already has a snapshot copy), and the Prisma upserts
  // are intentional fire-and-forget cache warming for subsequent requests.
  // NOTE: on serverless platforms (e.g. Vercel), execution is frozen once the
  // response is sent, so any Prisma upserts still in flight when the timeout
  // fires will be silently dropped. This is acceptable — they'll be re-fetched
  // on the next cache miss — but means cache warming is best-effort only.
  await Promise.race([fetchTask, timeoutPromise]);

  // Return a snapshot so background fetchTask mutations don't affect the caller.
  return new Map(resultMap);
}
