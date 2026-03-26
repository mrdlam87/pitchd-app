import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // max: 1 prevents connection pool exhaustion in serverless (Vercel).
  // Each function invocation is short-lived; a single connection per instance is sufficient.
  // The real fix is to use Supabase's transaction mode URL (port 6543) in DATABASE_URL,
  // which releases connections after each transaction instead of holding them for the session.
  const adapter = new PrismaPg({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5_000, // fail fast rather than hanging until Vercel's function timeout
    idleTimeoutMillis: 10_000,      // release idle connections promptly between requests
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
