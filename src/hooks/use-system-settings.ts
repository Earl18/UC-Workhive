"use client";

import { useQuery } from "@tanstack/react-query";
import type { SystemSettingsApiResponse } from "@/lib/admin-types";

async function fetchSystemSettings(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as SystemSettingsApiResponse & { error?: string };

  if (!response.ok || !payload.settings) {
    throw new Error(payload.error ?? "Unable to load system settings.");
  }

  return payload;
}

const SHARED_QUERY_OPTIONS = {
  retry: false,
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: () => fetchSystemSettings("/api/system-settings"),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useAdminSystemSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => fetchSystemSettings("/api/admin/settings"),
    ...SHARED_QUERY_OPTIONS,
  });
}