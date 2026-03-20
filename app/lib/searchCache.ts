// SearchCache lib — reusable helpers for hashing, reading, and writing NL search cache entries.
// Used by POST /api/search. Keeping this logic here means the route stays thin and the
// cache behaviour can be tested and reused independently.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  isValidIsoDate,
  ALLOWED_AMENITIES,
  DEFAULT_DRIVE_TIME_HRS,
  MAX_DRIVE_TIME_HRS,
  type ParsedIntent,
} from "@/lib/parseIntent";
import type { Prisma } from "@/lib/generated/prisma/client";

// 2-hour cache TTL — matches the SearchCache strategy in technical-design.md
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// Normalise query before hashing: lowercase + trim so "Blue Mountains" and
// "blue mountains " hash to the same entry.
export function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase().trim()).digest("hex");
}

// Check the cache for an unexpired entry matching queryHash.
// Returns the sanitised ParsedIntent on hit, null on miss or expiry.
// Sanitises on read — a tampered or pre-migration entry could have bad values.
export async function getCachedIntent(queryHash: string): Promise<ParsedIntent | null> {
  const cached = await prisma.searchCache.findUnique({ where: { queryHash } });

  if (!cached || cached.expiresAt <= new Date()) return null;

  const raw = cached.parsedIntentJson as unknown as ParsedIntent;
  const rawDriveTime =
    typeof raw.driveTimeHrs === "number" && raw.driveTimeHrs >= 1
      ? raw.driveTimeHrs
      : DEFAULT_DRIVE_TIME_HRS;

  return {
    location:
      typeof raw.location === "string" && raw.location.trim() !== ""
        ? raw.location.trim()
        : null,
    driveTimeHrs: Math.min(rawDriveTime, MAX_DRIVE_TIME_HRS),
    // Re-filter amenities in case the entry predates the current ALLOWED_AMENITIES list
    amenities: Array.isArray(raw.amenities)
      ? raw.amenities.filter(
          (a): a is string => typeof a === "string" && ALLOWED_AMENITIES.includes(a)
        )
      : [],
    startDate:
      typeof raw.startDate === "string" && isValidIsoDate(raw.startDate)
        ? raw.startDate
        : null,
    endDate:
      typeof raw.endDate === "string" && isValidIsoDate(raw.endDate)
        ? raw.endDate
        : null,
    sortBy:
      raw.sortBy === "proximity" || raw.sortBy === "relevance" ? raw.sortBy : null,
  };
}

// Upsert a SearchCache entry with a 2-hour TTL from now.
// Upsert handles the case where an expired record already exists for this hash.
export async function setCachedIntent(
  queryHash: string,
  queryText: string,
  intent: ParsedIntent
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.searchCache.upsert({
    where: { queryHash },
    create: {
      queryHash,
      queryText,
      parsedIntentJson: intent as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      queryText,
      parsedIntentJson: intent as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}
