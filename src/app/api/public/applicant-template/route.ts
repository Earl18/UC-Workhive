import { NextResponse } from "next/server";
import { getApplicantTemplateSetting } from "@/lib/applicant-template";

export async function GET() {
  return NextResponse.json({ template: await getApplicantTemplateSetting() });
}
