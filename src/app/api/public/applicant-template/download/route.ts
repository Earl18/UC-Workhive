import { NextResponse } from "next/server";
import { getApplicantTemplateSetting } from "@/lib/applicant-template";
import { createSignedEmployeeDocumentUrl } from "@/lib/supabase-storage";

export async function GET() {
  const template = await getApplicantTemplateSetting();
  if (!template.storagePath) {
    return NextResponse.json({ error: "The UC Application Form template has not been uploaded yet." }, { status: 404 });
  }

  const url = await createSignedEmployeeDocumentUrl({
    bucket: template.storageBucket,
    objectPath: template.storagePath,
    expiresInSeconds: 600,
  });

  return NextResponse.redirect(url);
}
