import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ auditLog: await getAuditLog() }, { headers: { "Cache-Control": "no-store" } });
}
