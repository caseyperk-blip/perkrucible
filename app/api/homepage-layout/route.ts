import { getDatabase } from "@/lib/neon";
import { isCollectionOwner } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Point = { left: number; top: number };
type HomepageLayout = {
  tickerOffset: number;
  backgroundOffset: number;
  quotePositions: Point[];
  mobileTickerOffset: number;
  mobileBackgroundOffset: number;
  mobileQuotePositions: Point[];
};

async function ensureTable() {
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS homepage_layout (
    id TEXT PRIMARY KEY,
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  return sql;
}

function points(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length === 3 && value.every((point) => {
    if (!point || typeof point !== "object") return false;
    const item = point as Record<string, unknown>;
    return typeof item.left === "number" && Number.isFinite(item.left) && item.left >= 0 && item.left <= 95
      && typeof item.top === "number" && Number.isFinite(item.top) && item.top >= 0 && item.top <= 95;
  });
}

function isLayout(value: unknown): value is HomepageLayout {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return points(item.quotePositions) && points(item.mobileQuotePositions)
    && typeof item.backgroundOffset === "number" && Number.isFinite(item.backgroundOffset) && item.backgroundOffset >= 0 && item.backgroundOffset <= 240
    && typeof item.mobileBackgroundOffset === "number" && Number.isFinite(item.mobileBackgroundOffset) && item.mobileBackgroundOffset >= -240 && item.mobileBackgroundOffset <= 240
    && typeof item.mobileTickerOffset === "number" && Number.isFinite(item.mobileTickerOffset) && item.mobileTickerOffset >= 0 && item.mobileTickerOffset <= 220;
}

export async function GET() {
  try {
    const sql = await ensureTable();
    const rows = await sql`SELECT settings FROM homepage_layout WHERE id = 'home' LIMIT 1` as Array<{ settings: HomepageLayout }>;
    return Response.json({ layout: rows[0]?.settings ?? null });
  } catch {
    return Response.json({ error: "Homepage layout is unavailable." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await isCollectionOwner()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!isLayout(body)) return Response.json({ error: "Invalid homepage layout." }, { status: 400 });

  const layout: HomepageLayout = { ...body, tickerOffset: 220 };
  try {
    const sql = await ensureTable();
    await sql`INSERT INTO homepage_layout (id, settings) VALUES ('home', ${JSON.stringify(layout)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`;
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "Homepage layout could not be saved." }, { status: 500 });
  }
}
