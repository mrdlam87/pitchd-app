import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole, SyncStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/search/nearby/route";

const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

const TEST_SOURCE = "test-nearby";

function makeRequest(params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  return new Request(`http://localhost/api/search/nearby?${sp}`);
}

beforeEach(async () => {
  mockAuth.mockResolvedValue(AUTHED_SESSION);
  await prisma.campsite.createMany({
    data: [
      // ~10 km from origin (-33.8688, 151.2093)
      { name: "!Nearby Close", slug: "!nearby-close-test", lat: -33.78, lng: 151.18, state: "NSW", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: true },
      // ~50 km from origin
      { name: "!Nearby Mid", slug: "!nearby-mid-test", lat: -34.28, lng: 151.0, state: "NSW", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: false },
      // ~200 km from origin — outside 100 km radius
      { name: "!Nearby Far", slug: "!nearby-far-test", lat: -35.5, lng: 150.0, state: "NSW", source: TEST_SOURCE, syncStatus: SyncStatus.active },
    ],
  });
});

afterEach(async () => {
  await prisma.campsite.deleteMany({ where: { source: TEST_SOURCE } });
});

describe("GET /api/search/nearby", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when lat or lng is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lat or lng is not a valid number", async () => {
    const res = await GET(makeRequest({ lat: "abc", lng: "151.2" }));
    expect(res.status).toBe(400);
  });

  it("returns campsites within 100 km and excludes those beyond", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { campsites: Array<{ name: string }> };
    const names = body.campsites.map((c) => c.name);
    expect(names).toContain("!Nearby Close");
    expect(names).toContain("!Nearby Mid");
    expect(names).not.toContain("!Nearby Far");
  });

  it("returns campsites sorted nearest-first", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites[0].name).toBe("!Nearby Close");
  });

  it("filters to isFree=true when free=true param provided", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093", free: "true" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites).toHaveLength(1);
    expect(body.campsites[0].name).toBe("!Nearby Close");
  });

  it("does not return inactive campsites", async () => {
    await prisma.campsite.create({
      data: { name: "!Nearby Removed", slug: "!nearby-removed-test", lat: -33.78, lng: 151.18, state: "NSW", source: TEST_SOURCE, syncStatus: SyncStatus.removed },
    });
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites.find((c) => c.name === "!Nearby Removed")).toBeUndefined();
  });

  it("returns hasMore: false when results are under the limit", async () => {
    const res = await GET(makeRequest({ lat: "-33.8688", lng: "151.2093" }));
    const body = await res.json() as { campsites: unknown[]; hasMore: boolean };
    expect(body.hasMore).toBe(false);
  });
});
