import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import {
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  EMPLOYEE_DOCUMENT_MAX_MB,
} from "@/lib/employee-document-config";
import { getEmployeeMasterRecordForUser, updateEmployeeMasterRecord } from "@/lib/hr-data";
import {
  isAllowedEmployeeDocumentMimeType,
  uploadEmployeeDocumentToStorage,
} from "@/lib/supabase-storage";
import type { DocumentRecord } from "@/lib/types";

const ALLOWED_DOCUMENT_TYPES: DocumentRecord["type"][] = [
  "Diploma",
  "Certificate",
  "PRC License",
  "Training Certificate",
  "COE",
  "Clearance",
  "Other",
];

function employeeDisplayName(employee: { firstName: string; middleName: string; lastName: string }) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuthenticated(request);
    if (auth.response) {
      return auth.response;
    }

    const employee = await getEmployeeMasterRecordForUser(auth.user);
    if (!employee) {
      return NextResponse.json({ error: "No employee record found." }, { status: 404 });
    }

    const formData = await request.formData();
    const type = String(formData.get("type") ?? "") as DocumentRecord["type"];
    const customLabel = String(formData.get("customLabel") ?? "").trim();
    const fileValue = formData.get("file");

    if (!ALLOWED_DOCUMENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Please select a valid document type." }, { status: 400 });
    }

    if (type === "Other" && !customLabel) {
      return NextResponse.json({ error: "Please enter the document name for Other." }, { status: 400 });
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "Please choose a file to upload." }, { status: 400 });
    }

    if (fileValue.size <= 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    if (fileValue.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
      return NextResponse.json({ error: `Each document must be ${EMPLOYEE_DOCUMENT_MAX_MB} MB or smaller.` }, { status: 400 });
    }

    if (!isAllowedEmployeeDocumentMimeType(fileValue.type)) {
      return NextResponse.json({ error: "Only PDF, JPG, JPEG, and PNG files are allowed." }, { status: 400 });
    }

    const storage = await uploadEmployeeDocumentToStorage({
      employeeName: employeeDisplayName(employee),
      file: fileValue,
    });

    const newDocument: DocumentRecord = {
      id: `doc-${randomUUID()}`,
      employeeId: employee.id,
      type,
      label: type === "Other" ? customLabel : undefined,
      fileName: fileValue.name,
      uploadDate: new Date().toISOString().slice(0, 10),
      status: "Pending",
      mimeType: fileValue.type,
      sizeBytes: fileValue.size,
      storageBucket: storage.bucket,
      storagePath: storage.objectPath,
    };

    const updatedEmployee = await updateEmployeeMasterRecord(employee.id, {
      documents: [...employee.documents, newDocument],
    });

    return NextResponse.json({
      employee: updatedEmployee,
      document: newDocument,
      maxFileSizeMb: EMPLOYEE_DOCUMENT_MAX_MB,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload the document right now.";
    const friendlyMessage = message.includes("Bucket not found")
      ? "Supabase bucket \"Employee Documents\" was not found. Create that bucket in Supabase Storage or update SUPABASE_EMPLOYEE_DOCUMENTS_BUCKET in .env to your existing bucket name."
      : message;

    return NextResponse.json(
      { error: friendlyMessage },
      { status: 500 },
    );
  }
}
