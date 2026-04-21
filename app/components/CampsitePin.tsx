import { FOREST_GREEN } from "@/lib/tokens";
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
  const pinH = isSelected ? 37 : 28;
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
        viewBox="0 0 26 28" fill="none"
      >
        <path d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
          fill={isSelected ? FOREST_GREEN : "#fff"} stroke={FOREST_GREEN} strokeWidth="1.5" />
        <text x="13" y="12.5" textAnchor="middle" dominantBaseline="central"
          fill={isSelected ? "#fff" : FOREST_GREEN} fontSize={isSelected ? 11 : 9} fontWeight="800" fontFamily="DM Sans, sans-serif">
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
