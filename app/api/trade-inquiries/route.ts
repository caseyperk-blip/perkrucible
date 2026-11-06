import { createHash } from "node:crypto";
import { isCollectionOwner } from "@/lib/auth/server";
import { ensureTradingCardTables } from "@/lib/trading-cards";

export const dynamic = "force-dynamic";

type Inquiry = { id: string; name: string; email: string; card_title: string; message: string; created_at: string };

function rateKey(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.DATABASE_URL}:${address}`).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function GET() {
  if (!await isCollectionOwner()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = await ensureTradingCardTables();
    const rows = await sql`SELECT id,name,email,card_title,message,created_at FROM trade_inquiries ORDER BY created_at DESC LIMIT 100` as Inquiry[];
    return Response.json({ inquiries: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load trading inquiries", error);
    return Response.json({ error: "The inquiry inbox is temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { name?: unknown; email?: unknown; cardTitle?: unknown; message?: unknown; website?: unknown };
    if (typeof input.website === "string" && input.website.trim()) return Response.json({ sent: true }, { status: 201 });
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const cardTitle = typeof input.cardTitle === "string" ? input.cardTitle.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || !cardTitle || cardTitle.length > 160 || !message || message.length > 3000) {
      return Response.json({ error: "Please enter your name, a valid email, and a message." }, { status: 400 });
    }
    const sql = await ensureTradingCardTables();
    const key = rateKey(request);
    const countRows = await sql`SELECT COUNT(*)::int AS amount FROM trade_inquiries WHERE rate_key=${key} AND created_at > NOW() - INTERVAL '1 hour'` as Array<{ amount: number }>;
    if (countRows[0].amount >= 5) return Response.json({ error: "Please wait a little before sending another inquiry." }, { status: 429 });
    const rows = await sql`INSERT INTO trade_inquiries (name,email,card_title,message,rate_key) VALUES (${name},${email},${cardTitle},${message},${key}) RETURNING id`;

    let emailSent = false;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL;
    const to = process.env.TRADE_INQUIRY_TO_EMAIL || process.env.CONTACT_TO_EMAIL || process.env.MILK_OWNER_EMAIL;
    if (apiKey && from && to) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], reply_to: email, subject: `Trade inquiry: ${cardTitle}`, html: `<h2>Trading card inquiry</h2><p><b>Card:</b> ${escapeHtml(cardTitle)}</p><p><b>From:</b> ${escapeHtml(name)} (${escapeHtml(email)})</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` }),
        });
        emailSent = response.ok;
        if (!response.ok) console.error("Trade inquiry email notification failed", await response.text());
      } catch (error) { console.error("Trade inquiry email notification failed", error); }
    }
    return Response.json({ sent: true, emailSent, inquiryId: rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save trading inquiry", error);
    return Response.json({ error: "Your message could not be sent. Please try again." }, { status: 500 });
  }
}
