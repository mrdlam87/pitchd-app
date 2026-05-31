import { ALLOWED_AMENITIES } from "@/lib/parseIntent";

// filterKey: when non-null, tap triggers a direct DB amenity filter.
// weatherFilter: client-side toggle handled by Map.tsx — hides campsites with weatherScore < 45.
// freeFilter: direct isFree=true DB filter applied by Map.tsx browse endpoint.
type FilterKey = (typeof ALLOWED_AMENITIES)[number] | null;

export const ALLOWED_POI_TYPES = ["dump_point", "water_fill"] as const;
type PoiType = (typeof ALLOWED_POI_TYPES)[number];

export const QUICK_CHIPS = [
  {
    kind: "quick" as const,
    key: "pitchd",
    label: "Pitchd pick",
    icon: "logo" as const,
    primary: true,
    filterKey: null as FilterKey,
    query: "Best campsite within 3 hours with good weather this weekend",
  },
  {
    kind: "quick" as const,
    key: "weather",
    label: "Good weather",
    icon: "☀️",
    primary: false,
    filterKey: null as FilterKey,
    query: "",
    weatherFilter: true as const,
  },
  {
    kind: "quick" as const,
    key: "free",
    label: "Free",
    icon: "🆓",
    primary: false,
    filterKey: null as FilterKey,
    query: "",
    freeFilter: true as const,
  },
  { kind: "quick" as const, key: "dog",     label: "Dog friendly", icon: "🐕", primary: false, filterKey: "dog_friendly" as FilterKey, query: "Dog friendly camping this weekend" },
  { kind: "quick" as const, key: "fishing", label: "Fishing",      icon: "🎣", primary: false, filterKey: "fishing" as FilterKey,      query: "Camping with fishing this weekend" },
  { kind: "quick" as const, key: "hiking",  label: "Hiking",       icon: "🥾", primary: false, filterKey: "hiking" as FilterKey,       query: "Camping near excellent hiking trails this weekend" },
] as const satisfies readonly {
  kind: "quick";
  key: string;
  label: string;
  icon: "logo" | (string & {});
  primary: boolean;
  filterKey: FilterKey;
  query: string;
  weatherFilter?: true;
  freeFilter?: true;
}[];

export type QuickChip = (typeof QUICK_CHIPS)[number];

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
