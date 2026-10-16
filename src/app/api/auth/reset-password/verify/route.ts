import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth";
import { getSupabaseResetConfig } from "@/lib/password-reset";

const invalidLink = { error: "This reset link is invalid or has expired." };
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const { tokenHash } = await request.json() as { tokenHash?: string };
    if (!tokenHash || !/^[A-Za-z0-9_-]{32,256}$/.test(tokenHash)) {
      return NextResponse.json(invalidLink, { status: 400, headers: noStore });
    }

    const { url, key } = getSupabaseResetConfig();
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json(invalidLink, { status: 400, headers: noStore });

    const session = await response.json() as { access_token?: string; user?: { email?: string } };
    const email = normalizeEmail(session.user?.email ?? "");
    if (!session.access_token || !email) return NextResponse.json(invalidLink, { status: 400, headers: noStore });
    const user = await db.user.findUnique({ where: { email }, select: { active: true } });
    if (!user?.active) return NextResponse.json(invalidLink, { status: 400, headers: noStore });

    return NextResponse.json({ accessToken: session.access_token }, { headers: noStore });
  } catch (error) {
    console.error("Recovery token verification failed", error);
    return NextResponse.json({ error: "Unable to verify this reset link right now." }, { status: 503, headers: noStore });
  }
}
