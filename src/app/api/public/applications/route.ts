import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { APPLICANT_UPLOAD_REQUIREMENTS } from "@/lib/application-requirements";
import { DuplicateJobApplicationError, hasSubmittedJobApplication, submitApplicantApplication } from "@/lib/application-data";
import { ApplicationChallengeError, verifyJobApplicationChallenge } from "@/lib/application-abuse";
import { sendTemplatedEmailSafely } from "@/lib/brevo-email";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import {
  APPLICATION_REQUIREMENT_ALLOWED_MIME_TYPES,
  APPLICATION_REQUIREMENT_MAX_BYTES,
  APPLICATION_REQUIREMENT_MAX_MB,
} from "@/lib/employee-document-config";
import { deleteApplicantRequirementsArchiveFromR2, R2StorageLimitError, uploadApplicantRequirementsArchiveToR2 } from "@/lib/r2-storage";

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
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 22 * 1024 * 1024) {
    return NextResponse.json({ error: "The application upload is too large." }, { status: 413 });
  }
  try {
    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const jobId = String(formData.get("jobId") ?? "").trim();
    const challengeToken = String(formData.get("turnstileToken") ?? "").trim();

    if (!fullName || !email || !contact || !jobId) {
      return NextResponse.json({ error: "Please complete all required applicant details." }, { status: 400 });
    }
    if (fullName.length > 160 || email.length > 254 || contact.length > 40 || message.length > 2_000 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please check the applicant details and email address." }, { status: 400 });
    }
    await verifyJobApplicationChallenge(challengeToken, request.nextUrl.hostname);
    if (await hasSubmittedJobApplication(jobId, email)) {
      return NextResponse.json({ error: "An application from this email has already been submitted for this job." }, { status: 409 });
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

      if (files.length > 1) {
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
      jobId,
      requirements,
      requirementsArchiveName: storage.fileName,
      requirementsArchiveBucket: storage.bucket,
      requirementsArchivePath: storage.objectPath,
    }).catch(async (error) => {
      await deleteApplicantRequirementsArchiveFromR2(storage).catch((cleanupError) => console.error("Applicant archive cleanup failed", cleanupError));
      throw error;
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
    if (error instanceof ApplicationChallengeError || error instanceof DuplicateJobApplicationError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof ApplicationChallengeError ? error.status : 409 });
    }
    if (error instanceof R2StorageLimitError) {
      return NextResponse.json({ error: error.message }, { status: 507 });
    }
    console.error("Applicant application submission failed", error);
    return NextResponse.json({ error: "Unable to submit the application right now. Please try again later." }, { status: 500 });
  }
}
