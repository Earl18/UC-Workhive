import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/admin-data";
import { importEmployeeMasterRecords } from "@/lib/hr-data";
import type { ImportedEmployeeDraft } from "@/lib/hr-import";

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      records?: ImportedEmployeeDraft[];
      fileName?: string;
      classification?: string;
      overwriteExisting?: boolean;
      workbookType?: "employee-information" | "id-number";
    };
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return NextResponse.json({ error: "No extracted employee records were provided." }, { status: 400 });
    }

    const overwriteExisting = body.overwriteExisting === true;
    const result = await importEmployeeMasterRecords(records, { overwriteExisting, workbookType: body.workbookType ?? "employee-information" });

    await logAuditEvent({
      user: auth.user.name,
      action: "Import Employee Master List",
      category: "Employee",
      detail: `Imported ${result.total} ${body.classification ?? "Non-Teaching"} employee records from ${body.fileName ?? "Excel workbook"} (${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.accountsCreated} accounts created, ${result.accountsSkipped} account creations skipped, mode: ${overwriteExisting ? "update duplicates" : "retain database originals"})`,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save imported employee records.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


