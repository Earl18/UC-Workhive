export const EMPLOYEE_DOCUMENT_BUCKET = process.env.SUPABASE_EMPLOYEE_DOCUMENTS_BUCKET ?? "Employee Documents";
export const LEAVE_ATTACHMENT_BUCKET = process.env.SUPABASE_LEAVE_ATTACHMENTS_BUCKET ?? "Leave Attachment";
export const APPLICATION_REQUIREMENTS_BUCKET = process.env.GCS_APPLICANT_REQUIREMENTS_BUCKET ?? "workhive_requirements";
export const APPLICANT_TEMPLATE_BUCKET = process.env.SUPABASE_APPLICANT_TEMPLATES_BUCKET ?? EMPLOYEE_DOCUMENT_BUCKET;

export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EMPLOYEE_DOCUMENT_MAX_MB = 10;
export const EMPLOYEE_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export const APPLICATION_REQUIREMENT_MAX_BYTES = 10 * 1024 * 1024;
export const APPLICATION_REQUIREMENT_MAX_MB = 10;
export const APPLICATION_REQUIREMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export const APPLICANT_TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;
export const APPLICANT_TEMPLATE_MAX_MB = 10;
export const APPLICANT_TEMPLATE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";

export const EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const APPLICANT_TEMPLATE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedEmployeeDocumentMimeType = (typeof EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES)[number];
export type AllowedApplicationRequirementMimeType = (typeof APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES)[number];
export type AllowedApplicantTemplateMimeType = (typeof APPLICANT_TEMPLATE_ALLOWED_MIME_TYPES)[number];

