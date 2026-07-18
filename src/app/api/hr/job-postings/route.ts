import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { createJobPosting, getJobPostingFormOptions, getStaffJobPostings } from "@/lib/job-posting-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const [jobPostings, options] = await Promise.all([
    getStaffJobPostings(),
    getJobPostingFormOptions(),
  ]);

  return NextResponse.json({ jobPostings, ...options }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const jobPosting = await createJobPosting({ ...body, creatorName: auth.user.name });
    return NextResponse.json({ jobPosting }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create job posting." },
      { status: 400 },
    );
  }
}
