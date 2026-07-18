import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  APPLICANT_TEMPLATE_ALLOWED_MIME_TYPES,
  APPLICANT_TEMPLATE_MAX_BYTES,
  APPLICANT_TEMPLATE_MAX_MB,
} from "@/lib/employee-document-config";
import {
  APPLICANT_TEMPLATE_LABEL,
  getApplicantTemplateSetting,
  saveApplicantTemplateSetting,
} from "@/lib/applicant-template";
import {
  createSignedEmployeeDocumentUrl,
  deleteEmployeeDocumentFromStorage,
  uploadApplicantTemplateToStorage,
} from "@/lib/supabase-storage";

export async function GET(request: Request) {
  const auth = requireAdmin(request as never);
  if (auth.response) {
    return auth.response;
  }

  try {
    return NextResponse.json({ template: await getApplicantTemplateSetting() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the applicant template." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = requireAdmin(request as never);
  if (auth.response) {
    return auth.response;
  }

  let uploadedStorage: { bucket: string; objectPath: string } | null = null;

  try {
    const formData = await request.formData();
    const value = formData.get("templateFile");

    if (!(value instanceof File)) {
      return NextResponse.json({ error: "Please choose a template file to upload." }, { status: 400 });
    }

    if (value.size <= 0) {
      return NextResponse.json({ error: "The selected template file is empty." }, { status: 400 });
    }

    if (value.size > APPLICANT_TEMPLATE_MAX_BYTES) {
      return NextResponse.json({ error: `Template files must be ${APPLICANT_TEMPLATE_MAX_MB} MB or smaller.` }, { status: 400 });
    }

    if (!APPLICANT_TEMPLATE_ALLOWED_MIME_TYPES.includes(value.type as (typeof APPLICANT_TEMPLATE_ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json({ error: "Allowed template formats are PDF, DOC, DOCX, XLS, and XLSX." }, { status: 400 });
    }

    const previous = await getApplicantTemplateSetting();
    uploadedStorage = await uploadApplicantTemplateToStorage({
      templateLabel: APPLICANT_TEMPLATE_LABEL,
      file: value,
    });

    const template = await saveApplicantTemplateSetting({
      fileName: value.name,
      storageBucket: uploadedStorage.bucket,
      storagePath: uploadedStorage.objectPath,
    });

    const downloadUrl = await createSignedEmployeeDocumentUrl({
      bucket: uploadedStorage.bucket,
      objectPath: uploadedStorage.objectPath,
      expiresInSeconds: 600,
    });

    if (previous.storagePath && previous.storagePath !== uploadedStorage.objectPath) {
      await deleteEmployeeDocumentFromStorage({
        bucket: previous.storageBucket,
        objectPath: previous.storagePath,
      }).catch(() => undefined);
    }

    return NextResponse.json({ template, downloadUrl });
  } catch (error) {
    if (uploadedStorage) {
      await deleteEmployeeDocumentFromStorage({
        bucket: uploadedStorage.bucket,
        objectPath: uploadedStorage.objectPath,
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { error: error instanceof Error && error.message.includes("Bucket not found") ? "Supabase template storage bucket was not found. The system now defaults to the Employee Documents bucket unless SUPABASE_APPLICANT_TEMPLATES_BUCKET is set. Try uploading again, or update that env var if you want a separate bucket." : error instanceof Error ? error.message : "Unable to save the applicant template." },
      { status: 500 },
    );
  }
}

