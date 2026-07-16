import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getStaffLeaveRequestById } from "@/lib/employee-leave";
import { createSignedEmployeeDocumentUrl } from "@/lib/supabase-storage";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const leaveRequest = await getStaffLeaveRequestById(id);

  if (!leaveRequest) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
  }

  if (!leaveRequest.attachment?.storagePath) {
    return NextResponse.json({ error: "No attachment uploaded for this leave request." }, { status: 404 });
  }

  try {
    const url = await createSignedEmployeeDocumentUrl({
      bucket: leaveRequest.attachment.storageBucket,
      objectPath: leaveRequest.attachment.storagePath,
    });

    return NextResponse.json({ url, fileName: leaveRequest.attachment.fileName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open the leave attachment." },
      { status: 500 },
    );
  }
}
