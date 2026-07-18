import { useQuery } from "@tanstack/react-query";
import type { ApplicantTemplateRecord } from "@/lib/applicant-template";

type ApplicantTemplateApiResponse = {
  template: ApplicantTemplateRecord;
};

async function fetchApplicantTemplate(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as ApplicantTemplateApiResponse & { error?: string };

  if (!response.ok || !payload.template) {
    throw new Error(payload.error ?? "Unable to load the applicant template.");
  }

  return payload;
}

export function useApplicantTemplate() {
  return useQuery({
    queryKey: ["public-applicant-template"],
    queryFn: () => fetchApplicantTemplate("/api/public/applicant-template"),
  });
}

export function useAdminApplicantTemplate() {
  return useQuery({
    queryKey: ["admin-applicant-template"],
    queryFn: () => fetchApplicantTemplate("/api/admin/settings/applicant-template"),
  });
}
