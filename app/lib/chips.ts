// Shared quick-filter chip definitions used by HomeScreen and MapView.
// Defined here so the two lists can't drift independently.
// `primary` marks the Pitchd brand chip — it uses coral for its active colour;
// category chips (weather, dog, etc.) use forest green when active.
// filterKey: when non-null, HomeScreen taps this chip using a direct DB filter
// instead of calling the AI — no API cost, instant navigation.
// Must match an ALLOWED_AMENITIES key from lib/parseIntent.ts.
export const QUICK_CHIPS = [
  { key: "pitchd",  label: "Pitchd pick",  icon: "logo" as const, primary: true,  filterKey: null,            query: "Best camping spots with great weather this weekend" },
  { key: "weather", label: "Good weather", icon: "☀️",             primary: false, filterKey: null,            query: "Dry sunny camping this weekend" },
  { key: "dog",     label: "Dog friendly", icon: "🐕",             primary: false, filterKey: "dog_friendly",  query: "Dog friendly camping this weekend" },
  { key: "fishing", label: "Fishing",      icon: "🎣",             primary: false, filterKey: "fishing",       query: "Camping with fishing this weekend" },
  { key: "hiking",  label: "Hiking",       icon: "🥾",             primary: false, filterKey: "hiking",        query: "Camping near excellent hiking trails this weekend" },
] as const;

export type QuickChip = (typeof QUICK_CHIPS)[number];

// Map-only chips that filter amenity POIs directly — not shown on HomeScreen.
export const AMENITY_CHIPS = [
  { key: "dump",  label: "Dump points", icon: "🚐", primary: false as const, poiType: "dump_point" },
  { key: "water", label: "Water fill",  icon: "💧", primary: false as const, poiType: "water_fill"  },
] as const;

export type AmenityChip = (typeof AMENITY_CHIPS)[number];
