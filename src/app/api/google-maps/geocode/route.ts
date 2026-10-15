import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { googleMapsKey, mapTilerServerKey, searchMapTiler } from "@/lib/map-provider";

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    place_id?: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components?: Array<{ long_name: string }>;
  }>;
};

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId && query.length < 3) return NextResponse.json({ error: "A campus address or landmark is required." }, { status: 400 });

  if (googleMapsKey() && !placeId.startsWith("maptiler:")) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      if (placeId && !placeId.startsWith("maptiler:")) url.searchParams.set("place_id", placeId);
      else url.searchParams.set("address", query);
      url.searchParams.set("region", "ph");
      url.searchParams.set("key", googleMapsKey());
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const payload = (await response.json()) as GoogleGeocodeResponse;
        const first = payload.status === "OK" ? payload.results?.[0] : undefined;
        if (first) return NextResponse.json({ result: {
          lat: first.geometry.location.lat,
          lng: first.geometry.location.lng,
          formattedAddress: first.formatted_address,
          name: first.address_components?.[0]?.long_name ?? query,
          placeId: first.place_id ?? placeId,
        } }, { headers: { "Cache-Control": "no-store" } });
      }
    } catch { /* MapTiler is the backup. */ }
  }

  if (!mapTilerServerKey()) return NextResponse.json({ error: "No available geocoding provider is configured." }, { status: 503 });
  try {
    const byId = placeId.startsWith("maptiler:");
    const payload = await searchMapTiler(byId ? placeId.slice("maptiler:".length) : query, byId, request.nextUrl.origin);
    const first = payload.features?.[0];
    if (!first?.center || !Number.isFinite(first.center[0]) || !Number.isFinite(first.center[1])) {
      return NextResponse.json({ error: "Campus location was not found." }, { status: 404 });
    }
    return NextResponse.json({ result: {
      lat: first.center[1],
      lng: first.center[0],
      formattedAddress: first.place_name || first.text || query,
      name: first.text || first.properties?.name || query,
      placeId: first.id ? `maptiler:${first.id}` : "",
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geocoding is unavailable." }, { status: 502 });
  }
}
