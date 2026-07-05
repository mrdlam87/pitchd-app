import { FOREST_GREEN } from "@/lib/tokens";
import { hexToRgba, PIN_PATH_D } from "@/lib/mapPin";
import type { AmenityPOI } from "@/types/map";

export type AmenityPinMeta = { emoji: string; label: string; color: string };

export type AmenityPinProps = {
  poi: AmenityPOI;
  meta: AmenityPinMeta;
  isSelected: boolean;
  onSelect: () => void;
};

export function AmenityPin({ poi, meta, isSelected, onSelect }: AmenityPinProps) {
  const pinW = isSelected ? 34 : 26;
  // See CampsitePin for why selected height grows via top-only viewBox headroom
  // (issue #142 follow-up) — keeps the anchor="bottom" tip position unchanged.
  const pinH = isSelected ? 40 : 28;
  return (
    <div
      role="button" tabIndex={0}
      className="relative flex flex-col items-center cursor-pointer select-none"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      aria-label={`Select ${meta.label}${poi.name ? `: ${poi.name}` : ""}`}
    >
      <svg
        style={{ width: pinW, height: pinH, filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSelected ? 0.45 : 0.28}))`, transition: "width 150ms, height 150ms" }}
        viewBox={isSelected ? "0 -2 26 30" : "0 0 26 28"} fill="none"
      >
        {isSelected && (
          // Tonal glow in the amenity's own colour — same treatment as CampsitePin,
          // so the selection highlight suits every pin colour (issue #142 follow-up).
          <path d={PIN_PATH_D} fill="none" stroke={hexToRgba(meta.color, 0.3)} strokeWidth="5" />
        )}
        {isSelected && (
          <path d={PIN_PATH_D} fill="none" stroke="#fff" strokeWidth="4" />
        )}
        {/* Solid fill (not white-with-outline) so the category colour is the
            dominant signal, matching CampsitePin and ClusterBubble — a thin
            outline reads too faintly against Mapbox's own light basemap. */}
        <path d={PIN_PATH_D} fill={meta.color} stroke={meta.color} strokeWidth={isSelected ? "2" : "1.5"} />
        {/* Emoji lives in the same viewBox coordinate space as the pin path (like
            CampsitePin's number text) so it stays exactly centred on the circle
            in every state, instead of an approximated CSS overlay. */}
        <text x="13" y="12.5" textAnchor="middle" dominantBaseline="central" fill="#000"
          fontSize={isSelected ? 13 : 11} style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }}>
          {meta.emoji}
        </text>
      </svg>
      <div
        className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSelected ? "font-bold" : "font-semibold"}`}
        style={{ color: FOREST_GREEN, fontFamily: "var(--font-dm-sans), sans-serif", fontSize: isSelected ? 11 : 10, textShadow: "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)" }}
      >
        {poi.name ?? meta.label}
      </div>
    </div>
  );
}
