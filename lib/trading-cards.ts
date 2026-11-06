import "server-only";
import { getDatabase } from "@/lib/neon";

let schemaSetup: Promise<void> | null = null;

export async function ensureTradingCardTables() {
  const sql = getDatabase();
  schemaSetup ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS trade_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(160) NOT NULL,
    description VARCHAR(3000) NOT NULL DEFAULT '',
    image_data TEXT NOT NULL,
    thumbnail_data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
    await sql`CREATE INDEX IF NOT EXISTS trade_cards_created_at_idx ON trade_cards (created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS trade_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL,
    email VARCHAR(320) NOT NULL,
    card_title VARCHAR(160) NOT NULL,
    message VARCHAR(3000) NOT NULL,
    rate_key CHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
    await sql`CREATE INDEX IF NOT EXISTS trade_inquiries_created_at_idx ON trade_inquiries (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS trade_inquiries_rate_created_idx ON trade_inquiries (rate_key, created_at DESC)`;
  })().catch((error) => { schemaSetup = null; throw error; });
  await schemaSetup;
  return sql;
}

export function mediaUrl(id: string, variant: "image" | "thumbnail") {
  return `/api/trade-cards/${id}/media?variant=${variant}`;
}
