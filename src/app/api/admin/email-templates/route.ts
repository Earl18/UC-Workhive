import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getEmailTemplates, logAuditEvent } from "@/lib/admin-data";
import { getEmailPlaceholders } from "@/lib/email-placeholders";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(
    { emailTemplates: await getEmailTemplates(), placeholders: await getEmailPlaceholders() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    type?: string;
    subject?: string;
    body?: string;
  };

  const type = body.type?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const templateBody = body.body?.trim() ?? "";

  if (!type || !subject || !templateBody) {
    return NextResponse.json(
      { error: "Template name, subject, and body are required." },
      { status: 400 },
    );
  }

  const existing = await db.emailTemplateRecord.findUnique({ where: { type } });
  if (existing) {
    return NextResponse.json(
      { error: "A template with that name already exists." },
      { status: 409 },
    );
  }

  const template = await db.emailTemplateRecord.create({
    data: {
      type,
      subject,
      body: templateBody,
    },
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Create Email Template",
    category: "System",
    detail: `Created ${template.type} email template`,
  });

  return NextResponse.json({
    template: {
      type: template.type,
      subject: template.subject,
      body: template.body,
    },
  });
}
