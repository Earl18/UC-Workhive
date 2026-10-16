import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth";

export function getSupabaseResetConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication is unavailable.");
  return { url, key };
}

export async function getResetUser(accessToken: string) {
  const { url, key } = getSupabaseResetConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const authUser = await response.json() as { email?: string };
  const email = normalizeEmail(authUser.email ?? "");
  if (!email) return null;
  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true, active: true },
  });
}
