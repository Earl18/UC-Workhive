import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/admin-data";

export async function GET() {
  return NextResponse.json(
    { settings: await getSystemSettings() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
