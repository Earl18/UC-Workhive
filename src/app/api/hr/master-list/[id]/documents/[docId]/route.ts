import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/admin-data";
import { getEmployeeMasterRecord, updateEmployeeMasterRecord } from "@/lib/hr-data";
import type { DocumentRecord } from "@/lib/types";

const ALLOWED_STATUSES: DocumentRecord["status"][] = ["Verified", "Rejected"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id, docId } = await context.params;
  const employee = await getEmployeeMasterRecord(id);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const body = (await request.json()) as { status?: DocumentRecord["status"] };
  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid document status." }, { status: 400 });
  }

  const targetDocument = employee.documents.find((document) => document.id === docId);
  if (!targetDocument) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const updatedEmployee = await updateEmployeeMasterRecord(id, {
    documents: employee.documents.map((document) => (
      document.id === docId ? { ...document, status: body.status } : document
    )),
  });

  await logAuditEvent({
    user: auth.user.name,
    action: body.status === "Verified" ? "Verify Employee Document" : "Reject Employee Document",
    category: "Employee",
    detail: `${employee.lastName}, ${employee.firstName} - ${targetDocument.fileName} marked as ${body.status}`,
  });

  return NextResponse.json({ employee: updatedEmployee });
}
