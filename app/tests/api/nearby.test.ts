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

// Remote outback origin with no production campsites — avoids interference from real DB data.
// Origin: (-29.0, 135.0) — central Australia.
// Close: ~10 km NW, Mid: ~55 km NW, Far: ~220 km away (outside 100 km radius).
const TEST_ORIGIN = { lat: "-29.0", lng: "135.0" };

beforeEach(async () => {
  mockAuth.mockResolvedValue(AUTHED_SESSION);
  await prisma.campsite.createMany({
    data: [
      // ~10 km from TEST_ORIGIN
      { name: "!Nearby Close", slug: "!nearby-close-test", lat: -28.91, lng: 134.91, state: "SA", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: true },
      // ~55 km from TEST_ORIGIN
      { name: "!Nearby Mid", slug: "!nearby-mid-test", lat: -28.52, lng: 134.52, state: "SA", source: TEST_SOURCE, syncStatus: SyncStatus.active, isFree: false },
      // ~220 km from TEST_ORIGIN — outside 100 km radius
      { name: "!Nearby Far", slug: "!nearby-far-test", lat: -27.0, lng: 133.0, state: "SA", source: TEST_SOURCE, syncStatus: SyncStatus.active },
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
    const res = await GET(makeRequest(TEST_ORIGIN));
    expect(res.status).toBe(200);
    const body = await res.json() as { campsites: Array<{ name: string }> };
    const names = body.campsites.map((c) => c.name);
    expect(names).toContain("!Nearby Close");
    expect(names).toContain("!Nearby Mid");
    expect(names).not.toContain("!Nearby Far");
  });

  it("returns campsites sorted nearest-first", async () => {
    // Use !Nearby Close's exact coordinates as origin — distance 0, guaranteed first
    const res = await GET(makeRequest({ lat: "-28.91", lng: "134.91" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites[0].name).toBe("!Nearby Close");
  });

  it("filters to isFree=true when free=true param provided", async () => {
    const res = await GET(makeRequest({ ...TEST_ORIGIN, free: "true" }));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites).toHaveLength(1);
    expect(body.campsites[0].name).toBe("!Nearby Close");
  });

  it("does not return inactive campsites", async () => {
    await prisma.campsite.create({
      data: { name: "!Nearby Removed", slug: "!nearby-removed-test", lat: -28.91, lng: 134.91, state: "SA", source: TEST_SOURCE, syncStatus: SyncStatus.removed },
    });
    const res = await GET(makeRequest(TEST_ORIGIN));
    const body = await res.json() as { campsites: Array<{ name: string }> };
    expect(body.campsites.find((c) => c.name === "!Nearby Removed")).toBeUndefined();
  });

  it("returns hasMore: false when results are under the limit", async () => {
    const res = await GET(makeRequest(TEST_ORIGIN));
    const body = await res.json() as { campsites: unknown[]; hasMore: boolean };
    expect(body.hasMore).toBe(false);
  });
});
