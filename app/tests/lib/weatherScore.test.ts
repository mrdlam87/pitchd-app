// Unit tests for lib/weatherScore — covers scoring edge cases and badge thresholds.
import { describe, it, expect } from "vitest";
import { weatherScore, getWeatherBadge, wmoCodeToEmoji, condColorForCode } from "@/lib/weatherScore";
import type { WeatherDay } from "@/types/map";

function makeWeatherDay(weatherCode: number, precipitationSum: number): WeatherDay {
  return {
    weatherCode,
    precipitationSum,
    tempMax: 25,
    tempMin: 15,
    date: "2024-03-23",
    dayName: "SAT",
    precipProbability: null,
  };
}

// Wraps a single day in an array — weatherScore now takes WeatherDay[].
// Single-element arrays produce identical scores to the old single-day API.
function score(weatherCode: number, precipitationSum: number): number {
  return weatherScore([makeWeatherDay(weatherCode, precipitationSum)]);
}

// ── weatherScore ──────────────────────────────────────────────────────────────

describe("weatherScore", () => {
  it("returns 100 for a clear sky with no rain", () => {
    expect(score(0, 0)).toBe(100);
  });

  it("applies a -2 penalty for mainly clear (code 1)", () => {
    expect(score(1, 0)).toBe(98);
  });

  it("applies a -2 penalty for partly cloudy (code 2)", () => {
    expect(score(2, 0)).toBe(98);
  });

  it("applies a -4 penalty for overcast (code 3)", () => {
    expect(score(3, 0)).toBe(96);
  });

  it("applies a -4 penalty for fog (code 45)", () => {
    expect(score(45, 0)).toBe(96);
  });

  it("applies a -10 penalty for drizzle (code 51)", () => {
    expect(score(51, 0)).toBe(90);
  });

  it("applies a -16 penalty for moderate rain (code 63)", () => {
    expect(score(63, 0)).toBe(84);
  });

  it("applies a -22 penalty for heavy rain (code 65)", () => {
    expect(score(65, 0)).toBe(78);
  });

  it("applies a -28 penalty for thunderstorm (code 95)", () => {
    expect(score(95, 0)).toBe(72);
  });

  it("applies a -28 penalty for thunderstorm with hail (code 99)", () => {
    expect(score(99, 0)).toBe(72);
  });

  it("applies a -22 penalty for violent showers (code 82)", () => {
    expect(score(82, 0)).toBe(78);
  });

  // Precipitation penalties
  it("applies a -2 precipitation penalty for >= 2mm", () => {
    expect(score(0, 2)).toBe(98);
  });

  it("applies a -4 precipitation penalty for >= 5mm", () => {
    expect(score(0, 5)).toBe(96);
  });

  it("applies a -8 precipitation penalty for >= 10mm", () => {
    expect(score(0, 10)).toBe(92);
  });

  it("stacks code and precipitation penalties", () => {
    // overcast (-4) + 10mm rain (-8) = 88
    expect(score(3, 10)).toBe(88);
  });

  it("stacks thunderstorm and heavy rain penalties", () => {
    // thunderstorm (-28) + 10mm rain (-8) = 36 total penalty → 64
    expect(score(95, 10)).toBe(64);
  });

  it("never returns a score below 0", () => {
    expect(score(99, 100)).toBeGreaterThanOrEqual(0);
  });

  it("never returns a score above 100", () => {
    expect(score(0, 0)).toBeLessThanOrEqual(100);
  });

  it("averages penalties — two partly-cloudy days score the same as one", () => {
    // avg penalty = (2 + 2) / 2 = 2, score = 98 (same as a single partly-cloudy day)
    const days = [makeWeatherDay(2, 0), makeWeatherDay(2, 0)];
    expect(weatherScore(days)).toBe(98);
  });

  it("averages penalties — mixed good and bad days reflect the mean", () => {
    // one clear (penalty 0) + one thunderstorm (penalty 28) = avg 14, score = 86
    const days = [makeWeatherDay(0, 0), makeWeatherDay(95, 0)];
    expect(weatherScore(days)).toBe(86);
  });

  it("never returns a score below 0 across many days with extreme conditions", () => {
    // Extreme: thunderstorm + max rain across many days — avg penalty = 36
    const days = Array.from({ length: 7 }, () => makeWeatherDay(95, 10));
    expect(weatherScore(days)).toBeGreaterThanOrEqual(0);
  });

  it("returns 100 for an empty day array", () => {
    expect(weatherScore([])).toBe(100);
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

// ── wmoCodeToEmoji ────────────────────────────────────────────────────────────

describe("wmoCodeToEmoji", () => {
  it("returns sun for code 0 (clear sky)", () => {
    expect(wmoCodeToEmoji(0)).toBe("☀️");
  });

  it("returns mainly-clear for code 1", () => {
    expect(wmoCodeToEmoji(1)).toBe("🌤️");
  });

  it("returns partly-cloudy for code 2", () => {
    expect(wmoCodeToEmoji(2)).toBe("⛅");
  });

  it("returns overcast for code 3", () => {
    expect(wmoCodeToEmoji(3)).toBe("☁️");
  });

  it("returns fog for code 45", () => {
    expect(wmoCodeToEmoji(45)).toBe("🌫️");
  });

  it("returns drizzle for code 51 (boundary)", () => {
    expect(wmoCodeToEmoji(51)).toBe("🌦️");
  });

  it("returns rain for code 61 (boundary)", () => {
    expect(wmoCodeToEmoji(61)).toBe("🌧️");
  });

  it("returns snow for code 71 (boundary)", () => {
    expect(wmoCodeToEmoji(71)).toBe("🌨️");
  });

  it("returns showers for code 80 (boundary)", () => {
    expect(wmoCodeToEmoji(80)).toBe("🌦️");
  });

  it("returns thunderstorm for code 95 (boundary)", () => {
    expect(wmoCodeToEmoji(95)).toBe("⛈️");
  });
});

// ── condColorForCode ──────────────────────────────────────────────────────────

describe("condColorForCode", () => {
  it("returns good green for code 0 (clear sky)", () => {
    expect(condColorForCode(0)).toBe("#4a9e6a");
  });

  it("returns mid green for code 1 (mainly clear)", () => {
    expect(condColorForCode(1)).toBe("#5a9a5a");
  });

  it("returns muted sage for code 45 (fog, boundary)", () => {
    expect(condColorForCode(45)).toBe("#90a890");
  });

  it("returns amber for code 51 (drizzle, boundary)", () => {
    expect(condColorForCode(51)).toBe("#c8a040");
  });

  it("returns warm orange for code 61 (moderate rain, boundary)", () => {
    expect(condColorForCode(61)).toBe("#e09060");
  });

  it("returns coral for code 65 (heavy rain, boundary)", () => {
    expect(condColorForCode(65)).toBe("#e8674a");
  });

  it("returns coral for code 80 (slight showers — absorbed by >= 65 branch)", () => {
    expect(condColorForCode(80)).toBe("#e8674a");
  });

  it("returns coral for code 95 (thunderstorm, boundary)", () => {
    expect(condColorForCode(95)).toBe("#e8674a");
  });
});
