// Weather scoring — converts Open-Meteo daily forecasts into a
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
 * Returns a 0–100 camping quality score for a multi-day forecast.
 *
 * Score is based on the **average per-day penalty** so the badge represents
 * "what is a typical day like on this trip" regardless of how many days are
 * shown. This keeps the existing Great/Good/Poor thresholds consistent between
 * the 2-day compact card and the 4-day full card — the same condition (e.g.
 * moderate rain) produces the same badge in both views.
 *
 * Single-element arrays behave identically to the old single-day scoring.
 * The Math.max/min guards are safety nets for unexpected input.
 */
export function weatherScore(days: WeatherDay[]): number {
  if (days.length === 0) return 100;
  let totalPenalty = 0;
  for (const day of days) {
    totalPenalty += wmoCodePenalty(day.weatherCode) + precipPenalty(day.precipitationSum);
  }
  return Math.max(0, Math.min(100, 100 - totalPenalty / days.length));
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

/**
 * Maps a WMO weather code to a weather emoji icon.
 * Matches prototype getIcon() design.
 */
export function wmoCodeToEmoji(code: number): string {
  if (code >= 95) return "⛈️";  // thunderstorm
  if (code >= 80) return "🌦️";  // rain showers
  if (code >= 71) return "🌨️";  // snow
  if (code >= 61) return "🌧️";  // rain
  if (code >= 51) return "🌦️";  // drizzle
  if (code >= 45) return "🌫️";  // fog
  if (code === 3)  return "☁️";  // overcast
  if (code === 2)  return "⛅";  // partly cloudy
  if (code === 1)  return "🌤️";  // mainly clear
  return "☀️";                   // clear sky (code 0) or unknown
}

/**
 * Returns a segment color for WeatherStrip based on WMO code.
 * Matches prototype condColor() design.
 */
export function condColorForCode(code: number): string {
  if (code >= 95) return "#e8674a";  // thunderstorm — coral
  // All codes 65–94 intentionally map to coral. This includes heavy rain (65),
  // freezing rain (66–67), snow (71–77), slight/moderate rain showers (80–81),
  // and heavy/violent showers (82–86). Snow is exceedingly rare in AU camping
  // regions; coral signals "not ideal" consistently across the bad-weather range.
  if (code >= 65) return "#e8674a";  // heavy rain / freezing rain / snow / showers — coral
  if (code >= 61) return "#e09060";  // moderate rain — warm orange
  if (code >= 51) return "#c8a040";  // drizzle — amber
  if (code === 3 || (code >= 45 && code <= 48)) return "#90a890"; // overcast/fog — muted sage
  if (code === 1 || code === 2) return "#5a9a5a"; // mainly/partly clear — mid green
  return "#4a9e6a"; // clear sky — good green
}
