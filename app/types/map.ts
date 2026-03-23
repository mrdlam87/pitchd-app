// Shared map data types — mirror Prisma model shapes but are decoupled from the
// ORM so they can be used across API routes, server components, and UI layers.

// Per-day weather data extracted from an Open-Meteo forecast response.
export type WeatherDay = {
  date: string;               // ISO date e.g. "2024-03-23"
  dayName: string;            // Short day label e.g. "SAT"
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipProbability: number | null; // null when absent from cached forecast
  weatherCode: number;
};

export type Campsite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  blurb: string | null;
  amenities: { key: string; label: string; icon: string; color: string }[];
  // Multi-day forecast attached client-side after the batch weather fetch.
  // Absent on initial load; null if weather fetch failed.
  weather?: WeatherDay[] | null;
};

export type AmenityPOI = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  amenityType: { key: string };
};

export type POIMeta = { emoji: string; label: string; color: string };
