import { ensureTradingCardTables } from "@/lib/trading-cards";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  try {
    const variant = new URL(request.url).searchParams.get("variant") === "thumbnail" ? "thumbnail_data" : "image_data";
    const sql = await ensureTradingCardTables();
    const rows = variant === "thumbnail_data"
      ? await sql`SELECT thumbnail_data AS data FROM trade_cards WHERE id=${id}` as Array<{ data: string }>
      : await sql`SELECT image_data AS data FROM trade_cards WHERE id=${id}` as Array<{ data: string }>;
    const match = rows[0]?.data.match(/^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return new Response(null, { status: 404 });
    return new Response(Buffer.from(match[1], "base64"), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Unable to load trading card image", error);
    return new Response(null, { status: 500 });
  }
}
