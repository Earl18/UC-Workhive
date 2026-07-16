import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

type GoogleTextSearchResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
  }>;
};

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in your environment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("region", "ph");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Google Maps search is currently unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = (await response.json()) as GoogleTextSearchResponse;
  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      { error: payload.error_message ?? `Google Maps request failed with status ${payload.status}.` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const results = (payload.results ?? []).slice(0, 5).map((result) => ({
    placeId: result.place_id,
    name: result.name || result.formatted_address,
    formattedAddress: result.formatted_address,
  }));

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}