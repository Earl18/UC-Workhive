import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getEmployeeMasterRecord, updateEmployeeMasterRecord } from "@/lib/hr-data";
import { logAuditEvent } from "@/lib/admin-data";
import type { Employee } from "@/lib/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const employee = await getEmployeeMasterRecord(id);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({ employee }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as Partial<Employee & { birthDate?: string }>;
  const employee = await updateEmployeeMasterRecord(id, body);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  await logAuditEvent({
    user: auth.user.name,
    action: "Update Employee Record",
    category: "Employee",
    detail: `${employee.lastName}, ${employee.firstName} master list details were updated`,
  });

  return NextResponse.json({ employee });
}
