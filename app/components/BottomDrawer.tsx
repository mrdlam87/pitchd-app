"use client";

import { useEffect, useRef } from "react";
import { CORAL, CORAL_LIGHT, FOREST_GREEN, SAGE, SURFACE } from "@/lib/tokens";
import { wmoCodeToEmoji, condColorForCode } from "@/lib/weatherScore";
import type { AmenityPOI, Campsite, POIMeta, WeatherDay } from "@/types/map";
import { haversineKm } from "@/lib/distance";

export type DrawerState = "peek" | "half" | "full";

// ── Heights ────────────────────────────────────────────────────────────────────

export const PEEK_HEIGHT_PX = 64;

// Duration of the CSS height transition on the drawer div — exported so Map.tsx
// can use it to delay scrollIntoView until the animation has settled.
export const DRAWER_TRANSITION_MS = 300;

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
    style={{ background: "rgba(232,103,74,0.12)" }}
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

function POICard({ poi, meta }: { poi: AmenityPOI; meta: POIMeta }) {
  return (
    <div
      className="relative rounded-xl p-3"
      style={{ border: `1.5px solid ${meta.color}`, background: "#fff" }}
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

// ── DrawerContentList — scrollable card list (half/full states) ────────────────

function DrawerContentList({
  campsites,
  selectedPoi,
  poiMeta,
  selectedIdx,
  userLocation,
  cardRefs,
  compact,
  onSelectPin,
}: {
  campsites: Campsite[];
  selectedPoi: AmenityPOI | null;
  poiMeta: Record<string, POIMeta>;
  selectedIdx: number | null;
  userLocation: { lat: number; lng: number } | null;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  compact: boolean;
  onSelectPin: (i: number) => void;
}) {
  const selectedPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  return (
    <div className="overflow-y-auto flex-1 px-4 pt-2 pb-4 space-y-2">
      {/* POI detail card — shown when an amenity pin is selected */}
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
          onSelect={() => onSelectPin(i)}
        />
      ))}
    </div>
  );
}

// ── BottomDrawer ───────────────────────────────────────────────────────────────

const DRAG_THRESHOLD_PX = 40;

function cycleUp(s: DrawerState): DrawerState {
  return s === "peek" ? "half" : "full";
}
function cycleDown(s: DrawerState): DrawerState {
  return s === "full" ? "half" : s === "half" ? "peek" : "peek";
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
  onDrawerStateChange: (state: DrawerState) => void;
  onSelectPin: (i: number) => void;
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
  onDrawerStateChange,
  onSelectPin,
}: Props) {
  // Touch drag tracking
  const touchStartY = useRef<number | null>(null);
  // Ref to the drawer div — used for direct DOM manipulation during drag so
  // we never trigger React re-renders on every touchmove frame.
  const drawerRef = useRef<HTMLDivElement | null>(null);
  // Ref to the handle strip so we can attach a non-passive native touchmove
  // listener (React registers touch handlers as passive by default, which
  // silently ignores e.preventDefault() and spams console warnings).
  const handleStripRef = useRef<HTMLDivElement | null>(null);
  // Track whether the last touch was a drag (vs a tap) so we can suppress the
  // onClick that fires after touchEnd when the gesture was a drag, not a tap.
  const wasDragRef = useRef(false);
  // Timestamp of touch start — used for velocity-based snap decisions.
  const touchStartTimeRef = useRef<number | null>(null);

  const selectedPoi = selectedPoiId
    ? amenityPois.find((p) => p.id === selectedPoiId) ?? null
    : null;

  const resultLabel =
    campsites.length > 0
      ? hasMore
        ? `${campsites.length}+ campsites found`
        : `${campsites.length} campsite${campsites.length === 1 ? "" : "s"} found`
      : selectedPoi
      ? (poiMeta[selectedPoi.amenityType.key] ?? { label: "POI" }).label
      : "";

  // Attach a non-passive native touchmove to the handle strip so we can call
  // preventDefault() without browser console warnings.
  useEffect(() => {
    const el = handleStripRef.current;
    if (!el) return;
    function onNativeTouchMove(e: TouchEvent) {
      if (touchStartY.current === null) return;
      // Only prevent default (scroll lock) when dragging the handle
      e.preventDefault();
    }
    el.addEventListener("touchmove", onNativeTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onNativeTouchMove);
  }, []);

  // Returns the translateY offset in px for a given snap state.
  // Client-only — reads window.innerHeight.
  function offsetForState(state: DrawerState): number {
    const vh = window.innerHeight;
    if (state === "full") return 0;
    if (state === "half") return Math.round(vh * (1 - HALF_VH));
    return vh - PEEK_HEIGHT_PX;
  }

  // Drag handlers — start/end via React synthetic events; move split:
  // native listener (above) calls preventDefault() to suppress passive-listener warnings,
  // React onTouchMove updates the drawer DOM directly (no setState = no re-renders per frame).
  function handleTouchStart(e: React.TouchEvent) {
    // Reset here (not in onClick) so a drag that never fires a click event
    // doesn't leave wasDragRef stuck at true and swallow the next real tap.
    wasDragRef.current = false;
    if (e.touches.length !== 1) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
    // Kill the CSS transition for the duration of the drag so the drawer
    // tracks the finger with zero latency.
    if (drawerRef.current) drawerRef.current.style.transition = "none";
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null || !drawerRef.current) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Downward: full travel. Upward: 20 % resistance capped at 20 px so the
    // drawer communicates it can expand without flying off-screen.
    const delta = dy < 0 ? Math.max(-20, dy * 0.2) : dy;
    const base = offsetForState(drawerState);
    // Clamp so the drawer can't go above full (offset 0).
    const offset = Math.max(0, base + delta);
    drawerRef.current.style.transform = `translateY(${offset}px)`;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null || !drawerRef.current) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = touchStartTimeRef.current !== null ? Date.now() - touchStartTimeRef.current : 999;
    const velocity = dy / Math.max(dt, 1); // px/ms, positive = downward
    touchStartY.current = null;
    touchStartTimeRef.current = null;
    wasDragRef.current = Math.abs(dy) > 8;

    // Re-enable the CSS transition BEFORE calling setState, then force a
    // reflow so the browser commits it as "active". When React subsequently
    // changes only `transform` (transition is already the same value so React
    // won't touch it), the browser fires the animation from the drag-release
    // position → snap target, with no snap-back artefact.
    // Clearing to "" would cause React to set both transition + transform in
    // the same render; the browser skips the animation when both change at once.
    drawerRef.current.style.transition = `transform ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), border-radius ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    drawerRef.current.getBoundingClientRect(); // force reflow — commits the transition

    const VELOCITY_THRESHOLD = 0.4; // px/ms
    const allStates: DrawerState[] = ["peek", "half", "full"];

    if (velocity < -VELOCITY_THRESHOLD) {
      // Fast flick upward — advance one step.
      onDrawerStateChange(cycleUp(drawerState));
    } else if (velocity > VELOCITY_THRESHOLD) {
      // Fast flick downward — retreat one step.
      onDrawerStateChange(cycleDown(drawerState));
    } else {
      // Slow drag — snap to whichever position is closest to where the
      // user released. This lets a single drag go from full → peek without
      // stepping through half.
      const base = offsetForState(drawerState);
      const delta = dy < 0 ? Math.max(-20, dy * 0.2) : dy;
      const releaseOffset = Math.max(0, base + delta);
      const target = allStates.reduce((nearest, s) =>
        Math.abs(offsetForState(s) - releaseOffset) <
        Math.abs(offsetForState(nearest) - releaseOffset)
          ? s
          : nearest
      );
      onDrawerStateChange(target);
    }
  }

  const isFull = drawerState === "full";
  // The drawer is always position:fixed, top:0, height:100dvh.
  // Only transform:translateY changes — it's compositor-only so there is
  // no layout reflow on any animation frame.
  const translateOffset = isFull
    ? "0px"
    : drawerState === "half"
    ? `${Math.round((1 - HALF_VH) * 100)}dvh`
    : `calc(100dvh - ${PEEK_HEIGHT_PX}px)`;

  // Peek state: show selected card (or first card) without scrolling
  const peekIdx = selectedIdx ?? 0;
  const peekCampsite = campsites[peekIdx];
  const peekPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  return (
    <div
      ref={drawerRef}
      className="flex flex-col shadow-2xl z-50"
      style={{
        // Always fixed + full-height. Only transform:translateY moves the drawer —
        // it runs on the compositor so there is zero layout reflow during animation
        // or drag. The transform is also overridden directly via drawerRef during
        // touch drag (no React renders per frame).
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "100dvh",
        borderRadius: isFull ? 0 : "1rem 1rem 0 0",
        borderTop: isFull ? "none" : "1.5px solid #e0dbd0",
        transform: `translateY(${translateOffset})`,
        transition: `transform ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), border-radius ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        background: SURFACE,
        overflow: "hidden",
      }}
    >
      {/* Spacer — pushes content below the floating search bar + chips (z-[60]) in full
          state. Height is animated alongside the transform so the handle doesn't jump
          when entering or leaving full state. */}
      <div
        style={{
          height: isFull ? FULL_STATE_SPACER_PX : 0,
          flexShrink: 0,
          overflow: "hidden",
          transition: `height ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      />

      {/* Peek strip — drag handle + summary row.
          Touch handlers live here so only dragging the handle strip moves the drawer;
          the card list scrolls independently without triggering drag. */}
      <div
        ref={handleStripRef}
        className="flex-shrink-0 cursor-pointer select-none"
        style={{ borderTop: isFull ? "1.5px solid #e0dbd0" : "none" }}
        onClick={() => {
          // Suppress click when the touch gesture was a drag (not a tap)
          if (wasDragRef.current) { wasDragRef.current = false; return; }
          // Tap cycles upward: peek → half → full → peek (AllTrails pattern)
          onDrawerStateChange(drawerState === "full" ? "peek" : cycleUp(drawerState));
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#e0dbd0]" />
        </div>

        {/* Summary row */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="text-sm font-semibold" style={{ color: FOREST_GREEN }}>
            {resultLabel}
            {campsites.length > 0 && (
              <span className="ml-1.5 font-normal text-xs" style={{ color: SAGE }}>
                · nearby
              </span>
            )}
          </div>
          {/* More / Less toggle — cycles peek→half→full→peek */}
          <button
            type="button"
            className="text-[11px] font-bold flex-shrink-0 ml-2"
            style={{ color: CORAL }}
            onClick={(e) => {
              e.stopPropagation();
              onDrawerStateChange(drawerState === "full" ? "peek" : cycleUp(drawerState));
            }}
            aria-label={drawerState === "full" ? "Collapse drawer" : "Expand drawer"}
          >
            {drawerState === "full" ? "▼ Less" : "▲ More"}
          </button>
        </div>
      </div>

      {/* Scrollable card list — visible in half and full states */}
      {drawerState !== "peek" && (
        <DrawerContentList
          campsites={campsites}
          selectedPoi={selectedPoi}
          poiMeta={poiMeta}
          selectedIdx={selectedIdx}
          userLocation={userLocation}
          cardRefs={cardRefs}
          compact={drawerState !== "full"}
          onSelectPin={onSelectPin}
        />
      )}

      {/* Peek state — show selected card (or first card) without scrolling */}
      {drawerState === "peek" && (
        <div className="px-4 pt-2 pb-4 overflow-hidden">
          {selectedPoi && peekPoiMeta
            ? <POICard poi={selectedPoi} meta={peekPoiMeta} />
            : peekCampsite && (
                <CampsiteCard
                  campsite={peekCampsite}
                  index={peekIdx}
                  isSelected={selectedIdx === peekIdx}
                  compact={true}
                  userLocation={userLocation}
                  cardRef={() => { /* peek card — ref not used for scrollIntoView */ }}
                  onSelect={() => onSelectPin(peekIdx)}
                />
              )
          }
        </div>
      )}
    </div>
  );
}
