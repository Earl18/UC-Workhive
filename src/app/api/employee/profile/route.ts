import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getEmployeeMasterRecordForUser, updateEmployeeMasterRecord } from "@/lib/hr-data";
import type { Employee } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const employee = await getEmployeeMasterRecordForUser(auth.user);
  if (!employee) {
    return NextResponse.json({ error: "No employee record found." }, { status: 404 });
  }

  return NextResponse.json({ employee }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const existing = await getEmployeeMasterRecordForUser(auth.user);
  if (!existing) {
    return NextResponse.json({ error: "No employee record found." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<Employee & { birthDate?: string }>;
  const employee = await updateEmployeeMasterRecord(existing.id, body);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({ employee });
}
