import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent, toSystemUser } from "@/lib/admin-data";
import { ensureAuthUserWithPassword } from "@/lib/auth-admin";
import { emailDeliveryErrorMessage, isEmailTransportConfigured, prepareTemplatedEmail, sendTemplatedEmail } from "@/lib/brevo-email";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;

  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  if (!isEmailTransportConfigured()) {
    return NextResponse.json({ error: "Account email delivery is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  const temporaryPassword = generateTemporaryPassword();
  let deliveryError: unknown;
  try {
    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, employeeId: true, email: true, name: true },
    });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const emailContext = {
      userId: target.id,
      employeeId: target.employeeId ?? undefined,
      event: { temporaryPassword },
    };
    const prepared = await prepareTemplatedEmail("Temporary Password", emailContext);
    if (prepared.rendered.unresolved.length) {
      return NextResponse.json(
        { error: `Temporary Password has unresolved placeholders: ${prepared.rendered.unresolved.join(", ")}` },
        { status: 422 },
      );
    }
    if (!prepared.rendered.body.includes(temporaryPassword)) {
      return NextResponse.json(
        { error: "The Temporary Password email template must include [Temporary Password]." },
        { status: 422 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, authUserId: true, email: true, name: true, role: true },
      });
      if (!user) return null;

      const authUser = await ensureAuthUserWithPassword(tx, {
        authUserId: user.authUserId,
        email: user.email,
        password: temporaryPassword,
        name: user.name ?? user.email,
        role: user.role,
      });

      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          authUserId: authUser.id,
          passwordSource: "role_default",
          passwordRole: null,
          passwordVersion: null,
        },
        select: {
          id: true, name: true, email: true, role: true, employeeId: true,
          department: true, active: true, lastLogin: true,
        },
      });
      try {
        await sendTemplatedEmail({
          type: "Temporary Password",
          to: updated.email,
          recipientName: updated.name ?? undefined,
          context: emailContext,
          prepared,
          eventKey: `user:${updated.id}:password-reset:${Date.now()}`,
        });
      } catch (error) {
        deliveryError = error;
        throw error;
      }
      return updated;
    }, { timeout: 25_000 });

    if (!result) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await logAuditEvent({
      user: auth.user.name,
      action: "Reset User Password",
      category: "System",
      detail: `${result.email} was issued a unique temporary password`,
    }).catch((error) => console.error("Password reset audit log failed", error));

    return NextResponse.json({ user: toSystemUser(result) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin password reset failed", error);
    if (deliveryError) {
      return NextResponse.json(
        { error: `${emailDeliveryErrorMessage(deliveryError)} The previous password remains valid.` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Unable to reset this password right now." },
      { status: 503 },
    );
  }
}
