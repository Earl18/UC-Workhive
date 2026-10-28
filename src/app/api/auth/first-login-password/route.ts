import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getSessionCookieOptions,
  mustChangeRolePassword,
  verifySessionToken,
} from "@/lib/auth";
import { DEFAULT_ROLE_PASSWORDS, getDefaultPasswordForRole, PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = verifySessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in to set your password." }, { status: 401 });

  let password: string;
  try {
    const body = await request.json() as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!validatePasswordRequirements(password)) {
    return NextResponse.json({ error: PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.id },
        select: { id: true, email: true, role: true, active: true, authUserId: true, passwordSource: true },
      });
      if (!user || !user.active || user.email.toLowerCase() !== session.email.toLowerCase()) return "unauthorized";
      if (!mustChangeRolePassword(user.email, user.passwordSource)) return "already_changed";

      const settings = await tx.systemSettings.findUnique({
        where: { id: "default" },
        select: { employeeDefaultPassword: true, hrDefaultPassword: true, adminDefaultPassword: true },
      });
      const roleDefault = settings ? getDefaultPasswordForRole(settings, user.role) : DEFAULT_ROLE_PASSWORDS[user.role];
      if (password === roleDefault) return "same_password";

      const updated = user.authUserId
        ? await tx.$executeRaw`
            UPDATE auth.users SET "encrypted_password" = crypt(${password}, gen_salt('bf')), "updated_at" = NOW()
            WHERE "id" = ${user.authUserId}::uuid AND "deleted_at" IS NULL
          `
        : await tx.$executeRaw`
            UPDATE auth.users SET "encrypted_password" = crypt(${password}, gen_salt('bf')), "updated_at" = NOW()
            WHERE lower("email") = lower(${user.email}) AND "deleted_at" IS NULL
          `;
      if (updated !== 1) throw new Error("Authentication account is missing or duplicated.");

      await tx.user.update({
        where: { id: user.id },
        data: { passwordSource: "custom", passwordRole: null, passwordVersion: null },
      });
      return "changed";
    });

    if (result === "unauthorized") return NextResponse.json({ error: "Your account is unavailable." }, { status: 401 });
    if (result === "already_changed") return NextResponse.json({ error: "This account already has a custom password. Sign in again." }, { status: 409 });
    if (result === "same_password") return NextResponse.json({ error: "Choose a password different from your role's default password." }, { status: 400 });

    const user = { ...session, mustChangePassword: false };
    const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AUTH_SESSION_COOKIE, createSessionToken(user, false), getSessionCookieOptions(false));
    return response;
  } catch (error) {
    console.error("First-login password change failed", error);
    return NextResponse.json({ error: "Unable to change your password right now." }, { status: 503 });
  }
}
