import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const total = await prisma.campsite.count();
  console.log(`Total campsites: ${total}`);

  const byState = await prisma.$queryRaw<{ state: string; count: number }[]>`
    SELECT state, COUNT(*)::int as count FROM "Campsite" GROUP BY state ORDER BY count DESC
  `;
  console.log("\nBy state:");
  byState.forEach((r) => console.log(`  ${r.state}: ${r.count}`));

  const emptyName = await prisma.campsite.count({ where: { name: "" } });
  console.log(`\nEmpty name records: ${emptyName}`);

  const nullCoords = await prisma.campsite.count({
    where: { OR: [{ lat: 0 }, { lng: 0 }] },
  });
  console.log(`Zero-coordinate records: ${nullCoords}`);

  // Spot-check well-known campsites
  const spotChecks = [
    "Ku-ring-gai",
    "Myall Lakes",
    "Wilsons Prom",
    "Grampians",
    "Kakadu",
  ];
  console.log("\nSpot-checks:");
  for (const name of spotChecks) {
    const hits = await prisma.campsite.findMany({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { name: true, lat: true, lng: true, state: true },
      take: 3,
    });
    console.log(`  "${name}": ${hits.length} hit(s)`);
    hits.forEach((h) => console.log(`    → ${h.name} (${h.lat}, ${h.lng}) [${h.state}]`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
