"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.warn("[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
}

// Default centre: roughly the middle of Australia
const DEFAULT_VIEWPORT = {
  longitude: 134.0,
  latitude: -25.5,
  zoom: 4,
};

// Design tokens
const FOREST_GREEN = "#2d4a2d";
const SURFACE = "#f7f5f0";
const CORAL = "#e8674a";

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

async function fetchCampsites(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<FetchResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(Math.min(Math.max(radiusKm, 1), 250)),
  });
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

function computeRadius(map: mapboxgl.Map): number {
  const bounds = map.getBounds();
  if (!bounds) return 250;
  const latSpan = (bounds.getNorth() - bounds.getSouth()) / 2;
  const lngSpan = (bounds.getEast() - bounds.getWest()) / 2;
  // Apply cos(lat) correction — at ~30°S, 1° lng ≈ 96 km not 111 km
  const centerLat = (bounds.getNorth() + bounds.getSouth()) / 2;
  const latSpanKm = latSpan * 111;
  const lngSpanKm = lngSpan * 111 * Math.cos((centerLat * Math.PI) / 180);
  return Math.sqrt(latSpanKm ** 2 + lngSpanKm ** 2);
}

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipNextFetch = useRef(false);
  // Monotonic counter — discard results from stale in-flight requests
  const fetchCounterRef = useRef(0);

  // Request user geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {
        /* denied or unavailable — no-op */
      }
    );
  }, []);

  const loadCampsites = useCallback((map: mapboxgl.Map) => {
    const id = ++fetchCounterRef.current;
    const center = map.getCenter();
    const radius = computeRadius(map);
    fetchCampsites(center.lat, center.lng, radius).then(
      ({ results, hasMore }) => {
        if (id !== fetchCounterRef.current) return; // stale fetch — discard
        cardRefs.current = []; // clear stale DOM refs from the previous result set
        setCampsites(results);
        setHasMore(hasMore);
        setSelectedIdx(null);
      }
    );
  }, []);

  const handleLoad = useCallback(
    (e: { target: mapboxgl.Map }) => loadCampsites(e.target),
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
    (i: number) => {
      setSelectedIdx(i);
      const campsite = campsites[i];
      if (campsite && mapRef.current) {
        // Known edge case: a manual pan that starts during the 300ms easeTo animation
        // will have its moveend consumed by this flag (no refetch fires for that gesture).
        // Low-frequency and acceptable for MVP.
        skipNextFetch.current = true;
        mapRef.current.easeTo({
          center: [campsite.lng, campsite.lat],
          duration: 300,
        });
      }
      requestAnimationFrame(() => {
        cardRefs.current[i]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    },
    [campsites]
  );

  const resultLabel =
    campsites.length === 0
      ? ""
      : hasMore
      ? `${campsites.length}+ campsites nearby`
      : `${campsites.length} campsites nearby`;

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        mapLib={mapboxgl}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEWPORT}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
      >
        {/* User location dot */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
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
            .replace(" State Park", " SP")
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
              <div
                role="button"
                tabIndex={0}
                className="flex flex-col items-center cursor-pointer select-none transition-all duration-150"
                style={{
                  filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSel ? 0.45 : 0.28}))`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectPin(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectPin(i);
                  }
                }}
                aria-label={`Select campsite ${i + 1}: ${campsite.name}`}
              >
                {/* Rounder teardrop pin — circle takes ~70% of height, tip is short + soft */}
                <svg
                  width={pinW}
                  height={pinH}
                  viewBox="0 0 26 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
                    fill={isSel ? FOREST_GREEN : "#fff"}
                    stroke={FOREST_GREEN}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
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
                {/* Name label — Google Maps style: text only, white outline for legibility */}
                <div
                  className="mt-0.5 whitespace-nowrap font-semibold"
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
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl flex flex-col max-h-[40vh] z-50"
          style={{
            background: SURFACE,
            borderTop: "1.5px solid #e0dbd0",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#e0dbd0]" />
          </div>

          {/* Result count */}
          <div className="px-4 pb-2 text-sm font-semibold flex-shrink-0 text-[#2d4a2d]">
            {resultLabel}
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
                  className="rounded-xl p-3 cursor-pointer transition-all duration-150"
                  style={{
                    border: isSel
                      ? `1.5px solid ${CORAL}`
                      : "1.5px solid #e0dbd0",
                    background: isSel ? "#fff" : SURFACE,
                  }}
                >
                  <div className="flex items-center gap-3">
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
