import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { APPLICANT_UPLOAD_REQUIREMENTS } from "@/lib/application-requirements";
import { submitApplicantApplication } from "@/lib/application-data";
import { sendTemplatedEmailSafely } from "@/lib/brevo-email";
import {
  APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES,
  APPLICATION_REQUIREMENT_MAX_BYTES,
  APPLICATION_REQUIREMENT_MAX_MB,
} from "@/lib/employee-document-config";
import { R2StorageLimitError, uploadApplicantRequirementsArchiveToR2 } from "@/lib/r2-storage";

function sanitizeArchiveName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "applicant";
}

function sanitizeZipEntryName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .replace(/\s+/g, " ") || "requirement";
}

function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot) : "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const sssNumber = String(formData.get("sssNumber") ?? "").trim();
    const tinNumber = String(formData.get("tinNumber") ?? "").trim();
    const pagIbigNumber = String(formData.get("pagIbigNumber") ?? "").trim();
    const philHealthNumber = String(formData.get("philHealthNumber") ?? "").trim();
    const jobId = String(formData.get("jobId") ?? "").trim();

    if (!fullName || !email || !contact || !sssNumber || !tinNumber || !pagIbigNumber || !philHealthNumber || !jobId) {
      return NextResponse.json({ error: "Please complete all required applicant details." }, { status: 400 });
    }

    const zip = new JSZip();
    const requirements = [] as Array<{ key: string; label: string; submitted: boolean; fileCount?: number }>;

    for (let index = 0; index < APPLICANT_UPLOAD_REQUIREMENTS.length; index += 1) {
      const requirement = APPLICANT_UPLOAD_REQUIREMENTS[index];
      const values = formData.getAll(`requirement:${requirement.key}`);
      const files = values.filter((value): value is File => value instanceof File);

      if (files.length === 0) {
        return NextResponse.json({ error: `Missing required file: ${requirement.label}` }, { status: 400 });
      }

      if (!("allowMultiple" in requirement && requirement.allowMultiple) && files.length > 1) {
        return NextResponse.json({ error: `${requirement.label} accepts only one file.` }, { status: 400 });
      }

      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];

        if (file.size <= 0) {
          return NextResponse.json({ error: `The uploaded file for ${requirement.label} is empty.` }, { status: 400 });
        }

        if (file.size > APPLICATION_REQUIREMENT_MAX_BYTES) {
          return NextResponse.json({ error: `Each requirement file must be ${APPLICATION_REQUIREMENT_MAX_MB} MB or smaller.` }, { status: 400 });
        }

        if (!APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES.includes(file.type as (typeof APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES)[number])) {
          return NextResponse.json({ error: `Only PDF, JPG, JPEG, and PNG files are allowed for ${requirement.label}.` }, { status: 400 });
        }

        const extension = getFileExtension(file.name);
        const entryName = `${String(index + 1).padStart(2, "0")} - ${sanitizeZipEntryName(requirement.label)}${files.length > 1 ? ` (${fileIndex + 1})` : ""}${extension}`;
        zip.file(entryName, Buffer.from(await file.arrayBuffer()));
      }

      requirements.push({
        key: requirement.key,
        label: requirement.label,
        submitted: true,
        fileCount: files.length,
      });
    }

    const archiveName = `${sanitizeArchiveName(fullName)}.zip`;
    const archiveBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const storage = await uploadApplicantRequirementsArchiveToR2({
      archiveName,
      archiveBuffer,
    });

    const applicant = await submitApplicantApplication({
      fullName,
      email,
      contact,
      message,
      sssNumber,
      tinNumber,
      pagIbigNumber,
      philHealthNumber,
      jobId,
      requirements,
      requirementsArchiveName: storage.fileName,
      requirementsArchiveBucket: storage.bucket,
      requirementsArchivePath: storage.objectPath,
    });

    await sendTemplatedEmailSafely({
      type: "Job Application Received",
      to: email,
      recipientName: fullName,
      context: { applicantId: applicant.id },
      eventKey: `application:${applicant.id}:received`,
    });

    return NextResponse.json({ applicant });
  } catch (error) {
    if (error instanceof R2StorageLimitError) {
      return NextResponse.json({ error: error.message }, { status: 507 });
    }
    console.error("Applicant application submission failed", error);
    return NextResponse.json({ error: "Unable to submit the application right now. Please try again later." }, { status: 500 });
  }
}
