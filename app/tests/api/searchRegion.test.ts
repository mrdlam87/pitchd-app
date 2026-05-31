import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole, SyncStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/search/region/route";

const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

const TEST_SOURCE = "test-region-search";

function makeRequest(params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  return new Request(`http://localhost/api/search/region?${sp}`);
}

beforeEach(async () => {
  mockAuth.mockResolvedValue(AUTHED_SESSION);
  await prisma.campsite.createMany({
    data: [
      { name: "!Region Site A", slug: "!region-site-a-test", lat: -33.7, lng: 150.3, state: "NSW", region: "!Test Region", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: true },
      { name: "!Region Site B", slug: "!region-site-b-test", lat: -33.9, lng: 150.5, state: "NSW", region: "!Test Region", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: false },
      { name: "!Region Site C", slug: "!region-site-c-test", lat: -33.8, lng: 150.4, state: "NSW", region: "!Test Region", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: null },
    ],
  });
});

afterEach(async () => {
  await prisma.campsite.deleteMany({ where: { source: TEST_SOURCE } });
});

describe("GET /api/search/region", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest({ name: "!Test Region" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns all matching campsites for a region", async () => {
    const res = await GET(makeRequest({ name: "!Test Region" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites).toHaveLength(3);
  });

  it("returns empty array for unknown region", async () => {
    const res = await GET(makeRequest({ name: "xyznotexist" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { campsites: unknown[] };
    expect(body.campsites).toHaveLength(0);
  });

  it("proximity-sorts when lat/lng provided", async () => {
    // Site C is at lat -33.8 lng 150.4 — closest to the search origin
    const res = await GET(makeRequest({ name: "!Test Region", lat: "-33.8", lng: "150.4" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites[0].name).toBe("!Region Site C");
  });

  it("filters to isFree=true when free=true param provided", async () => {
    const res = await GET(makeRequest({ name: "!Test Region", free: "true" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    // Only Site A has isFree=true; Site B (false) and Site C (null) are excluded
    expect(body.campsites).toHaveLength(1);
    expect(body.campsites[0].name).toBe("!Region Site A");
  });

  it("does not return inactive campsites", async () => {
    await prisma.campsite.create({
      data: { name: "!Region Removed", slug: "!region-removed-test", lat: -33.7, lng: 150.3, state: "NSW", region: "!Test Region", source: TEST_SOURCE, syncStatus: SyncStatus.removed },
    });
    const res = await GET(makeRequest({ name: "!Test Region" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites.find((c) => c.name === "!Region Removed")).toBeUndefined();
  });
});
