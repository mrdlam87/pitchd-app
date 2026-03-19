/**
 * Seeds a handful of AmenityPOI records near Sydney for local testing.
 * Run with: npx tsx scripts/seed-test-pois.ts
 * Remove with: npx tsx scripts/seed-test-pois.ts --clean
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const TEST_POIS = [
  { key: "dump_point", name: "Test Dump Point — Centennial Park",  lat: -33.895, lng: 151.232 },
  { key: "dump_point", name: "Test Dump Point — Homebush",         lat: -33.845, lng: 151.072 },
  { key: "water_fill", name: "Test Water Fill — Lane Cove",        lat: -33.815, lng: 151.173 },
  { key: "water_fill", name: "Test Water Fill — Manly",            lat: -33.797, lng: 151.285 },
  { key: "toilets",    name: "Test Toilets — Bondi",               lat: -33.891, lng: 151.274 },
  { key: "laundromat", name: "Test Laundromat — Newtown",          lat: -33.898, lng: 151.179 },
];

async function main() {
  const clean = process.argv.includes("--clean");

  if (clean) {
    const { count } = await prisma.amenityPOI.deleteMany({ where: { source: "test" } });
    console.log(`Removed ${count} test AmenityPOI records.`);
    return;
  }

  console.log("Seeding test AmenityPOI records near Sydney...");

  // Delete any existing test records first so re-runs are idempotent
  await prisma.amenityPOI.deleteMany({ where: { source: "test" } });

  for (const { key, name, lat, lng } of TEST_POIS) {
    const amenityType = await prisma.amenityType.findUnique({ where: { key } });
    if (!amenityType) {
      console.warn(`  ⚠ AmenityType not found for key="${key}" — run prisma/seed.ts first`);
      continue;
    }
    await prisma.amenityPOI.create({
      // sourceId uses the display name here as a stable dedup key for test records.
      // Real ingested records use provider IDs (e.g. "osm:node:12345").
      data: { name, lat, lng, amenityTypeId: amenityType.id, source: "test", sourceId: name },
    });
    console.log(`  ✓ ${name}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
