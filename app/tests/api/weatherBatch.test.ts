import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { POST } from "@/app/api/weather/batch/route";

const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

const MOCK_FORECAST = {
  daily: {
    time: ["2026-03-23"],
    temperature_2m_max: [22.5],
    temperature_2m_min: [15.1],
    precipitation_sum: [0.0],
    weathercode: [1],
  },
};

// Test coordinates — deliberately distinct from weather.test.ts (SYDNEY_LAT/LNG = -33.8688, 151.2093)
// to avoid cache record collisions when test files run in parallel.
const LOC_A = { id: "camp-a", lat: -37.8136, lng: 144.9631 }; // Melbourne
const LOC_B = { id: "camp-b", lat: -27.4698, lng: 153.0251 }; // Brisbane
const LOC_C = { id: "camp-c", lat: -34.9285, lng: 138.6007 }; // Adelaide

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/weather/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cleanupCache(...coords: { lat: number; lng: number }[]) {
  for (const { lat, lng } of coords) {
    await prisma.weatherCache.deleteMany({ where: { lat, lng } });
  }
}

describe("POST /api/weather/batch", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_FORECAST),
        text: () => Promise.resolve(""),
      })
    );
  });

  afterEach(async () => {
    await cleanupCache(LOC_A, LOC_B, LOC_C);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ locations: [LOC_A] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when body is missing locations", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when locations is not an array", async () => {
    const res = await POST(makeRequest({ locations: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a location is missing id", async () => {
    const res = await POST(makeRequest({ locations: [{ lat: -33.8, lng: 151.2 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a location has non-numeric lat", async () => {
    const res = await POST(makeRequest({ locations: [{ id: "x", lat: "bad", lng: 151.2 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a location has lat out of range (> 90)", async () => {
    const res = await POST(makeRequest({ locations: [{ id: "x", lat: 91, lng: 0 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a location has lat out of range (< -90)", async () => {
    const res = await POST(makeRequest({ locations: [{ id: "x", lat: -91, lng: 0 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a location has lng out of range (> 180)", async () => {
    const res = await POST(makeRequest({ locations: [{ id: "x", lat: 0, lng: 181 }] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when locations exceeds the maximum (> 100)", async () => {
    const locations = Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, lat: -30, lng: 150 }));
    const res = await POST(makeRequest({ locations }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/weather/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // --- Empty locations ---

  it("returns 200 with empty results for an empty locations array", async () => {
    const res = await POST(makeRequest({ locations: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: {} });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // --- Cache miss (fresh fetch) ---

  it("fetches from Open-Meteo on cache miss and returns forecastJson keyed by id", async () => {
    const res = await POST(makeRequest({ locations: [LOC_A] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("stores forecast in WeatherCache after a cache miss", async () => {
    await POST(makeRequest({ locations: [LOC_A] }));
    const record = await prisma.weatherCache.findUnique({
      where: { lat_lng: { lat: LOC_A.lat, lng: LOC_A.lng } },
    });
    expect(record).not.toBeNull();
    expect(record!.forecastJson).toEqual(MOCK_FORECAST);
    const ttlMs = record!.expiresAt.getTime() - record!.fetchedAt.getTime();
    expect(ttlMs).toBeCloseTo(60 * 60 * 1000, -3); // within ~1 second of 1 hour
  });

  it("fetches weather for multiple locations in one request", async () => {
    const res = await POST(makeRequest({ locations: [LOC_A, LOC_B] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(body.results[LOC_B.id]).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  // --- Cache hit ---

  it("returns cached forecast without calling Open-Meteo", async () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + 60 * 60 * 1000);
    await prisma.weatherCache.create({
      data: { lat: LOC_A.lat, lng: LOC_A.lng, fetchedAt, expiresAt, forecastJson: MOCK_FORECAST },
    });

    const res = await POST(makeRequest({ locations: [LOC_A] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // --- Mixed: one cache hit, one miss ---

  it("returns cache hit for one location and fetches Open-Meteo for the miss", async () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + 60 * 60 * 1000);
    await prisma.weatherCache.create({
      data: { lat: LOC_A.lat, lng: LOC_A.lng, fetchedAt, expiresAt, forecastJson: MOCK_FORECAST },
    });

    const res = await POST(makeRequest({ locations: [LOC_A, LOC_B] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(body.results[LOC_B.id]).toEqual(MOCK_FORECAST);
    // Only LOC_B should have triggered an Open-Meteo call
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  // --- Expired cache ---

  it("re-fetches from Open-Meteo when cache record is expired", async () => {
    const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000); // expired
    await prisma.weatherCache.create({
      data: { lat: LOC_A.lat, lng: LOC_A.lng, fetchedAt, expiresAt, forecastJson: { stale: true } },
    });

    const res = await POST(makeRequest({ locations: [LOC_A] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  // --- Deduplication ---

  it("deduplicates by id — first occurrence wins, only one Open-Meteo call made", async () => {
    // Same id as LOC_A but different coordinates — should be ignored
    const dupLoc = { id: LOC_A.id, lat: LOC_B.lat, lng: LOC_B.lng };
    const res = await POST(makeRequest({ locations: [LOC_A, dupLoc] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  // --- Partial failure ---

  it("returns null for a failed location but succeeds for others", async () => {
    // First call (LOC_A) fails, second call (LOC_B) succeeds
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("error") })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_FORECAST), text: () => Promise.resolve("") })
    );

    const res = await POST(makeRequest({ locations: [LOC_A, LOC_B] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[LOC_A.id]).toBeNull();
    expect(body.results[LOC_B.id]).toEqual(MOCK_FORECAST);
  });

  // --- Batch cache writes ---

  it("writes all cache misses in a single batch instead of individual upserts", async () => {
    // N concurrent upserts exhaust the DB connection pool — the fix must not call upsert at all.
    const upsertSpy = vi.spyOn(prisma.weatherCache, "upsert");

    const res = await POST(makeRequest({ locations: [LOC_A, LOC_B, LOC_C] }));
    expect(res.status).toBe(200);

    expect(upsertSpy).not.toHaveBeenCalled();

    // All three locations must still be persisted to the cache
    const [recA, recB, recC] = await Promise.all([
      prisma.weatherCache.findUnique({ where: { lat_lng: { lat: LOC_A.lat, lng: LOC_A.lng } } }),
      prisma.weatherCache.findUnique({ where: { lat_lng: { lat: LOC_B.lat, lng: LOC_B.lng } } }),
      prisma.weatherCache.findUnique({ where: { lat_lng: { lat: LOC_C.lat, lng: LOC_C.lng } } }),
    ]);
    expect(recA?.forecastJson).toEqual(MOCK_FORECAST);
    expect(recB?.forecastJson).toEqual(MOCK_FORECAST);
    expect(recC?.forecastJson).toEqual(MOCK_FORECAST);
  });
});
