import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import {
  bulkResolveAttendanceValidation,
  bulkResolveAttendanceValidationWithPunchAutoFill,
  getAttendanceValidationDashboard,
  getAttendanceValidationFilters,
  previewAttendanceValidationBulkResolve,
  resolveAttendanceValidation,
  resolveAttendanceValidationAsOnLeave,
  resolveAttendanceValidationWithPunches,
} from "@/lib/attendance-data";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      month: searchParams.get("month") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
      issue: searchParams.get("issue") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      ids: searchParams.getAll("id").filter(Boolean),
      date: searchParams.get("date") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    };

    const payload = searchParams.get("bulkPreview") === "1"
      ? await previewAttendanceValidationBulkResolve(filters)
      : searchParams.get("metaOnly") === "1"
        ? await getAttendanceValidationFilters(filters)
        : await getAttendanceValidationDashboard(filters);

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attendance validation records." },
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
      action?: "bulk-resolve" | "bulk-auto-fill-punches" | "resolve-punches" | "mark-on-leave";
      id?: string;
      note?: string;
      morningIn?: string | null;
      morningOut?: string | null;
      afternoonIn?: string | null;
      afternoonOut?: string | null;
      markHalfDay?: boolean;
      month?: string;
      employeeId?: string;
      issue?: string;
      search?: string;
      ids?: string[];
      date?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (body.action === "bulk-resolve") {
      const result = await bulkResolveAttendanceValidation(auth.user, {
        month: body.month,
        employeeId: body.employeeId,
        issue: body.issue,
        search: body.search,
        ids: body.ids,
        date: body.date,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      });
      return NextResponse.json(result);
    }

    if (body.action === "bulk-auto-fill-punches") {
      const result = await bulkResolveAttendanceValidationWithPunchAutoFill(auth.user, {
        month: body.month,
        employeeId: body.employeeId,
        issue: body.issue,
        search: body.search,
        ids: body.ids,
        date: body.date,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      });
      return NextResponse.json(result);
    }

    if (body.action === "resolve-punches") {
      const record = await resolveAttendanceValidationWithPunches(auth.user, {
        id: body.id,
        morningIn: body.morningIn,
        morningOut: body.morningOut,
        afternoonIn: body.afternoonIn,
        afternoonOut: body.afternoonOut,
        markHalfDay: body.markHalfDay,
      });
      return NextResponse.json({ record });
    }

    if (body.action === "mark-on-leave") {
      const record = await resolveAttendanceValidationAsOnLeave(auth.user, body);
      return NextResponse.json({ record });
    }

    const record = await resolveAttendanceValidation(auth.user, body);
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to resolve attendance validation." },
      { status: 400 },
    );
  }
}








