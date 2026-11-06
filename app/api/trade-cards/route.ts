import { isCollectionOwner } from "@/lib/auth/server";
import { ensureTradingCardTables, mediaUrl } from "@/lib/trading-cards";

export const dynamic = "force-dynamic";

type CardRow = { id: string; title: string; description: string; created_at: string };

export async function GET() {
  try {
    const sql = await ensureTradingCardTables();
    const rows = await sql`SELECT id, title, description, created_at FROM trade_cards ORDER BY created_at ASC` as CardRow[];
    return Response.json({
      title: "HEAVY METAL Trading Cards - Wave 1 Genesis Set - UP FOR TRADE!",
      cards: rows.map((card) => ({ ...card, thumbnailUrl: mediaUrl(card.id, "thumbnail"), imageUrl: mediaUrl(card.id, "image") })),
      canManage: await isCollectionOwner(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load the trading card collection", error);
    return Response.json({ error: "The collection is temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await isCollectionOwner()) return Response.json({ error: "Sign in as the site owner to add cards." }, { status: 401 });
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const image = form.get("image");
    const thumbnail = form.get("thumbnail");
    if (title.length > 160 || description.length > 3000 || !(image instanceof File) || !(thumbnail instanceof File)) {
      return Response.json({ error: "Add a card image. Card names are optional and descriptions can be up to 3,000 characters." }, { status: 400 });
    }
    const supportedImageTypes = new Set(["image/webp", "image/jpeg"]);
    if (image.size > 4_000_000 || thumbnail.size > 500_000 || !supportedImageTypes.has(image.type) || !supportedImageTypes.has(thumbnail.type)) {
      return Response.json({ error: "The image could not be processed. Please try a smaller photo or PDF." }, { status: 413 });
    }
    const imageData = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
    const thumbnailData = `data:${thumbnail.type};base64,${Buffer.from(await thumbnail.arrayBuffer()).toString("base64")}`;
    const sql = await ensureTradingCardTables();
    const rows = await sql`INSERT INTO trade_cards (title,description,image_data,thumbnail_data) VALUES (${title},${description},${imageData},${thumbnailData}) RETURNING id,title,description,created_at` as CardRow[];
    const card = rows[0];
    return Response.json({ card: { ...card, thumbnailUrl: mediaUrl(card.id, "thumbnail"), imageUrl: mediaUrl(card.id, "image") } }, { status: 201 });
  } catch (error) {
    console.error("Unable to add trading card", error);
    return Response.json({ error: "The card could not be saved. Please try again." }, { status: 500 });
  }
}
