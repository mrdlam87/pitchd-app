import { describe, it, expect } from "vitest";
import { extractForecastDays, proximityScore, combinedScore } from "@/lib/weatherRanking";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

/** Builds a minimal valid Open-Meteo daily response for a single date. */
function makeSingleDayForecast(
  date: string,
  overrides: Partial<{
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    weathercode: (number | null)[];
    precipitation_probability_max: (number | null)[] | undefined;
  }> = {},
) {
  return {
    daily: {
      time: [date],
      temperature_2m_max: overrides.temperature_2m_max ?? [25],
      temperature_2m_min: overrides.temperature_2m_min ?? [15],
      precipitation_sum: overrides.precipitation_sum ?? [0],
      weathercode: overrides.weathercode ?? [0],
      ...("precipitation_probability_max" in overrides
        ? { precipitation_probability_max: overrides.precipitation_probability_max }
        : {}),
    },
  };
}

function makeRangeForecast(dates: string[]) {
  return {
    daily: {
      time: dates,
      temperature_2m_max: dates.map(() => 25),
      temperature_2m_min: dates.map(() => 15),
      precipitation_sum: dates.map(() => 0),
      weathercode: dates.map(() => 0),
      precipitation_probability_max: dates.map(() => 10),
    },
  };
}

// ─── extractForecastDays ──────────────────────────────────────────────────────

describe("extractForecastDays", () => {
  it("returns empty array for null input", () => {
    expect(extractForecastDays(null, null, null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(extractForecastDays("bad", null, null)).toEqual([]);
    expect(extractForecastDays(42, null, null)).toEqual([]);
  });

  it("returns empty array when daily field is missing", () => {
    expect(extractForecastDays({}, null, null)).toEqual([]);
  });

  it("returns empty array when required arrays are missing", () => {
    expect(extractForecastDays({ daily: {} }, null, null)).toEqual([]);
  });

  it("returns today + tomorrow by default (no date range)", () => {
    const forecast = makeRangeForecast([yesterday, today, tomorrow]);
    const days = extractForecastDays(forecast, null, null);
    expect(days.map((d) => d.date)).toEqual([today, tomorrow]);
  });

  it("filters to the supplied date range (inclusive)", () => {
    const dates = [yesterday, today, tomorrow];
    const forecast = makeRangeForecast(dates);
    const days = extractForecastDays(forecast, today, today);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe(today);
  });

  it("single-day range (startDate === endDate) returns exactly that day", () => {
    const forecast = makeRangeForecast([yesterday, today, tomorrow]);
    const days = extractForecastDays(forecast, today, today);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe(today);
  });

  it("returns empty array when startDate > endDate (inverted range)", () => {
    const forecast = makeRangeForecast([today, tomorrow]);
    const days = extractForecastDays(forecast, tomorrow, today);
    expect(days).toHaveLength(0);
  });

  it("handles missing precipitation_probability_max gracefully", () => {
    const forecast = makeSingleDayForecast(today, {
      precipitation_probability_max: undefined,
    });
    const days = extractForecastDays(forecast, today, today);
    expect(days).toHaveLength(1);
    expect(days[0].precipProbability).toBeNull();
  });

  it("skips days with null required numeric fields", () => {
    const forecast = makeSingleDayForecast(today, {
      temperature_2m_max: [null],
    });
    const days = extractForecastDays(forecast, today, today);
    expect(days).toHaveLength(0);
  });
});

// ─── proximityScore ───────────────────────────────────────────────────────────

describe("proximityScore", () => {
  it("returns 100 when radiusKm is 0", () => {
    expect(proximityScore(0, 0)).toBe(100);
    expect(proximityScore(50, 0)).toBe(100);
  });

  it("returns 100 at the centre (distanceKm = 0)", () => {
    expect(proximityScore(0, 100)).toBe(100);
  });

  it("returns ~0 at the boundary (distanceKm = radiusKm)", () => {
    expect(proximityScore(100, 100)).toBe(0);
  });

  it("returns 50 at the midpoint", () => {
    expect(proximityScore(50, 100)).toBe(50);
  });

  it("clamps to 0 for distances beyond the radius", () => {
    expect(proximityScore(150, 100)).toBe(0);
  });

  it("clamps to 100 for negative distances", () => {
    expect(proximityScore(-10, 100)).toBe(100);
  });
});

// ─── combinedScore ────────────────────────────────────────────────────────────

describe("combinedScore", () => {
  it("uses neutral weather score (50) when forecast is null", () => {
    // proximityScore(0, 100) = 100; NEUTRAL = 50 → 0.6*100 + 0.4*50 = 80
    expect(combinedScore(0, 100, null, null, null)).toBe(80);
  });

  it("uses neutral weather score (50) when startDate > endDate (no matching days)", () => {
    const forecast = makeRangeForecast([today, tomorrow]);
    // Empty days → neutral (50); proximity at centre → 100 → combined = 80
    const score = combinedScore(0, 100, forecast, tomorrow, today);
    expect(score).toBe(80);
  });

  it("returns 80 for radiusKm = 0 regardless of distance (proximityScore=100, neutral weather=50)", () => {
    // proximityScore always 100 when radiusKm = 0; neutral weather → 0.6*100 + 0.4*50 = 80
    expect(combinedScore(999, 0, null, null, null)).toBe(80);
  });

  it("produces a higher score for a nearer campsite with identical weather", () => {
    const forecast = makeRangeForecast([today, tomorrow]);
    const near = combinedScore(10, 100, forecast, today, tomorrow);
    const far = combinedScore(80, 100, forecast, today, tomorrow);
    expect(near).toBeGreaterThan(far);
  });
});
