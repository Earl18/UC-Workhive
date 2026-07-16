import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, verifySessionToken, type AuthenticatedPortalUser } from "@/lib/auth";

export function requireAuthenticated(request: NextRequest):
  | { user: AuthenticatedPortalUser; response?: undefined }
  | { user?: undefined; response: NextResponse } {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user };
}

export function requireAdmin(request: NextRequest):
  | { user: AuthenticatedPortalUser; response?: undefined }
  | { user?: undefined; response: NextResponse } {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth;
  }

  if (auth.user.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: auth.user };
}

export function requireStaff(request: NextRequest):
  | { user: AuthenticatedPortalUser; response?: undefined }
  | { user?: undefined; response: NextResponse } {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth;
  }

  if (auth.user.role !== "admin" && auth.user.role !== "hr") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user: auth.user };
}
