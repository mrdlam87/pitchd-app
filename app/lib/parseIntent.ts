// NL query parsing — extracts structured intent from a plain-English camping search query.
// Used by POST /api/search. Defined here as a reusable lib so the route stays thin.
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export const DEFAULT_DRIVE_TIME_HRS = 3;
// Hard cap — prevents a hallucinated large value causing a near-full-table scan in the route
export const MAX_DRIVE_TIME_HRS = 12;
// Conversion factor: 1 hour of driving ≈ 80km (Australian highway speeds)
export const KM_PER_HOUR = 80;

// Amenity keys Claude is allowed to return — filter out hallucinated values.
// Must match the keys seeded in prisma/seed.ts — keep in sync if the seed changes.
export const ALLOWED_AMENITIES = ["dog_friendly", "fishing", "hiking", "swimming"] as const;

// POI type keys Claude is allowed to return for amenity-only queries.
// Must match AmenityType.key values seeded in prisma/seed.ts.
export const ALLOWED_POI_TYPES = ["dump_point", "water_fill", "toilets", "laundromat"] as const;

export interface ParsedIntent {
  // Geographic area used to centre the search radius (city, region, state)
  location: string | null;
  // Specific campsite, campground, or reserve name — distinct from a geographic area
  siteName: string | null;
  driveTimeHrs: number;
  amenities: string[];
  // Free-form amenity descriptions Claude extracted but couldn't map to ALLOWED_AMENITIES.
  // Stored for future ranking; not used by the DB query in this version.
  amenityHints: string[];
  startDate: string | null;
  endDate: string | null;
  sortBy: "proximity" | "relevance" | null;
  // Determines which result pipeline the search route uses
  resultType: "campsites" | "amenities" | null;
  // POI type keys when resultType === "amenities" — filtered to ALLOWED_POI_TYPES
  poiTypes: string[] | null;
}

// ISO date guard — rejects free-text and calendar-invalid dates (e.g. 2026-02-30)
export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().startsWith(s);
}

// Lazy init — defers SDK instantiation (and the missing-API-key throw) to request time
let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export async function parseIntentWithClaude(query: string): Promise<ParsedIntent> {
  const today = new Date().toISOString().split("T")[0];

  // Escape angle brackets to prevent prompt injection via </query> tag breakout
  const safeQuery = query.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 10-second timeout — prevents the request hanging if the Anthropic API is slow
  const message = await getAnthropicClient().messages.create(
    {
      model: HAIKU_MODEL,
      max_tokens: 400,
      system: "JSON-only. No explanation, no markdown. Output only a single JSON object.",
      messages: [
        {
          role: "user",
          content: `Parse this Australian camping search query and extract structured intent.
<query>${safeQuery}</query>
Today: ${today}

Return ONLY this JSON shape:
{"location":null,"siteName":null,"driveTimeHrs":3,"amenities":[],"amenityHints":[],"startDate":null,"endDate":null,"sortBy":null,"resultType":null,"poiTypes":null}

Rules:
- location: geographic area used to centre the search radius (city, region, state, e.g. "Blue Mountains", "Victoria") — or null if not mentioned. Do not infer from vague queries.
- siteName: specific campsite, campground, or reserve name the user is searching for (e.g. "Lane Cove campground", "Royal National Park") — NOT a city or region. Use location for areas. null if not a specific named site.
- driveTimeHrs: number of hours willing to drive (1–12). Default 3 if not mentioned. "nearby"/"close" ≈ 1, "a few hours" ≈ 3, "half a day" ≈ 6. Use the exact number if stated.
- amenities: array of matching keys from [dog_friendly, fishing, hiking, swimming] — empty array if none mentioned.
- amenityHints: array of amenity descriptions the user mentioned that are NOT in the amenities list above (e.g. ["firepit", "flush toilets", "river views", "mountain views"]). Empty array if none.
- startDate / endDate: ISO date strings (YYYY-MM-DD) if dates are mentioned, otherwise null. "this weekend" = upcoming Saturday and Sunday. "next weekend" = the weekend after that.
- sortBy: "proximity" if user wants closest results, "relevance" if they want best match, null if not mentioned.
- resultType: "amenities" if the query is clearly about finding a service or amenity POI (dump points, water fill stations, toilets, laundromats). "campsites" if the query is clearly about finding a campsite or campground. null if ambiguous or unclear.
- poiTypes: array of POI type keys when resultType is "amenities", chosen from [dump_point, water_fill, toilets, laundromat]. null when resultType is not "amenities".`,
        },
      ],
    },
    { timeout: 10_000 }
  );

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude returned invalid JSON");

  const parsed = JSON.parse(text.slice(start, end + 1));

  return {
    location: typeof parsed.location === "string" && parsed.location.trim() !== "" ? parsed.location.trim() : null,
    siteName: typeof parsed.siteName === "string" && parsed.siteName.trim() !== "" ? parsed.siteName.trim() : null,
    driveTimeHrs: typeof parsed.driveTimeHrs === "number" && parsed.driveTimeHrs >= 1
      ? Math.min(parsed.driveTimeHrs, MAX_DRIVE_TIME_HRS)
      : DEFAULT_DRIVE_TIME_HRS,
    amenities: Array.isArray(parsed.amenities)
      ? (parsed.amenities as unknown[]).filter(
          (a): a is string => typeof a === "string" && (ALLOWED_AMENITIES as readonly string[]).includes(a)
        )
      : [],
    amenityHints: Array.isArray(parsed.amenityHints)
      ? (parsed.amenityHints as unknown[])
          .filter((h): h is string => typeof h === "string")
          .slice(0, 10)
          .map((h) => h.slice(0, 100))
      : [],
    startDate:
      typeof parsed.startDate === "string" && isValidIsoDate(parsed.startDate)
        ? parsed.startDate
        : null,
    endDate:
      typeof parsed.endDate === "string" && isValidIsoDate(parsed.endDate)
        ? parsed.endDate
        : null,
    sortBy:
      parsed.sortBy === "proximity" || parsed.sortBy === "relevance"
        ? parsed.sortBy
        : null,
    resultType:
      parsed.resultType === "amenities" ? "amenities"
      : parsed.resultType === "campsites" ? "campsites"
      : null,
    poiTypes: Array.isArray(parsed.poiTypes)
      ? (parsed.poiTypes as unknown[]).filter(
          (p): p is string => typeof p === "string" && (ALLOWED_POI_TYPES as readonly string[]).includes(p)
        )
      : null,
  };
}
