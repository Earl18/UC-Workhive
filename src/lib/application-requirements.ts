export const APPLICANT_UPLOAD_REQUIREMENTS = [
  { key: "application-letter", label: "Application Letter" },
  { key: "resume-cv", label: "Resume / Curriculum Vitae" },
] as const;

export type ApplicantUploadRequirement = (typeof APPLICANT_UPLOAD_REQUIREMENTS)[number];
export type ApplicantUploadRequirementKey = ApplicantUploadRequirement["key"];
