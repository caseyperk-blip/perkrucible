import { getDatabase } from "@/lib/neon";
import { isMilkOwner } from "@/lib/auth/server";
import { starterDrinks, type Drink, type Recipe } from "@/lib/cocktails";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; image: string; standard: Recipe; poor_mans: Recipe | null };
async function ensureTable() {
  const sql = getDatabase();
  await sql`CREATE TABLE IF NOT EXISTS cocktail_recipes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, image TEXT NOT NULL DEFAULT '', standard JSONB NOT NULL, poor_mans JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS cocktail_recipe_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  const seeded = await sql`SELECT value FROM cocktail_recipe_settings WHERE key='starter-recipes' LIMIT 1`;
  if (!seeded.length) {
    for (const drink of starterDrinks) {
      await sql`INSERT INTO cocktail_recipes (name,image,standard,poor_mans) VALUES (${drink.name},${drink.image},${JSON.stringify(drink.standard)}::jsonb,${drink.poorMans ? JSON.stringify(drink.poorMans) : null}::jsonb) ON CONFLICT (name) DO NOTHING`;
    }
    await sql`INSERT INTO cocktail_recipe_settings (key,value) VALUES ('starter-recipes','done') ON CONFLICT (key) DO NOTHING`;
  }
  return sql;
}
function serialize(row: Row): Drink { return { id: row.id, name: row.name, image: row.image, standard: row.standard, poorMans: row.poor_mans ?? undefined }; }
function cleanRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const cleanList = (items: unknown) => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 40) : [];
  const ingredients = cleanList(row.ingredients), instructions = cleanList(row.instructions);
  return ingredients.length && instructions.length ? { ingredients, instructions } : null;
}
function cleanInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const image = typeof row.image === "string" ? row.image.trim() : "";
  const standard = cleanRecipe(row.standard);
  const poorMans = row.poorMans == null ? null : cleanRecipe(row.poorMans);
  if (!name || name.length > 100 || image.length > 500 || !standard || (row.poorMans != null && !poorMans)) return null;
  return { name, image, standard, poorMans };
}
async function requireOwner() { return await isMilkOwner() ? null : Response.json({ error: "Unauthorized" }, { status: 401 }); }

export async function GET() {
  try {
    const sql = await ensureTable();
    const rows = await sql`SELECT id,name,image,standard,poor_mans FROM cocktail_recipes ORDER BY created_at ASC` as Row[];
    return Response.json({ drinks: rows.map(serialize), canEdit: await isMilkOwner() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load cocktail recipes", error);
    return Response.json({ error: "The Cocktail Cabinet is temporarily unavailable." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const input = cleanInput(await request.json());
  if (!input) return Response.json({ error: "Enter a name, ingredients, and instructions." }, { status: 400 });
  const sql = await ensureTable();
  try {
    const rows = await sql`INSERT INTO cocktail_recipes (name,image,standard,poor_mans) VALUES (${input.name},${input.image},${JSON.stringify(input.standard)}::jsonb,${input.poorMans ? JSON.stringify(input.poorMans) : null}::jsonb) RETURNING id,name,image,standard,poor_mans` as Row[];
    return Response.json({ drink: serialize(rows[0]) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save cocktail.";
    return Response.json({ error: message.includes("unique") ? "A cocktail with that name already exists." : "The cocktail could not be saved." }, { status: 409 });
  }
}
export async function PATCH(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const body = await request.json() as { id?: unknown };
  const input = cleanInput(body);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !input) return Response.json({ error: "Enter a name, ingredients, and instructions." }, { status: 400 });
  const sql = await ensureTable();
  try {
    const rows = await sql`UPDATE cocktail_recipes SET name=${input.name},image=${input.image},standard=${JSON.stringify(input.standard)}::jsonb,poor_mans=${input.poorMans ? JSON.stringify(input.poorMans) : null}::jsonb,updated_at=NOW() WHERE id=${id} RETURNING id,name,image,standard,poor_mans` as Row[];
    return rows[0] ? Response.json({ drink: serialize(rows[0]) }) : Response.json({ error: "Cocktail not found." }, { status: 404 });
  } catch { return Response.json({ error: "That cocktail name is already in use." }, { status: 409 }); }
}
export async function DELETE(request: Request) {
  const denied = await requireOwner(); if (denied) return denied;
  const input = await request.json() as { id?: unknown };
  if (typeof input.id !== "string" || !input.id) return Response.json({ error: "Invalid cocktail." }, { status: 400 });
  const sql = await ensureTable();
  await sql`DELETE FROM cocktail_recipes WHERE id=${input.id}`;
  return new Response(null, { status: 204 });
}
