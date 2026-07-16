import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/admin-data";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    color?: string;
  };

  const existing = await db.geofenceZone.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  }

  const zone = await db.geofenceZone.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      lat: body.lat ?? existing.lat,
      lng: body.lng ?? existing.lng,
      radius: body.radius ?? existing.radius,
      color: body.color ?? existing.color,
    },
  });

  await logAuditEvent({
    user: auth.user.name,
    action: "Update Geofence Zone",
    category: "System",
    detail: `Updated geofence zone ${zone.name}`,
  });

  return NextResponse.json({ zone });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const existing = await db.geofenceZone.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  }

  await db.geofenceZone.delete({ where: { id } });
  await logAuditEvent({
    user: auth.user.name,
    action: "Delete Geofence Zone",
    category: "System",
    detail: `Deleted geofence zone ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
