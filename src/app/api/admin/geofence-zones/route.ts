import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getGeofenceZones, logAuditEvent } from "@/lib/admin-data";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ geofenceZones: await getGeofenceZones() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    name?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    color?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Zone name is required." }, { status: 400 });
  }

  const zone = await db.geofenceZone.create({
    data: {
      name: body.name.trim(),
      lat: Number(body.lat ?? 10.293),
      lng: Number(body.lng ?? 123.882),
      radius: Number(body.radius ?? 100),
      color: body.color ?? "#1e3a8a",
    },
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Create Geofence Zone",
    category: "System",
    detail: `Created geofence zone ${zone.name}`,
  });

  return NextResponse.json({ zone });
}
