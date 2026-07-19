import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env.local");
const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS milk_sections (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0)`;
await sql`CREATE TABLE IF NOT EXISTS milk_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), section_id TEXT NOT NULL REFERENCES milk_sections(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
await sql`CREATE INDEX IF NOT EXISTS milk_entries_section_created_idx ON milk_entries(section_id, created_at DESC)`;

const starterSections = [
  ["passion", "The Passion of Milk", "Devotion, appreciation, and the enduring importance of a cold glass of milk.", 0],
  ["authority", "Milk & Authority", "Regulation, public policy, institutional suspicion, and the arguments surrounding milk.", 1],
  ["science", "The Science of Milk", "Nutrition, composition, research, and the practical case for drinking milk.", 2],
];
for (const [id, title, description, position] of starterSections) {
  await sql`INSERT INTO milk_sections (id,title,description,position) VALUES (${id},${title},${description},${position}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, position=EXCLUDED.position`;
}
console.log("Neon Milk schema is ready.");
