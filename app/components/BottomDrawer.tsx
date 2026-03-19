"use client";

import { useRef, useState } from "react";
import { CORAL, CORAL_LIGHT, FOREST_GREEN, SAGE, SURFACE } from "@/lib/tokens";
import type { AmenityPOI, Campsite, POIMeta } from "@/types/map";

export type { AmenityPOI, Campsite, POIMeta };
export type DrawerState = "peek" | "half" | "full";

// ── Heights ────────────────────────────────────────────────────────────────────

export const PEEK_HEIGHT_PX = 64;

// Duration of the CSS height transition on the drawer div — exported so Map.tsx
// can use it to delay scrollIntoView until the animation has settled.
export const DRAWER_TRANSITION_MS = 300;

/**
 * Returns the drawer height in px for a given state.
 * Client-only — reads window.innerHeight. Do not call during SSR or in render.
 */
export function getDrawerHeightPx(state: DrawerState): number {
  if (state === "peek") return PEEK_HEIGHT_PX;
  if (state === "half") return Math.round(window.innerHeight * 0.52);
  return Math.round(window.innerHeight * 0.82);
}

// ── Drive time estimate ────────────────────────────────────────────────────────

// Haversine distance in km between two lat/lng points
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough drive time label assuming 80 km/h average
function driveLabel(km: number): string {
  const mins = Math.round((km / 80) * 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `~${h} h` : `~${h} h ${m} min`;
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

function CampsiteCard({
  campsite,
  index,
  isSelected,
  userLocation,
  cardRef,
  onSelect,
}: {
  campsite: Campsite;
  index: number;
  isSelected: boolean;
  userLocation: { lat: number; lng: number } | null;
  cardRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
}) {
  const driveTime = userLocation
    ? driveLabel(haversineKm(userLocation.lat, userLocation.lng, campsite.lat, campsite.lng))
    : null;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Select campsite ${index + 1}: ${campsite.name}`}
      aria-pressed={isSelected}
      className="relative rounded-xl p-3 cursor-pointer transition-all duration-150"
      style={{
        border: isSelected ? `1.5px solid ${CORAL}` : "1.5px solid #e0dbd0",
        background: isSelected ? "#fff" : SURFACE,
      }}
    >
      {/* Navigate icon button */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${campsite.lat},${campsite.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
        style={{ background: "rgba(232,103,74,0.12)" }}
        aria-label={`Navigate to ${campsite.name} in Google Maps`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={CORAL} />
        </svg>
      </a>

      <div className="flex items-start gap-3 pr-8">
        {/* Index badge */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 font-extrabold mt-0.5"
          style={{
            background: isSelected ? FOREST_GREEN : "transparent",
            border: `2px solid ${FOREST_GREEN}`,
            color: isSelected ? "#fff" : FOREST_GREEN,
            fontSize: 10,
            fontFamily: "var(--font-dm-sans), sans-serif",
          }}
        >
          {index + 1}
        </div>

        {/* Name + region + drive time */}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate" style={{ color: FOREST_GREEN }}>
            {campsite.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: SAGE }}>
            {campsite.region && <span className="truncate">{campsite.region}</span>}
            {campsite.region && driveTime && (
              <span className="text-[#e0dbd0]">·</span>
            )}
            {driveTime && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                🚗 {driveTime}
              </span>
            )}
          </div>
          <AmenityTags amenities={campsite.amenities} />
        </div>
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
  amenityPois,
  poiMeta,
  selectedIdx,
  selectedPoiId,
  userLocation,
  cardRefs,
  onSelectPin,
}: {
  campsites: Campsite[];
  amenityPois: AmenityPOI[];
  poiMeta: Record<string, POIMeta>;
  selectedIdx: number | null;
  selectedPoiId: string | null;
  userLocation: { lat: number; lng: number } | null;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onSelectPin: (i: number) => void;
}) {
  const selectedPoi = selectedPoiId
    ? amenityPois.find((p) => p.id === selectedPoiId) ?? null
    : null;
  const selectedPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  return (
    <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
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
  // Whether we are currently mid-drag (suppresses CSS transition during drag)
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);

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

  // Drag handlers — snap between states on release
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(false);
    setDragOffsetY(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    setIsDragging(true);
    // Constrain: don't drag past drawer's natural height
    setDragOffsetY(Math.max(0, dy));
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    setIsDragging(false);
    setDragOffsetY(0);
    if (dy < -DRAG_THRESHOLD_PX) {
      onDrawerStateChange(cycleUp(drawerState));
    } else if (dy > DRAG_THRESHOLD_PX) {
      onDrawerStateChange(cycleDown(drawerState));
    }
  }

  const drawerHeightStyle =
    drawerState === "peek" ? "64px" : drawerState === "half" ? "52vh" : "82vh";

  // Peek state: show selected card (or first card) without scrolling
  const peekIdx = selectedIdx ?? 0;
  const peekCampsite = campsites[peekIdx];
  const peekPoiMeta = selectedPoi
    ? (poiMeta[selectedPoi.amenityType.key] ?? { emoji: "📍", label: selectedPoi.amenityType.key, color: FOREST_GREEN })
    : null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl flex flex-col z-50"
      style={{
        height: drawerHeightStyle,
        transform: isDragging ? `translateY(${dragOffsetY}px)` : "translateY(0)",
        transition: isDragging ? "none" : `height ${DRAWER_TRANSITION_MS}ms ease-in-out`,
        background: SURFACE,
        borderTop: "1.5px solid #e0dbd0",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Peek strip — drag handle + summary row. Tapping toggles between peek and half. */}
      <div
        className="flex-shrink-0 cursor-pointer select-none"
        onClick={() => onDrawerStateChange(drawerState === "peek" ? "half" : "peek")}
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
          amenityPois={amenityPois}
          poiMeta={poiMeta}
          selectedIdx={selectedIdx}
          selectedPoiId={selectedPoiId}
          userLocation={userLocation}
          cardRefs={cardRefs}
          onSelectPin={onSelectPin}
        />
      )}

      {/* Peek state — show selected card (or first card) without scrolling */}
      {drawerState === "peek" && (
        <div className="px-4 pb-4 overflow-hidden">
          {selectedPoi && peekPoiMeta
            ? <POICard poi={selectedPoi} meta={peekPoiMeta} />
            : peekCampsite && (
                <CampsiteCard
                  campsite={peekCampsite}
                  index={peekIdx}
                  isSelected={selectedIdx === peekIdx}
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
