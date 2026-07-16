import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGeofenceOverview } from "@/lib/geofence-overview";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(await getGeofenceOverview(), {
    headers: { "Cache-Control": "no-store" },
  });
}
