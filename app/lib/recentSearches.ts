const KEY = "pitchd:recentSearches";
const MAX = 5;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  try {
    const current = getRecentSearches();
    const deduped = [query, ...current.filter((s) => s !== query)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(deduped));
  } catch {
    // localStorage unavailable or full — fail silently
  }
}
