import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/weather/route";

// Cast to the session-returning overload — avoids TypeScript picking up the middleware overload
const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

// Sydney CBD coordinates used across tests
const SYDNEY_LAT = -33.8688;
const SYDNEY_LNG = 151.2093;

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

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/weather");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

// Clean up WeatherCache records created during tests.
// Note: all tests use SYDNEY_LAT/SYDNEY_LNG — if new tests add different coordinates,
// extend this cleanup or add a separate afterEach for those coordinates.
async function cleanupCache(lat: number, lng: number) {
  await prisma.weatherCache.deleteMany({ where: { lat, lng } });
}

describe("GET /api/weather", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // Stub fetch to return mock Open-Meteo response by default
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
    await cleanupCache(SYDNEY_LAT, SYDNEY_LNG);
    await cleanupCache(0, 0);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when lat is missing", async () => {
    const res = await GET(makeRequest({ lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is missing", async () => {
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial string lat (e.g. 123abc)", async () => {
    const res = await GET(makeRequest({ lat: "123abc", lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial string lng (e.g. 123abc)", async () => {
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: "123abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is out of range (> 90)", async () => {
    const res = await GET(makeRequest({ lat: "91", lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat is out of range (< -90)", async () => {
    const res = await GET(makeRequest({ lat: "-91", lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is out of range (> 180)", async () => {
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: "181" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is out of range (< -180)", async () => {
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: "-181" }));
    expect(res.status).toBe(400);
  });

  // --- Cache miss (fresh fetch) ---

  it("fetches from Open-Meteo on cache miss and returns forecastJson", async () => {
    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("forecastJson");
    expect(body.forecastJson).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("stores forecast in WeatherCache after a cache miss", async () => {
    await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    const record = await prisma.weatherCache.findUnique({
      where: { lat_lng: { lat: SYDNEY_LAT, lng: SYDNEY_LNG } },
    });
    expect(record).not.toBeNull();
    expect(record!.forecastJson).toEqual(MOCK_FORECAST);
    // expiresAt should be approximately 1 hour from now
    const ttlMs = record!.expiresAt.getTime() - record!.fetchedAt.getTime();
    expect(ttlMs).toBeCloseTo(60 * 60 * 1000, -3); // within ~1 second
  });

  // --- Cache hit ---

  it("returns cached forecastJson without calling Open-Meteo", async () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + 60 * 60 * 1000);
    await prisma.weatherCache.create({
      data: { lat: SYDNEY_LAT, lng: SYDNEY_LNG, fetchedAt, expiresAt, forecastJson: MOCK_FORECAST },
    });

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forecastJson).toEqual(MOCK_FORECAST);
    // Open-Meteo must NOT be called on a cache hit
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // --- Expired cache ---

  it("re-fetches from Open-Meteo when cache record is expired", async () => {
    const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000); // expired 1 hour ago
    await prisma.weatherCache.create({
      data: { lat: SYDNEY_LAT, lng: SYDNEY_LNG, fetchedAt, expiresAt, forecastJson: { stale: true } },
    });

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forecastJson).toEqual(MOCK_FORECAST);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  // --- Open-Meteo error ---

  it("returns 502 when Open-Meteo responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })
    );

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Open-Meteo fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Open-Meteo fetch times out (AbortError)", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(502);
  });

  // --- Cache write failure ---

  it("returns 200 with forecastJson even when cache write fails", async () => {
    vi.spyOn(prisma.weatherCache, "upsert").mockRejectedValueOnce(new Error("DB error"));

    const res = await GET(makeRequest({ lat: String(SYDNEY_LAT), lng: String(SYDNEY_LNG) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forecastJson).toEqual(MOCK_FORECAST);
  });

  // --- Edge case: equator coordinates (lat=0, lng=0) ---
  // Guards against accidental regression in the `|| NaN` pattern — "0" is truthy so Number("0") = 0, not NaN

  it("accepts lat=0 and lng=0 (equator/prime meridian)", async () => {
    const res = await GET(makeRequest({ lat: "0", lng: "0" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forecastJson).toEqual(MOCK_FORECAST);
  });
});
