import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

type Slot = { subject: string; seeds: string[] };
type Topic = { title: string; subject: string; description: string; image: string; url: string };
type Summary = { title?: string; extract?: string; thumbnail?: { source?: string }; originalimage?: { source?: string }; content_urls?: { desktop?: { page?: string } }; type?: string };

const slots: Slot[] = [
  { subject: "HISTORY", seeds: ["Ancient Greece", "Dancing plague of 1518", "Mithridates VI Eupator", "Bronze Age collapse"] },
  { subject: "PHILOSOPHY", seeds: ["Trolley problem", "Ship of Theseus", "Chinese room", "Experience machine"] },
  { subject: "PSYCHOLOGY", seeds: ["Capgras delusion", "Cotard delusion", "Stroop effect", "False memory"] },
  { subject: "SCIENCE", seeds: ["Transient lunar phenomenon", "Rogue planet", "Deep sea gigantism", "Magnetoreception"] },
  { subject: "SCIENCE", seeds: ["Ball lightning", "Wow! signal", "Bloop", "Bioluminescence"] },
  { subject: "STRANGE MYSTERIES", seeds: ["Taos Hum", "Mary Celeste", "Voynich manuscript", "Dyatlov Pass incident"] },
];

function shuffled<T>(values: T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function todayInDenver() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function topicFromSlot(slot: Slot, used: Set<string>, recent: Set<string>): Promise<Topic> {
  const seeds = shuffled(slot.seeds);
  for (const seed of seeds) {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(seed.replaceAll(" ", "_"))}`, { headers: { "User-Agent": "PerkruciblePersonalArchive/1.0 (topic discovery page)" } });
    if (!response.ok) continue;
    const summary = await response.json() as Summary;
    const image = summary.originalimage?.source ?? summary.thumbnail?.source;
    if (summary.type === "disambiguation" || !summary.extract || !image || !summary.content_urls?.desktop?.page) continue;
    const normalizedTitle = (summary.title ?? seed).toLowerCase();
    if (used.has(normalizedTitle) || recent.has(normalizedTitle)) continue;
    used.add(normalizedTitle);
    const extract = summary.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    return {
      title: summary.title ?? seed,
      subject: slot.subject,
      description: extract.length > 300 ? `${extract.slice(0, 297).trimEnd()}…` : extract,
      image,
      url: summary.content_urls.desktop.page,
    };
  }
  throw new Error(`No fresh image topic available for ${slot.subject}`);
}

function parseStoredTopics(value: unknown): Topic[] {
  if (Array.isArray(value)) return value as Topic[];
  if (typeof value === "string") {
    try { return JSON.parse(value) as Topic[]; } catch { return []; }
  }
  return [];
}

export async function GET(request: Request) {
  try {
    const sql = getDatabase();
    await sql`CREATE TABLE IF NOT EXISTS rabbit_hole_daily_sets (date_key TEXT PRIMARY KEY, topics JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const dateKey = `${todayInDenver()}-r2`;
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const saved = await sql`SELECT topics FROM rabbit_hole_daily_sets WHERE date_key = ${dateKey} LIMIT 1` as Array<{ topics: unknown }>;
    if (saved[0] && !refresh) return Response.json({ topics: parseStoredTopics(saved[0].topics) }, { headers: { "Cache-Control": "no-store" } });

    const previous = await sql`SELECT topics FROM rabbit_hole_daily_sets WHERE date_key < ${dateKey} ORDER BY date_key DESC LIMIT 1` as Array<{ topics: unknown }>;
    const recentTitles = [
      ...previous.flatMap((row) => parseStoredTopics(row.topics).map((topic) => topic.title.toLowerCase())),
      ...(refresh && saved[0] ? parseStoredTopics(saved[0].topics).map((topic) => topic.title.toLowerCase()) : []),
    ];
    const recent = new Set(recentTitles);
    const used = new Set<string>();
    const topics: Topic[] = [];
    for (const slot of slots) topics.push(await topicFromSlot(slot, used, recent));

    await sql`INSERT INTO rabbit_hole_daily_sets (date_key, topics) VALUES (${dateKey}, ${JSON.stringify(topics)}::jsonb) ON CONFLICT (date_key) DO UPDATE SET topics = EXCLUDED.topics, created_at = NOW()`;
    const final = await sql`SELECT topics FROM rabbit_hole_daily_sets WHERE date_key = ${dateKey} LIMIT 1` as Array<{ topics: unknown }>;
    return Response.json({ topics: parseStoredTopics(final[0]?.topics ?? topics) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load rabbit hole topics", error);
    return Response.json({ error: "The topic feed is unavailable." }, { status: 502 });
  }
}
