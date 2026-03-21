// Shared quick-filter chip definitions used by HomeScreen and MapView.
// Defined here so the two lists can't drift independently.
// `primary` marks the Pitchd brand chip — it uses coral for its active colour;
// category chips (weather, dog, etc.) use forest green when active.
import { ALLOWED_AMENITIES } from "@/lib/parseIntent";

// filterKey: when non-null, HomeScreen taps this chip using a direct DB filter
// instead of calling the AI — no API cost, instant navigation.
// Typed against ALLOWED_AMENITIES so a typo is a compile error, not a silent no-op.
type FilterKey = (typeof ALLOWED_AMENITIES)[number] | null;

export const QUICK_CHIPS: readonly {
  key: string;
  label: string;
  icon: "logo" | (string & {});
  primary: boolean;
  filterKey: FilterKey;
  query: string;
}[] = [
  { key: "pitchd",  label: "Pitchd pick",  icon: "logo", primary: true,  filterKey: null,           query: "Best camping spots with great weather this weekend" },
  { key: "weather", label: "Good weather", icon: "☀️",   primary: false, filterKey: null,           query: "Dry sunny camping this weekend" },
  { key: "dog",     label: "Dog friendly", icon: "🐕",   primary: false, filterKey: "dog_friendly", query: "Dog friendly camping this weekend" },
  { key: "fishing", label: "Fishing",      icon: "🎣",   primary: false, filterKey: "fishing",      query: "Camping with fishing this weekend" },
  { key: "hiking",  label: "Hiking",       icon: "🥾",   primary: false, filterKey: "hiking",       query: "Camping near excellent hiking trails this weekend" },
];

export type QuickChip = (typeof QUICK_CHIPS)[number];

// Map-only chips that filter amenity POIs directly — not shown on HomeScreen.
export const AMENITY_CHIPS = [
  { key: "dump",  label: "Dump points", icon: "🚐", poiType: "dump_point" },
  { key: "water", label: "Water fill",  icon: "💧", poiType: "water_fill"  },
] as const;

export type AmenityChip = (typeof AMENITY_CHIPS)[number];
