"use client";

import { useQuery } from "@tanstack/react-query";
import type { Holiday } from "@/lib/types";

type HolidaysResponse = {
  holidays?: Holiday[];
  error?: string;
};

async function fetchHolidays(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as HolidaysResponse;
  if (!response.ok || !payload.holidays) {
    throw new Error(payload.error ?? "Unable to load holidays.");
  }
  return payload;
}

export function useHolidayRecords() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: () => fetchHolidays("/api/holidays"),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useStaffHolidayRecords() {
  return useQuery({
    queryKey: ["staff-holidays"],
    queryFn: () => fetchHolidays("/api/hr/holidays"),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}
