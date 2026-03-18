"use client";

import mapboxgl from "mapbox-gl";
import MapGL from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  console.warn("[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
}

// Default centre: roughly the middle of Australia
const DEFAULT_VIEWPORT = {
  longitude: 134.0,
  latitude: -25.5,
  zoom: 4,
};

export default function MapView() {
  return (
    <div className="h-full w-full">
      <MapGL
        mapLib={mapboxgl}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEWPORT}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
      />
    </div>
  );
}
