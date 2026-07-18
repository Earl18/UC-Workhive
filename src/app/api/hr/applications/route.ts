import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicants } from "@/lib/application-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const applicants = await getSubmittedApplicants();
  return NextResponse.json({ applicants }, { headers: { "Cache-Control": "no-store" } });
}
