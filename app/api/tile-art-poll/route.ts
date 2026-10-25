import { getDatabase } from "@/lib/neon";
import { isMilkOwner } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Choice = "artwork" | "real-images";
const choices: Choice[] = ["artwork", "real-images"];

async function ensurePoll(sql: ReturnType<typeof getDatabase>) {
  await sql`CREATE TABLE IF NOT EXISTS tile_art_poll_votes (
    voter_id TEXT PRIMARY KEY,
    choice TEXT NOT NULL CHECK (choice IN ('artwork', 'real-images')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function readPoll(sql: ReturnType<typeof getDatabase>, voterId: string | null, canViewResults: boolean) {
  let totals: Record<Choice, number> | null = null;
  if (canViewResults) {
    const rows = await sql`SELECT choice, COUNT(*)::int AS votes FROM tile_art_poll_votes GROUP BY choice` as Array<{ choice: Choice; votes: number }>;
    totals = { artwork: 0, "real-images": 0 };
    for (const row of rows) if (choices.includes(row.choice)) totals[row.choice] = row.votes;
  }
  let choice: Choice | null = null;
  if (voterId) {
    const own = await sql`SELECT choice FROM tile_art_poll_votes WHERE voter_id = ${voterId} LIMIT 1` as Array<{ choice: Choice }>;
    choice = own[0]?.choice ?? null;
  }
  return { totals, choice, canViewResults };
}

export async function GET(request: Request) {
  try {
    const voterId = new URL(request.url).searchParams.get("voterId");
    const sql = getDatabase();
    await ensurePoll(sql);
    return Response.json(await readPoll(sql, voterId?.slice(0, 100) ?? null, await isMilkOwner()));
  } catch (error) {
    console.error("Unable to load tile image poll", error);
    return Response.json({ error: "Poll tally is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { voterId?: unknown; choice?: unknown };
    const voterId = typeof input.voterId === "string" ? input.voterId.trim().slice(0, 100) : "";
    const choice = input.choice;
    if (!voterId || !choices.includes(choice as Choice)) return Response.json({ error: "Choose one poll option." }, { status: 400 });
    const sql = getDatabase();
    await ensurePoll(sql);
    await sql`INSERT INTO tile_art_poll_votes (voter_id, choice) VALUES (${voterId}, ${choice as Choice}) ON CONFLICT (voter_id) DO NOTHING`;
    return Response.json(await readPoll(sql, voterId, await isMilkOwner()));
  } catch (error) {
    console.error("Unable to record tile image poll vote", error);
    return Response.json({ error: "Your vote could not be recorded." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const voterId = new URL(request.url).searchParams.get("voterId")?.trim().slice(0, 100);
    if (!voterId) return Response.json({ error: "Missing voter." }, { status: 400 });
    const sql = getDatabase();
    await ensurePoll(sql);
    await sql`DELETE FROM tile_art_poll_votes WHERE voter_id = ${voterId}`;
    return Response.json(await readPoll(sql, voterId, await isMilkOwner()));
  } catch (error) {
    console.error("Unable to reset tile image test vote", error);
    return Response.json({ error: "The test vote could not be reset." }, { status: 503 });
  }
}
