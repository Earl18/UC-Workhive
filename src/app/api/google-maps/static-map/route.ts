import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const centerLat = searchParams.get("centerLat") ?? "10.293";
  const centerLng = searchParams.get("centerLng") ?? "123.882";
  const zoom = searchParams.get("zoom") ?? "18";
  const width = searchParams.get("width") ?? "1280";
  const height = searchParams.get("height") ?? "840";
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in your environment." },
      { status: 400 },
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${centerLat},${centerLng}`);
  url.searchParams.set("zoom", zoom);
  url.searchParams.set("size", `${width}x${height}`);
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("format", "png");
  url.searchParams.set("key", key);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "Unable to load satellite map." }, { status: 502 });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/png",
      "Cache-Control": "no-store",
    },
  });
}
