import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { requireStaff } from "@/lib/admin-auth";
import { getSystemSettings } from "@/lib/admin-data";
import { exportLeaveSummaryWorkbook } from "@/lib/hr-export";
import { getStaffLeaveSummary } from "@/lib/employee-leave";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const department = searchParams.get("department") ?? undefined;
  const summary = await getStaffLeaveSummary(department);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      timeframeLabel?: string;
      filtersLabel?: string;
      rows?: Array<{
        lastName: string;
        firstName: string;
        middleName?: string;
        position: string;
        employmentStatus: string;
        dateHired?: string;
        vacationLeave: string;
        sickLeave: string;
        incentiveLeave: string;
        soloParent: string;
        paternity: string;
        maternity: string;
      }>;
    };

    const rows = body.rows ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No leave summary rows matched the current filters for export." }, { status: 400 });
    }

    const settings = await getSystemSettings();
    const workbook = await exportLeaveSummaryWorkbook({
      organizationName: settings.organizationName,
      reportTitle: "Leave Summary Remaining Credits",
      timeframeLabel: body.timeframeLabel?.trim() || `Leave Credits From January - December ${new Date().getFullYear()}`,
      filtersLabel: body.filtersLabel?.trim() || "",
      rows: rows.map((row, index) => ({
        sequence: index + 1,
        lastName: row.lastName,
        firstName: row.firstName,
        middleName: row.middleName ?? "",
        position: row.position,
        employmentStatus: row.employmentStatus,
        dateHired: row.dateHired?.trim() || "-",
        vacationLeave: row.vacationLeave,
        sickLeave: row.sickLeave,
        incentiveLeave: row.incentiveLeave,
        soloParent: row.soloParent,
        paternity: row.paternity,
        maternity: row.maternity,
      })),
    });

    const stamp = format(new Date(), "yyyy-MM-dd");
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leave-summary-remaining-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export leave summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
