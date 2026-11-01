import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById } from "@/lib/application-data";
import { APPLICANT_UPLOAD_REQUIREMENTS, requirementArchiveEntryBaseName } from "@/lib/application-requirements";
import { downloadApplicantRequirementsArchive } from "@/lib/gcs-storage";
import { downloadApplicantRequirementsArchiveFromR2, isR2ApplicantArchive } from "@/lib/r2-storage";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; key: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) return auth.response;

  const { id, key } = await context.params;
  const requirementIndex = APPLICANT_UPLOAD_REQUIREMENTS.findIndex((requirement) => requirement.key === key);
  if (requirementIndex < 0) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  try {
    const applicant = await getSubmittedApplicantById(id);
    if (!applicant?.requirements?.some((requirement) => requirement.key === key && requirement.submitted)
      || !applicant.requirementsArchiveBucket || !applicant.requirementsArchivePath) {
      return NextResponse.json({ error: "Submitted file not found." }, { status: 404 });
    }

    const archive = await (isR2ApplicantArchive(applicant.requirementsArchiveBucket)
      ? downloadApplicantRequirementsArchiveFromR2({
          bucket: applicant.requirementsArchiveBucket,
          objectPath: applicant.requirementsArchivePath,
        })
      : downloadApplicantRequirementsArchive({
          bucket: applicant.requirementsArchiveBucket,
          objectPath: applicant.requirementsArchivePath,
        }));
    const zip = await JSZip.loadAsync(archive);
    const entryBase = requirementArchiveEntryBaseName(APPLICANT_UPLOAD_REQUIREMENTS[requirementIndex], requirementIndex);
    const entry = Object.values(zip.files).find((file) => {
      if (file.dir || file.name.includes("/") || !file.name.startsWith(`${entryBase}.`)) return false;
      return Object.hasOwn(CONTENT_TYPES, file.name.slice(entryBase.length).toLowerCase());
    });
    if (!entry) {
      return NextResponse.json({ error: "Submitted file not found." }, { status: 404 });
    }

    const file = await entry.async("nodebuffer");
    if (file.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Submitted file is too large to preview." }, { status: 413 });
    }
    const extension = entry.name.slice(entryBase.length).toLowerCase();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension],
        "Content-Disposition": `inline; filename="${entryBase}${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to open the submitted file." }, { status: 500 });
  }
}
