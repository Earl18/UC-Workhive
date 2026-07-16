import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getEmployeeMasterRecordForUser, updateEmployeeMasterRecord } from "@/lib/hr-data";
import { deleteEmployeeDocumentFromStorage } from "@/lib/supabase-storage";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ docId: string }> },
) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const employee = await getEmployeeMasterRecordForUser(auth.user);
  if (!employee) {
    return NextResponse.json({ error: "No employee record found." }, { status: 404 });
  }

  const { docId } = await context.params;
  const targetDocument = employee.documents.find((document) => document.id === docId);
  if (!targetDocument) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await deleteEmployeeDocumentFromStorage({
    bucket: targetDocument.storageBucket,
    objectPath: targetDocument.storagePath,
  });

  const updatedEmployee = await updateEmployeeMasterRecord(employee.id, {
    documents: employee.documents.filter((document) => document.id !== docId),
  });

  return NextResponse.json({ employee: updatedEmployee });
}
