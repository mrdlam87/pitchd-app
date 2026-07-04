"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { BORDER, CORAL, CORAL_LIGHT, FOREST_GREEN, SAGE, SURFACE } from "@/lib/tokens";
import { wmoCodeToEmoji, condColorForCode } from "@/lib/weatherScore";
import type { AmenityPOI, Campsite, POIMeta, WeatherDay } from "@/types/map";
import { haversineKm } from "@/lib/distance";
import type { ParsedIntent } from "@/lib/parseIntent";

export type DrawerState = "peek" | "half" | "full";
export type DrawerMode = "browse" | "ai-search" | "region" | "location" | "amenity-only";

// ── Heights ────────────────────────────────────────────────────────────────────

export const PEEK_HEIGHT_PX = 64;

// Duration of Vaul's snap animation — exported so Map.tsx can delay
// scrollIntoView until the drawer has settled. Must match Vaul's internal
// CSS transition: `transform 0.5s cubic-bezier(0.32,0.72,0,1)` (500ms).
export const DRAWER_TRANSITION_MS = 500;

// Viewport-height fraction for half state
const HALF_VH = 0.52;

// Height of the top spacer in full state — clears the floating search bar + chips
// that remain absolutely positioned above the drawer (z-[60]).
// Accounts for: top-3 (12px) + search bar with context text (~56px) + gap-2 (8px) + chips row (~32px) + breathing room.
// Sized for the taller two-line search bar (input + AI context query) so the
// borderTop handle strip never overlaps the chips row when a search is active.
// TODO: make dynamic via ResizeObserver if the SearchBar or QuickFilterChips
// padding/height changes further.
const FULL_STATE_SPACER_PX = 120;

/**
 * Returns the drawer height in px for a given state.
 * Client-only — reads window.innerHeight. Do not call during SSR or in render.
 */
export function getDrawerHeightPx(state: DrawerState): number {
  if (state === "peek") return PEEK_HEIGHT_PX;
  if (state === "half") return Math.round(window.innerHeight * HALF_VH);
  // Full state covers 100dvh — use full viewport height for Mapbox padding calculation
  return window.innerHeight;
}

// ── Drive time estimate ────────────────────────────────────────────────────────

// Rough drive time label assuming 80 km/h average
function driveLabel(km: number): string {
  const mins = Math.round((km / 80) * 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `~${h} h` : `~${h} h ${m} min`;
}

// ── Scenic SVG illustration (ported from prototype) ────────────────────────────

const SCENIC_PALETTES = [
  { sky: "#87CEAB", hills: ["#4a7c4a", "#5a9a5a", "#3d6b3d"] as const, ground: "#6b8f4a" },
  { sky: "#7ab5d4", hills: ["#3d6b6b", "#4a8a7a", "#2d5a5a"] as const, ground: "#5a7a5a" },
  { sky: "#c4a882", hills: ["#8a6a4a", "#6b5a3a", "#4a3a2a"] as const, ground: "#7a6a4a" },
  { sky: "#b0c8a0", hills: ["#4a6a3a", "#3a5a2a", "#5a7a4a"] as const, ground: "#6a8a4a" },
];

function ScenicPhoto({ seed }: { seed: number }) {
  const p = SCENIC_PALETTES[seed % SCENIC_PALETTES.length];
  const w = 400;
  const h = 120;
  // Suffix seed into gradient IDs to avoid DOM-scope collisions across multiple cards.
  // Assumes seed (card index) is unique within any single rendered list.
  const sid = `sp${seed}`;
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className="block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky${sid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p.sky} stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`ov${sid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#sky${sid})`} />
      {/* Far hills */}
      <path
        d={`M0 ${h * 0.65} Q${w * 0.2} ${h * 0.38} ${w * 0.4} ${h * 0.52} Q${w * 0.6} ${h * 0.35} ${w * 0.8} ${h * 0.48} Q${w * 0.9} ${h * 0.42} ${w} ${h * 0.5} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[0]}
        opacity="0.6"
      />
      {/* Mid hills */}
      <path
        d={`M0 ${h * 0.72} Q${w * 0.15} ${h * 0.55} ${w * 0.3} ${h * 0.65} Q${w * 0.5} ${h * 0.48} ${w * 0.65} ${h * 0.62} Q${w * 0.82} ${h * 0.52} ${w} ${h * 0.6} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[1]}
      />
      {/* Foreground */}
      <path
        d={`M0 ${h * 0.82} Q${w * 0.25} ${h * 0.7} ${w * 0.5} ${h * 0.78} Q${w * 0.75} ${h * 0.68} ${w} ${h * 0.75} L${w} ${h} L0 ${h}Z`}
        fill={p.hills[2]}
      />
      {/* Ground strip */}
      <rect x="0" y={h * 0.9} width={w} height={h * 0.1} fill={p.ground} />
      {/* Tent silhouette */}
      <polygon
        points={`${w * 0.45},${h * 0.75} ${w * 0.5},${h * 0.63} ${w * 0.55},${h * 0.75}`}
        fill="rgba(255,255,255,0.85)"
      />
      <rect x={w * 0.485} y={h * 0.73} width={w * 0.03} height={h * 0.02} fill="rgba(255,255,255,0.5)" />
      {/* Darkening overlay for readability */}
      <rect width={w} height={h} fill={`url(#ov${sid})`} />
    </svg>
  );
}

// ── Weather strip ──────────────────────────────────────────────────────────────

// Segmented color bar — one segment per forecast day, colored by condition.
// Matches prototype WeatherStrip design.
function WeatherStrip({ weather }: { weather: WeatherDay[] }) {
  if (weather.length === 0) return null;
  return (
    <div className="flex gap-[2px] rounded-[6px] overflow-hidden my-2 h-[5px]">
      {weather.map((d) => (
        <div
          key={d.date}
          className="flex-1"
          style={{ background: condColorForCode(d.weatherCode) }}
        />
      ))}
    </div>
  );
}

// ── Day weather cells ──────────────────────────────────────────────────────────

function DayWeatherCells({ weather }: { weather: WeatherDay[] }) {
  if (weather.length === 0) return null;
  return (
    <div className="flex gap-[2px]">
      {weather.map((d) => (
        <div
          key={d.date}
          className="flex-1 flex flex-col items-center gap-[1px]"
        >
          <span
            className="text-[7px] uppercase font-bold font-[family-name:var(--font-dm-sans)]"
            style={{ color: SAGE }}
          >
            {d.dayName}
          </span>
          <span className="text-[13px]">{wmoCodeToEmoji(d.weatherCode)}</span>
          <span
            className="text-[10px] font-bold font-[family-name:var(--font-dm-sans)]"
            style={{ color: FOREST_GREEN }}
          >
            {Number.isFinite(d.tempMax) ? Math.round(d.tempMax) : "--"}°
          </span>
          <span
            className="text-[8px] font-[family-name:var(--font-dm-sans)]"
            style={{ color: SAGE }}
          >
            {d.precipProbability !== null ? `${d.precipProbability}%` : `${d.precipitationSum}mm`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Amenity tags ───────────────────────────────────────────────────────────────

function AmenityTags({ amenities }: { amenities: Campsite["amenities"] }) {
  if (!amenities.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {amenities.map((a) => (
        <span
          key={a.key}
          className="inline-flex items-center gap-[3px] text-[10px] font-semibold rounded-full px-2 py-[3px]"
          style={{
            color: a.color,
            // hex-alpha suffix requires a.color to be a 6-digit #rrggbb string —
            // guaranteed by the AmenityType seed data in prisma/seed.ts
            background: a.color + "15",
            border: `1px solid ${a.color}30`,
          }}
        >
          <span className="text-[11px]">{a.icon}</span>
          {a.label}
        </span>
      ))}
    </div>
  );
}

// ── Campsite card ──────────────────────────────────────────────────────────────

const NavigateButton = ({ lat, lng, name }: { lat: number; lng: number; name: string }) => (
  <a
    href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
    style={{ background: CORAL_LIGHT }}
    aria-label={`Navigate to ${name} in Google Maps`}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={CORAL} />
    </svg>
  </a>
);

function CampsiteCard({
  campsite,
  index,
  isSelected,
  compact,
  showIndex = false,
  userLocation,
  cardRef,
  onSelect,
}: {
  campsite: Campsite;
  index: number;
  isSelected: boolean;
  compact: boolean;
  showIndex?: boolean;
  userLocation: { lat: number; lng: number } | null;
  cardRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
}) {
  const driveTime = userLocation
    ? driveLabel(haversineKm(userLocation.lat, userLocation.lng, campsite.lat, campsite.lng))
    : null;

  const sharedInteractionProps = {
    ref: cardRef,
    role: "button" as const,
    tabIndex: 0,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    "aria-label": `Select campsite ${index + 1}: ${campsite.name}`,
    "aria-pressed": isSelected,
  };

  if (!compact) {
    // Full drawer: scenic header + name + badge + drive/blurb + weather strip + 4-day cells + amenity tags
    return (
      <div
        {...sharedInteractionProps}
        className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-150"
        style={{
          boxShadow: isSelected
            ? `0 0 0 2px ${CORAL}, 0 2px 12px rgba(0,0,0,0.08)`
            : "0 2px 12px rgba(0,0,0,0.08)",
          background: "#fff",
        }}
      >
        <ScenicPhoto seed={index} />
        <div className="p-3">
          <div className="flex items-start gap-2 mb-1">
            <div className="min-w-0 flex-1">
              <div
                className="text-[15px] font-semibold leading-snug font-[family-name:var(--font-dm-sans)]"
                style={{ color: FOREST_GREEN }}
              >
                {campsite.name}
              </div>
              {(driveTime || campsite.blurb) && (
                <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: SAGE }}>
                  {driveTime && <span>🚗 {driveTime}</span>}
                  {driveTime && campsite.blurb && <span> · </span>}
                  {campsite.blurb && <span>{campsite.blurb}</span>}
                </div>
              )}
            </div>
            <NavigateButton lat={campsite.lat} lng={campsite.lng} name={campsite.name} />
          </div>
          {campsite.weather && campsite.weather.length > 0 && (
            <>
              <WeatherStrip weather={campsite.weather} />
              <DayWeatherCells weather={campsite.weather} />
            </>
          )}
          <AmenityTags amenities={campsite.amenities} />
        </div>
      </div>
    );
  }

  // Compact (half / peek): name + badge | drive/blurb | weather strip | 2-day cells | amenity tags
  const subText = campsite.blurb ?? campsite.region;
  // Limit to 2 days in compact mode to avoid crowding
  const compactWeather = campsite.weather?.slice(0, 2) ?? null;
  return (
    <div
      {...sharedInteractionProps}
      className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-150"
      style={{
        boxShadow: isSelected
          ? `0 0 0 2px ${CORAL}, 0 2px 12px rgba(0,0,0,0.08)`
          : "0 2px 12px rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-3 mb-1.5">
          {showIndex && (
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 font-extrabold mt-0.5 text-[10px]"
              style={{
                background: isSelected ? FOREST_GREEN : "transparent",
                border: `2px solid ${FOREST_GREEN}`,
                color: isSelected ? "#fff" : FOREST_GREEN,
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}
            >
              {index + 1}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold text-[15px] leading-snug font-[family-name:var(--font-dm-sans)]"
              style={{ color: FOREST_GREEN }}
            >
              {campsite.name}
            </div>
            {(driveTime || subText) && (
              <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: SAGE }}>
                {driveTime && <span>🚗 {driveTime}</span>}
                {driveTime && subText && <span> · </span>}
                {subText && <span>{subText}</span>}
              </div>
            )}
          </div>
          <NavigateButton lat={campsite.lat} lng={campsite.lng} name={campsite.name} />
        </div>
        {compactWeather && compactWeather.length > 0 && (
          <>
            <WeatherStrip weather={compactWeather} />
            <DayWeatherCells weather={compactWeather} />
          </>
        )}
        <AmenityTags amenities={campsite.amenities} />
      </div>
    </div>
  );
}

// ── POI detail card ────────────────────────────────────────────────────────────

function POICard({ poi, meta, onClick, isSelected }: { poi: AmenityPOI; meta: POIMeta; onClick?: () => void; isSelected?: boolean }) {
  return (
    <div
      className="relative rounded-xl p-3"
      style={{
        border: isSelected ? `2px solid ${meta.color}` : `1.5px solid ${meta.color}`,
        background: isSelected ? `${meta.color}18` : SURFACE,
        cursor: onClick ? "pointer" : undefined,
      }}
      {...(onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } } : {})}
    >
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
        style={{ background: CORAL_LIGHT }}
        aria-label={`Navigate to ${poi.name ?? meta.label} in Google Maps`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={CORAL} />
        </svg>
      </a>
      <div className="flex items-center gap-3 pr-8">
        <span className="text-xl leading-none flex-shrink-0">{meta.emoji}</span>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: FOREST_GREEN }}>
            {poi.name ?? meta.label}
          </div>
          <div className="text-xs" style={{ color: meta.color }}>
            {meta.label}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty search state ─────────────────────────────────────────────────────────

function EmptySearchState({
  title,
  location,
  onClearSearch,
  onBroadenSearch,
}: {
  title?: string;
  location?: string | null;
  onClearSearch?: () => void;
  onBroadenSearch?: () => void;
}) {
  const heading = title ?? `No campsites found${location ? ` near ${location}` : ""}`;
  return (
    <div
      className="rounded-2xl p-4 text-center"
      style={{ background: SURFACE, border: `1.5px solid ${BORDER}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <div className="text-sm font-semibold mb-1 font-[family-name:var(--font-dm-sans)]" style={{ color: FOREST_GREEN }}>
        {heading}
      </div>
      <div className="text-xs mb-3 font-[family-name:var(--font-dm-sans)]" style={{ color: SAGE }}>
        Try broadening your search or clearing filters.
      </div>
      <div className="flex gap-2 justify-center">
        {onBroadenSearch && (
          <button
            type="button"
            onClick={onBroadenSearch}
            className="rounded-full border px-4 py-2 text-xs font-semibold font-[family-name:var(--font-dm-sans)] transition-colors"
            style={{ color: FOREST_GREEN, background: SURFACE, borderColor: BORDER }}
          >
            Edit search
          </button>
        )}
        {onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="rounded-full px-4 py-2 text-xs font-semibold text-white font-[family-name:var(--font-dm-sans)] transition-opacity hover:opacity-80"
            style={{ background: CORAL }}
          >
            Browse area
          </button>
        )}
      </div>
    </div>
  );
}

// ── DrawerContentList — scrollable card list (half/full states) ────────────────

function DrawerContentList({
  campsites,
  amenityPois,
  selectedPoi,
  poiMeta,
  selectedIdx,
  userLocation,
  cardRefs,
  compact,
  drawerMode,
  scrollRef,
  onSelectPoi,
  onHighlightPin,
  onOpenDetail,
}: {
  campsites: Campsite[];
  amenityPois: AmenityPOI[];
  selectedPoi: AmenityPOI | null;
  poiMeta: Record<string, POIMeta>;
  selectedIdx: number | null;
  userLocation: { lat: number; lng: number } | null;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  compact: boolean;
  drawerMode: DrawerMode;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectPoi?: (poi: AmenityPOI) => void;
  onHighlightPin?: (i: number) => void;
  onOpenDetail: (campsite: Campsite) => void;
}) {
  if (drawerMode === "amenity-only") {
    return (
      <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 px-4 pt-2 pb-4 space-y-2">
        {amenityPois.map((poi) => {
          const meta = poiMeta[poi.amenityType.key] ?? { emoji: "📍", label: poi.amenityType.key, color: FOREST_GREEN };
          return <POICard key={poi.id} poi={poi} meta={meta} isSelected={selectedPoi?.id === poi.id} onClick={onSelectPoi ? () => onSelectPoi(poi) : undefined} />;
        })}
      </div>
    );
  }

  const selectedPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  return (
    <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 px-4 pt-2 pb-4 space-y-2">
      {/* POI detail card — shown when an amenity pin is selected in campsite list modes */}
      {selectedPoi && selectedPoiMeta && (
        <POICard key={selectedPoi.id} poi={selectedPoi} meta={selectedPoiMeta} />
      )}
      {campsites.map((campsite, i) => (
        <CampsiteCard
          key={campsite.id}
          campsite={campsite}
          index={i}
          isSelected={selectedIdx === i}
          compact={compact}
          showIndex={false}
          userLocation={userLocation}
          cardRef={(el) => { cardRefs.current[i] = el; }}
          onSelect={() => {
            onHighlightPin?.(i);
            onOpenDetail(campsite);
          }}
        />
      ))}
    </div>
  );
}

// ── Campsite detail sheet ──────────────────────────────────────────────────────

function CampsiteDetailSheet({
  campsite,
  userLocation,
  onDismiss,
  open,
}: {
  campsite: Campsite | null;
  userLocation: { lat: number; lng: number } | null;
  onDismiss: () => void;
  open: boolean;
}) {
  const pointerStartY = useRef<number | null>(null);

  const driveTime =
    campsite && userLocation
      ? driveLabel(haversineKm(userLocation.lat, userLocation.lng, campsite.lat, campsite.lng))
      : null;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      aria-hidden={!open}
      inert={!open || undefined}
      style={{
        background: SURFACE,
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: `transform 350ms cubic-bezier(0.32,0.72,0,1)`,
        zIndex: 10,
        pointerEvents: open ? undefined : "none",
      }}
    >
      {/* Drag handle + back arrow — intercepts pointer to detect swipe-down */}
      <div
        className="flex-shrink-0 select-none"
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!(e.target as Element).closest("button")) {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointerStartY.current = e.clientY;
          }
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (pointerStartY.current !== null && e.clientY - pointerStartY.current > 60) {
            pointerStartY.current = null;
            onDismiss();
          }
        }}
        onPointerUp={() => {
          pointerStartY.current = null;
        }}
        onPointerLeave={() => {
          pointerStartY.current = null;
        }}
        onPointerCancel={() => {
          pointerStartY.current = null;
        }}
      >
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1.5 text-xs font-semibold font-[family-name:var(--font-dm-sans)] transition-opacity hover:opacity-70"
            style={{ color: SAGE }}
            aria-label="Back to results"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke={SAGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Results
          </button>
        </div>
      </div>

      {campsite && (
        <>
          <ScenicPhoto seed={1000 + (campsite.name.charCodeAt(0) || 0)} />
          <div className="overflow-y-auto flex-1 px-4 pt-3 pb-4">
            <div className="flex items-start gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <div
                  className="text-[18px] font-semibold leading-snug font-[family-name:var(--font-dm-sans)]"
                  style={{ color: FOREST_GREEN }}
                >
                  {campsite.name}
                </div>
                {(driveTime || campsite.region || campsite.blurb) && (
                  <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: SAGE }}>
                    {driveTime && <span>🚗 {driveTime}</span>}
                    {driveTime && (campsite.region ?? campsite.blurb) && <span> · </span>}
                    {campsite.region && <span>{campsite.region}</span>}
                    {campsite.region && campsite.blurb && <span> · </span>}
                    {campsite.blurb && <span>{campsite.blurb}</span>}
                  </div>
                )}
              </div>
            </div>
            {campsite.weather && campsite.weather.length > 0 && (
              <div className="mt-3">
                <WeatherStrip weather={campsite.weather} />
                <DayWeatherCells weather={campsite.weather} />
              </div>
            )}
            <AmenityTags amenities={campsite.amenities} />
          </div>
          {/* Sticky directions button */}
          <div
            className="flex-shrink-0 px-4 pb-6 pt-3"
            style={{ borderTop: `1.5px solid ${BORDER}`, background: SURFACE }}
          >
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${campsite.lat},${campsite.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-full py-3 text-sm font-semibold text-white font-[family-name:var(--font-dm-sans)] transition-opacity hover:opacity-80 active:opacity-70"
              style={{ background: CORAL }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="#fff" />
              </svg>
              Get directions
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ── BottomDrawer ───────────────────────────────────────────────────────────────

// Vaul snap points: least → most visible.
// "64px" = peek strip, HALF_VH = half viewport, 1 = full viewport.
const SNAP_POINTS: (number | string)[] = ["64px", HALF_VH, 1];
const PEEK_ONLY_SNAP_POINTS: (number | string)[] = [SNAP_POINTS[0]];

function snapForState(s: DrawerState): number | string {
  if (s === "full") return 1;
  if (s === "half") return HALF_VH;
  return "64px";
}

function stateForSnap(snap: number | string | null): DrawerState {
  if (snap === 1) return "full";
  // Vaul returns the exact value passed in SNAP_POINTS, so === is safe here.
  if (snap === HALF_VH) return "half";
  // null only occurs when dismissible=true closes the drawer — never fires here.
  return "peek";
}

// More button cycles up: peek→half→full. Collapse goes full→peek directly
// (skipping half) — drag is the natural way to land on half from full.
function cycleUp(s: DrawerState): DrawerState {
  return s === "peek" ? "half" : "full";
}

type Props = {
  campsites: Campsite[];
  hasMore: boolean;
  amenityPois: AmenityPOI[];
  poiMeta: Record<string, POIMeta>;
  selectedIdx: number | null;
  selectedPoiId: string | null;
  userLocation: { lat: number; lng: number } | null;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  drawerState: DrawerState;
  drawerMode: DrawerMode;
  parsedIntent: ParsedIntent | null;
  onDrawerStateChange: (state: DrawerState) => void;
  onSelectPin: (i: number) => void;
  onSelectPoi?: (poi: AmenityPOI) => void;
  onHighlightPin?: (i: number) => void;
  isFetching?: boolean;
  isEmpty?: boolean;
  searchLocation?: string | null;
  onClearSearch?: () => void;
  onBroadenSearch?: () => void;
};

export default function BottomDrawer({
  campsites,
  hasMore,
  amenityPois,
  poiMeta,
  selectedIdx,
  selectedPoiId,
  userLocation,
  cardRefs,
  drawerState,
  drawerMode,
  parsedIntent,
  onDrawerStateChange,
  onSelectPin,
  onSelectPoi,
  onHighlightPin,
  isFetching = false,
  isEmpty = false,
  searchLocation,
  onClearSearch,
  onBroadenSearch,
}: Props) {
  // Track the visual viewport so the drawer height stays correct when the soft
  // keyboard opens or the browser URL bar shows/hides.
  //
  // Why JS instead of CSS units:
  //   dvh  — changes with keyboard on iOS (breaks Vaul snap calculations)
  //   lvh  — may exceed innerHeight when URL bar is visible (snaps land too high)
  //   100% — relative to Drawer.Portal container, not reliable
  //
  // visualViewport.height is always the *visible* area above the keyboard on both
  // iOS and Android. When it changes, React re-renders with the new height, Vaul's
  // ResizeObserver fires, and it re-computes snap translations against the new height.
  //
  // drawerBottom handles iOS: the layout viewport doesn't shrink when the keyboard
  // opens, so `fixed bottom-0` would pin the drawer under the keyboard. Offsetting
  // by (innerHeight - visualViewport.height - visualViewport.offsetTop) lifts the
  // drawer above the keyboard.
  const [drawerHeight, setDrawerHeight] = useState<number>(
    () => (typeof window !== "undefined" ? (window.visualViewport?.height ?? window.innerHeight) : 812)
  );
  const [drawerBottom, setDrawerBottom] = useState<number>(0);
  const handleStripRef = useRef<HTMLDivElement>(null);
  const [handleStripHeight, setHandleStripHeight] = useState(52);

  useEffect(() => {
    function update() {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const bottom = vv
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;
      setDrawerHeight(height);
      setDrawerBottom(bottom);
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const el = handleStripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHandleStripHeight(entry.contentRect.height));
    ro.observe(el);
    setHandleStripHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Detail sheet state — local to the drawer.
  // detailCampsite holds the content to display (persists through close animation).
  // isDetailOpen drives the CSS transform so the sheet can animate out with content visible.
  const [detailCampsite, setDetailCampsite] = useState<Campsite | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const closeAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedScrollRef = useRef(0);

  const isFull = drawerState === "full";

  // Vaul sizes Drawer.Content to drawerHeight (full viewport) and uses translateY to
  // show only the snap-point fraction. From the browser's perspective the scroll
  // container fills the entire drawer height, so its clientHeight >> visible area and
  // the browser thinks no scrolling is needed. Constrain the content wrapper to the
  // *visible* snap height so the scroll container is properly bounded.
  const snapPx =
    drawerState === "full"
      ? drawerHeight
      : drawerState === "half"
        ? Math.round(drawerHeight * HALF_VH)
        : 64; // peek = SNAP_POINTS[0] = "64px"
  const spacerPx = isFull ? FULL_STATE_SPACER_PX : 0;
  const contentAreaHeight = Math.max(0, snapPx - spacerPx - handleStripHeight);

  const selectedPoi = selectedPoiId
    ? amenityPois.find((p) => p.id === selectedPoiId) ?? null
    : null;

  // Show empty state when the last search returned 0 results and we're not fetching
  const showEmptyState =
    isEmpty &&
    !isFetching &&
    campsites.length === 0 &&
    amenityPois.length === 0 &&
    selectedPoi === null;

  // Context-aware result label — switches on drawerMode.
  const resultLabel = (() => {
    if (drawerMode === "amenity-only") {
      const count = amenityPois.length;
      if (isFetching && count === 0) return "Finding…";
      if (count === 0) return "0 amenities found";
      const uniqueKeys = [...new Set(amenityPois.map((p) => p.amenityType.key))];
      const rawLabel =
        uniqueKeys.length === 1
          ? (poiMeta[uniqueKeys[0]]?.label ?? "amenity")
          : "amenities";
      const label = count === 1 ? rawLabel : (rawLabel.endsWith("s") ? rawLabel : `${rawLabel}s`);
      return `${count} ${label} nearby`;
    }

    if (isFetching) return "Finding…";

    if (drawerMode === "ai-search") {
      const count = campsites.length;
      const base = `${count} result${count === 1 ? "" : "s"} · ranked by weather`;
      if (parsedIntent?.location) {
        return `${base} · near ${parsedIntent.location}`;
      }
      return base;
    }

    if (drawerMode === "region" && searchLocation) {
      const count = campsites.length;
      const suffix = hasMore ? "+" : "";
      return `${count}${suffix} campsite${count === 1 ? "" : "s"} in ${searchLocation}`;
    }

    if (drawerMode === "location" && searchLocation) {
      const count = campsites.length;
      const suffix = hasMore ? "+" : "";
      return `${count}${suffix} campsite${count === 1 ? "" : "s"} near ${searchLocation}`;
    }

    // browse (and fallback when searchLocation is missing for region/location)
    const count = campsites.length;
    if (count === 0) {
      if (selectedPoi) return (poiMeta[selectedPoi.amenityType.key] ?? { label: "POI" }).label;
      return "0 campsites found";
    }
    const suffix = hasMore ? "+" : "";
    return `${count}${suffix} campsite${count === 1 ? "" : "s"} nearby`;
  })();

  // hasContent drives drawer expansion; amenity-only mode uses POI count.
  const hasContent =
    campsites.length > 0 ||
    selectedPoi !== null ||
    (drawerMode === "amenity-only" && amenityPois.length > 0);
  // Allow expansion when there's content OR when showing empty state (so the card is fully visible)
  const allowExpand = hasContent || showEmptyState;

  // Peek state: show selected card (or first card) without scrolling
  const peekIdx = selectedIdx ?? 0;
  const peekCampsite = campsites[peekIdx];
  const peekPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  // Ref for the scrollable list container — used to save/restore scroll position
  // when the detail sheet opens and closes.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function openDetail(campsite: Campsite) {
    if (closeAnimTimerRef.current !== null) {
      clearTimeout(closeAnimTimerRef.current);
      closeAnimTimerRef.current = null;
    }
    savedScrollRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    setDetailCampsite(campsite);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
    // Restore scroll position after React re-renders the list.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollRef.current;
        }
      });
    });
    // Clear content after the slide-down animation completes so it stays visible during the transition.
    closeAnimTimerRef.current = setTimeout(() => {
      closeAnimTimerRef.current = null;
      setDetailCampsite(null);
    }, 350);
  }

  useEffect(() => {
    return () => {
      if (closeAnimTimerRef.current !== null) clearTimeout(closeAnimTimerRef.current);
    };
  }, []);

  // Vaul's Drawer.Content has overflow:hidden but Chrome's scrollIntoView (and
  // other browser scroll mechanisms) can still set scrollTop on it via JS, which
  // shifts all drawer content up and clips the handle strip. Guard against this
  // by listening for any scroll on the dialog and immediately resetting to 0.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const dialog = container.closest('[role="dialog"]') as HTMLElement | null;
    if (!dialog) return;
    const reset = () => { if (dialog.scrollTop !== 0) dialog.scrollTop = 0; };
    dialog.addEventListener("scroll", reset, { passive: true });
    reset(); // clear any scrollTop left over from a previous render cycle
    return () => dialog.removeEventListener("scroll", reset);
  }, []);

  // When a map pin is tapped while the detail sheet is already open, update the
  // displayed campsite so the sheet reflects the newly selected pin.
  useEffect(() => {
    if (isDetailOpen && selectedIdx !== null) {
      const campsite = campsites[selectedIdx];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (campsite) setDetailCampsite(campsite);
    }
  }, [selectedIdx, isDetailOpen, campsites]);

  // Close the detail sheet whenever the drawer snaps to peek (e.g. user drags
  // it down). Leaving it open in peek state hides the peek card behind the sheet.
  useEffect(() => {
    if (drawerState !== "peek") return;
    if (!isDetailOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDetailOpen(false);
    if (closeAnimTimerRef.current !== null) clearTimeout(closeAnimTimerRef.current);
    closeAnimTimerRef.current = setTimeout(() => {
      closeAnimTimerRef.current = null;
      setDetailCampsite(null);
    }, 350);
  }, [drawerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the selected card into view when selectedIdx changes.
  // We avoid scrollIntoView because Chrome also scrolls ancestor overflow:hidden
  // elements (including Vaul's Drawer.Content), which shifts the drawer content
  // upward and clips the handle strip. Instead we set scrollTop directly on the
  // scroll container so only the inner list scrolls.
  // Guard: if isDetailOpen is true at render time, this change came from a card
  // tap (onHighlightPin + openDetail fire in the same event, React batches them),
  // so the card is already visible — skip the scroll.
  useEffect(() => {
    if (selectedIdx === null || isDetailOpen) return;
    const i = selectedIdx;
    const timer = setTimeout(() => {
      const card = cardRefs.current[i];
      const container = scrollContainerRef.current;
      if (!card || !container) return;
      const cardTop =
        card.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      container.scrollTop = Math.max(0, cardTop - 8);
    }, DRAWER_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Empty state title for amenity-only mode
  const emptyTitle =
    drawerMode === "amenity-only" ? "No amenities found" : undefined;

  return (
    <Drawer.Root
      snapPoints={allowExpand ? SNAP_POINTS : PEEK_ONLY_SNAP_POINTS}
      activeSnapPoint={allowExpand ? snapForState(drawerState) : SNAP_POINTS[0]}
      setActiveSnapPoint={(snap) => { if (allowExpand) onDrawerStateChange(stateForSnap(snap)); }}
      // modal=false: the map and UI above the drawer stay fully interactive.
      modal={false}
      // dismissible=false: peek is the minimum — the drawer never disappears.
      dismissible={false}
      // fadeFromIndex=0 prevents Vaul's overlay-snap-point logic from treating
      // the half snap point (index 1) as fadeFromIndex-1, which would cause
      // getPercentageDragged to return 1 immediately when dragging down from
      // half — triggering the dismissible=false drag block before any movement.
      fadeFromIndex={0}
      // Always open; onOpenChange is a no-op since we control state via drawerState.
      open
      onOpenChange={() => {}}
      // Prevent Vaul from adding overflow:hidden or background-color to <body>.
      noBodyStyles
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed left-0 right-0 flex flex-col z-50 outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            height: drawerHeight,
            bottom: drawerBottom,
            background: SURFACE,
            borderRadius: isFull ? 0 : "1rem 1rem 0 0",
            borderTop: isFull ? "none" : `1.5px solid ${BORDER}`,
            boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
            overflow: "hidden",
            // Transition border-radius so it animates alongside Vaul's snap
            // rather than snapping instantly when drawerState commits.
            transition: `border-radius ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32,0.72,0,1)`,
          }}
        >
          {/* Visually-hidden title for screen readers — Vaul extends Radix Dialog
              which requires either aria-label or a Drawer.Title to be present. */}
          <Drawer.Title className="sr-only">Search results</Drawer.Title>

          {/* Spacer — pushes content below the floating search bar + chips (z-[60])
              in full state. Animating the height (rather than mount/unmount) prevents
              the handle from jumping when entering or leaving full state. */}
          <div
            style={{
              height: isFull ? FULL_STATE_SPACER_PX : 0,
              flexShrink: 0,
              overflow: "hidden",
              transition: `height ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32,0.72,0,1)`,
            }}
          />

          {/* Handle strip — drag pill + summary row + More/Less button.
              Vaul attaches its own pointer-event listeners to Drawer.Content so
              dragging anywhere on the strip (or the card list) moves the drawer.
              Vaul's internal scroll detection prevents card-list scrolling from
              accidentally triggering a drawer drag. */}
          <div
            ref={handleStripRef}
            className="flex-shrink-0 select-none cursor-grab"
            style={{ borderTop: isFull ? `1.5px solid ${BORDER}` : "none" }}
          >
            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: BORDER }} />
            </div>

            {/* Summary row */}
            <div className="px-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold${isFetching ? " animate-pulse" : ""}`}
                  style={{ color: FOREST_GREEN }}
                >
                  {resultLabel}
                </span>
                {isFetching && (
                  <div
                    className="w-4 h-4 rounded-full animate-spin flex-shrink-0"
                    style={{ border: `2px solid ${BORDER}`, borderTopColor: CORAL }}
                  />
                )}
              </div>
              {/* More / Less button — hidden when there's no content to expand into */}
              {hasContent && (
                <button
                  type="button"
                  className="text-[11px] font-bold flex-shrink-0 ml-2"
                  style={{ color: CORAL }}
                  onClick={() =>
                    onDrawerStateChange(drawerState === "full" ? "peek" : cycleUp(drawerState))
                  }
                  aria-label={drawerState === "full" ? "Collapse drawer" : "Expand drawer"}
                >
                  {drawerState === "full" ? "▼ Less" : "▲ More"}
                </button>
              )}
            </div>
          </div>

          {/* Content wrapper — CampsiteDetailSheet is absolute inset-0 relative to this
              div, so it clips to the card-list area below the handle strip rather than
              covering the full Drawer.Content (which would hide the handle strip and
              overlap the floating search bar). */}
          <div
            className="relative flex-shrink-0 overflow-hidden flex flex-col"
            style={{
              height: contentAreaHeight,
              transition: `height ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32,0.72,0,1)`,
            }}
          >
            {/* Campsite detail sheet — absolute overlay, slides up when a card is tapped */}
            <CampsiteDetailSheet
              campsite={detailCampsite}
              userLocation={userLocation}
              open={isDetailOpen}
              onDismiss={closeDetail}
            />

            {/* Scrollable card list (or empty state) — visible in half and full states */}
            {drawerState !== "peek" && (
              showEmptyState ? (
                <div className="overflow-y-auto flex-1 px-4 pt-2 pb-4">
                  <EmptySearchState
                    title={emptyTitle}
                    location={searchLocation}
                    onClearSearch={onClearSearch}
                    onBroadenSearch={onBroadenSearch}
                  />
                </div>
              ) : (
                <DrawerContentList
                  campsites={campsites}
                  amenityPois={amenityPois}
                  selectedPoi={selectedPoi}
                  poiMeta={poiMeta}
                  selectedIdx={selectedIdx}
                  userLocation={userLocation}
                  cardRefs={cardRefs}
                  compact={drawerState !== "full"}
                  drawerMode={drawerMode}
                  scrollRef={scrollContainerRef}
                  onSelectPoi={onSelectPoi}
                  onHighlightPin={onHighlightPin}
                  onOpenDetail={openDetail}
                />
              )
            )}

            {/* Peek state — show selected card (or first card, or empty state) without scrolling */}
            {drawerState === "peek" && (
              <div className="px-4 pt-2 pb-4 overflow-hidden">
                {showEmptyState ? (
                  <EmptySearchState
                    title={emptyTitle}
                    location={searchLocation}
                    onClearSearch={onClearSearch}
                    onBroadenSearch={onBroadenSearch}
                  />
                ) : selectedPoi && peekPoiMeta ? (
                  <POICard poi={selectedPoi} meta={peekPoiMeta} />
                ) : peekCampsite ? (
                  <CampsiteCard
                    campsite={peekCampsite}
                    index={peekIdx}
                    isSelected={selectedIdx === peekIdx}
                    compact={true}
                    userLocation={userLocation}
                    cardRef={() => { /* peek card — ref not used for scrollIntoView */ }}
                    onSelect={() => onSelectPin(peekIdx)}
                  />
                ) : null}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
