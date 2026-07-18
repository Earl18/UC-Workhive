import { NextResponse } from "next/server";
import { getPublicJobPostings } from "@/lib/job-posting-data";

export async function GET() {
  const jobPostings = await getPublicJobPostings();
  return NextResponse.json({ jobPostings }, { headers: { "Cache-Control": "no-store" } });
}
