// Unit tests for lib/parseIntent — covers validation and sanitisation of ParsedIntent fields.
// parseIntentWithClaude itself calls the Anthropic API; that path is not unit-tested here.
// These tests cover the validation helpers and the sanitisation logic applied to Claude's output.
import { describe, it, expect } from "vitest";
import { isValidIsoDate, ALLOWED_AMENITIES, ALLOWED_POI_TYPES } from "@/lib/parseIntent";

describe("isValidIsoDate", () => {
  it("accepts a valid ISO date", () => {
    expect(isValidIsoDate("2026-04-01")).toBe(true);
  });

  it("rejects a calendar-invalid date (Feb 30)", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects free-text", () => {
    expect(isValidIsoDate("next weekend")).toBe(false);
  });

  it("rejects a datetime string", () => {
    expect(isValidIsoDate("2026-04-01T00:00:00Z")).toBe(false);
  });
});

describe("ALLOWED_AMENITIES", () => {
  it("contains the four expected keys", () => {
    expect(ALLOWED_AMENITIES).toEqual(
      expect.arrayContaining(["dog_friendly", "fishing", "hiking", "swimming"])
    );
    expect(ALLOWED_AMENITIES).toHaveLength(4);
  });
});

describe("ALLOWED_POI_TYPES", () => {
  it("contains the four expected POI type keys", () => {
    expect(ALLOWED_POI_TYPES).toEqual(
      expect.arrayContaining(["dump_point", "water_fill", "toilets", "laundromat"])
    );
    expect(ALLOWED_POI_TYPES).toHaveLength(4);
  });
});

describe("ParsedIntent — new fields shape", () => {
  // These tests import sanitiseParsedIntent and verify that new fields
  // are validated and defaulted correctly. The function is not exported today
  // (the logic lives inline in parseIntentWithClaude) — these tests will fail
  // until we extract and export it.
  it.todo("siteName: trims and returns string when present");
  it.todo("siteName: returns null when missing");
  it.todo("siteName: returns null for non-string");
  it.todo("resultType: passes 'campsites' through");
  it.todo("resultType: passes 'amenities' through");
  it.todo("resultType: returns null for unknown value");
  it.todo("resultType: defaults to null when missing");
  it.todo("poiTypes: filters to ALLOWED_POI_TYPES only");
  it.todo("poiTypes: returns null when missing");
  it.todo("amenityHints: accepts array of strings");
  it.todo("amenityHints: caps each hint at 100 chars");
  it.todo("amenityHints: caps array at 10 items");
  it.todo("amenityHints: returns empty array when missing");
});
