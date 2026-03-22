// Shared quick-filter chip definitions used by HomeScreen and MapView.
// Defined here so the two lists can't drift independently.
// `primary` marks the Pitchd brand chip — it uses coral for its active colour;
// category chips (weather, dog, etc.) use forest green when active.
import { ALLOWED_AMENITIES } from "@/lib/parseIntent";

// filterKey: when non-null, HomeScreen taps this chip using a direct DB filter
// instead of calling the AI — no API cost, instant navigation.
// Typed against ALLOWED_AMENITIES so a typo is a compile error, not a silent no-op.
type FilterKey = (typeof ALLOWED_AMENITIES)[number] | null;

// POI type keys must match AmenityType.key values seeded in the DB.
// Typed as a const tuple so a typo in AMENITY_CHIPS is a compile error, not a runtime 400.
export const ALLOWED_POI_TYPES = ["dump_point", "water_fill"] as const;
type PoiType = (typeof ALLOWED_POI_TYPES)[number];

export const QUICK_CHIPS = [
  { kind: "quick" as const, key: "pitchd",  label: "Pitchd pick",  icon: "logo" as const, primary: true,  filterKey: null           as FilterKey, query: "Best camping spots with great weather this weekend" },
  { kind: "quick" as const, key: "weather", label: "Good weather", icon: "☀️",            primary: false, filterKey: null           as FilterKey, query: "Dry sunny camping this weekend" },
  { kind: "quick" as const, key: "dog",     label: "Dog friendly", icon: "🐕",            primary: false, filterKey: "dog_friendly" as FilterKey, query: "Dog friendly camping this weekend" },
  { kind: "quick" as const, key: "fishing", label: "Fishing",      icon: "🎣",            primary: false, filterKey: "fishing"      as FilterKey, query: "Camping with fishing this weekend" },
  { kind: "quick" as const, key: "hiking",  label: "Hiking",       icon: "🥾",            primary: false, filterKey: "hiking"       as FilterKey, query: "Camping near excellent hiking trails this weekend" },
] as const satisfies readonly {
  kind: "quick";
  key: string;
  label: string;
  icon: "logo" | (string & {});
  primary: boolean;
  filterKey: FilterKey;
  query: string;
}[];

export type QuickChip = (typeof QUICK_CHIPS)[number];

// Map-only chips that filter amenity POIs directly — not shown on HomeScreen.
export const AMENITY_CHIPS = [
  { kind: "amenity" as const, key: "dump",  label: "Dump points", icon: "🚐", poiType: "dump_point" },
  { kind: "amenity" as const, key: "water", label: "Water fill",  icon: "💧", poiType: "water_fill"  },
] as const satisfies readonly {
  kind: "amenity";
  key: string;
  label: string;
  icon: string;
  poiType: PoiType;
}[];

export type AmenityChip = (typeof AMENITY_CHIPS)[number];
