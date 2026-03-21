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
  chipKey: string;
};

export type SearchResultsPayload = AISearchPayload | DirectFilterPayload;
