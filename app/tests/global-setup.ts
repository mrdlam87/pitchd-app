import { config } from "dotenv";
import { resolve } from "path";

export default function setup() {
  // Load .env.local before any test modules are imported so DATABASE_URL is available
  // when the Prisma singleton initialises
  config({ path: resolve(process.cwd(), ".env.local") });
}
