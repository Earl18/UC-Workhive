"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@/lib/types";

type HrMasterListResponse = {
  employees: Array<Employee & { birthDate?: string }>;
  departments: string[];
  positions: string[];
  pagination: {
    page: number;
    pageSize: number;
    filteredRecords: number;
    totalRecords: number;
    totalPages: number;
  };
};

type HrMasterListQuery = {
  search?: string;
  status?: string;
  department?: string;
  position?: string;
  gender?: string;
  age?: string;
  educationLevel?: string;
  sortKey?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
};

type HrEmployeeResponse = {
  employee: Employee & { birthDate?: string };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

function buildQueryString(params: HrMasterListQuery) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

async function fetchHrMasterList(params: HrMasterListQuery = {}) {
  const query = buildQueryString(params);
  const response = await fetch(query ? `/api/hr/master-list?${query}` : "/api/hr/master-list", { cache: "no-store" });
  return readJson<HrMasterListResponse>(response);
}

async function fetchHrEmployee(id: string) {
  const response = await fetch(`/api/hr/master-list/${id}`);
  return readJson<HrEmployeeResponse>(response);
}

export function useHrMasterList(params: HrMasterListQuery = {}) {
  return useQuery({
    queryKey: ["hr-master-list", params],
    queryFn: () => fetchHrMasterList(params),
    retry: false,
    staleTime: 15_000,
    placeholderData: (previous) => previous,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useHrEmployee(id: string | null) {
  const queryClient = useQueryClient();

  const cachedEmployee = id
    ? queryClient
      .getQueriesData<HrMasterListResponse | HrEmployeeResponse>({ queryKey: ["hr-master-list"] })
      .flatMap(([, payload]) => {
        if (!payload || !("employees" in payload)) {
          return [] as Array<Employee & { birthDate?: string }>;
        }
        return payload.employees;
      })
      .find((employee) => employee.id === id)
    : undefined;

  return useQuery({
    queryKey: ["hr-master-list", id],
    queryFn: async () => {
      const payload = await fetchHrEmployee(id!);
      return payload;
    },
    enabled: Boolean(id),
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    placeholderData: cachedEmployee ? { employee: cachedEmployee } : undefined,
    refetchOnWindowFocus: false,
  });
}

