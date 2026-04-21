"use client";

import { FOREST_GREEN } from "@/lib/tokens";
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
  const pinH = isSelected ? 37 : 28;
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
        viewBox="0 0 26 28" fill="none"
      >
        <path d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
          fill="#fff" stroke={meta.color} strokeWidth={isSelected ? "2.5" : "1.5"} />
      </svg>
      <div className="absolute pointer-events-none"
        style={{ fontSize: isSelected ? 12 : 10, lineHeight: 1, top: 0, width: pinW, height: Math.round(pinH * 0.72), display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {meta.emoji}
      </div>
      <div
        className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSelected ? "font-bold" : "font-semibold"}`}
        style={{ color: FOREST_GREEN, fontFamily: "var(--font-dm-sans), sans-serif", fontSize: isSelected ? 11 : 10, textShadow: "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)" }}
      >
        {poi.name ?? meta.label}
      </div>
    </div>
  );
}
