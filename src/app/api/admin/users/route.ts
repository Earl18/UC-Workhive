import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminUsers, logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { ensureAuthUserWithPassword, findAuthUserByEmail } from "@/lib/auth-admin";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { emailDeliveryErrorMessage, isEmailTransportConfigured, sendTemplatedEmail } from "@/lib/brevo-email";
import { generateTemporaryPassword } from "@/lib/temporary-password";

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

  if (!isEmailTransportConfigured()) {
    return NextResponse.json({ error: "Account email delivery is not configured." }, { status: 503 });
  }

  const temporaryPassword = generateTemporaryPassword();

  const created = await db.$transaction(async (tx) => {
    const existingAuthUser = await findAuthUserByEmail(tx, email);
    if (existingAuthUser) {
      throw new Error("An authentication account with that email already exists.");
    }

    const authUser = await ensureAuthUserWithPassword(tx, {
      email,
      password: temporaryPassword,
      name,
      role,
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
        passwordRole: null,
        passwordVersion: null,
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

  try {
    await sendTemplatedEmail({
      type: "Welcome Email", to: created.email, recipientName: created.name ?? undefined,
      context: { userId: created.id, employeeId: created.employeeId ?? undefined, event: { temporaryPassword } },
      eventKey: `user:${created.id}:credentials`,
    });
    return NextResponse.json({ user: toSystemUser(created), emailSent: true });
  } catch (error) {
    console.error("Account credentials email failed", error);
    return NextResponse.json({ user: toSystemUser(created), emailSent: false, emailError: emailDeliveryErrorMessage(error) });
  }
}
