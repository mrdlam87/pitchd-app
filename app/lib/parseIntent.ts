// NL query parsing — extracts structured intent from a plain-English camping search query.
// Used by POST /api/search. Defined here as a reusable lib so the route stays thin.
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export const DEFAULT_DRIVE_TIME_HRS = 3;
// Hard cap — prevents a hallucinated large value causing a near-full-table scan in the route
export const MAX_DRIVE_TIME_HRS = 12;

// Amenity keys Claude is allowed to return — filter out hallucinated values.
// Must match the keys seeded in prisma/seed.ts — keep in sync if the seed changes.
export const ALLOWED_AMENITIES = ["dog_friendly", "fishing", "hiking", "swimming"];

export interface ParsedIntent {
  // Extracted place name (e.g. "Blue Mountains"). Returned to the client for display
  // but not yet used to shift the search centre — geocoding is deferred to a later milestone.
  location: string | null;
  driveTimeHrs: number;
  amenities: string[];
  startDate: string | null;
  endDate: string | null;
  sortBy: "proximity" | "relevance" | null;
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
      max_tokens: 300,
      system: "JSON-only. No explanation, no markdown. Output only a single JSON object.",
      messages: [
        {
          role: "user",
          content: `Parse this Australian camping search query and extract structured intent.
<query>${safeQuery}</query>
Today: ${today}

Return ONLY this JSON shape:
{"location":null,"driveTimeHrs":3,"amenities":[],"startDate":null,"endDate":null,"sortBy":null}

Rules:
- location: the place name mentioned (e.g. "Blue Mountains", "Victoria") or null if not mentioned. Do not infer from vague queries.
- driveTimeHrs: number of hours willing to drive (1–12). Default 3 if not mentioned. "nearby"/"close" ≈ 1, "a few hours" ≈ 3, "half a day" ≈ 6. Use the exact number if stated.
- amenities: array of matching keys from [dog_friendly, fishing, hiking, swimming] — empty array if none mentioned.
- startDate / endDate: ISO date strings (YYYY-MM-DD) if dates are mentioned, otherwise null. "this weekend" = upcoming Saturday and Sunday. "next weekend" = the weekend after that.
- sortBy: "proximity" if user wants closest results, "relevance" if they want best match, null if not mentioned.`,
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
    driveTimeHrs: typeof parsed.driveTimeHrs === "number" && parsed.driveTimeHrs > 0
      ? Math.min(parsed.driveTimeHrs, MAX_DRIVE_TIME_HRS)
      : DEFAULT_DRIVE_TIME_HRS,
    amenities: Array.isArray(parsed.amenities)
      ? (parsed.amenities as unknown[]).filter(
          (a): a is string => typeof a === "string" && ALLOWED_AMENITIES.includes(a)
        )
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
  };
}
