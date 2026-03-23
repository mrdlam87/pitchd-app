// GET /api/weather
// Returns weather forecast for a given lat/lng.
// Checks WeatherCache (TTL: 1 hour) before fetching from Open-Meteo.
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);

  // Number() is stricter than parseFloat() — rejects partial strings like "123abc".
  // || NaN handles null/empty-string since Number(null) and Number("") both return 0.
  const lat = Number(searchParams.get("lat") || NaN);
  const lng = Number(searchParams.get("lng") || NaN);

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90) {
    return Response.json(
      { error: "lat must be between -90 and 90" },
      { status: 400 }
    );
  }

  if (lng < -180 || lng > 180) {
    return Response.json(
      { error: "lng must be between -180 and 180" },
      { status: 400 }
    );
  }

  const now = new Date();

  try {
    // Cache lookup — @@unique([lat, lng]) ensures at most one record per coordinate
    const cached = await prisma.weatherCache.findUnique({
      where: { lat_lng: { lat, lng } },
    });

    if (cached && cached.expiresAt > now) {
      return Response.json({ forecastJson: cached.forecastJson });
    }

    // Cache miss or expired — fetch from Open-Meteo (no API key required)
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode"
    );
    url.searchParams.set("timezone", "auto");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let forecastJson: any;
    try {
      const fetchRes = await fetch(url.toString());
      if (!fetchRes.ok) {
        console.error(
          "[GET /api/weather] Open-Meteo error",
          fetchRes.status,
          await fetchRes.text()
        );
        return Response.json(
          { error: "Failed to fetch weather data" },
          { status: 502 }
        );
      }
      forecastJson = await fetchRes.json();
    } catch (fetchErr) {
      console.error("[GET /api/weather] Open-Meteo fetch failed", fetchErr);
      return Response.json(
        { error: "Failed to fetch weather data" },
        { status: 502 }
      );
    }

    // Upsert into cache — write failures are logged but don't block the response
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
    try {
      await prisma.weatherCache.upsert({
        where: { lat_lng: { lat, lng } },
        update: { fetchedAt, expiresAt, forecastJson },
        create: { lat, lng, fetchedAt, expiresAt, forecastJson },
      });
    } catch (cacheErr) {
      console.error("[GET /api/weather] Cache write failed", cacheErr);
    }

    return Response.json({ forecastJson });
  } catch (e) {
    console.error("[GET /api/weather]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
