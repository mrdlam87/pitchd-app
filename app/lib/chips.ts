// Shared quick-filter chip definitions used by HomeScreen and MapView.
// Defined here so the two lists can't drift independently.
// `ai` marks chips that trigger NL/AI search (used by MapView to pick the active-chip colour).
export const QUICK_CHIPS = [
  { key: "pitchd",  label: "Pitchd pick",  icon: "logo" as const, ai: true,  query: "Best camping spots with great weather this weekend" },
  { key: "weather", label: "Good weather", icon: "☀️",             ai: false, query: "Dry sunny camping this weekend" },
  { key: "dog",     label: "Dog friendly", icon: "🐕",             ai: false, query: "Dog friendly camping this weekend" },
  { key: "fishing", label: "Fishing",      icon: "🎣",             ai: false, query: "Camping with fishing this weekend" },
  { key: "hiking",  label: "Hiking",       icon: "🥾",             ai: false, query: "Camping near excellent hiking trails this weekend" },
] as const;

export type QuickChip = (typeof QUICK_CHIPS)[number];
