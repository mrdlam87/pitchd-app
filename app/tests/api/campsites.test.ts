import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/campsites/route";

const mockAuth = vi.mocked(auth);

// Sydney coords used across tests
const SYDNEY = { lat: -33.8688, lng: 151.2093, radius: 50 };

function makeRequest(params: Record<string, string | string[]>) {
  const url = new URL("http://localhost/api/campsites");
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url);
}

// Seed a minimal campsite within the Sydney bounding box
async function seedCampsite(overrides: Partial<{ lat: number; lng: number; syncStatus: string }> = {}) {
  return prisma.campsite.create({
    data: {
      name: "Test Campsite",
      slug: `test-campsite-${Date.now()}-${Math.random()}`,
      lat: overrides.lat ?? -33.87,
      lng: overrides.lng ?? 151.21,
      state: "NSW",
      source: "test",
      sourceId: `test-${Date.now()}-${Math.random()}`,
      syncStatus: (overrides.syncStatus as "active" | "removed") ?? "active",
    },
  });
}

describe("GET /api/campsites", () => {
  beforeEach(() => {
    // Default: authenticated session
    mockAuth.mockResolvedValue({ user: { id: "test-user", email: "test@example.com" } } as never);
  });

  afterEach(async () => {
    await prisma.campsite.deleteMany({ where: { source: "test" } });
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when lat is missing", async () => {
    const res = await GET(makeRequest({ lng: "151.2", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is missing", async () => {
    const res = await GET(makeRequest({ lat: "-33.8", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when radius is missing", async () => {
    const res = await GET(makeRequest({ lat: "-33.8", lng: "151.2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial string lat (e.g. 123abc)", async () => {
    const res = await GET(makeRequest({ lat: "123abc", lng: "151.2", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lat out of range", async () => {
    const res = await GET(makeRequest({ lat: "999", lng: "151.2", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lng out of range", async () => {
    const res = await GET(makeRequest({ lat: "-33.8", lng: "999", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for radius of 0", async () => {
    const res = await GET(makeRequest({ lat: "-33.8", lng: "151.2", radius: "0" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for radius over MAX_RADIUS_KM (250)", async () => {
    const res = await GET(makeRequest({ lat: "-33.8", lng: "151.2", radius: "500" }));
    expect(res.status).toBe(400);
  });

  // --- Response shape ---

  it("returns correct response shape", async () => {
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      results: expect.any(Array),
      page: 1,
      pageSize: 20,
      hasMore: expect.any(Boolean),
    });
  });

  it("returns campsite with expected fields", async () => {
    await seedCampsite();
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    const campsite = body.results[0];
    expect(campsite).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      lat: expect.any(Number),
      lng: expect.any(Number),
      amenities: expect.any(Array),
    });
    // state should not be present in response
    expect(campsite.state).toBeUndefined();
  });

  it("excludes campsites with syncStatus removed", async () => {
    await seedCampsite({ syncStatus: "removed" });
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.results.map((c: { name: string }) => c.name);
    expect(names).not.toContain("Test Campsite");
  });

  // --- Amenity filter ---

  it("ignores empty amenity filter values (?amenities=)", async () => {
    await seedCampsite();
    const url = new URL("http://localhost/api/campsites");
    url.searchParams.set("lat", String(SYDNEY.lat));
    url.searchParams.set("lng", String(SYDNEY.lng));
    url.searchParams.set("radius", String(SYDNEY.radius));
    url.searchParams.set("amenities", ""); // empty value
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Empty amenity filter should not restrict results
    expect(body.results.length).toBeGreaterThan(0);
  });

  // --- Pagination ---

  it("respects page param", async () => {
    const res = await GET(makeRequest({ ...SYDNEY, page: "2" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
  });

  it("treats non-numeric page as page 1", async () => {
    const res = await GET(makeRequest({ ...SYDNEY, page: "abc" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
  });
});
