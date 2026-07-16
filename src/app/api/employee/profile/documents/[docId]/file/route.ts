import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getEmployeeMasterRecordForUser } from "@/lib/hr-data";
import { createSignedEmployeeDocumentUrl } from "@/lib/supabase-storage";

export async function GET(
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

  if (!targetDocument.storagePath) {
    return NextResponse.json({ error: "This document is not stored in Supabase yet." }, { status: 404 });
  }

  try {
    const url = await createSignedEmployeeDocumentUrl({
      bucket: targetDocument.storageBucket,
      objectPath: targetDocument.storagePath,
    });

    return NextResponse.json({
      url,
      fileName: targetDocument.fileName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open this document." },
      { status: 500 },
    );
  }
}
