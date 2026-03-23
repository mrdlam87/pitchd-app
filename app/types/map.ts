// Shared map data types — mirror Prisma model shapes but are decoupled from the
// ORM so they can be used across API routes, server components, and UI layers.

// Extracted first-day weather data from an Open-Meteo forecast response.
export type WeatherDay = {
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
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
  // Attached client-side after the batch weather fetch — absent on initial load.
  weather?: WeatherDay | null;
};

export type AmenityPOI = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  amenityType: { key: string };
};

export type POIMeta = { emoji: string; label: string; color: string };
