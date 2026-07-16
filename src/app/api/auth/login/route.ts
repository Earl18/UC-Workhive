import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getSessionCookieOptions,
  isAllowedEmail,
  normalizeEmail,
  resolvePortalUserByEmail,
  updateUserLastLogin,
} from "@/lib/auth";

type SupabaseLoginResponse = {
  user?: {
    email?: string;
    email_confirmed_at?: string | null;
  };
};

const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;

function getClientKey(request: NextRequest, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${forwardedFor}:${normalizeEmail(email)}`;
}

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
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      remember?: boolean;
    };

    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    const remember = Boolean(body.remember);

    if (!email || !password || !isAllowedEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const key = getClientKey(request, email);
    const trackedAttempt = attempts.get(key);
    const now = Date.now();

    if (trackedAttempt && trackedAttempt.blockedUntil > now) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { url, key: supabaseKey } = getSupabaseAuthConfig();
    const upstream = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const nextCount = (trackedAttempt?.count ?? 0) + 1;
      attempts.set(key, {
        count: nextCount,
        blockedUntil: nextCount >= MAX_ATTEMPTS ? now + BLOCK_WINDOW_MS : 0,
      });

      return NextResponse.json(
        {
          error:
            nextCount >= MAX_ATTEMPTS
              ? "Too many failed login attempts. Please try again later."
              : "Invalid email or password.",
        },
        {
          status: nextCount >= MAX_ATTEMPTS ? 429 : 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const authResult = (await upstream.json()) as SupabaseLoginResponse;
    const authenticatedEmail = normalizeEmail(authResult.user?.email ?? email);

    if (!authResult.user?.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your email address before signing in." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const portalUser = await resolvePortalUserByEmail(authenticatedEmail);
    if (!portalUser) {
      return NextResponse.json(
        {
          error:
            "Your account is authenticated but not yet provisioned for WorkHive access. Please contact HR or IT.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    attempts.delete(key);

    const sessionUser = await updateUserLastLogin(portalUser.id);
    const sessionToken = createSessionToken(sessionUser, remember);

    const response = NextResponse.json(
      { user: sessionUser },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(AUTH_SESSION_COOKIE, sessionToken, getSessionCookieOptions(remember));
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again in a moment." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
