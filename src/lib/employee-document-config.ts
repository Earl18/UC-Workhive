export const EMPLOYEE_DOCUMENT_BUCKET = process.env.SUPABASE_EMPLOYEE_DOCUMENTS_BUCKET ?? "Employee Documents";
export const LEAVE_ATTACHMENT_BUCKET = process.env.SUPABASE_LEAVE_ATTACHMENTS_BUCKET ?? "Leave Attachment";
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EMPLOYEE_DOCUMENT_MAX_MB = 10;
export const EMPLOYEE_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

export const EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedEmployeeDocumentMimeType = (typeof EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES)[number];
