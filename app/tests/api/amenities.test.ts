import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Mock auth — real OAuth not needed for integration tests
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/amenities/route";

// Cast to the session-returning overload — avoids TypeScript picking up the middleware overload
const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

// Sydney CBD — used as the base coordinate for all tests
const BASE = { lat: "-33.8688", lng: "151.2093", radius: "50" };

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/amenities");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

// Requires AmenityType rows from `npm run db:seed`.
// Uses findUnique (not findUniqueOrThrow) so a missing seed gives a clear skip warning.
describe("GET /api/amenities", () => {
  let dumpPointTypeId: string | null = null;
  let dumpPointTypeKey: string | null = null;

  beforeAll(async () => {
    // Prefer dump_point as the test type — it's a POI category, not a campsite amenity
    const amenityType = await prisma.amenityType.findUnique({
      where: { key: "dump_point" },
    });
    dumpPointTypeId = amenityType?.id ?? null;
    dumpPointTypeKey = amenityType?.key ?? null;
    if (!dumpPointTypeId) {
      console.warn(
        "[amenities.test] AmenityType 'dump_point' seed row not found — some tests will be skipped. " +
        "Run `npm run db:seed`."
      );
    }
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
  });

  afterEach(async () => {
    await prisma.amenityPOI.deleteMany({ where: { source: "test" } });
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest({ ...BASE, type: "dump_point" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  // --- Input validation ---

  it("returns 400 when lat is missing", async () => {
    const res = await GET(makeRequest({ lng: "151.2093", radius: "50", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lng is missing", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", radius: "50", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when radius is missing", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is missing", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", radius: "50" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial string lat (e.g. 123abc)", async () => {
    const res = await GET(makeRequest({ lat: "123abc", lng: "151.2093", radius: "50", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lat out of range", async () => {
    const res = await GET(makeRequest({ lat: "999", lng: "151.2093", radius: "50", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lng out of range", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "999", radius: "50", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for radius of 0", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", radius: "0", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative radius", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", radius: "-10", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for radius exceeding maximum", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", radius: "501", type: "dump_point" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown type key", async () => {
    const res = await GET(makeRequest({ ...BASE, type: "nonexistent_type_xyz" }));
    expect(res.status).toBe(400);
  });

  // --- Response shape ---

  it("returns correct response shape with results array and truncated flag", async (ctx) => {
    if (!dumpPointTypeKey) { ctx.skip(); return; }
    const res = await GET(makeRequest({ ...BASE, type: dumpPointTypeKey }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      results: expect.any(Array),
      truncated: expect.any(Boolean),
    });
  });

  // --- Results ---

  it("returns POI within radius with correct fields", async (ctx) => {
    if (!dumpPointTypeId || !dumpPointTypeKey) { ctx.skip(); return; }

    const poi = await prisma.amenityPOI.create({
      data: {
        name: "!Test Dump Point",
        lat: -33.87,   // ~0.1 km from Sydney CBD — well within 50 km radius
        lng: 151.21,
        amenityTypeId: dumpPointTypeId,
        source: "test",
        sourceId: `test-${Date.now()}`,
      },
    });

    const res = await GET(makeRequest({ ...BASE, type: dumpPointTypeKey }));
    expect(res.status).toBe(200);
    const { results } = await res.json();

    const found = results.find((p: { id: string }) => p.id === poi.id);
    expect(found).toBeDefined();
    // name is String? in schema — can be null for unnamed POIs
    expect(found.id).toEqual(expect.any(String));
    expect(found.name === null || typeof found.name === "string").toBe(true);
    expect(found.lat).toEqual(expect.any(Number));
    expect(found.lng).toEqual(expect.any(Number));
    expect(found.amenityType).toEqual({ key: dumpPointTypeKey });
    // amenityTypeId (opaque UUID) is not included — amenityType.key makes it redundant
    expect(found.amenityTypeId).toBeUndefined();
  });

  it("excludes POI outside the radius", async (ctx) => {
    if (!dumpPointTypeId || !dumpPointTypeKey) { ctx.skip(); return; }

    // ~600 km north of Sydney — outside 50 km radius
    const poi = await prisma.amenityPOI.create({
      data: {
        name: "!Test Dump Point Far",
        lat: -28.5,
        lng: 151.2,
        amenityTypeId: dumpPointTypeId,
        source: "test",
        sourceId: `test-far-${Date.now()}`,
      },
    });

    const res = await GET(makeRequest({ ...BASE, type: dumpPointTypeKey }));
    expect(res.status).toBe(200);
    const { results } = await res.json();
    const ids = results.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(poi.id);
  });

  it("only returns POIs matching the requested type", async (ctx) => {
    if (!dumpPointTypeId || !dumpPointTypeKey) { ctx.skip(); return; }

    // Seed a POI of a different type — should not appear in results for dumpPointTypeKey
    const otherType = await prisma.amenityType.findFirst({
      where: { key: { not: dumpPointTypeKey } },
    });
    if (!otherType) { ctx.skip(); return; }

    const otherPoi = await prisma.amenityPOI.create({
      data: {
        name: "!Test Other POI",
        lat: -33.87,
        lng: 151.21,
        amenityTypeId: otherType.id,
        source: "test",
        sourceId: `test-other-${Date.now()}`,
      },
    });

    const res = await GET(makeRequest({ ...BASE, type: dumpPointTypeKey }));
    expect(res.status).toBe(200);
    const { results } = await res.json();
    const ids = results.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(otherPoi.id);
  });
});
