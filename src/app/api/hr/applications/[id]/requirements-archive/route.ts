import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById } from "@/lib/application-data";
import { downloadApplicantRequirementsArchive } from "@/lib/gcs-storage";
import { downloadApplicantRequirementsArchiveFromR2, isR2ApplicantArchive } from "@/lib/r2-storage";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const applicant = await getSubmittedApplicantById(id);

    if (!applicant) {
      return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
    }

    if (!applicant.requirementsArchiveBucket || !applicant.requirementsArchivePath || !applicant.requirementsArchiveName) {
      return NextResponse.json({ error: "Requirements archive is not available for this applicant." }, { status: 404 });
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

    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${applicant.requirementsArchiveName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to download the requirements archive." },
      { status: 400 },
    );
  }
}
