import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES,
  EMPLOYEE_DOCUMENT_BUCKET,
  LEAVE_ATTACHMENT_BUCKET,
} from "@/lib/employee-document-config";

const EMPLOYEE_DOCUMENTS_FOLDER_NAME = "employee-documents";
const LEAVE_ATTACHMENTS_FOLDER_NAME = "leave-attachments";

function getSupabaseStorageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase storage environment variables are not configured.");
  }

  return {
    url,
    serviceRoleKey,
  };
}

function sanitizePathSegment(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return normalized || "employee";
}

function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return fileName.slice(lastDot).toLowerCase();
}

function buildEmployeeStorageFolder(employeeName: string, subfolderName: string) {
  return `${sanitizePathSegment(employeeName)}/${subfolderName}`;
}

async function uploadFileToSupabaseBucket(input: {
  bucket: string;
  employeeName: string;
  file: File;
  subfolderName: string;
}) {
  const { url, serviceRoleKey } = getSupabaseStorageConfig();
  const employeeFolder = buildEmployeeStorageFolder(input.employeeName, input.subfolderName);
  const extension = getFileExtension(input.file.name);
  const safeBaseName = sanitizePathSegment(input.file.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${employeeFolder}/${Date.now()}-${safeBaseName}-${randomUUID().slice(0, 8)}${extension}`;
  const uploadUrl = `${url}/storage/v1/object/${input.bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": input.file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(await input.file.arrayBuffer()),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to upload the file to Supabase Storage.");
  }

  return {
    bucket: input.bucket,
    objectPath,
  };
}

export function buildEmployeeDocumentFolder(employeeName: string) {
  return buildEmployeeStorageFolder(employeeName, EMPLOYEE_DOCUMENTS_FOLDER_NAME);
}

export function isAllowedEmployeeDocumentMimeType(contentType: string) {
  return EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES.includes(contentType as (typeof EMPLOYEE_DOCUMENT_ALLOWED_MIME_TYPES)[number]);
}

export async function uploadEmployeeDocumentToStorage(input: {
  employeeName: string;
  file: File;
}) {
  return uploadFileToSupabaseBucket({
    bucket: EMPLOYEE_DOCUMENT_BUCKET,
    employeeName: input.employeeName,
    file: input.file,
    subfolderName: EMPLOYEE_DOCUMENTS_FOLDER_NAME,
  });
}

export async function uploadLeaveAttachmentToStorage(input: {
  employeeName: string;
  file: File;
}) {
  return uploadFileToSupabaseBucket({
    bucket: LEAVE_ATTACHMENT_BUCKET,
    employeeName: input.employeeName,
    file: input.file,
    subfolderName: LEAVE_ATTACHMENTS_FOLDER_NAME,
  });
}

export async function createSignedEmployeeDocumentUrl(input: {
  bucket?: string | null;
  objectPath?: string | null;
  expiresInSeconds?: number;
}) {
  if (!input.objectPath) {
    throw new Error("No storage object path was provided.");
  }

  const { url, serviceRoleKey } = getSupabaseStorageConfig();
  const targetBucket = input.bucket || EMPLOYEE_DOCUMENT_BUCKET;
  const response = await fetch(`${url}/storage/v1/object/sign/${targetBucket}/${input.objectPath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: input.expiresInSeconds ?? 600 }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to generate a secure file link.");
  }

  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL ?? payload.signedUrl;

  if (!signedPath) {
    throw new Error("Supabase did not return a signed URL for this file.");
  }

  return `${url}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
}

export async function deleteEmployeeDocumentFromStorage(input: {
  bucket?: string | null;
  objectPath?: string | null;
}) {
  if (!input.objectPath) {
    return;
  }

  const { url, serviceRoleKey } = getSupabaseStorageConfig();
  const targetBucket = input.bucket || EMPLOYEE_DOCUMENT_BUCKET;
  const response = await fetch(`${url}/storage/v1/object/${targetBucket}/${input.objectPath}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(text || "Unable to remove the document from Supabase Storage.");
  }
}
