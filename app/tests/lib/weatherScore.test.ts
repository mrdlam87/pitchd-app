// Unit tests for lib/weatherScore — covers scoring edge cases and badge thresholds.
import { describe, it, expect } from "vitest";
import { weatherScore, getWeatherBadge } from "@/lib/weatherScore";
import type { WeatherDay } from "@/types/map";

function makeWeatherDay(weatherCode: number, precipitationSum: number): WeatherDay {
  return { weatherCode, precipitationSum, tempMax: 25, tempMin: 15 };
}

// ── weatherScore ──────────────────────────────────────────────────────────────

describe("weatherScore", () => {
  it("returns 100 for a clear sky with no rain", () => {
    expect(weatherScore(makeWeatherDay(0, 0))).toBe(100);
  });

  it("applies a -2 penalty for mainly clear (code 1)", () => {
    expect(weatherScore(makeWeatherDay(1, 0))).toBe(98);
  });

  it("applies a -2 penalty for partly cloudy (code 2)", () => {
    expect(weatherScore(makeWeatherDay(2, 0))).toBe(98);
  });

  it("applies a -4 penalty for overcast (code 3)", () => {
    expect(weatherScore(makeWeatherDay(3, 0))).toBe(96);
  });

  it("applies a -4 penalty for fog (code 45)", () => {
    expect(weatherScore(makeWeatherDay(45, 0))).toBe(96);
  });

  it("applies a -10 penalty for drizzle (code 51)", () => {
    expect(weatherScore(makeWeatherDay(51, 0))).toBe(90);
  });

  it("applies a -16 penalty for moderate rain (code 63)", () => {
    expect(weatherScore(makeWeatherDay(63, 0))).toBe(84);
  });

  it("applies a -22 penalty for heavy rain (code 65)", () => {
    expect(weatherScore(makeWeatherDay(65, 0))).toBe(78);
  });

  it("applies a -28 penalty for thunderstorm (code 95)", () => {
    expect(weatherScore(makeWeatherDay(95, 0))).toBe(72);
  });

  it("applies a -28 penalty for thunderstorm with hail (code 99)", () => {
    expect(weatherScore(makeWeatherDay(99, 0))).toBe(72);
  });

  it("applies a -22 penalty for violent showers (code 82)", () => {
    expect(weatherScore(makeWeatherDay(82, 0))).toBe(78);
  });

  // Precipitation penalties
  it("applies a -2 precipitation penalty for >= 2mm", () => {
    expect(weatherScore(makeWeatherDay(0, 2))).toBe(98);
  });

  it("applies a -4 precipitation penalty for >= 5mm", () => {
    expect(weatherScore(makeWeatherDay(0, 5))).toBe(96);
  });

  it("applies a -8 precipitation penalty for >= 10mm", () => {
    expect(weatherScore(makeWeatherDay(0, 10))).toBe(92);
  });

  it("stacks code and precipitation penalties", () => {
    // overcast (-4) + 10mm rain (-8) = 88
    expect(weatherScore(makeWeatherDay(3, 10))).toBe(88);
  });

  it("stacks thunderstorm and heavy rain penalties", () => {
    // thunderstorm (-28) + 10mm rain (-8) = 36 total penalty → 64
    expect(weatherScore(makeWeatherDay(95, 10))).toBe(64);
  });

  it("never returns a score below 0", () => {
    expect(weatherScore(makeWeatherDay(99, 100))).toBeGreaterThanOrEqual(0);
  });

  it("never returns a score above 100", () => {
    expect(weatherScore(makeWeatherDay(0, 0))).toBeLessThanOrEqual(100);
  });
});

// ── getWeatherBadge ───────────────────────────────────────────────────────────

describe("getWeatherBadge", () => {
  it("returns Great for score >= 75", () => {
    expect(getWeatherBadge(100).label).toBe("Great");
    expect(getWeatherBadge(75).label).toBe("Great");
  });

  it("returns Good for score >= 45 and < 75", () => {
    expect(getWeatherBadge(74).label).toBe("Good");
    expect(getWeatherBadge(45).label).toBe("Good");
  });

  it("returns Poor for score < 45", () => {
    expect(getWeatherBadge(44).label).toBe("Poor");
    expect(getWeatherBadge(0).label).toBe("Poor");
  });

  it("Great badge has green color and background", () => {
    const badge = getWeatherBadge(100);
    expect(badge.color).toBe("#4a9e6a");
    expect(badge.bg).toBe("#e8f5ee");
  });

  it("Good badge has amber color and background", () => {
    const badge = getWeatherBadge(60);
    expect(badge.color).toBe("#c8a040");
    expect(badge.bg).toBe("#fdf5e0");
  });

  it("Poor badge has coral color and background", () => {
    const badge = getWeatherBadge(20);
    expect(badge.color).toBe("#e8674a");
    expect(badge.bg).toBe("#fdf0ed");
  });
});
