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
    color: "#2a8ab0",
    category: "activity",
  },
  // POIs
  {
    key: "dump_point",
    label: "Dump point",
    icon: "🚐",
    color: "#c8870a",
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
    color: "#4a9e6a",
    category: "poi",
  },
];

async function main() {
  console.log("Seeding AmenityType records...");

  for (const amenity of amenityTypes) {
    await prisma.amenityType.upsert({
      where: { key: amenity.key },
      update: amenity,
      create: amenity,
    });
    console.log(`  ✓ ${amenity.key}`);
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
