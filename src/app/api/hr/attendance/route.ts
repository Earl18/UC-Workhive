import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getHrAttendanceReport, restoreDeletedAttendanceRecord, softDeleteAttendanceRecord, updateAttendanceOvertimeDecision, updateAttendanceRecordTimes } from "@/lib/attendance-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const payload = await getHrAttendanceReport({
      month: searchParams.get("month") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
      remarks: searchParams.get("remarks") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attendance report." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      action?: "overtime" | "edit" | "delete" | "restore";
      id?: string;
      approve?: boolean;
      note?: string;
      morningIn?: string | null;
      morningOut?: string | null;
      afternoonIn?: string | null;
      afternoonOut?: string | null;
    };

    const action = body.action ?? "overtime";
    if (action === "edit") {
      const record = await updateAttendanceRecordTimes(auth.user, body);
      return NextResponse.json({ record });
    }
    if (action === "delete") {
      await softDeleteAttendanceRecord(auth.user, body);
      return NextResponse.json({ ok: true });
    }
    if (action === "restore") {
      const record = await restoreDeletedAttendanceRecord(body);
      return NextResponse.json({ record });
    }

    const record = await updateAttendanceOvertimeDecision(auth.user, body);
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update attendance record." },
      { status: 400 },
    );
  }
}


