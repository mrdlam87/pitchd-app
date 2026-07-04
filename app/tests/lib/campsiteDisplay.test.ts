import { describe, it, expect } from "vitest";
import { UNNAMED_CAMPSITE_NAME, isUnnamedCampsite, getDisplayName } from "@/lib/campsiteDisplay";

// ── isUnnamedCampsite ──────────────────────────────────────────────────────────

describe("isUnnamedCampsite", () => {
  it("returns true for the exact literal 'Unnamed campsite'", () => {
    expect(isUnnamedCampsite("Unnamed campsite")).toBe(true);
  });

  it("returns false for lowercase 'unnamed campsite'", () => {
    expect(isUnnamedCampsite("unnamed campsite")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isUnnamedCampsite("")).toBe(false);
  });

  it("returns false for other strings", () => {
    expect(isUnnamedCampsite("My Campsite")).toBe(false);
    expect(isUnnamedCampsite("Unnamed")).toBe(false);
    expect(isUnnamedCampsite("campsite")).toBe(false);
  });

  it("returns false for similar-looking strings with extra whitespace", () => {
    expect(isUnnamedCampsite(" Unnamed campsite")).toBe(false);
    expect(isUnnamedCampsite("Unnamed campsite ")).toBe(false);
    expect(isUnnamedCampsite("Unnamed  campsite")).toBe(false);
  });
});

// ── getDisplayName ────────────────────────────────────────────────────────────

describe("getDisplayName", () => {
  describe("named campsite", () => {
    it("returns the name unchanged when name is not the literal", () => {
      expect(getDisplayName({ name: "My Campsite", region: null, state: null })).toBe("My Campsite");
    });

    it("returns the name unchanged regardless of region/state values", () => {
      expect(getDisplayName({ name: "My Campsite", region: "NSW", state: "New South Wales" })).toBe(
        "My Campsite"
      );
    });

    it("returns custom name even if it looks similar to unnamed", () => {
      expect(getDisplayName({ name: "Unnamed Site", region: null, state: null })).toBe("Unnamed Site");
    });
  });

  describe("unnamed campsite with region", () => {
    it("returns 'Campsite in {region}' when region is set", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: "New South Wales", state: null })).toBe(
        "Campsite in New South Wales"
      );
    });

    it("returns 'Campsite in {region}' with various region names", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: "Queensland", state: null })).toBe(
        "Campsite in Queensland"
      );
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: "Snowy Mountains", state: null })).toBe(
        "Campsite in Snowy Mountains"
      );
    });
  });

  describe("unnamed campsite with state but no region", () => {
    it("returns 'Campsite in {state}' when region is null and state is set", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: null, state: "NSW" })).toBe("Campsite in NSW");
    });

    it("returns 'Campsite in {state}' with various state names", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: null, state: "Victoria" })).toBe(
        "Campsite in Victoria"
      );
    });
  });

  describe("unnamed campsite with neither region nor state", () => {
    it("returns the literal 'Unnamed campsite' when both region and state are null", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: null, state: null })).toBe(
        UNNAMED_CAMPSITE_NAME
      );
    });
  });

  describe("unnamed campsite with both region and state", () => {
    it("prioritizes region over state", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: "Snowy Mountains", state: "NSW" })).toBe(
        "Campsite in Snowy Mountains"
      );
    });

    it("returns region fallback not state when both are set", () => {
      expect(getDisplayName({ name: UNNAMED_CAMPSITE_NAME, region: "Yosemite", state: "California" })).toBe(
        "Campsite in Yosemite"
      );
    });
  });
});
