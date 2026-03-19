// Shared map data types — mirror Prisma model shapes but are decoupled from the
// ORM so they can be used across API routes, server components, and UI layers.

export type Campsite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  blurb: string | null;
  amenities: { key: string; label: string; icon: string; color: string }[];
};

export type AmenityPOI = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  amenityType: { key: string };
};

export type POIMeta = { emoji: string; label: string; color: string };
