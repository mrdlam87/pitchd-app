import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ALLOWED_AMENITIES } from "@/lib/parseIntent";
import { hashQuery } from "@/lib/searchCache";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// vi.hoisted ensures mocks are available inside vi.mock factories,
// which are hoisted before variable declarations by Vitest's transform.
const mockCreate = vi.hoisted(() => vi.fn());
const mockFetchWeather = vi.hoisted(() => vi.fn());

// Mock Anthropic SDK — no real API calls in tests.
// Must use a class so `new Anthropic()` works at module initialisation time.
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
});

// Mock fetchWeatherForCandidates to avoid real Open-Meteo calls.
// combinedScore, extractForecastDays, etc. use the real implementations so
// ranking logic is exercised end-to-end.
vi.mock("@/lib/weatherRanking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weatherRanking")>();
  return { ...actual, fetchWeatherForCandidates: mockFetchWeather };
});

import { auth } from "@/auth";
import { POST } from "@/app/api/search/route";

// Cast to session-returning overload to avoid middleware overload conflict
const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

// Sydney CBD — a real-world coordinate that will match seeded campsites
const SYDNEY_LAT = -33.8688;
const SYDNEY_LNG = 151.2093;

// Default mock Claude response — a valid parsedIntent with no amenities, 3hr drive time
const MOCK_CLAUDE_INTENT = {
  location: null,
  driveTimeHrs: 3,
  amenities: [],
  startDate: null,
  endDate: null,
  sortBy: null,
};
const MOCK_CLAUDE_RESPONSE = {
  content: [{ type: "text", text: JSON.stringify(MOCK_CLAUDE_INTENT) }],
};

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Use a distinct source so afterEach cleanup does not collide with campsites.test.ts,
// which also uses source:"test" and runs in parallel.
const TEST_SOURCE = "test-search";

// Seed a campsite near Sydney for result-shape tests.
// Name prefixed with "!" so it sorts first alphabetically.
async function seedCampsite(overrides: Partial<{ lat: number; lng: number }> = {}) {
  return prisma.campsite.create({
    data: {
      name: "!Test Search Campsite",
      slug: `test-search-campsite-${Date.now()}-${Math.random()}`,
      lat: overrides.lat ?? -33.87,
      lng: overrides.lng ?? 151.21,
      state: "NSW",
      source: TEST_SOURCE,
      sourceId: `test-search-${Date.now()}-${Math.random()}`,
    },
  });
}

// Track created SearchCache hashes so they can be cleaned up in afterEach
const createdHashes: string[] = [];

describe("POST /api/search", () => {
  beforeEach(() => {
    // Default: authenticated session + Claude returns valid intent
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreate.mockResolvedValue(MOCK_CLAUDE_RESPONSE);
    // Default weather: null for all candidates (neutral score → proximity-only ranking)
    mockFetchWeather.mockImplementation(
      async (locations: { id: string }[]) =>
        new Map(locations.map((l) => [l.id, null])),
    );
  });

  afterEach(async () => {
    // Clean up seeded campsites — use TEST_SOURCE to avoid deleting records owned
    // by campsites.test.ts (which runs in parallel and also uses source:"test")
    const testCampsites = await prisma.campsite.findMany({
      where: { source: TEST_SOURCE },
      select: { id: true },
    });
    const ids = testCampsites.map((c) => c.id);
    if (ids.length > 0) {
      await prisma.campsiteAmenity.deleteMany({ where: { campsiteId: { in: ids } } });
    }
    await prisma.campsite.deleteMany({ where: { source: TEST_SOURCE } });

    // Clean up SearchCache entries created during tests
    if (createdHashes.length > 0) {
      await prisma.searchCache.deleteMany({
        where: { queryHash: { in: [...createdHashes] } },
      });
      createdHashes.length = 0;
    }

    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ query: "camping near Sydney", lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when query is missing", async () => {
    const res = await POST(makeRequest({ lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/query/i);
  });

  it("returns 400 when query is an empty string", async () => {
    const res = await POST(makeRequest({ query: "  ", lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/query/i);
  });

  it("returns 400 when query exceeds 500 characters", async () => {
    const res = await POST(makeRequest({ query: "a".repeat(501), lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too long/i);
  });

  it("returns 400 when lat is missing", async () => {
    const res = await POST(makeRequest({ query: "camping near Sydney", lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lat/i);
  });

  it("returns 400 when lat is an empty string", async () => {
    const res = await POST(makeRequest({ query: "camping near Sydney", lat: "", lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lat/i);
  });

  it("accepts lat: 0 and lng: 0 as valid coordinates (equator / prime meridian)", async () => {
    // Regression: previous || NaN fix treated 0 as falsy and incorrectly returned 400.
    // 0,0 is valid (equator/prime meridian) — should pass required-field validation.
    const query = "zero coordinate regression test";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    const res = await POST(makeRequest({ query, lat: 0, lng: 0 }));
    // 0,0 is in-range, so validation passes — returns 200 with empty campsites (no AU data there)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("campsites");
  });

  it("returns 400 when lng is missing", async () => {
    const res = await POST(makeRequest({ query: "camping near Sydney", lat: SYDNEY_LAT }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lng/i);
  });

  it("returns 400 when lat is out of range", async () => {
    const res = await POST(makeRequest({ query: "camping", lat: 9999, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of range/i);
  });

  it("returns 400 for lat = 90 (pole causes lngDelta → Infinity)", async () => {
    const res = await POST(makeRequest({ query: "camping", lat: 90, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of range/i);
  });

  it("returns 400 for lat = -90 (pole causes lngDelta → Infinity)", async () => {
    const res = await POST(makeRequest({ query: "camping", lat: -90, lng: SYDNEY_LNG }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of range/i);
  });

  it("returns 400 when lng is out of range", async () => {
    const res = await POST(makeRequest({ query: "camping", lat: SYDNEY_LAT, lng: 9999 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of range/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      })
    );
    expect(res.status).toBe(400);
  });

  // --- ALLOWED_AMENITIES sync guard ---

  it("every key in ALLOWED_AMENITIES exists as a seeded AmenityType", async () => {
    // ALLOWED_AMENITIES is a subset of all amenity types — only the ones that make sense
    // for NL search. This test catches typos and drift: if a key is removed or renamed in
    // prisma/seed.ts, this will fail. Adding new amenity types to the seed will NOT fail this
    // test — add new keys to ALLOWED_AMENITIES in lib/parseIntent.ts only if they should be AI-searchable.
    const seeded = await prisma.amenityType.findMany({ select: { key: true } });
    if (seeded.length === 0) return; // AmenityType not seeded (CI) — nothing to check against
    const seededKeys = seeded.map((a) => a.key);
    for (const key of ALLOWED_AMENITIES) {
      expect(seededKeys, `"${key}" in ALLOWED_AMENITIES not found in AmenityType seed`).toContain(key);
    }
  });

  // --- Claude failure ---

  it("returns 500 when Claude SDK rejects", async () => {
    const query = "claude failure test query";
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    mockCreate.mockRejectedValueOnce(new Error("Claude error"));

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(500);
    const body = await res.json();
    // Must not leak internal error details
    expect(body).toEqual({ error: "Internal server error" });
  });

  // --- Cache behaviour ---

  it("calls Claude on a cache miss", async () => {
    const query = "dog friendly camping near Sydney";
    createdHashes.push(hashQuery(query));
    // Ensure no stale cache entry exists
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // Second arg is the request options ({ timeout }) — use expect.anything() to allow it
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
      expect.objectContaining({ timeout: 10_000 })
    );
  });

  it("stores result in SearchCache with 2-hour TTL on cache miss", async () => {
    const query = "fishing camping trip";
    const hash = hashQuery(query);
    createdHashes.push(hash);
    await prisma.searchCache.deleteMany({ where: { queryHash: hash } });

    const before = new Date();
    await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));

    const cached = await prisma.searchCache.findUnique({ where: { queryHash: hash } });
    expect(cached).not.toBeNull();
    expect(cached!.queryText).toBe(query);
    // expiresAt should be ~2 hours from now (within a 5-second tolerance)
    const expectedExpiry = new Date(before.getTime() + 2 * 60 * 60 * 1000);
    const diff = Math.abs(cached!.expiresAt.getTime() - expectedExpiry.getTime());
    expect(diff).toBeLessThan(5000);
  });

  it("returns cached result and skips Claude on a cache hit", async () => {
    const query = "hiking near Blue Mountains";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    const cachedIntent = {
      location: "Blue Mountains",
      driveTimeHrs: 2,
      amenities: ["hiking"],
      startDate: null,
      endDate: null,
      sortBy: null,
    };
    // Pre-seed a fresh (non-expired) cache entry
    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: cachedIntent,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      },
      update: {
        parsedIntentJson: cachedIntent,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    // Claude must NOT be called when there is a valid cache hit
    expect(mockCreate).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.parsedIntent).toMatchObject(cachedIntent);
  });

  it("passes valid sortBy values through from cache", async () => {
    const query = "sortBy proximity cache test";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: { location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: "proximity" },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: {
        parsedIntentJson: { location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: "proximity" },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    expect((await res.json()).parsedIntent.sortBy).toBe("proximity");
  });

  it("coerces invalid sortBy values from cache to null", async () => {
    const query = "sortBy invalid cache test";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: { location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: "distance" },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: {
        parsedIntentJson: { location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: "distance" },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    expect((await res.json()).parsedIntent.sortBy).toBeNull();
  });

  it("caps driveTimeHrs from cache at 12 hours", async () => {
    const query = "drive time cap cache test";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    // Pre-seed a cache entry with an oversized drive time
    const oversizedIntent = {
      location: null,
      driveTimeHrs: 100,
      amenities: [],
      startDate: null,
      endDate: null,
      sortBy: null,
    };
    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: oversizedIntent,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: {
        parsedIntentJson: oversizedIntent,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // driveTimeHrs in response must be capped at 12, not the stored 100
    expect(body.parsedIntent.driveTimeHrs).toBe(12);
  });

  it("calls Claude again when cached entry is expired", async () => {
    const query = "expired cache test query";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    // Pre-seed an expired cache entry
    const expiredIntent = {
      location: null,
      driveTimeHrs: 3,
      amenities: [],
      startDate: null,
      endDate: null,
      sortBy: null,
    };
    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: expiredIntent,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      },
      update: {
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // --- Response shape ---

  it("returns correct response shape with campsites and parsedIntent", async () => {
    const query = "camping near Sydney this weekend";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });
    await seedCampsite();

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      campsites: expect.any(Array),
      parsedIntent: {
        location: expect.toBeOneOf([expect.any(String), null]),
        driveTimeHrs: expect.any(Number),
        amenities: expect.any(Array),
        startDate: expect.toBeOneOf([expect.any(String), null]),
        endDate: expect.toBeOneOf([expect.any(String), null]),
        sortBy: expect.toBeOneOf(["proximity", "relevance", null]),
      },
    });
  });

  it("returns campsite with expected fields including distanceKm", async () => {
    const query = "quick camping trip fields test";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    // Use Broken Hill — remote area with no real OSM campsites, so our seeded campsite
    // is guaranteed to be within the DB_FETCH_LIMIT take cap.
    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    const created = await seedCampsite({ lat: -31.96, lng: 141.48 });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null,
        driveTimeHrs: 1,
        amenities: [],
        startDate: null,
        endDate: null,
        sortBy: null,
      }) }],
    });

    const res = await POST(makeRequest({ query, lat: BASE_LAT, lng: BASE_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const campsite = body.campsites.find((c: { id: string }) => c.id === created.id);
    expect(campsite).toBeDefined();
    expect(campsite).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      lat: expect.any(Number),
      lng: expect.any(Number),
      amenities: expect.any(Array),
      distanceKm: expect.any(Number),
    });
  });

  it("ranks results by proximity — closest campsite first", async () => {
    const query = "proximity ranking test remote area";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    // Use Broken Hill (~-31.95, 141.47) — remote area with no seeded OSM campsites.
    // This ensures our two test campsites are the only results returned.
    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    const near = await seedCampsite({ lat: -31.96, lng: 141.48 }); // ~1.5km away
    const far = await seedCampsite({ lat: -32.10, lng: 141.60 });  // ~20km away

    // Override mockCreate for this test to return a 1hr drive time (~80km radius) —
    // covers both test campsites but keeps the bounding box small enough that no
    // real DB campsites appear.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null,
        driveTimeHrs: 1,
        amenities: [],
        startDate: null,
        endDate: null,
        sortBy: null,
      }) }],
    });

    const res = await POST(makeRequest({ query, lat: BASE_LAT, lng: BASE_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const ids = body.campsites.map((c: { id: string }) => c.id);
    const nearIdx = ids.indexOf(near.id);
    const farIdx = ids.indexOf(far.id);
    expect(nearIdx).not.toBe(-1);
    expect(farIdx).not.toBe(-1);
    expect(nearIdx).toBeLessThan(farIdx);
  });

  // --- Vague query handling ---

  it("handles vague queries — returns 200 with a valid parsedIntent shape", async () => {
    const query = "somewhere nice this weekend";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    // Claude returns defaults for vague queries
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null,
        driveTimeHrs: 3,
        amenities: [],
        startDate: "2026-03-21",
        endDate: "2026-03-22",
        sortBy: null,
      }) }],
    });

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Vague query should still return a valid parsedIntent with defaults
    expect(body.parsedIntent.driveTimeHrs).toBeGreaterThan(0);
    expect(body.parsedIntent.amenities).toEqual([]);
  });

  // --- Weather-aware ranking ---

  // Use AEST dates to match extractForecastDays' Intl.DateTimeFormat default window.
  // toISOString() returns UTC and diverges from AEST for the first 8–11 h of each day.
  const aestDate = (offsetDays = 0) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
      new Date(Date.now() + offsetDays * 86_400_000),
    );

  // Forecast helpers — two days matching today + tomorrow (the default window)
  function makeForecast(weatherCode: number, precipSum: number) {
    const today = aestDate(0);
    const tomorrow = aestDate(1);
    return {
      daily: {
        time: [today, tomorrow],
        temperature_2m_max: [25, 24],
        temperature_2m_min: [15, 14],
        precipitation_sum: [precipSum, precipSum],
        precipitation_probability_max: [5, 5],
        weathercode: [weatherCode, weatherCode],
      },
    };
  }

  const GREAT_FORECAST = makeForecast(0, 0);      // clear sky, no rain → score 100
  const TERRIBLE_FORECAST = makeForecast(95, 20); // thunderstorm + heavy rain

  it("ranks a farther campsite with great weather above a closer one with terrible weather", async () => {
    const query = "weather ranking test remote area";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    // Broken Hill — remote, no real OSM campsites to contaminate ranking.
    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    // near: ~20km away with terrible weather
    const near = await seedCampsite({ lat: -32.13, lng: BASE_LNG });
    // far: ~25.5km away with great weather
    const far = await seedCampsite({ lat: -32.18, lng: BASE_LNG });

    // Configure weather mock: near → terrible, far → great
    mockFetchWeather.mockImplementationOnce(
      async (locations: { id: string; lat: number }[]) => {
        const map = new Map<string, unknown>();
        for (const loc of locations) {
          if (loc.id === near.id) map.set(loc.id, TERRIBLE_FORECAST);
          else if (loc.id === far.id) map.set(loc.id, GREAT_FORECAST);
          else map.set(loc.id, null);
        }
        return map;
      },
    );

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null, driveTimeHrs: 1, amenities: [],
        startDate: null, endDate: null, sortBy: null,
      }) }],
    });

    const res = await POST(makeRequest({ query, lat: BASE_LAT, lng: BASE_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const ids = body.campsites.map((c: { id: string }) => c.id);
    const nearIdx = ids.indexOf(near.id);
    const farIdx = ids.indexOf(far.id);

    expect(nearIdx).not.toBe(-1);
    expect(farIdx).not.toBe(-1);
    // Despite being farther, the great-weather campsite should rank higher
    expect(farIdx).toBeLessThan(nearIdx);
  });

  it("when weather is unavailable (null), campsite still appears with neutral score", async () => {
    const query = "weather unavailable fallback test";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    const campsite = await seedCampsite({ lat: -32.00, lng: BASE_LNG });

    // Default mock already returns null for all — just confirm campsite is in results
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null, driveTimeHrs: 1, amenities: [],
        startDate: null, endDate: null, sortBy: null,
      }) }],
    });

    const res = await POST(makeRequest({ query, lat: BASE_LAT, lng: BASE_LNG }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const found = body.campsites.find((c: { id: string }) => c.id === campsite.id);
    expect(found).toBeDefined();
  });

  it("body startDate/endDate override parsedIntent dates for weather scoring", async () => {
    const query = "date override weather test";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    // Claude returns dates in parsedIntent, but body supplies different dates
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null, driveTimeHrs: 1, amenities: [],
        startDate: "2099-01-01",  // far-future date — no forecast days would match
        endDate: "2099-01-02",
        sortBy: null,
      }) }],
    });

    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    const campsite = await seedCampsite({ lat: -32.00, lng: BASE_LNG });

    // Body supplies today + tomorrow in AEST — forecast days WILL match
    const today = aestDate(0);
    const tomorrow = aestDate(1);

    mockFetchWeather.mockImplementationOnce(
      async (locations: { id: string }[]) =>
        new Map(locations.map((l) => [l.id, GREAT_FORECAST])),
    );
    // Spy on combinedScore by verifying the result: with today/tomorrow + great weather
    // the campsite should appear. We can't easily spy on the internal date param,
    // but we verify the end-to-end result returns the campsite (i.e. it didn't crash
    // on the future parsedIntent date override).
    const capturedDates = { startDate: today, endDate: tomorrow };

    const res = await POST(makeRequest({
      query,
      lat: BASE_LAT,
      lng: BASE_LNG,
      startDate: capturedDates.startDate,
      endDate: capturedDates.endDate,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.campsites.find((c: { id: string }) => c.id === campsite.id);
    expect(found).toBeDefined();
    // body dates were used for scoring — great forecast should produce non-null weather
    expect(found.weather).not.toBeNull();
    // parsedIntent still reflects AI-parsed dates (not overridden in response)
    expect(body.parsedIntent.startDate).toBe("2099-01-01");
  });

  it("ignores invalid body startDate and falls back to parsedIntent dates", async () => {
    const query = "invalid date body test";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });

    const BASE_LAT = -31.95;
    const BASE_LNG = 141.47;
    await seedCampsite({ lat: -32.00, lng: BASE_LNG });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        location: null, driveTimeHrs: 1, amenities: [],
        startDate: null, endDate: null, sortBy: null,
      }) }],
    });

    // Supplying a non-ISO string should be silently ignored (no 400)
    const res = await POST(makeRequest({
      query,
      lat: BASE_LAT,
      lng: BASE_LNG,
      startDate: "not-a-date",
      endDate: "also-bad",
    }));
    expect(res.status).toBe(200);
  });
});
