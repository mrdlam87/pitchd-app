// Shared types and constants for passing search results from HomeScreen to MapView.
// Kept in lib/ so neither component imports from the other.

import type { Campsite } from "@/types/map";
import type { ParsedIntent } from "@/lib/parseIntent";

export const SEARCH_RESULTS_KEY = "pitchd:searchResults";

// AI-powered NL search — campsites returned by Claude + DB query.
export type AISearchPayload = {
  kind: "ai";
  campsites: Campsite[];
  parsedIntent: ParsedIntent;
  query: string;
  // Key of the quick chip that triggered the search (e.g. "pitchd", "weather").
  // Undefined for custom NL queries typed in the textarea.
  chipKey?: string;
};

// Direct DB filter — chip maps directly to an activity filter, no AI call.
export type DirectFilterPayload = {
  kind: "direct";
  filters: { activities: string[]; pois: string[] };
  // Stored for analytics / future use (e.g. highlighting the originating chip).
  // Map.tsx intentionally does not read this on arrival — active chip state is
  // derived from activeFilters rather than a separate chip-key field.
  chipKey: string;
};

export type SearchResultsPayload = AISearchPayload | DirectFilterPayload;

// Parses and validates an unknown value (e.g. from JSON.parse) as a SearchResultsPayload.
// Returns null if the shape is invalid. Exported for unit testing.
export function parseSearchResultsPayload(parsed: unknown): SearchResultsPayload | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.kind === "direct") {
    if (typeof obj.chipKey !== "string") return null;
    if (typeof obj.filters !== "object" || obj.filters === null) return null;
    const f = obj.filters as Record<string, unknown>;
    if (!Array.isArray(f.activities) || !Array.isArray(f.pois)) return null;
    // String check only — ALLOWED_AMENITIES validation is intentionally deferred to the
    // DB query layer (campsites route filters on known keys via Prisma enum).
    if (!(f.activities as unknown[]).every((a: unknown) => typeof a === "string")) return null;
    if (!(f.pois as unknown[]).every((p: unknown) => typeof p === "string")) return null;
    return parsed as SearchResultsPayload;
  }

  // AISearchPayload (kind === "ai" or legacy payload without kind field).
  // Normalise legacy entries by writing kind: "ai" so downstream narrowing works correctly
  // rather than silently falling through every kind === "ai" check.
  if (!Array.isArray(obj.campsites)) return null;
  const pi = (obj.parsedIntent ?? {}) as Record<string, unknown>;
  if (!Array.isArray(pi.amenities)) return null;
  if (!(pi.amenities as unknown[]).every((a: unknown) => typeof a === "string")) return null;
  // Spot-check item shapes — a malformed or null entry would crash fitToCampsites
  const campsites = obj.campsites as unknown[];
  if (!campsites.every((c) => c !== null && typeof (c as Record<string, unknown>).lat === "number" && typeof (c as Record<string, unknown>).lng === "number")) {
    return null;
  }
  if (!obj.kind) obj.kind = "ai";
  return parsed as SearchResultsPayload;
}
