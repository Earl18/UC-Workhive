import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { ensureAuthUserWithPassword } from "@/lib/auth-admin";
import { getDefaultPasswordForRole, getPasswordVersionFieldForRole, PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;

  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, authUserId: true, email: true, name: true, role: true },
      });
      if (!user) return null;

      const settings = await tx.systemSettings.findUnique({ where: { id: "default" } });
      if (!settings) throw new Error("System Settings is unavailable. Save role default passwords first.");

      const defaultPassword = getDefaultPasswordForRole(settings, user.role);
      if (!validatePasswordRequirements(defaultPassword)) {
        throw new Error(`${user.role.toUpperCase()} default password is invalid. ${PASSWORD_REQUIREMENTS_MESSAGE}`);
      }

      const authUser = await ensureAuthUserWithPassword(tx, {
        authUserId: user.authUserId,
        email: user.email,
        password: defaultPassword,
        name: user.name ?? user.email,
        role: user.role,
      });

      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          authUserId: authUser.id,
          passwordSource: "role_default",
          passwordRole: user.role,
          passwordVersion: settings[getPasswordVersionFieldForRole(user.role)],
        },
        select: {
          id: true, name: true, email: true, role: true, employeeId: true,
          department: true, active: true, lastLogin: true,
        },
      });
      return updated;
    });

    if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await logAuditEvent({
      user: auth.user.name,
      action: "Reset User Password",
      category: "System",
      detail: `${result.email} password reset to the ${result.role} role default`,
    }).catch((error) => console.error("Password reset audit log failed", error));

    return NextResponse.json({ user: toSystemUser(result) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin password reset failed", error);
    return NextResponse.json(
      { error: error instanceof Error && error.message.includes("default password is invalid") ? error.message : "Unable to reset this password right now." },
      { status: 503 },
    );
  }
}
