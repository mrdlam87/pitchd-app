import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const amenityTypes = [
  // Activities
  {
    key: "dog_friendly",
    label: "Dog friendly",
    icon: "🐕",
    color: "#b85a20",
    category: "activity",
  },
  {
    key: "fishing",
    label: "Fishing",
    icon: "🎣",
    color: "#2a6eb0",
    category: "activity",
  },
  {
    key: "hiking",
    label: "Hiking",
    icon: "🥾",
    color: "#5a6ab0",
    category: "activity",
  },
  {
    key: "swimming",
    label: "Swimming",
    icon: "🏊",
    color: "#2aa8a0",
    category: "activity",
  },
  // POIs
  {
    key: "dump_point",
    label: "Dump point",
    icon: "🚐",
    // Was #c8870a — collided with the "Good" weather-score pin colour (#c8a040 in
    // lib/weatherScore.ts). Keep in sync with POI_META in components/Map.tsx.
    color: "#944294",
    category: "poi",
  },
  {
    key: "water_fill",
    label: "Water fill",
    icon: "💧",
    color: "#2a8ab0",
    category: "poi",
  },
  {
    key: "laundromat",
    label: "Laundromat",
    icon: "🧺",
    color: "#7a6ab0",
    category: "poi",
  },
  {
    key: "toilets",
    label: "Toilets",
    icon: "🚻",
    // Was #4a9e6a — identical to the "Great" weather-score pin colour. Keep in
    // sync with POI_META in components/Map.tsx.
    color: "#1e3a5f",
    category: "poi",
  },
];

async function main() {
  console.log("Seeding AmenityType records...");

  for (const { key, ...rest } of amenityTypes) {
    await prisma.amenityType.upsert({
      where: { key },
      update: rest,
      create: { key, ...rest },
    });
    console.log(`  ✓ ${key}`);
  }

  console.log(`Done. ${amenityTypes.length} AmenityType records seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
