import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

type GoogleGeocodeResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    place_id?: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components?: Array<{ long_name: string }>;
  }>;
};

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? "";

  if (!placeId && query.length < 3) {
    return NextResponse.json({ error: "A campus address, landmark, or place ID is required." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key is not configured." }, { status: 503 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  if (placeId) {
    url.searchParams.set("place_id", placeId);
  } else {
    url.searchParams.set("address", query);
  }
  url.searchParams.set("region", "ph");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "Google Maps geocoding is currently unavailable." }, { status: 502 });
  }

  const payload = (await response.json()) as GoogleGeocodeResponse;
  if (payload.status !== "OK" || !payload.results?.length) {
    return NextResponse.json(
      { error: payload.error_message ?? `Google Maps geocoding failed with status ${payload.status}.` },
      { status: 502 },
    );
  }

  const first = payload.results[0];
  return NextResponse.json({
    result: {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
      name: first.address_components?.[0]?.long_name ?? query,
      placeId: first.place_id ?? placeId,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}