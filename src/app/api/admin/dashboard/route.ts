import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDashboardSummary } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const summary = await getAdminDashboardSummary();
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
