import { NextResponse } from "next/server";
import { getJobPostingById } from "@/lib/job-posting-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const jobPosting = await getJobPostingById(id);

  if (!jobPosting) {
    return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
  }

  return NextResponse.json({ jobPosting }, { headers: { "Cache-Control": "no-store" } });
}
