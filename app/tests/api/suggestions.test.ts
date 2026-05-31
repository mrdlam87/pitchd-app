import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { UserRole, SyncStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { GET } from "@/app/api/search/suggestions/route";

const mockAuth = vi.mocked(auth as () => Promise<Session | null>);

const AUTHED_SESSION: Session = {
  user: { id: "test-user", email: "test@example.com", name: "Test User", role: UserRole.user },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

const TEST_SOURCE = "test-suggestions";

function makeRequest(q: string) {
  return new Request(`http://localhost/api/search/suggestions?q=${encodeURIComponent(q)}`);
}

beforeEach(async () => {
  mockAuth.mockResolvedValue(AUTHED_SESSION);
  await prisma.campsite.createMany({
    data: [
      { name: "!Blue Mountains Campsite", slug: "!blue-mountains-campsite-test", lat: -33.7, lng: 150.3, state: "NSW", region: "Blue Mountains", source: TEST_SOURCE, syncStatus: SyncStatus.active },
      { name: "!Bluewater Lake Campsite", slug: "!bluewater-lake-campsite-test", lat: -36.4, lng: 148.3, state: "NSW", region: "Snowy Mountains", source: TEST_SOURCE, syncStatus: SyncStatus.active },
      { name: "!Red Rock Campsite", slug: "!red-rock-campsite-test", lat: -30.0, lng: 153.2, state: "NSW", region: "Coffs Harbour", source: TEST_SOURCE, syncStatus: SyncStatus.active },
    ],
  });
});

afterEach(async () => {
  await prisma.campsite.deleteMany({ where: { source: TEST_SOURCE } });
});

describe("GET /api/search/suggestions", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("blue"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty suggestions when query is shorter than 2 chars", async () => {
    const res = await GET(makeRequest("b"));
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestions: unknown[] };
    expect(data.suggestions).toEqual([]);
  });

  it("returns empty suggestions for no match", async () => {
    const res = await GET(makeRequest("xyznotexist"));
    expect(res.status).toBe(200);
    const body = await res.json() as { suggestions: unknown[] };
    expect(body.suggestions).toHaveLength(0);
  });

  it("returns matching campsites and regions as flat list", async () => {
    const res = await GET(makeRequest("blue"));
    expect(res.status).toBe(200);
    const body = await res.json() as { suggestions: Array<{ kind: string; name: string }> };
    expect(body.suggestions.length).toBeGreaterThan(0);
    const kinds = body.suggestions.map((s) => s.kind);
    expect(kinds).toContain("campsite");
    expect(kinds).toContain("region");
  });

  it("regions include count and state", async () => {
    const res = await GET(makeRequest("blue"));
    const body = await res.json() as { suggestions: Array<{ kind: string; count?: number; state?: string }> };
    const region = body.suggestions.find((s) => s.kind === "region");
    expect(region?.count).toBeGreaterThanOrEqual(1);
    expect(typeof region?.state).toBe("string");
  });

  it("does not return inactive campsites", async () => {
    await prisma.campsite.create({
      data: { name: "!BlueRemoved", slug: "!blue-removed-test", lat: -33.0, lng: 151.0, state: "NSW", source: TEST_SOURCE, syncStatus: SyncStatus.removed },
    });
    const res = await GET(makeRequest("BlueRemoved"));
    const body = await res.json() as { suggestions: Array<{ name: string }> };
    expect(body.suggestions.find((s) => s.name === "!BlueRemoved")).toBeUndefined();
  });
});
