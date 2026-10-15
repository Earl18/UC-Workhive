export const googleMapsKey = () =>
  (process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

export const mapTilerKey = () => (process.env.MAPTILER_API_KEY || "").trim();
export const mapTilerServerKey = () => (process.env.MAPTILER_SERVER_API_KEY || process.env.MAPTILER_API_KEY || "").trim();
export const esriKey = () => (process.env.ESRI_API_KEY || "").trim();

export const preferredMapProvider = () => {
  const selected = (process.env.MAP_PROVIDER || "auto").toLowerCase();
  if (selected === "maptiler") return "maptiler";
  if (selected === "esri") return "esri";
  if (selected === "google") return "google";
  return googleMapsKey() ? "google" : esriKey() ? "esri" : "maptiler";
};

export type MapTilerFeature = {
  id?: string;
  center?: [number, number];
  place_name?: string;
  text?: string;
  properties?: { name?: string };
};

export async function searchMapTiler(queryOrId: string, byId = false, origin?: string) {
  const key = mapTilerServerKey();
  if (!key) throw new Error("MAPTILER_API_KEY is not configured.");
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(queryOrId)}.json`);
  url.searchParams.set("key", key);
  if (!byId) {
    url.searchParams.set("country", "ph");
    url.searchParams.set("limit", "5");
  }
  const response = await fetch(url, {
    cache: "no-store",
    headers: origin ? { Origin: origin } : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`MapTiler search failed (${response.status}).`);
  return (await response.json()) as { features?: MapTilerFeature[] };
}
