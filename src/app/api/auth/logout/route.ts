import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, getSessionCookieDeletionOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(AUTH_SESSION_COOKIE, "", getSessionCookieDeletionOptions());
  return response;
}
