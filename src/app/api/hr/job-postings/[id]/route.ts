import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { deleteJobPosting, getJobPostingById, setJobPostingActiveState, updateJobPosting } from "@/lib/job-posting-data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const jobPosting = await getJobPostingById(id);
  if (!jobPosting) {
    return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
  }

  return NextResponse.json({ jobPosting }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : null;
    const jobPosting = action === "close"
      ? await setJobPostingActiveState(id, false)
      : action === "reopen"
        ? await setJobPostingActiveState(id, true)
        : await updateJobPosting(id, { ...(body ?? {}), creatorName: auth.user.name });

    return NextResponse.json({ jobPosting });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update job posting." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  try {
    await deleteJobPosting(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove job posting." },
      { status: 400 },
    );
  }
}
