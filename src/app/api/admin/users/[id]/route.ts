import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { syncAuthUserProfile } from "@/lib/auth-admin";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import type { Role } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      role?: Role;
      active?: boolean;
      employeeId?: string | null;
      department?: string | null;
    };

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const nextName = body.name === undefined ? existing.name ?? existing.email : (body.name ?? "").trim();
    const nextEmail = body.email === undefined ? existing.email : normalizeEmail(body.email);
    const nextRole = body.role ?? existing.role;

    if (!nextName || !nextEmail) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    if (!isAllowedEmail(nextEmail)) {
      return NextResponse.json({ error: "Use a valid email address to provision an account." }, { status: 400 });
    }

    if (nextEmail !== existing.email && existing.authUserId) {
      return NextResponse.json(
        { error: "Email changes for provisioned accounts are not supported yet. Create a new auth account first, then relink it." },
        { status: 400 },
      );
    }

    const emailOwner = await db.user.findUnique({ where: { email: nextEmail } });
    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }

    const updated = await db.$transaction(async (tx) => {
      const authUser = await syncAuthUserProfile(tx, {
        authUserId: existing.authUserId,
        email: nextEmail,
        name: nextName,
        role: nextRole,
      });

      return tx.user.update({
        where: { id },
        data: {
          authUserId: authUser?.id ?? existing.authUserId,
          name: nextName,
          email: nextEmail,
          role: nextRole,
          active: body.active ?? existing.active,
          employeeId: body.employeeId === undefined ? existing.employeeId : body.employeeId,
          department: body.department === undefined ? existing.department : body.department,
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

    if (body.role && body.role !== existing.role) {
      await logAuditEvent({
        user: auth.user.name,
        action: "Update User Role",
        category: "System",
        detail: `${updated.email} role changed from ${existing.role} to ${body.role}`,
      });
    }

    if (typeof body.active === "boolean" && body.active !== existing.active) {
      await logAuditEvent({
        user: auth.user.name,
        action: body.active ? "Activate User" : "Deactivate User",
        category: "System",
        detail: `${updated.email} was ${body.active ? "activated" : "deactivated"}`,
      });
    }

    if (body.name !== undefined || body.email !== undefined || body.department !== undefined) {
      await logAuditEvent({
        user: auth.user.name,
        action: "Update User Profile",
        category: "System",
        detail: `${updated.email} profile details were updated`,
      });
    }

    return NextResponse.json({ user: toSystemUser(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
