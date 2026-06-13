const KEY = "pitchd:recentSearches";
const MAX = 5;

export type RecentEntry =
  | { kind: "nl";       name: string }
  | { kind: "campsite"; name: string; id: string; lat: number; lng: number; region: string | null }
  | { kind: "location"; name: string; lat: number; lng: number }
  | { kind: "region";   name: string };

function parseEntry(raw: unknown): RecentEntry | null {
  // Migrate legacy plain-string entries (stored before typed recents).
  if (typeof raw === "string") return { kind: "nl", name: raw };
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "nl"       && typeof o.name === "string") return o as RecentEntry;
  if (o.kind === "campsite" && typeof o.name === "string" && typeof o.id === "string"
      && typeof o.lat === "number" && typeof o.lng === "number"
      && (o.region === null || typeof o.region === "string")) return o as RecentEntry;
  if (o.kind === "location" && typeof o.name === "string"
      && typeof o.lat === "number" && typeof o.lng === "number") return o as RecentEntry;
  if (o.kind === "region"   && typeof o.name === "string") return o as RecentEntry;
  return null;
}

export function getRecentEntries(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseEntry).filter((e): e is RecentEntry => e !== null).slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecentEntry(entry: RecentEntry): void {
  if (entry.name.length > 200) return;
  try {
    // Deduplicate by kind+id (campsite) or kind+name so different kinds with the same
    // display name (e.g. campsite "Blue Lake" vs region "Blue Lake") don't collide.
    const current = getRecentEntries().filter((e) => {
      if (e.kind !== entry.kind) return true;
      if (e.kind === "campsite" && entry.kind === "campsite") return e.id !== entry.id;
      return e.name !== entry.name;
    });
    localStorage.setItem(KEY, JSON.stringify([entry, ...current].slice(0, MAX)));
  } catch {
    // localStorage unavailable or full — fail silently
  }
}
