"use client";

import { useQuery } from "@tanstack/react-query";
import type { GeofenceOverviewResponse } from "@/lib/admin-types";

async function fetchGeofenceOverview() {
  const response = await fetch("/api/admin/geofence-zones/overview", { cache: "no-store" });
  const payload = (await response.json()) as GeofenceOverviewResponse & { error?: string };

  if (!response.ok || !payload.summary) {
    throw new Error(payload.error ?? "Unable to load geofence overview.");
  }

  return payload;
}

export function useGeofenceOverview() {
  return useQuery({
    queryKey: ["admin-geofence-overview"],
    queryFn: fetchGeofenceOverview,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
