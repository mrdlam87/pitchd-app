import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const empty = await prisma.campsite.findFirst({ where: { name: "" }, select: { id: true, sourceId: true, lat: true, lng: true, state: true } });
  console.log("Empty name record:", JSON.stringify(empty));

  const kuringgai = await prisma.campsite.findMany({ where: { lat: { gte: -33.8, lte: -33.5 }, lng: { gte: 151.0, lte: 151.3 } }, select: { name: true, lat: true, lng: true }, take: 5 });
  console.log("Near Ku-ring-gai:", JSON.stringify(kuringgai));

  const myall = await prisma.campsite.findMany({ where: { lat: { gte: -32.7, lte: -32.2 }, lng: { gte: 152.0, lte: 152.6 } }, select: { name: true, lat: true, lng: true }, take: 5 });
  console.log("Near Myall Lakes:", JSON.stringify(myall));

  const wilsons = await prisma.campsite.findMany({ where: { lat: { gte: -39.2, lte: -38.8 }, lng: { gte: 146.2, lte: 146.6 } }, select: { name: true, lat: true, lng: true }, take: 5 });
  console.log("Near Wilsons Prom:", JSON.stringify(wilsons));

  await prisma.$disconnect();
}

main().catch(console.error);
