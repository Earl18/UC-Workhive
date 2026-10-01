import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getStaffLeaveDashboard, updateLeaveRequestStageForStaff } from "@/lib/employee-leave";
import { db } from "@/lib/db";
import { sendTemplatedEmailSafely } from "@/lib/brevo-email";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const dashboard = await getStaffLeaveDashboard();
  return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      approve?: boolean;
      reason?: string;
    };

    const leaveRequest = await updateLeaveRequestStageForStaff(auth.user, body);
    try {
      const employee = await db.employeeRecord.findUnique({ where: { id: leaveRequest.employeeId }, select: { email: true, firstName: true, lastName: true } });
      if (employee && leaveRequest.overallStatus !== "Pending") {
        await sendTemplatedEmailSafely({
          type: leaveRequest.overallStatus === "Approved" ? "Leave Approved" : "Leave Rejected",
          to: employee.email,
          recipientName: `${employee.firstName} ${employee.lastName}`,
          context: { employeeId: leaveRequest.employeeId, leaveId: leaveRequest.id, event: { reason: body.reason?.trim() || leaveRequest.reason } },
          eventKey: `leave:${leaveRequest.id}:${leaveRequest.overallStatus}`,
        });
      }
    } catch (emailError) { console.error("Leave email preparation failed", emailError); }
    return NextResponse.json({ leaveRequest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update leave request." },
      { status: 400 },
    );
  }
}
