import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";

function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase auth environment variables are not configured.");
  }

  return { url, key };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");

    if (email && isAllowedEmail(email)) {
      const { url, key } = getSupabaseAuthConfig();
      await fetch(`${url}/auth/v1/recover`, {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          redirectTo: request.nextUrl.origin,
        }),
        cache: "no-store",
      });

      await db.user.updateMany({
        where: { email },
        data: {
          passwordSource: "custom",
          passwordRole: null,
          passwordVersion: null,
        },
      });
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}