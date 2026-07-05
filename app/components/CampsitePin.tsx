import { FOREST_GREEN, TEXT_MUTED } from "@/lib/tokens";
import { hexToRgba, PIN_PATH_D } from "@/lib/mapPin";
import { getWeatherBadge, weatherScore } from "@/lib/weatherScore";
import type { Campsite } from "@/types/map";

export type CampsitePinProps = {
  campsite: Campsite;
  idx: number;
  isSelected: boolean;
  onSelect: () => void;
};

export function CampsitePin({ campsite, idx, isSelected, onSelect }: CampsitePinProps) {
  const shortName = campsite.name
    .replace(" National Park", " NP")
    .replace(" Conservation Park", " CP")
    .split(" – ")[0];
  const pinW = isSelected ? 34 : 26;
  // Selected height (and the -2/30 viewBox below) leave headroom above the pin shape
  // for the glow + halo rings so they aren't clipped by the SVG viewport — see issue
  // #142 follow-up. The bottom edge stays at y=28 in both cases so the marker's
  // anchor="bottom" point (the pin tip) never shifts relative to its map coordinate.
  const pinH = isSelected ? 40 : 28;
  // No weather data yet (browse mode, not fetched for this viewport) → neutral colour.
  const pinColor = campsite.weather && campsite.weather.length > 0
    ? getWeatherBadge(weatherScore(campsite.weather)).color
    : TEXT_MUTED;
  return (
    <div
      role="button" tabIndex={0}
      className="relative flex flex-col items-center cursor-pointer select-none"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      aria-label={`Select campsite ${idx + 1}: ${campsite.name}`}
    >
      <svg
        style={{ width: pinW, height: pinH, filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSelected ? 0.45 : 0.28}))`, transition: "width 150ms, height 150ms" }}
        viewBox={isSelected ? "0 -2 26 30" : "0 0 26 28"} fill="none"
      >
        {isSelected && (
          // Tonal glow in the pin's own colour, not a fixed accent — so it reads
          // consistently on weather-coloured campsite pins and differently-coloured
          // amenity pins alike (issue #142 follow-up).
          <path d={PIN_PATH_D} fill="none" stroke={hexToRgba(pinColor, 0.3)} strokeWidth="5" />
        )}
        {isSelected && (
          <path d={PIN_PATH_D} fill="none" stroke="#fff" strokeWidth="4" />
        )}
        <path d={PIN_PATH_D} fill={pinColor} stroke={pinColor} strokeWidth={isSelected ? "2" : "1.5"} />
        <text x="13" y="12.5" textAnchor="middle" dominantBaseline="central"
          fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} paintOrder="stroke"
          fontSize={isSelected ? 11 : 9} fontWeight="800" fontFamily="DM Sans, sans-serif">
          {idx + 1}
        </text>
      </svg>
      <div
        className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSelected ? "font-bold" : "font-semibold"}`}
        style={{ color: FOREST_GREEN, fontFamily: "var(--font-dm-sans), sans-serif", fontSize: isSelected ? 11 : 10, textShadow: "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)" }}
      >
        {shortName}
      </div>
    </div>
  );
}
