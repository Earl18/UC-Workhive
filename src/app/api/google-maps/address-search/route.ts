import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { googleMapsKey, mapTilerServerKey, searchMapTiler } from "@/lib/map-provider";

type GoogleTextSearchResponse = {
  status: string;
  results?: Array<{ place_id: string; name: string; formatted_address: string }>;
};

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) return auth.response;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ results: [] });

  if (googleMapsKey()) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.set("query", query);
      url.searchParams.set("region", "ph");
      url.searchParams.set("key", googleMapsKey());
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const payload = (await response.json()) as GoogleTextSearchResponse;
        if (payload.status === "OK" || payload.status === "ZERO_RESULTS") {
          return NextResponse.json({
            results: (payload.results ?? []).slice(0, 5).map((item) => ({
              placeId: item.place_id,
              name: item.name || item.formatted_address,
              formattedAddress: item.formatted_address,
            })),
          }, { headers: { "Cache-Control": "no-store" } });
        }
      }
    } catch { /* MapTiler is the backup. */ }
  }

  if (!mapTilerServerKey()) return NextResponse.json({ error: "No available map search provider is configured." }, { status: 503 });
  try {
    const payload = await searchMapTiler(query, false, request.nextUrl.origin);
    return NextResponse.json({
      results: (payload.features ?? []).filter((item) => item.id).map((item) => ({
        placeId: `maptiler:${item.id}`,
        name: item.text || item.properties?.name || item.place_name || query,
        formattedAddress: item.place_name || item.text || query,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Map search is unavailable." }, { status: 502 });
  }
}
