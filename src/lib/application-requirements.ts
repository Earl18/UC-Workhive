export const APPLICANT_UPLOAD_REQUIREMENTS = [
  { key: "application-letter", label: "Application Letter" },
  { key: "resume-cv", label: "Resume / Curriculum Vitae" },
] as const;

export type ApplicantUploadRequirement = (typeof APPLICANT_UPLOAD_REQUIREMENTS)[number];
export type ApplicantUploadRequirementKey = ApplicantUploadRequirement["key"];

export function requirementArchiveEntryBaseName(requirement: ApplicantUploadRequirement, index: number) {
  const label = requirement.label
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .replace(/\s+/g, " ") || "requirement";
  return `${String(index + 1).padStart(2, "0")} - ${label}`;
}
