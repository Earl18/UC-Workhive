import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminUsers, getSystemSettings, logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { ensureAuthUserWithPassword, findAuthUserByEmail } from "@/lib/auth-admin";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import {
  getDefaultPasswordForRole,
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePasswordRequirements,
} from "@/lib/role-default-passwords";
import type { Role } from "@/lib/types";
import { sendTemplatedEmailSafely } from "@/lib/brevo-email";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ users: await getAdminUsers() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    role?: Role;
    employeeId?: string;
    department?: string;
  };

  const email = normalizeEmail(body.email ?? "");
  const name = (body.name ?? "").trim();
  const role = body.role ?? "employee";
  const employeeId = body.employeeId?.trim() || null;
  const department = body.department?.trim() || null;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  if (!isAllowedEmail(email)) {
    return NextResponse.json({ error: "Use a valid email address to provision an account." }, { status: 400 });
  }

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const settings = await getSystemSettings();
  const defaultPassword = getDefaultPasswordForRole(settings, role);

  if (!validatePasswordRequirements(defaultPassword)) {
    return NextResponse.json(
      { error: `${role.toUpperCase()} default password is invalid. ${PASSWORD_REQUIREMENTS_MESSAGE}` },
      { status: 400 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const existingAuthUser = await findAuthUserByEmail(tx, email);
    if (existingAuthUser) {
      throw new Error("An authentication account with that email already exists.");
    }

    const authUser = await ensureAuthUserWithPassword(tx, {
      email,
      password: defaultPassword,
      name,
      role,
    });

    const passwordVersionRow = await tx.systemSettings.findUnique({
      where: { id: "default" },
      select: {
        employeePasswordVersion: true,
        hrPasswordVersion: true,
        adminPasswordVersion: true,
      },
    });

    return tx.user.create({
      data: {
        authUserId: authUser.id,
        name,
        email,
        role,
        employeeId,
        department,
        active: true,
        passwordSource: "role_default",
        passwordRole: role,
        passwordVersion:
          role === "admin"
            ? passwordVersionRow?.adminPasswordVersion ?? 1
            : role === "hr"
              ? passwordVersionRow?.hrPasswordVersion ?? 1
              : passwordVersionRow?.employeePasswordVersion ?? 1,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employeeId: true,
        department: true,
        active: true,
        lastLogin: true,
      },
    });
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Create User",
    category: "System",
    detail: `Provisioned ${created.email} as ${created.role}`,
  });

  await sendTemplatedEmailSafely({
    type: "Welcome Email", to: created.email, recipientName: created.name ?? undefined,
    context: { userId: created.id, employeeId: created.employeeId ?? undefined },
    eventKey: `user:${created.id}:welcome`,
  });

  return NextResponse.json({ user: toSystemUser(created) });
}
