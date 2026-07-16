import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createEmployeeLeaveRequestForUser, getEmployeeLeaveDashboard } from "@/lib/employee-leave";

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const dashboard = await getEmployeeLeaveDashboard(auth.user);
  if (!dashboard) {
    return NextResponse.json({ error: "No employee record found." }, { status: 404 });
  }

  return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const leaveRequest = await createEmployeeLeaveRequestForUser(auth.user, {
      leaveType: String(formData.get("leaveType") ?? ""),
      dateFrom: String(formData.get("dateFrom") ?? ""),
      dateTo: String(formData.get("dateTo") ?? ""),
      durationType: String(formData.get("durationType") ?? "full-day"),
      reason: String(formData.get("reason") ?? ""),
      attachment: formData.get("attachment") instanceof File ? (formData.get("attachment") as File) : null,
    });

    return NextResponse.json({ leaveRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to file leave application." },
      { status: 400 },
    );
  }
}


