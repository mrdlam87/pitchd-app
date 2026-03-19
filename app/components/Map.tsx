"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import FilterPanel, { type FilterState } from "./FilterPanel";
import { CORAL, FOREST_GREEN, SURFACE } from "@/lib/tokens";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.warn("[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
}

// Default centre: Sydney — used when location is denied or unavailable
const DEFAULT_VIEWPORT = {
  longitude: 151.2093,
  latitude: -33.8688,
  zoom: 10,
};

type Campsite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  blurb: string | null;
  // amenities populated in M4 — always returned by the API but not yet used in UI
  amenities: { key: string; label: string; icon: string; color: string }[];
};

type FetchResult = { results: Campsite[]; hasMore: boolean };

type Bounds = { north: number; south: number; east: number; west: number };

async function fetchCampsites(bounds: Bounds, amenities: string[] = []): Promise<FetchResult> {
  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east:  String(bounds.east),
    west:  String(bounds.west),
  });
  amenities.forEach((key) => params.append("amenities", key));
  try {
    const res = await fetch(`/api/campsites?${params}`);
    if (!res.ok) {
      console.warn(`[fetchCampsites] ${res.status} ${res.statusText}`);
      return { results: [], hasMore: false };
    }
    const data = await res.json();
    return { results: data.results ?? [], hasMore: data.hasMore ?? false };
  } catch (e) {
    console.warn("[fetchCampsites] fetch failed", e);
    return { results: [], hasMore: false };
  }
}

// Returns the exact lat/lng bounding box of the visible area above the drawer.
// Uses unproject on canvas pixel coordinates so the drawer-covered area is excluded.
function computeVisibleBounds(map: mapboxgl.Map, drawerBottomPx: number): Bounds {
  const w = map.getCanvas().clientWidth;
  const h = map.getCanvas().clientHeight;
  const visH = Math.max(h - drawerBottomPx, 1);

  const nw = map.unproject([0, 0]);
  const se = map.unproject([w, visH]);

  return {
    north: nw.lat,
    south: se.lat,
    east:  se.lng,
    west:  nw.lng,
  };
}

// Height of the visible peek strip (drag handle + result count).
// Intentionally a few px larger than the ~52px rendered height so the
// translateY never clips content and computeVisibleBounds stays conservative.
const PEEK_HEIGHT = 64;

// Drawer open height in px — mirrors the CSS `height: "40vh"`.
// Note: window.innerHeight is the visual viewport on mobile (shrinks when the
// address bar is visible) while 40vh is the layout viewport; difference is
// typically < 60px and acceptable for MVP.
const drawerOpenPx = (): number => Math.round(window.innerHeight * 0.4);

const EMPTY_FILTERS: FilterState = { activities: [], pois: [] };

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Ref mirrors state so loadCampsites always reads the latest filters without
  // needing activeFilters as a dependency (the callback is stable).
  const activeFiltersRef = useRef<FilterState>(EMPTY_FILTERS);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  // Ref mirrors state so handleLoad always reads the latest value without
  // needing userLocation as a dependency (onLoad fires only once).
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // True after onLoad fires — guards the geo callback from calling flyTo before
  // the map is ready (mapRef.current is set at render time, before onLoad).
  const mapLoadedRef = useRef(false);
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipNextFetch = useRef(false);
  // Monotonic counter — discard results from stale in-flight requests
  const fetchCounterRef = useRef(0);
  // Mirrors drawerOpen so loadCampsites (a stable useCallback) always reads the latest value
  const drawerOpenRef = useRef(true);
  // Tracks the previous fetch's result count so loadCampsites can detect 0 → results
  // transitions without calling a state setter inside another setter's updater function.
  const prevCampsitesLengthRef = useRef(0);
  // Mirrors the selected campsite's ID so loadCampsites (stable callback) can
  // re-resolve the selection index after a fetch without needing selectedIdx as a dep.
  const selectedIdRef = useRef<string | null>(null);

  // Request user geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        setUserLocation(loc);
        // Only fly if the map has fired onLoad — mapRef.current is set at render
        // time (before onLoad), so without this guard both the geo callback and
        // handleLoad would each fire a flyTo, causing a spurious cancelled-animation
        // moveend that triggers a stale loadCampsites call.
        if (mapLoadedRef.current) {
          mapRef.current?.flyTo({
            center: [loc.lng, loc.lat],
            zoom: 11,
            duration: 1200,
            padding: { top: 0, right: 0, bottom: drawerOpenPx(), left: 0 },
          });
        }
      },
      () => {
        /* denied or unavailable — map stays at DEFAULT_VIEWPORT (Sydney) */
      },
      { timeout: 10_000 }
    );
  }, []);

  const loadCampsites = useCallback((map: mapboxgl.Map) => {
    const id = ++fetchCounterRef.current;
    // Note: window.innerHeight reflects the visual viewport on mobile (shrinks when the
    // browser address bar is visible), while the CSS "40vh" is relative to the layout
    // viewport. The difference is typically < 60px and acceptable for MVP.
    const drawerBottomPx = drawerOpenRef.current
      ? drawerOpenPx()
      : PEEK_HEIGHT;
    const bounds = computeVisibleBounds(map, drawerBottomPx);
    const filters = activeFiltersRef.current;
    const amenities = [...filters.activities, ...filters.pois];
    fetchCampsites(bounds, amenities).then(
      ({ results, hasMore }) => {
        if (id !== fetchCounterRef.current) return; // stale fetch — discard
        cardRefs.current = []; // clear stale DOM refs from the previous result set
        // Re-open the drawer only on 0 → results transition so it doesn't spring
        // back open immediately after every drag. Uses a ref instead of a functional
        // updater to avoid calling a state setter inside another setter (anti-pattern).
        if (results.length > 0 && prevCampsitesLengthRef.current === 0) {
          setDrawerOpen(true);
        }
        prevCampsitesLengthRef.current = results.length;
        setCampsites(results);
        setHasMore(hasMore);
        // Preserve selection if the campsite is still in the new result set
        const newIdx = selectedIdRef.current
          ? results.findIndex((c) => c.id === selectedIdRef.current)
          : -1;
        setSelectedIdx(newIdx >= 0 ? newIdx : null);
        if (newIdx < 0) selectedIdRef.current = null;
      }
    );
  }, []);

  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  useEffect(() => {
    activeFiltersRef.current = activeFilters;
  }, [activeFilters]);

  const handleLoad = useCallback(
    (_e: { target: mapboxgl.Map }) => {
      mapLoadedRef.current = true;
      // Read from ref so we always see the latest geolocation value regardless
      // of when the geolocation promise resolved vs when the map finished loading.
      const loc = userLocationRef.current;
      if (loc) {
        mapRef.current?.flyTo({
          center: [loc.lng, loc.lat],
          zoom: 11,
          duration: 1200,
          padding: { top: 0, right: 0, bottom: drawerOpenPx(), left: 0 },
        });
      } else {
        // No user location — set the initial camera padding to match the open
        // drawer so the first pin click doesn't also animate a 0→40vh padding
        // change (which would shift the camera upward at the same time the
        // drawer CSS transition slides up, causing a double-focus bounce).
        _e.target.setPadding({ top: 0, right: 0, bottom: drawerOpenPx(), left: 0 });
        loadCampsites(_e.target);
      }
    },
    [loadCampsites]
  );

  const handleMoveEnd = useCallback(
    (e: { target: mapboxgl.Map }) => {
      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      loadCampsites(e.target);
    },
    [loadCampsites]
  );

  const selectPin = useCallback(
    (i: number, fly = true) => {
      setDrawerOpen(true);
      setSelectedIdx(i);
      const campsite = campsites[i];
      selectedIdRef.current = campsite?.id ?? null;
      if (fly && campsite && mapRef.current) {
        // Known edge case: a manual pan that starts during the 300ms easeTo animation
        // will have its moveend consumed by this flag (no refetch fires for that gesture).
        // Low-frequency and acceptable for MVP.
        skipNextFetch.current = true;
        mapRef.current.easeTo({
          center: [campsite.lng, campsite.lat],
          duration: 300,
          padding: { top: 0, right: 0, bottom: drawerOpenPx(), left: 0 },
        });
      }
      if (fly) {
        // Card click — drawer is already open, scroll immediately
        requestAnimationFrame(() => {
          cardRefs.current[i]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      } else {
        // Pin click — drawer is animating open (300ms). Delaying scrollIntoView
        // until after the transition prevents the browser from trying to scroll
        // the card into view mid-animation, which was causing the map to shift.
        setTimeout(() => {
          cardRefs.current[i]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 300);
      }
    },
    [campsites]
  );

  const handleApplyFilters = useCallback(
    (filters: FilterState) => {
      setActiveFilters(filters);
      // Write ref directly here in addition to the useEffect sync — the useEffect
      // fires after render, which is too late for the synchronous loadCampsites
      // call below. Without this, the first search after applying filters would
      // still use the previous filter values.
      activeFiltersRef.current = filters;
      setShowFilters(false);
      // Re-run the search immediately with the new filters applied
      if (mapRef.current) {
        loadCampsites(mapRef.current.getMap());
      }
    },
    [loadCampsites],
  );

  const resultLabel =
    campsites.length === 0
      ? ""
      : hasMore
      ? `${campsites.length}+ campsites nearby`
      : `${campsites.length} campsites nearby`;

  const filterCount = activeFilters.activities.length + activeFilters.pois.length;

  return (
    <div className="relative h-full w-full">
      {/* Filter panel overlay */}
      {showFilters && (
        <FilterPanel
          initialFilters={activeFilters}
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Floating Filters button — z-[60] must exceed drawer (z-50) to stay clickable */}
      <div className="absolute top-3 right-3 z-[60]">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shadow-md transition-opacity hover:opacity-90 active:opacity-70"
          style={{
            background: filterCount > 0 ? CORAL : "#fff",
            color: filterCount > 0 ? "#fff" : FOREST_GREEN,
            border: `1.5px solid ${filterCount > 0 ? CORAL : "#e0dbd0"}`,
            fontFamily: "var(--font-dm-sans), sans-serif",
          }}
          aria-label={`Filters${filterCount > 0 ? ` (${filterCount} active)` : ""}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18M7 12h10M11 18h2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Filters
          {filterCount > 0 && (
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(255,255,255,0.3)" }}
            >
              {filterCount}
            </span>
          )}
        </button>
      </div>

      <MapGL
        ref={mapRef}
        mapLib={mapboxgl}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEWPORT}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        minZoom={7}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onDragStart={() => setDrawerOpen(false)}
      >
        {/* User location dot — zIndex must exceed selected pin (10) */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} style={{ zIndex: 20 }}>
            <div
              className="w-[11px] h-[11px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              style={{
                background: CORAL,
                border: "2.5px solid #fff",
              }}
            />
          </Marker>
        )}

        {/* Campsite pins */}
        {campsites.map((campsite, i) => {
          const isSel = selectedIdx === i;
          const shortName = campsite.name
            .replace(" National Park", " NP")
            .replace(" Conservation Park", " CP")
            .split(" – ")[0];
          const pinW = isSel ? 34 : 26;
          const pinH = isSel ? 37 : 28;
          return (
            <Marker
              key={campsite.id}
              longitude={campsite.lng}
              latitude={campsite.lat}
              anchor="bottom"
              style={{ zIndex: isSel ? 10 : 1 }}
            >
              {/* relative container — label is absolute so anchor="bottom" pins the SVG tip to the coordinate */}
              <div
                role="button"
                tabIndex={0}
                className="relative flex flex-col items-center cursor-pointer select-none"
                onClick={(e) => {
                  e.stopPropagation();
                  selectPin(i, false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectPin(i, false);
                  }
                }}
                aria-label={`Select campsite ${i + 1}: ${campsite.name}`}
              >
                {/* Rounder teardrop pin — circle takes ~70% of height, tip is short + soft */}
                {/* width/height as CSS (not SVG attributes) so transition-all can animate size change */}
                <svg
                  style={{
                    width: pinW,
                    height: pinH,
                    filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSel ? 0.45 : 0.28}))`,
                    transition: "width 150ms, height 150ms",
                  }}
                  viewBox="0 0 26 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
                    fill={isSel ? FOREST_GREEN : "#fff"}
                    stroke={FOREST_GREEN}
                    strokeWidth="1.5"
                  />
                  {/* fontFamily hardcoded string — SVG presentation attributes don't support CSS variables */}
                  <text
                    x="13"
                    y="12.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSel ? "#fff" : FOREST_GREEN}
                    fontSize={isSel ? 11 : 9}
                    fontWeight="800"
                    fontFamily="DM Sans, sans-serif"
                  >
                    {i + 1}
                  </text>
                </svg>
                {/* Name label — absolute beside the pin (Google Maps style), wraps at max-w */}
                {/* absolute so it doesn't affect Marker height; anchor="bottom" pins SVG tip to coordinate */}
                <div
                  className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSel ? "font-bold" : "font-semibold"}`}
                  style={{
                    color: FOREST_GREEN,
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: isSel ? 11 : 10,
                    textShadow:
                      "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)",
                  }}
                >
                  {shortName}
                </div>
              </div>
            </Marker>
          );
        })}
      </MapGL>

      {/* Bottom drawer — z-50 must exceed marker z-index (max 10) to prevent bleed-through */}
      {campsites.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl flex flex-col z-50 transition-transform duration-300 ease-in-out"
          style={{
            height: "40vh",
            transform: drawerOpen
              ? "translateY(0)"
              : `translateY(calc(100% - ${PEEK_HEIGHT}px))`,
            background: SURFACE,
            borderTop: "1.5px solid #e0dbd0",
          }}
        >
          {/* Peek strip — always visible, tapping reopens the drawer */}
          <div
            className="flex-shrink-0 cursor-pointer"
            onClick={() => setDrawerOpen(true)}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#e0dbd0]" />
            </div>
            {/* Result count */}
            <div className="px-4 pb-2 text-sm font-semibold text-[#2d4a2d]">
              {resultLabel}
            </div>
          </div>

          {/* Scrollable card list */}
          <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
            {campsites.map((campsite, i) => {
              const isSel = selectedIdx === i;
              return (
                <div
                  key={campsite.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectPin(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectPin(i);
                    }
                  }}
                  aria-label={`Select campsite ${i + 1}: ${campsite.name}`}
                  aria-pressed={isSel}
                  className="relative rounded-xl p-3 cursor-pointer transition-all duration-150"
                  style={{
                    border: isSel
                      ? `1.5px solid ${CORAL}`
                      : "1.5px solid #e0dbd0",
                    background: isSel ? "#fff" : SURFACE,
                  }}
                >
                  {/* Navigate icon button — top-right, doesn't interfere with card content */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${campsite.lat},${campsite.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
                    style={{ background: "rgba(232,103,74,0.12)" }}
                    aria-label={`Navigate to ${campsite.name} in Google Maps`}
                  >
                    {/* Navigation send icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={CORAL} />
                    </svg>
                  </a>
                  <div className="flex items-center gap-3 pr-8">
                    {/* Index badge */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full w-6 h-6 font-extrabold"
                      style={{
                        background: isSel ? FOREST_GREEN : "transparent",
                        border: `2px solid ${FOREST_GREEN}`,
                        color: isSel ? "#fff" : FOREST_GREEN,
                        fontSize: 10,
                        fontFamily: "var(--font-dm-sans), sans-serif",
                      }}
                    >
                      {i + 1}
                    </div>
                    {/* Name + region */}
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate text-[#2d4a2d]">
                        {campsite.name}
                      </div>
                      {campsite.region && (
                        <div className="text-xs truncate text-[#5a7a5a]">
                          {campsite.region}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
