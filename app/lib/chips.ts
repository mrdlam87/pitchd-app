// Shared quick-filter chip definitions used by HomeScreen and MapView.
// Defined here so the two lists can't drift independently.
// `primary` marks the Pitchd brand chip — it uses coral for its active colour;
// category chips (weather, dog, etc.) use forest green when active.
export const QUICK_CHIPS = [
  { key: "pitchd",  label: "Pitchd pick",  icon: "logo" as const, primary: true,  query: "Best camping spots with great weather this weekend" },
  { key: "weather", label: "Good weather", icon: "☀️",             primary: false, query: "Dry sunny camping this weekend" },
  { key: "dog",     label: "Dog friendly", icon: "🐕",             primary: false, query: "Dog friendly camping this weekend" },
  { key: "fishing", label: "Fishing",      icon: "🎣",             primary: false, query: "Camping with fishing this weekend" },
  { key: "hiking",  label: "Hiking",       icon: "🥾",             primary: false, query: "Camping near excellent hiking trails this weekend" },
] as const;

export type QuickChip = (typeof QUICK_CHIPS)[number];
