import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});

export async function isMilkOwner() {
  const { data: session } = await auth.getSession();
  const ownerEmail = process.env.MILK_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(ownerEmail && session?.user?.email?.toLowerCase() === ownerEmail);
}
