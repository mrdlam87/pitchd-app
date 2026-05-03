// Unit tests for lib/searchCache — covers getCachedIntent sanitisation paths.
// These tests seed SearchCache rows directly and call getCachedIntent to assert
// that tampered, stale, or pre-migration entries are handled correctly.
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCachedIntent, hashQuery } from "@/lib/searchCache";
import { DEFAULT_DRIVE_TIME_HRS, MAX_DRIVE_TIME_HRS } from "@/lib/parseIntent";

// Shared TTL helpers
const FUTURE = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
const PAST = new Date(Date.now() - 1000); // expired 1 second ago

const TEST_HASH_PREFIX = "searchcache-unit-test-";

// Hashes seeded during tests — cleaned up in afterEach
const seededHashes: string[] = [];

async function seedEntry(
  hashSuffix: string,
  parsedIntentJson: unknown,
  expiresAt: Date
): Promise<string> {
  const queryHash = hashQuery(`${TEST_HASH_PREFIX}${hashSuffix}`);
  seededHashes.push(queryHash);
  await prisma.searchCache.upsert({
    where: { queryHash },
    create: { queryHash, queryText: `${TEST_HASH_PREFIX}${hashSuffix}`, parsedIntentJson: parsedIntentJson as never, expiresAt },
    update: { parsedIntentJson: parsedIntentJson as never, expiresAt },
  });
  return queryHash;
}

describe("getCachedIntent", () => {
  afterEach(async () => {
    if (seededHashes.length > 0) {
      await prisma.searchCache.deleteMany({ where: { queryHash: { in: [...seededHashes] } } });
      seededHashes.length = 0;
    }
  });

  // --- Miss cases ---

  it("returns null when no entry exists", async () => {
    const result = await getCachedIntent(hashQuery("nonexistent-query-xyz-abc-123"));
    expect(result).toBeNull();
  });

  it("returns null when entry is expired", async () => {
    const queryHash = await seedEntry("expired", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, PAST);
    const result = await getCachedIntent(queryHash);
    expect(result).toBeNull();
  });

  it("returns null when expiresAt is exactly now (boundary is a miss)", async () => {
    // expiresAt <= new Date() is a miss — exact equality is treated as expired
    const queryHash = await seedEntry("boundary", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, new Date(Date.now() - 1)); // 1ms in the past to reliably hit the <= boundary
    const result = await getCachedIntent(queryHash);
    expect(result).toBeNull();
  });

  // --- Happy path ---

  it("returns sanitised ParsedIntent on a valid unexpired entry", async () => {
    const intent = {
      location: "Blue Mountains",
      driveTimeHrs: 2,
      amenities: ["hiking"],
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      sortBy: "proximity",
    };
    const queryHash = await seedEntry("valid", intent, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result).toMatchObject(intent);
  });

  // --- driveTimeHrs sanitisation ---

  it("falls back to DEFAULT_DRIVE_TIME_HRS when driveTimeHrs is 0", async () => {
    const queryHash = await seedEntry("drivetime-zero", {
      location: null, driveTimeHrs: 0, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.driveTimeHrs).toBe(DEFAULT_DRIVE_TIME_HRS);
  });

  it("falls back to DEFAULT_DRIVE_TIME_HRS when driveTimeHrs is 0.5 (sub-1)", async () => {
    const queryHash = await seedEntry("drivetime-sub1", {
      location: null, driveTimeHrs: 0.5, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.driveTimeHrs).toBe(DEFAULT_DRIVE_TIME_HRS);
  });

  it("falls back to DEFAULT_DRIVE_TIME_HRS when driveTimeHrs is a string", async () => {
    const queryHash = await seedEntry("drivetime-string", {
      location: null, driveTimeHrs: "fast", amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.driveTimeHrs).toBe(DEFAULT_DRIVE_TIME_HRS);
  });

  it("caps driveTimeHrs at MAX_DRIVE_TIME_HRS", async () => {
    const queryHash = await seedEntry("drivetime-over", {
      location: null, driveTimeHrs: 100, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.driveTimeHrs).toBe(MAX_DRIVE_TIME_HRS);
  });

  // --- amenities sanitisation ---

  it("filters out amenities not in ALLOWED_AMENITIES", async () => {
    const queryHash = await seedEntry("amenities-bad", {
      location: null, driveTimeHrs: 3, amenities: ["hiking", "surfing", "skydiving"], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenities).toEqual(["hiking"]);
  });

  it("returns empty array when amenities is not an array", async () => {
    const queryHash = await seedEntry("amenities-non-array", {
      location: null, driveTimeHrs: 3, amenities: "hiking", startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenities).toEqual([]);
  });

  // --- date sanitisation ---

  it("rejects a non-ISO startDate", async () => {
    const queryHash = await seedEntry("date-bad", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: "next weekend", endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.startDate).toBeNull();
  });

  it("rejects a calendar-invalid ISO date (e.g. Feb 30)", async () => {
    const queryHash = await seedEntry("date-invalid-cal", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: "2026-02-30", endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.startDate).toBeNull();
  });

  // --- location sanitisation ---

  it("returns null for location when it is an empty string", async () => {
    const queryHash = await seedEntry("location-empty", {
      location: "  ", driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.location).toBeNull();
  });

  it("returns null for location when it is not a string", async () => {
    const queryHash = await seedEntry("location-number", {
      location: 42, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.location).toBeNull();
  });

  // --- sortBy sanitisation ---

  it("coerces an invalid sortBy to null", async () => {
    const queryHash = await seedEntry("sortby-bad", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: "distance",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.sortBy).toBeNull();
  });

  it("passes valid sortBy values through unchanged", async () => {
    for (const sortBy of ["proximity", "relevance"] as const) {
      const queryHash = await seedEntry(`sortby-${sortBy}`, {
        location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy,
      }, FUTURE);
      const result = await getCachedIntent(queryHash);
      expect(result!.sortBy).toBe(sortBy);
    }
  });

  // --- new field defaults for pre-migration entries ---

  it("defaults siteName to null when missing from a pre-migration entry", async () => {
    const queryHash = await seedEntry("premig-sitename", {
      location: "Blue Mountains", driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      // siteName intentionally absent
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.siteName).toBeNull();
  });

  it("returns siteName when present and trims whitespace", async () => {
    const queryHash = await seedEntry("sitename-trim", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      siteName: "  Lane Cove campground  ",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.siteName).toBe("Lane Cove campground");
  });

  it("defaults siteName to null when it is not a string", async () => {
    const queryHash = await seedEntry("sitename-number", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      siteName: 42,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.siteName).toBeNull();
  });

  it("defaults resultType to null when missing from a pre-migration entry", async () => {
    const queryHash = await seedEntry("premig-resulttype", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.resultType).toBeNull();
  });

  it("passes resultType 'amenities' through unchanged", async () => {
    const queryHash = await seedEntry("resulttype-amenities", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      resultType: "amenities",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.resultType).toBe("amenities");
  });

  it("passes resultType 'campsites' through unchanged", async () => {
    const queryHash = await seedEntry("resulttype-campsites", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      resultType: "campsites",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.resultType).toBe("campsites");
  });

  it("coerces an unknown resultType to null", async () => {
    const queryHash = await seedEntry("resulttype-bad", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      resultType: "pois",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.resultType).toBeNull();
  });

  it("defaults poiTypes to null when missing from a pre-migration entry", async () => {
    const queryHash = await seedEntry("premig-poitypes", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.poiTypes).toBeNull();
  });

  it("filters poiTypes to ALLOWED_POI_TYPES only", async () => {
    const queryHash = await seedEntry("poitypes-filter", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      poiTypes: ["dump_point", "laundromat", "petrol_station"],
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.poiTypes).toEqual(["dump_point", "laundromat"]);
  });

  it("defaults poiTypes to null when it is not an array", async () => {
    const queryHash = await seedEntry("poitypes-non-array", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      poiTypes: "dump_point",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.poiTypes).toBeNull();
  });

  it("defaults poiTypes to empty array when resultType is 'amenities' but poiTypes is missing", async () => {
    const queryHash = await seedEntry("premig-amenities-no-poitypes", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      resultType: "amenities",
      // poiTypes intentionally absent
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.poiTypes).toEqual([]);
  });

  it("defaults amenityHints to empty array when missing from a pre-migration entry", async () => {
    const queryHash = await seedEntry("premig-amenityhints", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenityHints).toEqual([]);
  });

  it("passes amenityHints string array through", async () => {
    const queryHash = await seedEntry("amenityhints-valid", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      amenityHints: ["firepit", "flush toilets", "river views"],
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenityHints).toEqual(["firepit", "flush toilets", "river views"]);
  });

  it("filters out non-string amenityHints entries", async () => {
    const queryHash = await seedEntry("amenityhints-mixed", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      amenityHints: ["firepit", 42, null, "river views"],
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenityHints).toEqual(["firepit", "river views"]);
  });

  it("defaults amenityHints to empty array when it is not an array", async () => {
    const queryHash = await seedEntry("amenityhints-non-array", {
      location: null, driveTimeHrs: 3, amenities: [], startDate: null, endDate: null, sortBy: null,
      amenityHints: "firepit",
    }, FUTURE);
    const result = await getCachedIntent(queryHash);
    expect(result!.amenityHints).toEqual([]);
  });
});
