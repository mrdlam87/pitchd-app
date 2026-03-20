// Shared types and constants for passing NL search results from HomeScreen to MapView.
// Kept in lib/ so neither component imports from the other.

import type { Campsite } from "@/types/map";
import type { ParsedIntent } from "@/lib/parseIntent";

export const SEARCH_RESULTS_KEY = "pitchd:searchResults";

export type SearchResultsPayload = {
  campsites: Campsite[];
  parsedIntent: ParsedIntent;
  query: string;
};
