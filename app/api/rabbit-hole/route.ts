import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

type Slot = { subject: string; seeds: string[] };
type Topic = { title: string; subject: string; description: string; image: string; url: string };
type Summary = { title?: string; extract?: string; thumbnail?: { source?: string }; originalimage?: { source?: string }; content_urls?: { desktop?: { page?: string } }; type?: string };

const slots: Slot[] = [
  { subject: "HISTORY", seeds: ["Ancient Greece", "Dancing plague of 1518", "Mithridates VI Eupator", "Bronze Age collapse", "Antikythera mechanism", "Library of Alexandria", "Green Children of Woolpit", "Great Molasses Flood", "Sea Peoples", "Roman concrete", "Year Without a Summer", "Tarrare"] },
  { subject: "PHILOSOPHY", seeds: ["Trolley problem", "Ship of Theseus", "Chinese room", "Experience machine", "Plato's cave", "Sorites paradox", "Fermi paradox", "Simulation hypothesis", "Omnipotence paradox", "Brain in a vat", "Veil of ignorance", "Problem of induction"] },
  { subject: "PSYCHOLOGY", seeds: ["Capgras delusion", "Cotard delusion", "Stroop effect", "False memory", "Jam experiment", "Dunning–Kruger effect", "Baader–Meinhof phenomenon", "Zeigarnik effect", "Placebo effect", "Bystander effect", "Inattentional blindness", "Pavlovian conditioning"] },
  { subject: "SCIENCE", seeds: ["Transient lunar phenomenon", "Rogue planet", "Deep sea gigantism", "Magnetoreception", "Ferrofluid", "Catatumbo lightning", "Tardigrade", "Kessler syndrome", "Quantum tunnelling", "Ice volcano", "Fulgurite", "Chladni figures"] },
  { subject: "SCIENCE", seeds: ["Ball lightning", "Wow! signal", "Bloop", "Bioluminescence", "Tabby's Star", "Oumuamua", "Radioactive decay", "Sailing stones", "Blood Falls", "Brinicle", "Lake Nyos disaster", "Lunar swirls"] },
  { subject: "STRANGE MYSTERIES", seeds: ["Taos Hum", "Mary Celeste", "Voynich manuscript", "Dyatlov Pass incident", "Dighton Rock", "Dancing mania", "Oak Island mystery", "Disappearance of Frederick Valentich", "Cicada 3301", "Flannan Isles Lighthouse", "Max Headroom signal hijacking", "Green flash"] },
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
  for (const allowRecent of [false, true]) for (const seed of seeds) {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(seed.replaceAll(" ", "_"))}`, { headers: { "User-Agent": "PerkruciblePersonalArchive/1.0 (topic discovery page)" } });
    if (!response.ok) continue;
    const summary = await response.json() as Summary;
    const image = summary.originalimage?.source ?? summary.thumbnail?.source;
    if (summary.type === "disambiguation" || !summary.extract || !image || !summary.content_urls?.desktop?.page) continue;
    const normalizedTitle = (summary.title ?? seed).toLowerCase();
    if (used.has(normalizedTitle) || (!allowRecent && recent.has(normalizedTitle))) continue;
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
    const topics = await Promise.all(slots.map((slot) => topicFromSlot(slot, used, recent)));

    await sql`INSERT INTO rabbit_hole_daily_sets (date_key, topics) VALUES (${dateKey}, ${JSON.stringify(topics)}::jsonb) ON CONFLICT (date_key) DO UPDATE SET topics = EXCLUDED.topics, created_at = NOW()`;
    const final = await sql`SELECT topics FROM rabbit_hole_daily_sets WHERE date_key = ${dateKey} LIMIT 1` as Array<{ topics: unknown }>;
    return Response.json({ topics: parseStoredTopics(final[0]?.topics ?? topics) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load rabbit hole topics", error);
    return Response.json({ error: "The topic feed is unavailable." }, { status: 502 });
  }
}
