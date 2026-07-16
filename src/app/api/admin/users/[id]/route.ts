import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getSystemSettings, logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { ensureAuthUserWithPassword, syncAuthUserProfile } from "@/lib/auth-admin";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import { getDefaultPasswordForRole } from "@/lib/role-default-passwords";
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

    const settings = await getSystemSettings();
    const defaultPassword = getDefaultPasswordForRole(settings, nextRole);

    const updated = await db.$transaction(async (tx) => {
      let nextAuthUserId = existing.authUserId;
      let nextPasswordSource = existing.passwordSource;
      let nextPasswordRole = existing.passwordRole;
      let nextPasswordVersion = existing.passwordVersion;

      if (existing.passwordSource === "role_default") {
        const authUser = await ensureAuthUserWithPassword(tx, {
          authUserId: existing.authUserId,
          email: nextEmail,
          password: defaultPassword,
          name: nextName,
          role: nextRole,
        });

        const passwordVersionRow = await tx.systemSettings.findUnique({
          where: { id: "default" },
          select: {
            employeePasswordVersion: true,
            hrPasswordVersion: true,
            adminPasswordVersion: true,
          },
        });

        nextAuthUserId = authUser.id;
        nextPasswordSource = "role_default";
        nextPasswordRole = nextRole;
        nextPasswordVersion =
          nextRole === "admin"
            ? passwordVersionRow?.adminPasswordVersion ?? existing.passwordVersion ?? 1
            : nextRole === "hr"
              ? passwordVersionRow?.hrPasswordVersion ?? existing.passwordVersion ?? 1
              : passwordVersionRow?.employeePasswordVersion ?? existing.passwordVersion ?? 1;
      } else {
        const authUser = await syncAuthUserProfile(tx, {
          authUserId: existing.authUserId,
          email: nextEmail,
          name: nextName,
          role: nextRole,
        });

        if (authUser) {
          nextAuthUserId = authUser.id;
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          authUserId: nextAuthUserId,
          name: nextName,
          email: nextEmail,
          role: nextRole,
          active: body.active ?? existing.active,
          employeeId: body.employeeId === undefined ? existing.employeeId : body.employeeId,
          department: body.department === undefined ? existing.department : body.department,
          passwordSource: nextPasswordSource,
          passwordRole: nextPasswordRole,
          passwordVersion: nextPasswordVersion,
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