import { NextRequest, NextResponse } from "next/server";
import { getResetUser } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json() as { accessToken?: string };
    if (!accessToken) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const user = await getResetUser(accessToken);
    if (!user?.active) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reset link validation failed", error);
    return NextResponse.json({ error: "Unable to verify this reset link right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
