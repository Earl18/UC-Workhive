import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { parseEmploymentStatusWorkbook } from "@/lib/hr-import";
import { getEmployeeImportDuplicateSummary } from "@/lib/hr-data";

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Excel file is required." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported right now." }, { status: 400 });
  }

  const payload = await parseEmploymentStatusWorkbook(file.name, Buffer.from(await file.arrayBuffer()));
  const duplicateSummary = await getEmployeeImportDuplicateSummary(payload.records, payload.workbookType ?? "employee-information");

  return NextResponse.json({
    fileName: file.name,
    ...payload,
    duplicates: duplicateSummary,
  });
}
