import { NextResponse } from "next/server";
import { esriKey, googleMapsKey, mapTilerKey, preferredMapProvider } from "@/lib/map-provider";

export async function GET() {
  return NextResponse.json(
    {
      key: googleMapsKey() || null,
      esriKey: esriKey() || null,
      mapTilerKey: mapTilerKey() || null,
      provider: preferredMapProvider(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
