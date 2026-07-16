import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getFeatureToggles, logAuditEvent } from "@/lib/admin-data";
import type { FeatureToggles } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ featureToggles: await getFeatureToggles() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as Partial<FeatureToggles>;
  const current = await db.featureToggleConfig.findUniqueOrThrow({ where: { id: "default" } });
  const updated = await db.featureToggleConfig.update({
    where: { id: "default" },
    data: {
      manualAttendance: body.manualAttendance ?? current.manualAttendance,
      qrAttendance: body.qrAttendance ?? current.qrAttendance,
      leaveModule: body.leaveModule ?? current.leaveModule,
      recruitmentModule: body.recruitmentModule ?? current.recruitmentModule,
      gpsAttendance: body.gpsAttendance ?? current.gpsAttendance,
      overtimeModule: body.overtimeModule ?? current.overtimeModule,
    },
  });

  const changedKey = Object.keys(body)[0] ?? "feature toggle";
  await logAuditEvent({
    user: auth.user.name,
    action: "Update Feature Toggle",
    category: "System",
    detail: `${changedKey} is now ${String(body[changedKey as keyof FeatureToggles])}`,
  });

  return NextResponse.json({
    featureToggles: {
      manualAttendance: updated.manualAttendance,
      qrAttendance: updated.qrAttendance,
      leaveModule: updated.leaveModule,
      recruitmentModule: updated.recruitmentModule,
      gpsAttendance: updated.gpsAttendance,
      overtimeModule: updated.overtimeModule,
    },
  });
}
