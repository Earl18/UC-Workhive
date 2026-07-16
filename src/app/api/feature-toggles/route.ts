import { NextResponse } from "next/server";
import { getFeatureToggles } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(
    { featureToggles: await getFeatureToggles() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
