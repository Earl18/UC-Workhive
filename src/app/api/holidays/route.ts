import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getHolidayRecords } from "@/lib/holiday-data";

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const holidays = await getHolidayRecords();
  return NextResponse.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
}
