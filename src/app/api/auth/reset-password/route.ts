import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";

export async function POST(request: NextRequest) {
  const { accessToken, password } = await request.json() as { accessToken?: string; password?: string };
  if (!accessToken || !password || !validatePasswordRequirements(password)) {
    return NextResponse.json({ error: PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "The reset link expired or is invalid. Request a new one." }, { status: 400 });
    const user = await response.json() as { email?: string };
    if (user.email) {
      try {
        await db.user.updateMany({ where: { email: user.email.toLowerCase() }, data: {
          passwordSource: "custom", passwordRole: null, passwordVersion: null,
        } });
      } catch (error) { console.error("Password changed but local password status update failed", error); }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to reset the password right now." }, { status: 503 });
  }
}
