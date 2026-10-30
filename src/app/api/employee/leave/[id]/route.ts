import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { cancelEmployeeLeaveRequestForUser } from "@/lib/employee-leave";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const leaveRequest = await cancelEmployeeLeaveRequestForUser(auth.user, id);
    return NextResponse.json({ leaveRequest }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel leave request." },
      { status: 400 },
    );
  }
}
