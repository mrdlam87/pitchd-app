/**
 * OSM ingestion script — queries Overpass API for all tourism=camp_site in Australia
 * and upserts records into the Campsite table by sourceId.
 *
 * Usage: npm run db:ingest-osm
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SyncStatus } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// AU bounding box: south, west, north, east
const AU_BBOX = "-43.6,113.3,-10.7,153.6";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 300_000; // 5 minutes

// State bounding boxes — checked in priority order (smaller/more specific first)
const STATE_BOXES: Array<{
  code: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}> = [
  // ACT first — it sits inside NSW so must be checked first
  { code: "ACT", latMin: -35.9, latMax: -35.1, lngMin: 148.7, lngMax: 149.4 },
  { code: "TAS", latMin: -43.6, latMax: -39.5, lngMin: 143.8, lngMax: 148.5 },
  { code: "VIC", latMin: -39.2, latMax: -33.9, lngMin: 140.9, lngMax: 150.0 },
  { code: "SA",  latMin: -38.1, latMax: -25.9, lngMin: 129.0, lngMax: 141.0 },
  { code: "WA",  latMin: -35.1, latMax: -13.7, lngMin: 113.3, lngMax: 129.0 },
  { code: "NT",  latMin: -26.0, latMax: -10.7, lngMin: 129.0, lngMax: 138.1 },
  { code: "QLD", latMin: -29.2, latMax: -10.7, lngMin: 137.9, lngMax: 153.6 },
  { code: "NSW", latMin: -37.5, latMax: -28.2, lngMin: 140.9, lngMax: 153.6 },
];

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassWayOrRelation {
  type: "way" | "relation";
  id: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

type OverpassElement = OverpassNode | OverpassWayOrRelation;

interface OverpassResponse {
  elements: OverpassElement[];
}

function detectState(lat: number, lng: number): string {
  for (const box of STATE_BOXES) {
    if (
      lat >= box.latMin &&
      lat <= box.latMax &&
      lng >= box.lngMin &&
      lng <= box.lngMax
    ) {
      return box.code;
    }
  }
  return "AU"; // fallback for coordinates that don't match any state box
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function makeSlug(name: string, sourceId: string): string {
  const base = slugify(name || "campsite");
  // Append a short suffix from sourceId to guarantee uniqueness
  const suffix = sourceId.replace(/:/g, "-");
  return `${base}-${suffix}`;
}

async function fetchOverpassData(): Promise<OverpassElement[]> {
  const query = `
[out:json][timeout:300];
(
  node["tourism"="camp_site"](${AU_BBOX});
  way["tourism"="camp_site"](${AU_BBOX});
  relation["tourism"="camp_site"](${AU_BBOX});
);
out center;
`.trim();

  console.log("Querying Overpass API...");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Overpass API request timed out after 5 minutes");
    }
    throw new Error(`Overpass API request failed: ${String(err)}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(
      `Overpass API returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as OverpassResponse;
  console.log(`  → ${data.elements.length} elements returned`);
  return data.elements;
}

function elementToRecord(el: OverpassElement): {
  name: string;
  lat: number;
  lng: number;
  state: string;
  source: string;
  sourceId: string;
  slug: string;
  syncStatus: SyncStatus;
  lastSyncedAt: Date;
} | null {
  let lat: number;
  let lng: number;

  if (el.type === "node") {
    lat = el.lat;
    lng = el.lon;
  } else {
    // way or relation — use center coordinate
    if (!el.center) return null;
    lat = el.center.lat;
    lng = el.center.lon;
  }

  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? "";
  const sourceId = `osm:${el.type}:${el.id}`;
  const state = detectState(lat, lng);
  const slug = makeSlug(name, sourceId);
  const now = new Date();

  return {
    name,
    lat,
    lng,
    state,
    source: "osm",
    sourceId,
    slug,
    syncStatus: SyncStatus.active,
    lastSyncedAt: now,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Fetch OSM data
    let elements: OverpassElement[];
    try {
      elements = await fetchOverpassData();
    } catch (err) {
      console.error("Failed to fetch from Overpass API:", err);
      process.exit(1);
    }

    // 2. Map elements to records (skip elements without a usable coordinate)
    const records = elements
      .map(elementToRecord)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    console.log(`  → ${records.length} records to process (${elements.length - records.length} skipped — no center coordinate)`);

    // 3. Load existing OSM sourceIds from DB in one query
    console.log("Loading existing OSM records from DB...");
    const existing = await prisma.campsite.findMany({
      where: { source: "osm" },
      select: { id: true, sourceId: true },
    });

    const existingMap = new Map<string, string>(); // sourceId → db id
    for (const row of existing) {
      if (row.sourceId) existingMap.set(row.sourceId, row.id);
    }

    console.log(`  → ${existingMap.size} existing OSM records in DB`);

    // 4. Split into inserts and updates
    const toInsert = records.filter((r) => !existingMap.has(r.sourceId));
    const toUpdate = records.filter((r) => existingMap.has(r.sourceId));

    console.log(`Processing: ${toInsert.length} to insert, ${toUpdate.length} to update...`);

    // 5. Insert new records in batches
    const INSERT_BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH);
      await prisma.campsite.createMany({ data: batch });
      inserted += batch.length;
      process.stdout.write(`\r  → Inserted ${inserted}/${toInsert.length}`);
    }
    if (toInsert.length > 0) console.log(); // newline after progress

    // 6. Update existing records in batches using transactions
    const UPDATE_BATCH = 100;
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
      const batch = toUpdate.slice(i, i + UPDATE_BATCH);
      await prisma.$transaction(
        batch.map((r) => {
          const dbId = existingMap.get(r.sourceId)!;
          return prisma.campsite.update({
            where: { id: dbId },
            data: {
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              state: r.state,
              syncStatus: r.syncStatus,
              lastSyncedAt: r.lastSyncedAt,
            },
          });
        })
      );
      updated += batch.length;
      process.stdout.write(`\r  → Updated ${updated}/${toUpdate.length}`);
    }
    if (toUpdate.length > 0) console.log();

    const skipped = elements.length - records.length;
    console.log("\nDone.");
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Updated  : ${updated}`);
    console.log(`  Skipped  : ${skipped} (no coordinate)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
