/**
 * Shared database connection for CLI tools.
 * Loads DATABASE_URL from .env.local automatically.
 */
import postgres from "postgres";
import { loadDotEnvLocal } from "./env.mjs";

loadDotEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in .env.local.");
  process.exit(1);
}

export const sql = postgres(process.env.DATABASE_URL);

/** Helper: query with tagged template */
export { sql as db };
