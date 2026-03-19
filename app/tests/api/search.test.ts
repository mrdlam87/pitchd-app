import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// vi.hoisted ensures mockCreate is available inside the vi.mock factory,
// which is hoisted before variable declarations by Vitest's transform.
const mockCreate = vi.hoisted(() => vi.fn());

// Mock Anthropic SDK — no real API calls in tests.
// Must use a class so `new Anthropic()` works at module initialisation time.
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
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

// Default mock Claude response — a valid parsedIntent with no amenities, 300km radius
const MOCK_CLAUDE_INTENT = { amenities: [], dateFrom: null, dateTo: null, radiusKm: 300 };
const MOCK_CLAUDE_RESPONSE = {
  content: [{ type: "text", text: JSON.stringify(MOCK_CLAUDE_INTENT) }],
};

function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase().trim()).digest("hex");
}

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

    const cachedIntent = { amenities: ["hiking"], dateFrom: null, dateTo: null, radiusKm: 200 };
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

  it("calls Claude again when cached entry is expired", async () => {
    const query = "expired cache test query";
    const hash = hashQuery(query);
    createdHashes.push(hash);

    // Pre-seed an expired cache entry
    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryText: query,
        parsedIntentJson: { amenities: [], dateFrom: null, dateTo: null, radiusKm: 300 },
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
        amenities: expect.any(Array),
        dateFrom: expect.toBeOneOf([expect.any(String), null]),
        dateTo: expect.toBeOneOf([expect.any(String), null]),
        radiusKm: expect.any(Number),
      },
    });
  });

  it("returns campsite with expected fields including distanceKm", async () => {
    const query = "quick camping trip";
    createdHashes.push(hashQuery(query));
    await prisma.searchCache.deleteMany({ where: { queryHash: hashQuery(query) } });
    const created = await seedCampsite();

    const res = await POST(makeRequest({ query, lat: SYDNEY_LAT, lng: SYDNEY_LNG }));
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

    // Override mockCreate for this test to return a 50km radius — covers both test campsites
    // but keeps the bounding box small enough that no real DB campsites appear.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ amenities: [], dateFrom: null, dateTo: null, radiusKm: 50 }) }],
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
});
