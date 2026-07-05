// Unit tests for lib/mapPin — covers hexToRgba conversion for pin selection glow.
import { describe, it, expect } from "vitest";
import { hexToRgba } from "@/lib/mapPin";

describe("hexToRgba", () => {
  it("converts a hex colour with a leading # to rgba", () => {
    expect(hexToRgba("#e8674a", 0.28)).toBe("rgba(232, 103, 74, 0.28)");
  });

  it("converts a hex colour without a leading # to rgba", () => {
    expect(hexToRgba("2d4a2d", 1)).toBe("rgba(45, 74, 45, 1)");
  });

  it("handles black and white extremes", () => {
    expect(hexToRgba("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(hexToRgba("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });

  it("passes alpha through unchanged, including 0", () => {
    expect(hexToRgba("#536ba2", 0)).toBe("rgba(83, 107, 162, 0)");
  });
});
