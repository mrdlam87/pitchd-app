import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: "ok" });
}
