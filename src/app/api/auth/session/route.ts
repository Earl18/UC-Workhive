import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, updateUserLastLogin, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const user = verifySessionToken(token);

  let payloadUser = user;
  if (user) {
    try {
      payloadUser = await updateUserLastLogin(user.id);
    } catch {
      payloadUser = user;
    }
  }

  const response = NextResponse.json(
    { user: payloadUser },
    { headers: { "Cache-Control": "no-store" } },
  );

  if (!user && token) {
    response.cookies.delete(AUTH_SESSION_COOKIE);
  }

  return response;
}
