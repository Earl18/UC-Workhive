import { useQuery } from "@tanstack/react-query";
import type { Applicant } from "@/lib/types";

type HrApplicationsResponse = {
  applicants?: Applicant[];
  error?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load job applications.");
  }
  return payload;
}

export function useHrApplications() {
  return useQuery({
    queryKey: ["hr-applications"],
    queryFn: async () => {
      const response = await fetch("/api/hr/applications", { cache: "no-store" });
      const payload = await readResponse<HrApplicationsResponse>(response);
      return payload.applicants ?? [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}
