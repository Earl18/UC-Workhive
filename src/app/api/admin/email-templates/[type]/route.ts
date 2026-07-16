import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/admin-data";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const { type } = await context.params;
  const decodedType = decodeURIComponent(type);
  const body = (await request.json()) as { subject?: string; body?: string };

  const template = await db.emailTemplateRecord.update({
    where: { type: decodedType },
    data: {
      subject: body.subject,
      body: body.body,
    },
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Update Email Template",
    category: "System",
    detail: `Updated ${template.type} email template`,
  });

  return NextResponse.json({
    template: {
      type: template.type,
      subject: template.subject,
      body: template.body,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const { type } = await context.params;
  const decodedType = decodeURIComponent(type);

  const existing = await db.emailTemplateRecord.findUnique({
    where: { type: decodedType },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Template not found." },
      { status: 404 },
    );
  }

  await db.emailTemplateRecord.delete({
    where: { type: decodedType },
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Delete Email Template",
    category: "System",
    detail: `Deleted ${decodedType} email template`,
  });

  return NextResponse.json({ success: true });
}
