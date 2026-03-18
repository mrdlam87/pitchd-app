import { afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});
