import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getFeatureToggles, logAuditEvent } from "@/lib/admin-data";
import { FEATURE_TOGGLE_KEYS } from "@/lib/feature-access";
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
  const current = await getFeatureToggles();
  const data = Object.fromEntries(
    FEATURE_TOGGLE_KEYS.map((key) => [key, body[key] ?? current[key]]),
  ) as FeatureToggles;

  const updated = await db.featureToggleConfig.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  const changedKey = Object.keys(body)[0] ?? "feature toggle";
  await logAuditEvent({
    user: auth.user.name,
    action: "Update Feature Toggle",
    category: "System",
    detail: `${changedKey} is now ${String(body[changedKey as keyof FeatureToggles])}`,
  });

  return NextResponse.json({
    featureToggles: Object.fromEntries(
      FEATURE_TOGGLE_KEYS.map((key) => [key, updated[key]]),
    ) as FeatureToggles,
  });
}
