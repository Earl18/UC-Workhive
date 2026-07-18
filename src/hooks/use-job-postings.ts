import { useQuery } from "@tanstack/react-query";
import type { JobPosting } from "@/lib/types";

type JobPostingsResponse = {
  jobPostings?: JobPosting[];
  departmentSuggestions?: string[];
  positionTypeSuggestions?: string[];
  error?: string;
};

type JobPostingResponse = {
  jobPosting?: JobPosting;
  error?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load job postings.");
  }
  return payload;
}

export function useStaffJobPostings() {
  return useQuery({
    queryKey: ["staff-job-postings"],
    queryFn: async () => {
      const response = await fetch("/api/hr/job-postings", { cache: "no-store" });
      return readResponse<JobPostingsResponse>(response);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePublicJobPostings() {
  return useQuery({
    queryKey: ["public-job-postings"],
    queryFn: async () => {
      const response = await fetch("/api/public/job-postings", { cache: "no-store" });
      const payload = await readResponse<JobPostingsResponse>(response);
      return payload.jobPostings ?? [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePublicJobPosting(id: string | null) {
  return useQuery({
    queryKey: ["public-job-postings", id],
    queryFn: async () => {
      const response = await fetch(`/api/public/job-postings/${id}`, { cache: "no-store" });
      const payload = await readResponse<JobPostingResponse>(response);
      return payload.jobPosting ?? null;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
