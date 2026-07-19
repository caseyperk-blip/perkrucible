import { getDatabase } from "@/lib/neon";
import { isMilkOwner } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type MilkRow = {
  section_id: string;
  section_title: string;
  section_description: string;
  entry_id: string | null;
  entry_title: string | null;
  entry_body: string | null;
  entry_created_at: string | null;
};

export async function GET() {
  try {
    const sql = getDatabase();
    const rows = await sql`
      SELECT sections.id AS section_id, sections.title AS section_title,
        sections.description AS section_description, entries.id AS entry_id,
        entries.title AS entry_title, entries.body AS entry_body,
        entries.created_at AS entry_created_at
      FROM milk_sections AS sections
      LEFT JOIN milk_entries AS entries ON entries.section_id = sections.id
      ORDER BY sections.position ASC, entries.created_at DESC
    ` as MilkRow[];
    const sectionMap = new Map<string, { id: string; title: string; description: string; entries: Array<{ id: string; title: string; body: string; createdAt: string }> }>();
    for (const row of rows) {
      if (!sectionMap.has(row.section_id)) sectionMap.set(row.section_id, { id: row.section_id, title: row.section_title, description: row.section_description, entries: [] });
      if (row.entry_id && row.entry_title && row.entry_body && row.entry_created_at) {
        sectionMap.get(row.section_id)!.entries.push({ id: row.entry_id, title: row.entry_title, body: row.entry_body, createdAt: row.entry_created_at });
      }
    }
    return Response.json({ sections: Array.from(sectionMap.values()), canEdit: await isMilkOwner() });
  } catch (error) {
    console.error("Unable to load Milk archive", error);
    return Response.json({ error: "The Milk archive is temporarily unavailable." }, { status: 500 });
  }
}

async function requireOwner() {
  return await isMilkOwner() ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}

function cleanEntry(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  if (!title || !body || title.length > 180 || body.length > 20000) return null;
  return { title, body };
}

export async function POST(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const input = await request.json();
  const entry = cleanEntry(input);
  const sectionId = typeof input?.sectionId === "string" ? input.sectionId : "";
  if (!entry || !sectionId) return Response.json({ error: "Invalid entry" }, { status: 400 });
  const sql = getDatabase();
  const rows = await sql`INSERT INTO milk_entries (section_id,title,body) VALUES (${sectionId},${entry.title},${entry.body}) RETURNING id,title,body,created_at AS "createdAt"`;
  return Response.json({ entry: rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const input = await request.json();
  const entry = cleanEntry(input);
  const id = typeof input?.id === "string" ? input.id : "";
  if (!entry || !id) return Response.json({ error: "Invalid entry" }, { status: 400 });
  const sql = getDatabase();
  const rows = await sql`UPDATE milk_entries SET title=${entry.title},body=${entry.body},updated_at=NOW() WHERE id=${id} RETURNING id,title,body,created_at AS "createdAt"`;
  return rows[0] ? Response.json({ entry: rows[0] }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const input = await request.json();
  const id = typeof input?.id === "string" ? input.id : "";
  if (!id) return Response.json({ error: "Invalid entry" }, { status: 400 });
  const sql = getDatabase();
  await sql`DELETE FROM milk_entries WHERE id=${id}`;
  return new Response(null, { status: 204 });
}
