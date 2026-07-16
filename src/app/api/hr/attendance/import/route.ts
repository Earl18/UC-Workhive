import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { importAttendanceWorkbookForStaff } from "@/lib/attendance-data";

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

  try {
    const overwriteExisting = String(formData.get("overwriteExisting") ?? "false") === "true";
    const summary = await importAttendanceWorkbookForStaff(auth.user, file.name, Buffer.from(await file.arrayBuffer()), { overwriteExisting });
    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import attendance workbook." },
      { status: 400 },
    );
  }
}


