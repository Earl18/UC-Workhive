import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getStaffLeaveDashboard, updateLeaveRequestStageForStaff } from "@/lib/employee-leave";

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
    return NextResponse.json({ leaveRequest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update leave request." },
      { status: 400 },
    );
  }
}
