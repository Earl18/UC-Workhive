import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { createEmployeeMasterRecord, getEmployeeMasterListPage } from "@/lib/hr-data";
import { logAuditEvent } from "@/lib/admin-data";
import type { Employee } from "@/lib/types";
import { emailDeliveryErrorMessage, isEmailTransportConfigured, sendTemplatedEmail } from "@/lib/brevo-email";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const data = await getEmployeeMasterListPage({
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    department: searchParams.get("department") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    gender: searchParams.get("gender") ?? undefined,
    age: (searchParams.get("age") as "all" | "under-25" | "25-34" | "35-44" | "45-54" | "55-plus" | null) ?? undefined,
    educationLevel: (searchParams.get("educationLevel") as "all" | "Bachelor" | "Master" | "Doctoral" | null) ?? undefined,
    sortKey: (searchParams.get("sortKey") as "idNumber" | "lastName" | "firstName" | "department" | "position" | "dateHired" | "employmentStatus" | "age" | null) ?? undefined,
    sortDir: (searchParams.get("sortDir") as "asc" | "desc" | null) ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}


export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Omit<Employee, "id"> & { birthDate?: string; accountRole?: "employee" | "hr"; createAccount?: boolean };
    if (body.createAccount !== false && !isEmailTransportConfigured()) {
      return NextResponse.json({ error: "Account email delivery is not configured." }, { status: 503 });
    }
    const { employee, temporaryPassword } = await createEmployeeMasterRecord(body);

    await logAuditEvent({
      user: auth.user.name,
      action: "Create Employee Record",
      category: "Employee",
      detail: `${employee?.lastName}, ${employee?.firstName} was added to the employee master list`,
    });

    if (temporaryPassword) {
      try {
        await sendTemplatedEmail({
          type: "Welcome Email", to: employee.email,
          recipientName: `${employee.firstName} ${employee.lastName}`,
          context: { employeeId: employee.id, event: { temporaryPassword } }, eventKey: `employee:${employee.id}:credentials`,
        });
      } catch (emailError) {
        console.error("Employee credentials email failed", emailError);
        return NextResponse.json({ employee, emailSent: false, emailError: emailDeliveryErrorMessage(emailError) }, { status: 201 });
      }
    }

    return NextResponse.json({ employee, emailSent: Boolean(temporaryPassword) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create employee record.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

