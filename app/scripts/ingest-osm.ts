/**
 * OSM ingestion script — queries Overpass API for all tourism=camp_site in Australia
 * and upserts records into the Campsite table by sourceId.
 *
 * Usage: npm run db:ingest-osm
 */

import * as https from "https";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SyncStatus } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 120_000; // 2 minutes per state query
// Delay between region queries to avoid rate-limiting
const BETWEEN_REQUESTS_MS = 10_000;

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
  { code: "VIC", latMin: -39.2, latMax: -36.0, lngMin: 140.9, lngMax: 150.0 },
  { code: "SA",  latMin: -38.1, latMax: -25.9, lngMin: 129.0, lngMax: 141.0 },
  { code: "WA",  latMin: -35.1, latMax: -13.7, lngMin: 113.3, lngMax: 129.0 },
  { code: "NT",  latMin: -26.0, latMax: -10.7, lngMin: 129.0, lngMax: 138.1 },
  { code: "QLD", latMin: -29.2, latMax: -10.7, lngMin: 137.9, lngMax: 153.6 },
  { code: "NSW", latMin: -37.5, latMax: -28.2, lngMin: 140.9, lngMax: 153.6 },
];

// OSM tag → AmenityType key mapping.
// Each entry matches if ANY of the [tag, value] pairs is present on the element.
const OSM_AMENITY_TAGS: Array<{ match: [string, string][]; key: string }> = [
  { match: [["dog", "yes"], ["dog", "leashed"]], key: "dog_friendly" },
  { match: [["fishing", "yes"], ["sport", "fishing"]], key: "fishing" },
  { match: [["swimming", "yes"], ["sport", "swimming"]], key: "swimming" },
  { match: [["sanitary_dump_station", "yes"]], key: "dump_point" },
  { match: [["drinking_water", "yes"]], key: "water_fill" },
  { match: [["toilets", "yes"], ["toilets:indoor", "yes"], ["toilets:outdoor", "yes"]], key: "toilets" },
];

function extractAmenityKeys(tags: Record<string, string>): string[] {
  const result: string[] = [];
  for (const { match, key } of OSM_AMENITY_TAGS) {
    if (match.some(([k, v]) => tags[k] === v)) {
      result.push(key);
    }
  }
  return result;
}

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

async function fetchStateElementsOnce(
  stateCode: string,
  bbox: string,
  endpointUrl: string
): Promise<OverpassElement[]> {
  const query = `
[out:json][timeout:115];
(
  node["tourism"="camp_site"](${bbox});
  way["tourism"="camp_site"](${bbox});
  relation["tourism"="camp_site"](${bbox});
);
out center;
`.trim();

  const body = `data=${encodeURIComponent(query)}`;
  const url = new URL(endpointUrl);

  const json = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        family: 4, // force IPv4 — IPv6 is unreachable on this host
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "pitchd-osm-ingest/1.0 (github.com/mrdlam87/pitchd-app)",
        },
        timeout: OVERPASS_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${stateCode}: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (!text.trimStart().startsWith("{")) {
            reject(new Error(`${stateCode}: unexpected response: ${text.slice(0, 200)}`));
          } else {
            resolve(text);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`${stateCode}: request timed out`));
    });
    req.on("error", (err) => reject(new Error(`${stateCode}: ${(err as NodeJS.ErrnoException).code ?? err.message}`)));
    req.write(body);
    req.end();
  });

  const data = JSON.parse(json) as OverpassResponse;
  return data.elements;
}

async function fetchStateElements(
  stateCode: string,
  bbox: string
): Promise<OverpassElement[]> {
  // Try each endpoint in order, with a retry per endpoint
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await fetchStateElementsOnce(stateCode, bbox, endpoint);
      } catch (err) {
        const isLastAttempt = attempt === 2;
        const isLastEndpoint = endpoint === OVERPASS_ENDPOINTS[OVERPASS_ENDPOINTS.length - 1];
        if (isLastAttempt && isLastEndpoint) throw err;
        if (!isLastAttempt) {
          console.log(` attempt ${attempt} failed (${endpoint.includes("kumi") ? "kumi" : "main"}), retrying in 15s...`);
          await new Promise((resolve) => setTimeout(resolve, 15_000));
        } else {
          console.log(` failed on main, trying mirror in 5s...`);
          await new Promise((resolve) => setTimeout(resolve, 5_000));
        }
      }
    }
  }
  throw new Error(`${stateCode}: all endpoints exhausted`);
}

// Regions to fetch — large states are split into sub-regions to stay within Overpass limits
const FETCH_REGIONS: Array<{ label: string; bbox: string }> = [
  { label: "ACT",     bbox: "-35.9,148.7,-35.1,149.4" },
  { label: "TAS",     bbox: "-43.6,143.8,-39.5,148.5" },
  { label: "VIC",     bbox: "-39.2,140.9,-33.9,150.0" },
  { label: "SA",      bbox: "-38.1,129.0,-25.9,141.0" },
  { label: "WA",      bbox: "-35.1,113.3,-13.7,129.0" },
  { label: "NT",      bbox: "-26.0,129.0,-10.7,138.1" },
  // QLD split north/south at lat -20
  { label: "QLD-S",   bbox: "-29.2,137.9,-20.0,153.6" },
  { label: "QLD-N",   bbox: "-20.0,137.9,-10.7,153.6" },
  // NSW split north/south at lat -33
  { label: "NSW-S",   bbox: "-37.5,140.9,-33.0,153.6" },
  { label: "NSW-N",   bbox: "-33.0,140.9,-28.2,153.6" },
];

async function fetchOverpassData(): Promise<OverpassElement[]> {
  const allElements = new Map<string, OverpassElement>(); // dedup by "type:id"

  for (const region of FETCH_REGIONS) {
    process.stdout.write(`  Fetching ${region.label}...`);
    const elements = await fetchStateElements(region.label, region.bbox);
    let added = 0;
    for (const el of elements) {
      const key = `${el.type}:${el.id}`;
      if (!allElements.has(key)) {
        allElements.set(key, el);
        added++;
      }
    }
    console.log(` ${elements.length} returned, ${added} new`);
    // Delay between regions to avoid rate-limiting — skip after the last one
    if (region !== FETCH_REGIONS.at(-1)) {
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
    }
  }

  return Array.from(allElements.values());
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
  amenityKeys: string[];
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
  const name = tags.name || tags["name:en"] || "Unnamed campsite";
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
    amenityKeys: extractAmenityKeys(tags),
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Fetch OSM data
    console.log("Querying Overpass API (state by state)...");
    const elements = await fetchOverpassData();

    // 2. Map elements to records (skip elements without a usable coordinate)
    const records = elements
      .map(elementToRecord)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    console.log(`  → ${records.length} records to process (${elements.length - records.length} skipped — no center coordinate)`);

    // 3a. Load AmenityType key → id map (needed for CampsiteAmenity inserts)
    const amenityTypes = await prisma.amenityType.findMany({ select: { id: true, key: true } });
    const amenityTypeMap = new Map(amenityTypes.map((a) => [a.key, a.id]));

    // 3. Load existing OSM records from DB — include fields needed for change detection
    console.log("Loading existing OSM records from DB...");
    const existing = await prisma.campsite.findMany({
      where: { source: "osm", syncStatus: { not: SyncStatus.removed } },
      select: { id: true, sourceId: true, syncStatus: true, name: true, lat: true, lng: true, state: true },
    });

    interface ExistingRow { id: string; syncStatus: SyncStatus; name: string; lat: number; lng: number; state: string }
    const existingMap = new Map<string, ExistingRow>(); // sourceId → db row
    for (const row of existing) {
      if (row.sourceId) existingMap.set(row.sourceId, row);
    }

    console.log(`  → ${existingMap.size} existing OSM records in DB`);

    // 4. Split into inserts, updates, removals, and re-activations
    const fetchedSourceIds = new Set(records.map((r) => r.sourceId));
    const toInsert = records.filter((r) => !existingMap.has(r.sourceId));
    // Only update records where something actually changed — avoids ~7000 no-op DB writes per run.
    // Re-activations (syncStatus change) are always included.
    const toUpdate = records.filter((r) => {
      const ex = existingMap.get(r.sourceId);
      if (!ex) return false;
      return (
        ex.syncStatus !== SyncStatus.active ||
        r.name !== ex.name ||
        Math.abs(r.lat - ex.lat) > 1e-6 ||
        Math.abs(r.lng - ex.lng) > 1e-6 ||
        r.state !== ex.state
      );
    });
    const toRemove = Array.from(existingMap.keys()).filter((id) => !fetchedSourceIds.has(id));
    // Re-activations: previously unverified records that are now back in OSM as active
    const reactivatedCount = toUpdate.filter(
      (r) => existingMap.get(r.sourceId)?.syncStatus !== SyncStatus.active
    ).length;

    const unchanged = records.filter((r) => existingMap.has(r.sourceId)).length - toUpdate.length;
    console.log(`Processing: ${toInsert.length} to insert, ${toUpdate.length} to update, ${unchanged} unchanged, ${toRemove.length} to mark removed...`);

    // 5. Insert new records in batches, then link their amenities
    const INSERT_BATCH = 500;
    let inserted = 0;
    let amenityLinksCreated = 0;
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH);
      // createMany doesn't return IDs — look up the inserted records by sourceId afterwards
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await prisma.campsite.createMany({ data: batch.map(({ amenityKeys: _amenityKeys, ...rest }) => rest), skipDuplicates: true });

      // Sync amenities for newly inserted campsites
      const batchWithAmenities = batch.filter((r) => r.amenityKeys.length > 0);
      if (batchWithAmenities.length > 0) {
        const sourceIds = batchWithAmenities.map((r) => r.sourceId);
        const dbRecords = await prisma.campsite.findMany({
          where: { sourceId: { in: sourceIds } },
          select: { id: true, sourceId: true },
        });
        const dbIdBySourceId = new Map(dbRecords.map((r) => [r.sourceId, r.id]));
        const amenityRows: { campsiteId: string; amenityTypeId: string }[] = [];
        for (const r of batchWithAmenities) {
          const dbId = dbIdBySourceId.get(r.sourceId);
          if (!dbId) continue;
          for (const key of r.amenityKeys) {
            const typeId = amenityTypeMap.get(key);
            if (typeId) amenityRows.push({ campsiteId: dbId, amenityTypeId: typeId });
          }
        }
        if (amenityRows.length > 0) {
          await prisma.campsiteAmenity.createMany({ data: amenityRows, skipDuplicates: true });
          amenityLinksCreated += amenityRows.length;
        }
      }

      inserted += batch.length;
      process.stdout.write(`\r  → Inserted ${inserted}/${toInsert.length}`);
    }
    if (toInsert.length > 0) console.log(); // newline after progress

    // 6. Update existing records in batches (also syncs amenities)
    const UPDATE_BATCH = 100;
    let updated = 0;
    let amenityLinksUpdated = 0;
    for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
      const batch = toUpdate.slice(i, i + UPDATE_BATCH);
      const dbIds = batch.map((r) => existingMap.get(r.sourceId)!.id);

      // Parallel campsite updates — records are independent, no need for a single transaction
      await Promise.all(
        batch.map((r) => {
          const dbId = existingMap.get(r.sourceId)!.id;
          return prisma.campsite.update({
            where: { id: dbId },
            data: {
              name: r.name,
              slug: r.slug,
              lat: r.lat,
              lng: r.lng,
              state: r.state,
              syncStatus: r.syncStatus,
              lastSyncedAt: r.lastSyncedAt,
            },
          });
        })
      );

      // Sync amenities: bulk-delete all existing links for the batch, then bulk-insert current OSM tags.
      // This ensures stale amenity data is removed when OSM tags change.
      await prisma.campsiteAmenity.deleteMany({ where: { campsiteId: { in: dbIds } } });
      const amenityRows: { campsiteId: string; amenityTypeId: string }[] = [];
      for (const r of batch) {
        const dbId = existingMap.get(r.sourceId)!.id;
        for (const key of r.amenityKeys) {
          const typeId = amenityTypeMap.get(key);
          if (typeId) amenityRows.push({ campsiteId: dbId, amenityTypeId: typeId });
        }
      }
      if (amenityRows.length > 0) {
        await prisma.campsiteAmenity.createMany({ data: amenityRows, skipDuplicates: true });
      }
      amenityLinksUpdated += amenityRows.length;

      updated += batch.length;
      process.stdout.write(`\r  → Updated ${updated}/${toUpdate.length}`);
    }
    if (toUpdate.length > 0) console.log();

    // 7. Mark stale OSM records as removed in batches
    const REMOVE_BATCH = 500;
    let removed = 0;
    for (let i = 0; i < toRemove.length; i += REMOVE_BATCH) {
      const batch = toRemove.slice(i, i + REMOVE_BATCH);
      const ids = batch.map((sourceId) => existingMap.get(sourceId)!.id);
      await prisma.campsite.updateMany({
        where: { id: { in: ids } },
        data: { syncStatus: SyncStatus.removed },
      });
      removed += batch.length;
      process.stdout.write(`\r  → Marked removed ${removed}/${toRemove.length}`);
    }
    if (toRemove.length > 0) console.log();

    const skipped = elements.length - records.length;
    console.log("\nDone.");
    console.log(`  Inserted     : ${inserted}`);
    console.log(`  Updated      : ${updated}`);
    console.log(`  Reactivated  : ${reactivatedCount}`);
    console.log(`  Unchanged    : ${unchanged}`);
    console.log(`  Removed      : ${removed}`);
    console.log(`  Skipped      : ${skipped} (no coordinate)`);
    console.log(`  Amenity links: ${amenityLinksCreated} created (new), ${amenityLinksUpdated} synced (updated)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
