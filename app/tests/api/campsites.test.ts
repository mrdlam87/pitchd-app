import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/campsites/route";

// Cast to the session-returning overload — avoids TypeScript picking up the middleware overload
const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

// Sydney bounding box — ~50 km around (-33.8688, 151.2093)
const SYDNEY = { north: "-33.42", south: "-34.32", east: "151.75", west: "150.67" };

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

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

// Seed a minimal campsite within the Sydney bounding box.
// Name prefixed with "!" so it sorts before all real campsite names (alphabetically first).
async function seedCampsite(overrides: Partial<{ lat: number; lng: number; syncStatus: string }> = {}) {
  return prisma.campsite.create({
    data: {
      name: "!Test Campsite",
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
    mockAuth.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(async () => {
    // CampsiteAmenity has ON DELETE RESTRICT — must be deleted before campsites
    const testCampsites = await prisma.campsite.findMany({
      where: { source: "test" },
      select: { id: true },
    });
    const ids = testCampsites.map((c) => c.id);
    if (ids.length > 0) {
      await prisma.campsiteAmenity.deleteMany({ where: { campsiteId: { in: ids } } });
    }
    await prisma.campsite.deleteMany({ where: { source: "test" } });
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when north is missing", async () => {
    const res = await GET(makeRequest({ south: "-34.32", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when south is missing", async () => {
    const res = await GET(makeRequest({ north: "-33.42", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when east is missing", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-34.32", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when west is missing", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-34.32", east: "151.75" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial string north (e.g. 123abc)", async () => {
    const res = await GET(makeRequest({ north: "123abc", south: "-34.32", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for north out of range", async () => {
    const res = await GET(makeRequest({ north: "999", south: "-34.32", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for south out of range", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-999", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for east out of range", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-34.32", east: "999", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for west out of range", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-34.32", east: "151.75", west: "-999" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bounding box is too large", async () => {
    // lat span > MAX_LAT_SPAN (10°)
    const res = await GET(makeRequest({ north: "0", south: "-11", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when south >= north", async () => {
    const res = await GET(makeRequest({ north: "-34.32", south: "-33.42", east: "151.75", west: "150.67" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when west >= east", async () => {
    const res = await GET(makeRequest({ north: "-33.42", south: "-34.32", east: "150.67", west: "151.75" }));
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
      pageSize: 200,
      hasMore: expect.any(Boolean),
    });
  });

  it("returns campsite with expected fields", async () => {
    const created = await seedCampsite();
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.results.map((c: { id: string }) => c.id);
    expect(ids).toContain(created.id);
    const campsite = body.results.find((c: { id: string }) => c.id === created.id);
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
    const created = await seedCampsite({ syncStatus: "removed" });
    const res = await GET(makeRequest(SYDNEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.results.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(created.id);
  });

  // --- Amenity filter ---

  it("ignores empty amenity filter values (?amenities=)", async () => {
    const created = await seedCampsite();
    const res = await GET(makeRequest({ ...SYDNEY, amenities: "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Empty amenity filter should not restrict results — seeded campsite must still appear
    const ids = body.results.map((c: { id: string }) => c.id);
    expect(ids).toContain(created.id);
  });

  // These three tests require AmenityType rows populated by `npm run db:seed`.
  // The beforeAll uses findUnique (not findUniqueOrThrow) so a missing seed produces
  // a clear skip warning rather than a NotFoundError with no obvious cause.
  describe("with seeded AmenityType data", () => {
    let dogTypeId: string | null = null;
    let fishTypeId: string | null = null;

    beforeAll(async () => {
      const [dog, fish] = await Promise.all([
        prisma.amenityType.findUnique({ where: { key: "dog_friendly" } }),
        prisma.amenityType.findUnique({ where: { key: "fishing" } }),
      ]);
      dogTypeId = dog?.id ?? null;
      fishTypeId = fish?.id ?? null;
      if (!dogTypeId || !fishTypeId) {
        console.warn(
          "[campsites.test] AmenityType seed rows not found — skipping amenity filter tests. " +
          "Run `npm run db:seed`."
        );
      }
    });

    it("returns campsite that has the requested amenity", async (ctx) => {
      if (!dogTypeId) { ctx.skip(); return; }
      const created = await seedCampsite();
      await prisma.campsiteAmenity.create({
        data: { campsiteId: created.id, amenityTypeId: dogTypeId },
      });
      const res = await GET(makeRequest({ ...SYDNEY, amenities: "dog_friendly" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.results.map((c: { id: string }) => c.id);
      expect(ids).toContain(created.id);
    });

    it("excludes campsite that does not have the requested amenity", async (ctx) => {
      if (!dogTypeId) { ctx.skip(); return; }
      const created = await seedCampsite(); // no amenities linked
      const res = await GET(makeRequest({ ...SYDNEY, amenities: "dog_friendly" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.results.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(created.id);
    });

    it("returns campsite matching any one of multiple amenity filters (OR logic)", async (ctx) => {
      if (!dogTypeId || !fishTypeId) { ctx.skip(); return; }
      // dogCampsite has dog_friendly only; fishCampsite has fishing only; plain has neither
      const [dogCampsite, fishCampsite, plainCampsite] = await Promise.all([
        seedCampsite({ lat: -33.87, lng: 151.21 }),
        seedCampsite({ lat: -33.88, lng: 151.22 }),
        seedCampsite({ lat: -33.89, lng: 151.23 }),
      ]);
      await Promise.all([
        prisma.campsiteAmenity.create({ data: { campsiteId: dogCampsite.id, amenityTypeId: dogTypeId } }),
        prisma.campsiteAmenity.create({ data: { campsiteId: fishCampsite.id, amenityTypeId: fishTypeId } }),
      ]);
      const res = await GET(makeRequest({ ...SYDNEY, amenities: ["dog_friendly", "fishing"] }));
      expect(res.status).toBe(200);
      const body = await res.json();
      const ids = body.results.map((c: { id: string }) => c.id);
      expect(ids).toContain(dogCampsite.id);
      expect(ids).toContain(fishCampsite.id);
      expect(ids).not.toContain(plainCampsite.id);
    });
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
