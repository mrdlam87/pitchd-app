import type { Campsite, WeatherDay } from "@/types/map";
import { DAY_NAMES } from "@/types/map";
import { WEATHER_MAX_LOCATIONS } from "@/lib/weatherConstants";

const WEATHER_BATCH_SIZE = WEATHER_MAX_LOCATIONS;

const MAX_FORECAST_DAYS = 4;

function extractWeatherForecast(
  forecast: unknown,
  startDate?: string | null,
  endDate?: string | null,
): WeatherDay[] | null {
  if (typeof forecast !== "object" || forecast === null) return null;
  const f = forecast as Record<string, unknown>;
  if (typeof f.daily !== "object" || f.daily === null) return null;
  const d = f.daily as Record<string, unknown>;
  if (!Array.isArray(d.temperature_2m_max) || !Array.isArray(d.temperature_2m_min)) return null;
  if (!Array.isArray(d.precipitation_sum) || !Array.isArray(d.weathercode)) return null;
  if (!Array.isArray(d.time)) return null;

  const probArr = Array.isArray(d.precipitation_probability_max)
    ? (d.precipitation_probability_max as unknown[])
    : null;

  const days: WeatherDay[] = [];
  for (let i = 0; i < (d.time as unknown[]).length; i++) {
    const dateStr = d.time[i];
    if (typeof dateStr !== "string") continue;

    if (startDate && endDate) {
      if (dateStr < startDate || dateStr > endDate) continue;
    } else if (startDate) {
      if (dateStr < startDate) continue;
      if (days.length >= MAX_FORECAST_DAYS) break;
    } else if (days.length >= MAX_FORECAST_DAYS) {
      break;
    }

    const tempMax = d.temperature_2m_max[i];
    const tempMin = d.temperature_2m_min[i];
    const precipitationSum = d.precipitation_sum[i];
    const weatherCode = d.weathercode[i];
    if (typeof tempMax !== "number" || typeof tempMin !== "number") continue;
    if (typeof precipitationSum !== "number" || typeof weatherCode !== "number") continue;
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
  return days.length > 0 ? days : null;
}

async function fetchChunk(
  campsites: Campsite[],
  startDate?: string | null,
  endDate?: string | null,
): Promise<Campsite[]> {
  const locations = campsites.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));
  try {
    const res = await fetch("/api/weather/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    if (!res.ok) {
      console.warn(`[fetchWeatherBatch] ${res.status} ${res.statusText}`);
      return campsites.map((c) => ({ ...c, weather: null }));
    }
    const data = (await res.json()) as { results: Record<string, unknown> };
    return campsites.map((c) => ({
      ...c,
      weather: extractWeatherForecast(data.results[c.id], startDate, endDate) ?? null,
    }));
  } catch (e) {
    console.warn("[fetchWeatherBatch] fetch failed", e);
    return campsites.map((c) => ({ ...c, weather: null }));
  }
}

// Fetches weather for a batch of campsites from /api/weather/batch.
// Splits into chunks of WEATHER_BATCH_SIZE to stay within the server limit.
// startDate/endDate filter the displayed days to the search date window (when supplied).
// Never throws; errors are logged and each campsite gets weather: null.
export async function fetchWeatherBatch(
  campsites: Campsite[],
  startDate?: string | null,
  endDate?: string | null,
): Promise<Campsite[]> {
  if (campsites.length === 0) return campsites;

  const chunks: Campsite[][] = [];
  for (let i = 0; i < campsites.length; i += WEATHER_BATCH_SIZE) {
    chunks.push(campsites.slice(i, i + WEATHER_BATCH_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => fetchChunk(chunk, startDate, endDate))
  );
  return chunkResults.flat();
}
