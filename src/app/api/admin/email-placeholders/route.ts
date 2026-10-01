import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createEmailPlaceholder, findEmailPlaceholder, getEmailPlaceholders, validPlaceholderField, validPlaceholderLabel } from "@/lib/email-placeholders";
import { logAuditEvent } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ placeholders: await getEmailPlaceholders() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;
  const input = (await request.json()) as { label?: unknown; source?: unknown; field?: unknown };
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const source = typeof input.source === "string" ? input.source : "";
  const field = typeof input.field === "string" ? input.field : "";
  if (!validPlaceholderLabel(label) || !validPlaceholderField(source, field)) {
    return NextResponse.json({ error: "Choose a valid placeholder name and database or event field." }, { status: 400 });
  }
  await getEmailPlaceholders();
  const existing = await findEmailPlaceholder(label);
  if (existing) return NextResponse.json({ error: "That placeholder already exists." }, { status: 409 });
  const placeholder = await createEmailPlaceholder(label, source, field);
  await logAuditEvent({ user: auth.user.name, action: "Create Email Placeholder", category: "System", detail: `Created [${label}] from ${source}.${field}` });
  return NextResponse.json({ placeholder }, { status: 201 });
}
