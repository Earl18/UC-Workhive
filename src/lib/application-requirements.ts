export const GOVERNMENT_STATUTORY_NUMBER_FIELDS = [
  { key: "sssNumber", label: "SSS" },
  { key: "tinNumber", label: "TIN" },
  { key: "pagIbigNumber", label: "PAG-IBIG" },
  { key: "philHealthNumber", label: "PHILHEALTH" },
] as const;

export const APPLICANT_UPLOAD_REQUIREMENTS = [
  { key: "uc-application-form", label: "UC Application Form", templateKey: "uc-application-form" },
  { key: "application-letter", label: "Application Letter" },
  { key: "resume-cv", label: "Resume / Curriculum Vitae" },
  { key: "two-by-two-photo", label: "3 pcs 2x2 colored picture" },
  { key: "transcript-of-records", label: "Transcript of Records (BS / MA / Doctorate)" },
  { key: "diplomas", label: "Diploma/s", allowMultiple: true },
  { key: "recommendation-letters", label: "Recommendation Letter/s", allowMultiple: true },
  { key: "form-2316", label: "Form 2316" },
  { key: "clearance-or-coe", label: "Former Employee's Clearance / COE" },
  { key: "nbi-or-police-clearance", label: "NBI or POLICE Clearance" },
  { key: "prc-licenses", label: "PRC License/s", allowMultiple: true },
  { key: "marriage-certificate", label: "Marriage Certificate, if married" },
  { key: "birth-certificate", label: "Birth Certificate" },
  { key: "medical-dental-result", label: "Medical / Dental Examination Result" },
  { key: "psychological-test-result", label: "Psychological Test Result" },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  allowMultiple?: boolean;
  templateKey?: "uc-application-form";
}>;

export const APPLICANT_REQUIREMENT_GROUPS = [
  {
    title: "Core Documents",
    items: APPLICANT_UPLOAD_REQUIREMENTS.filter((item) => [
      "uc-application-form",
      "application-letter",
      "resume-cv",
      "two-by-two-photo",
      "transcript-of-records",
      "diplomas",
      "recommendation-letters",
    ].includes(item.key)),
    uploadRequired: true,
  },
  {
    title: "Government Statutory Numbers",
    items: GOVERNMENT_STATUTORY_NUMBER_FIELDS.map((field) => ({ key: field.key, label: field.label })),
    uploadRequired: false,
  },
  {
    title: "Clearances and Civil Documents",
    items: APPLICANT_UPLOAD_REQUIREMENTS.filter((item) => [
      "form-2316",
      "clearance-or-coe",
      "nbi-or-police-clearance",
      "prc-licenses",
      "marriage-certificate",
      "birth-certificate",
    ].includes(item.key)),
    uploadRequired: true,
  },
  {
    title: "Medical Results",
    items: APPLICANT_UPLOAD_REQUIREMENTS.filter((item) => [
      "medical-dental-result",
      "psychological-test-result",
    ].includes(item.key)),
    uploadRequired: true,
  },
] as const;

export type GovernmentStatutoryNumberField = (typeof GOVERNMENT_STATUTORY_NUMBER_FIELDS)[number];
export type ApplicantUploadRequirement = (typeof APPLICANT_UPLOAD_REQUIREMENTS)[number];
export type ApplicantUploadRequirementKey = ApplicantUploadRequirement["key"];
