// Weather scoring — converts a single Open-Meteo daily forecast into a
// Great / Good / Poor badge matching the prototype's getBadge() design.
//
// Thresholds match prototypes/pitchd-light-v2.jsx:
//   score >= 75 → Great (green)
//   score >= 45 → Good  (amber)
//   score <  45 → Poor  (red/coral)

import type { WeatherDay } from "@/types/map";

// WMO code → score penalty (0–28).
// Reference: https://open-meteo.com/en/docs#weathervariables
function wmoCodePenalty(code: number): number {
  if (code >= 95) return 28; // thunderstorm (slight / moderate / with hail)
  if (code === 65 || code === 82) return 22; // heavy rain / violent showers
  if (
    code === 63 ||
    code === 64 ||
    code === 66 ||
    code === 67 ||
    code === 80 ||
    code === 81
  )
    return 16; // moderate rain / freezing rain / slight–moderate showers
  if (
    (code >= 51 && code <= 59) || // drizzle / freezing drizzle
    (code >= 61 && code <= 62) || // slight–moderate rain (not covered above)
    (code >= 71 && code <= 77) || // snow
    (code >= 83 && code <= 86)    // snow showers
  )
    return 10;
  if (code === 3 || (code >= 45 && code <= 48)) return 4; // overcast / fog
  if (code === 1 || code === 2) return 2; // mainly clear / partly cloudy
  // Code 0 = clear sky. Any unrecognised code (e.g. future WMO additions not
  // in Open-Meteo's daily set) is treated as clear sky — no penalty.
  return 0;
}

// Precipitation sum (mm) → additional penalty.
function precipPenalty(mm: number): number {
  if (mm >= 10) return 8;
  if (mm >= 5) return 4;
  if (mm >= 2) return 2;
  return 0;
}

/**
 * Returns a 0–100 camping quality score for a single forecast day.
 * Higher is better.
 *
 * With current WMO codes the maximum combined penalty is 28 (thunderstorm) + 8
 * (≥10mm rain) = 36, so the practical floor is 64. The Math.max(0, ...) guard
 * is a safety net for future penalty changes or unexpected input.
 */
export function weatherScore(day: WeatherDay): number {
  const penalty = wmoCodePenalty(day.weatherCode) + precipPenalty(day.precipitationSum);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export type WeatherBadgeInfo = {
  label: "Great" | "Good" | "Poor";
  color: string;
  bg: string;
};

/**
 * Maps a 0–100 score to a badge label and colours.
 * Matches prototype getBadge() exactly.
 */
export function getWeatherBadge(score: number): WeatherBadgeInfo {
  if (score >= 75) return { label: "Great", color: "#4a9e6a", bg: "#e8f5ee" };
  if (score >= 45) return { label: "Good",  color: "#c8a040", bg: "#fdf5e0" };
  return              { label: "Poor",  color: "#e8674a", bg: "#fdf0ed" };
}
