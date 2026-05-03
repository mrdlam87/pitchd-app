// Unit tests for lib/searchResults — covers parseSearchResultsPayload validation.
// This is a security-adjacent boundary: user-controlled sessionStorage data flows
// through this function into filter state and API query params.
import { describe, it, expect } from "vitest";
import { parseSearchResultsPayload } from "@/lib/searchResults";

// Minimal valid DirectFilterPayload
const validDirect = {
  kind: "direct",
  chipKey: "dog",
  filters: { activities: ["dog_friendly"], pois: [] },
};

// Minimal valid AISearchPayload
const validAI = {
  kind: "ai",
  campsites: [{ lat: -33.8, lng: 151.2, id: "1", name: "Test", state: "NSW" }],
  parsedIntent: { amenities: [] },
  query: "camping near sydney",
};

describe("parseSearchResultsPayload — DirectFilterPayload", () => {
  it("accepts a valid direct payload", () => {
    const result = parseSearchResultsPayload(validDirect);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("direct");
  });

  it("accepts empty activities and pois arrays", () => {
    const result = parseSearchResultsPayload({
      ...validDirect,
      filters: { activities: [], pois: [] },
    });
    expect(result).not.toBeNull();
  });

  it("accepts pois with string elements", () => {
    const result = parseSearchResultsPayload({
      ...validDirect,
      filters: { activities: [], pois: ["dump_point", "water_fill"] },
    });
    expect(result).not.toBeNull();
  });

  it("returns null when kind is missing", () => {
    const { kind: _kind, ...withoutKind } = validDirect;
    // Falls through to the AI path (no kind !== "direct"). DirectFilterPayload
    // has no campsites field, so the AI path returns null immediately.
    expect(parseSearchResultsPayload(withoutKind)).toBeNull();
  });

  it("returns null when chipKey is missing", () => {
    const { chipKey: _chipKey, ...payload } = validDirect;
    expect(parseSearchResultsPayload(payload)).toBeNull();
  });

  it("returns null when chipKey is not a string", () => {
    expect(parseSearchResultsPayload({ ...validDirect, chipKey: 42 })).toBeNull();
  });

  it("returns null when filters is missing", () => {
    const { filters: _filters, ...payload } = validDirect;
    expect(parseSearchResultsPayload(payload)).toBeNull();
  });

  it("returns null when filters is null", () => {
    expect(parseSearchResultsPayload({ ...validDirect, filters: null })).toBeNull();
  });

  it("returns null when activities is missing", () => {
    expect(
      parseSearchResultsPayload({ ...validDirect, filters: { pois: [] } })
    ).toBeNull();
  });

  it("returns null when activities contains a non-string element", () => {
    expect(
      parseSearchResultsPayload({
        ...validDirect,
        filters: { activities: ["dog_friendly", 99], pois: [] },
      })
    ).toBeNull();
  });

  it("returns null when activities contains null", () => {
    expect(
      parseSearchResultsPayload({
        ...validDirect,
        filters: { activities: [null], pois: [] },
      })
    ).toBeNull();
  });

  it("returns null when pois contains a non-string element", () => {
    expect(
      parseSearchResultsPayload({
        ...validDirect,
        filters: { activities: [], pois: [{ type: "dump_point" }] },
      })
    ).toBeNull();
  });

  it("returns null when pois contains null", () => {
    expect(
      parseSearchResultsPayload({
        ...validDirect,
        filters: { activities: [], pois: [null] },
      })
    ).toBeNull();
  });

  // pois values are validated as strings but NOT checked against a known AmenityType list.
  // Unknown values (e.g. "not_a_real_type") pass through and produce no DB results — this is
  // intentional: AmenityType validation is deferred to the DB query layer, not the boundary parser.
  it("returns null when pois is not an array", () => {
    expect(
      parseSearchResultsPayload({
        ...validDirect,
        filters: { activities: [], pois: "dump_point" },
      })
    ).toBeNull();
  });
});

describe("parseSearchResultsPayload — AISearchPayload", () => {
  it("accepts a valid AI payload", () => {
    const result = parseSearchResultsPayload(validAI);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("ai");
  });

  it("returns null when campsites is missing", () => {
    const { campsites: _c, ...payload } = validAI;
    expect(parseSearchResultsPayload(payload)).toBeNull();
  });

  it("returns null when a campsite is missing lat/lng", () => {
    expect(
      parseSearchResultsPayload({
        ...validAI,
        campsites: [{ id: "1", name: "Bad" }],
      })
    ).toBeNull();
  });

  it("returns null when parsedIntent.amenities is not an array", () => {
    expect(
      parseSearchResultsPayload({
        ...validAI,
        parsedIntent: { amenities: "toilet" },
      })
    ).toBeNull();
  });

  it("returns null when parsedIntent.amenities contains non-string elements", () => {
    expect(
      parseSearchResultsPayload({
        ...validAI,
        parsedIntent: { amenities: [99, null] },
      })
    ).toBeNull();
  });

  // Legacy payloads (written before the discriminated union) have no `kind` field.
  // The parser normalises them to kind: "ai" so downstream narrowing works correctly.
  it("accepts a legacy payload without kind and normalises it to kind: \"ai\"", () => {
    const { kind: _kind, ...legacy } = validAI;
    const result = parseSearchResultsPayload(legacy);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("ai");
  });
});

describe("parseSearchResultsPayload — AISearchPayload with new ParsedIntent fields", () => {
  it("accepts a payload where parsedIntent includes siteName", () => {
    const result = parseSearchResultsPayload({
      ...validAI,
      parsedIntent: { amenities: [], siteName: "Lane Cove campground" },
    });
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("ai");
  });

  it("accepts a payload where parsedIntent includes resultType", () => {
    const result = parseSearchResultsPayload({
      ...validAI,
      parsedIntent: { amenities: [], resultType: "campsites" },
    });
    expect(result).not.toBeNull();
  });

  it("accepts a payload where parsedIntent includes poiTypes", () => {
    const result = parseSearchResultsPayload({
      ...validAI,
      parsedIntent: { amenities: [], poiTypes: ["dump_point"] },
    });
    expect(result).not.toBeNull();
  });

  it("accepts a payload where parsedIntent includes amenityHints", () => {
    const result = parseSearchResultsPayload({
      ...validAI,
      parsedIntent: { amenities: [], amenityHints: ["firepit", "river views"] },
    });
    expect(result).not.toBeNull();
  });

  it("accepts a payload with all new fields present", () => {
    const result = parseSearchResultsPayload({
      ...validAI,
      parsedIntent: {
        amenities: ["hiking"],
        siteName: "Royal National Park",
        resultType: "campsites",
        poiTypes: null,
        amenityHints: ["waterfall", "dog friendly"],
      },
    });
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("ai");
  });

  it("still rejects a payload where parsedIntent.amenities is not an array (new fields do not affect existing validation)", () => {
    expect(
      parseSearchResultsPayload({
        ...validAI,
        parsedIntent: { amenities: "hiking", siteName: "Test" },
      })
    ).toBeNull();
  });
});

describe("parseSearchResultsPayload — invalid input", () => {
  it("returns null for null", () => {
    expect(parseSearchResultsPayload(null)).toBeNull();
  });

  it("returns null for a string", () => {
    expect(parseSearchResultsPayload("not an object")).toBeNull();
  });

  it("returns null for an array", () => {
    expect(parseSearchResultsPayload([])).toBeNull();
  });

  it("returns null for an empty object", () => {
    expect(parseSearchResultsPayload({})).toBeNull();
  });
});
