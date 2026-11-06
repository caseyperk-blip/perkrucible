import { isCollectionOwner } from "@/lib/auth/server";
import { ensureTradingCardTables } from "@/lib/trading-cards";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isCollectionOwner()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid card" }, { status: 400 });
  try {
    const input = await request.json() as { title?: unknown; description?: unknown };
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (!title || title.length > 160 || description.length > 3000) return Response.json({ error: "Enter a card name and a description up to 3,000 characters." }, { status: 400 });
    const sql = await ensureTradingCardTables();
    const rows = await sql`UPDATE trade_cards SET title=${title},description=${description},updated_at=NOW() WHERE id=${id} RETURNING id,title,description,created_at`;
    return rows[0] ? Response.json({ card: rows[0] }) : Response.json({ error: "Card not found." }, { status: 404 });
  } catch (error) {
    console.error("Unable to update trading card", error);
    return Response.json({ error: "The card could not be updated." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isCollectionOwner()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid card" }, { status: 400 });
  try {
    const sql = await ensureTradingCardTables();
    await sql`DELETE FROM trade_cards WHERE id=${id}`;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Unable to remove trading card", error);
    return Response.json({ error: "The card could not be removed." }, { status: 500 });
  }
}
