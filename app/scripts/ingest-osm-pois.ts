/**
 * OSM POI ingestion script — queries Overpass API for standalone amenity POIs
 * across Australia and upserts records into the AmenityPOI table by sourceId.
 *
 * POI types fetched:
 *   dump_point  → amenity=sanitary_dump_station
 *   water_fill  → amenity=drinking_water
 *   toilets     → amenity=toilets
 *   laundromat  → shop=laundry
 *
 * Usage: npm run db:ingest-osm-pois
 */

import * as https from "https";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 120_000; // 2 minutes per region query
const BETWEEN_REQUESTS_MS = 10_000; // delay between regions to avoid rate-limiting

// OSM tag → AmenityType key mapping
const POI_TAG_MAP: Array<{ tag: string; value: string; key: string }> = [
  { tag: "amenity", value: "sanitary_dump_station", key: "dump_point" },
  { tag: "amenity", value: "drinking_water",        key: "water_fill" },
  { tag: "amenity", value: "toilets",               key: "toilets"    },
  { tag: "shop",    value: "laundry",               key: "laundromat" },
];

// Regions to fetch — large states split into sub-regions to stay within Overpass limits
const FETCH_REGIONS: Array<{ label: string; bbox: string }> = [
  { label: "ACT",   bbox: "-35.9,148.7,-35.1,149.4" },
  { label: "TAS",   bbox: "-43.6,143.8,-39.5,148.5" },
  { label: "VIC",   bbox: "-39.2,140.9,-33.9,150.0" },
  { label: "SA",    bbox: "-38.1,129.0,-25.9,141.0" },
  { label: "WA",    bbox: "-35.1,113.3,-13.7,129.0" },
  { label: "NT",    bbox: "-26.0,129.0,-10.7,138.1" },
  { label: "QLD-S", bbox: "-29.2,137.9,-20.0,153.6" },
  { label: "QLD-N", bbox: "-20.0,137.9,-10.7,153.6" },
  { label: "NSW-S", bbox: "-37.5,140.9,-33.0,153.6" },
  { label: "NSW-N", bbox: "-33.0,140.9,-28.2,153.6" },
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

function detectAmenityKey(tags: Record<string, string>): string | null {
  for (const { tag, value, key } of POI_TAG_MAP) {
    if (tags[tag] === value) return key;
  }
  return null;
}

async function fetchRegionOnce(
  label: string,
  bbox: string,
  endpointUrl: string
): Promise<OverpassElement[]> {
  // Single combined query — all 4 POI types in one request per region
  const tagFilters = POI_TAG_MAP.map(({ tag, value }) =>
    `  node["${tag}"="${value}"](${bbox});\n  way["${tag}"="${value}"](${bbox});`
  ).join("\n");

  const query = `[out:json][timeout:115];\n(\n${tagFilters}\n);\nout center;`.trim();
  const body = `data=${encodeURIComponent(query)}`;
  const url = new URL(endpointUrl);

  const json = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "pitchd-osm-ingest/1.0 (github.com/mrdlam87/pitchd-app)",
        },
        timeout: OVERPASS_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${label}: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (!text.trimStart().startsWith("{")) {
            reject(new Error(`${label}: unexpected response: ${text.slice(0, 200)}`));
          } else {
            resolve(text);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`${label}: request timed out`));
    });
    req.on("error", (err) =>
      reject(new Error(`${label}: ${(err as NodeJS.ErrnoException).code ?? err.message}`))
    );
    req.write(body);
    req.end();
  });

  const data = JSON.parse(json) as OverpassResponse;
  return data.elements;
}

async function fetchRegionElements(
  label: string,
  bbox: string
): Promise<OverpassElement[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await fetchRegionOnce(label, bbox, endpoint);
      } catch (err) {
        const isLastAttempt = attempt === 2;
        const isLastEndpoint = endpoint === OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1];
        if (isLastAttempt && isLastEndpoint) throw err;
        if (!isLastAttempt) {
          console.log(
            ` attempt ${attempt} failed (${endpoint.includes("kumi") ? "kumi" : "main"}), retrying in 15s...`
          );
          await new Promise((resolve) => setTimeout(resolve, 15_000));
        } else {
          console.log(` failed on main, trying mirror...`);
        }
      }
    }
  }
  throw new Error(`${label}: all endpoints exhausted`);
}

async function fetchAllPOIs(): Promise<OverpassElement[]> {
  const allElements = new Map<string, OverpassElement>(); // dedup by "type:id"

  for (const region of FETCH_REGIONS) {
    process.stdout.write(`  Fetching ${region.label}...`);
    const elements = await fetchRegionElements(region.label, region.bbox);
    let added = 0;
    for (const el of elements) {
      const key = `${el.type}:${el.id}`;
      if (!allElements.has(key)) {
        allElements.set(key, el);
        added++;
      }
    }
    console.log(` ${elements.length} returned, ${added} new`);
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
  }

  return Array.from(allElements.values());
}

interface POIRecord {
  name: string | null;
  lat: number;
  lng: number;
  amenityKey: string;
  source: string;
  sourceId: string;
}

function elementToPOIRecord(el: OverpassElement): POIRecord | null {
  let lat: number;
  let lng: number;

  if (el.type === "node") {
    lat = el.lat;
    lng = el.lon;
  } else {
    if (!el.center) return null; // skip ways/relations without a center coordinate
    lat = el.center.lat;
    lng = el.center.lon;
  }

  const tags = el.tags ?? {};
  const amenityKey = detectAmenityKey(tags);
  if (!amenityKey) return null; // shouldn't happen given the query, but guard anyway

  const name = tags.name || tags["name:en"] || null;
  const sourceId = `osm:${el.type}:${el.id}`;

  return { name, lat, lng, amenityKey, source: "osm", sourceId };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("DRY RUN — no database writes will be made\n");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Fetch OSM data
    console.log("Querying Overpass API for amenity POIs (state by state)...");
    const elements = await fetchAllPOIs();

    // 2. Map elements to POI records (skip those without a usable coordinate)
    const records = elements
      .map(elementToPOIRecord)
      .filter((r): r is POIRecord => r !== null);

    const skipped = elements.length - records.length;
    console.log(
      `  → ${records.length} records to process (${skipped} skipped — no coordinate or unrecognised tag)`
    );

    // 3. Load AmenityType key → id map
    const amenityTypes = await prisma.amenityType.findMany({
      select: { id: true, key: true },
    });
    const amenityTypeMap = new Map(amenityTypes.map((a) => [a.key, a.id]));

    const missingKeys = [...new Set(records.map((r) => r.amenityKey))].filter(
      (k) => !amenityTypeMap.has(k)
    );
    if (missingKeys.length > 0) {
      console.warn(
        `  ⚠ Missing AmenityType rows for keys: ${missingKeys.join(", ")} — affected records will be skipped`
      );
    }

    // Filter out records whose AmenityType doesn't exist in DB
    const validRecords = records.filter((r) => amenityTypeMap.has(r.amenityKey));
    console.log(
      `  → ${validRecords.length} valid records (${records.length - validRecords.length} skipped — missing AmenityType)`
    );

    // 4. Load existing OSM AmenityPOI records from DB (including current field values for change detection)
    console.log("Loading existing OSM POI records from DB...");
    const existing = await prisma.amenityPOI.findMany({
      where: { source: "osm" },
      select: { id: true, sourceId: true, name: true, lat: true, lng: true, amenityTypeId: true },
    });

    interface ExistingRow { id: string; name: string | null; lat: number; lng: number; amenityTypeId: string }
    const existingMap = new Map<string, ExistingRow>(); // sourceId → db row
    for (const row of existing) {
      if (row.sourceId) existingMap.set(row.sourceId, row);
    }
    console.log(`  → ${existingMap.size} existing OSM POI records in DB`);

    // 5. Split into inserts, changed updates, and deletions
    const fetchedSourceIds = new Set(validRecords.map((r) => r.sourceId));
    const toInsert = validRecords.filter((r) => !existingMap.has(r.sourceId));
    const toUpdate = validRecords.filter((r) => {
      const existing = existingMap.get(r.sourceId);
      if (!existing) return false;
      const newTypeId = amenityTypeMap.get(r.amenityKey)!;
      return (
        r.name !== existing.name ||
        r.lat !== existing.lat ||
        r.lng !== existing.lng ||
        newTypeId !== existing.amenityTypeId
      );
    });
    const toDelete = Array.from(existingMap.keys()).filter(
      (id) => !fetchedSourceIds.has(id)
    );

    const unchanged = validRecords.filter((r) => existingMap.has(r.sourceId)).length - toUpdate.length;
    console.log(
      `Would process: ${toInsert.length} to insert, ${toUpdate.length} to update, ${unchanged} unchanged, ${toDelete.length} to delete`
    );

    if (dryRun) {
      console.log("\nDry run complete — no changes written.");
      console.log(`  Would insert  : ${toInsert.length}`);
      console.log(`  Would update  : ${toUpdate.length}`);
      console.log(`  Would skip    : ${unchanged} (unchanged)`);
      console.log(`  Would delete  : ${toDelete.length}`);
      console.log(`  Skipped       : ${skipped} (no coordinate or unrecognised tag)`);
      return;
    }

    // 6. Insert new records in batches
    const INSERT_BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH);
      await prisma.amenityPOI.createMany({
        data: batch.map((r) => ({
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          amenityTypeId: amenityTypeMap.get(r.amenityKey)!,
          source: r.source,
          sourceId: r.sourceId,
        })),
        skipDuplicates: true,
      });
      inserted += batch.length;
      process.stdout.write(`\r  → Inserted ${inserted}/${toInsert.length}`);
    }
    if (toInsert.length > 0) console.log();

    // 7. Update changed records using interactive $transaction with explicit timeout
    const UPDATE_BATCH = 100;
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
      const batch = toUpdate.slice(i, i + UPDATE_BATCH);
      await prisma.$transaction(
        async (tx) => {
          for (const r of batch) {
            await tx.amenityPOI.update({
              where: { id: existingMap.get(r.sourceId)!.id },
              data: {
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                amenityTypeId: amenityTypeMap.get(r.amenityKey)!,
              },
            });
          }
        },
        { timeout: 60_000 }
      );
      updated += batch.length;
      process.stdout.write(`\r  → Updated ${updated}/${toUpdate.length}`);
    }
    if (toUpdate.length > 0) console.log();

    // 8. Delete stale OSM records in batches
    const DELETE_BATCH = 500;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
      const batch = toDelete.slice(i, i + DELETE_BATCH);
      const ids = batch.map((sourceId) => existingMap.get(sourceId)!.id);
      await prisma.amenityPOI.deleteMany({ where: { id: { in: ids } } });
      deleted += batch.length;
      process.stdout.write(`\r  → Deleted ${deleted}/${toDelete.length}`);
    }
    if (toDelete.length > 0) console.log();

    console.log("\nDone.");
    console.log(`  Inserted  : ${inserted}`);
    console.log(`  Updated   : ${updated}`);
    console.log(`  Unchanged : ${unchanged}`);
    console.log(`  Deleted   : ${deleted}`);
    console.log(`  Skipped   : ${skipped} (no coordinate or unrecognised tag)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
