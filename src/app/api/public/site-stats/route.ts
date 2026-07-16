import { NextResponse } from "next/server";
import { getPublicSiteStats } from "@/lib/public-site-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getPublicSiteStats();
    return NextResponse.json({ stats }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load public stats." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
