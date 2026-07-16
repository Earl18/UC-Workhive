import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { requireStaff } from "@/lib/admin-auth";
import { getSystemSettings } from "@/lib/admin-data";
import { getHrAttendanceSummary } from "@/lib/attendance-data";
import { exportAttendanceSummaryWorkbook } from "@/lib/hr-export";

export async function GET(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const payload = await getHrAttendanceSummary({
      month: searchParams.get("month") ?? undefined,
      period: searchParams.get("period") ?? undefined,
      staffCategory: searchParams.get("staffCategory") === "Teaching" ? "Teaching" : "Non-Teaching",
    });

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attendance summary." },
      { status: 400 },
    );
  }
}

function formatCount(value: number) {
  return value > 0 ? value.toLocaleString() : "-";
}

function formatHours(value: number) {
  return value > 0 ? value.toFixed(1) : "-";
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      month?: string;
      period?: string;
      staffCategory?: string;
    };

    const payload = await getHrAttendanceSummary({
      month: body.month ?? undefined,
      period: body.period ?? undefined,
      staffCategory: body.staffCategory === "Teaching" ? "Teaching" : "Non-Teaching",
    });

    if (payload.rows.length === 0) {
      return NextResponse.json({ error: "No attendance summary rows matched the selected export timeframe." }, { status: 400 });
    }

    const settings = await getSystemSettings();
    const workbook = await exportAttendanceSummaryWorkbook({
      organizationName: settings.organizationName,
      campusAddress: settings.campusAddress,
      reportTitle: "Attendance Summary",
      classification: `${payload.staffCategory} Personnel`,
      timeframeLabel: payload.monthLabel,
      periodLabel: `${payload.periodLabel} | ${payload.dateFrom} to ${payload.dateTo}`,
      rows: payload.rows.map((row, index) => ({
        sequence: index + 1,
        lastName: row.lastName,
        firstName: row.firstName,
        absent: formatCount(row.absent),
        leaveDays: formatCount(row.leaveDays),
        late: formatCount(row.lateMinutes),
        undertime: formatCount(row.undertimeMinutes),
        overtime: formatHours(row.approvedOvertimeHours),
        remarks: row.remarks || "-",
      })),
    });

    const stamp = format(new Date(), "yyyy-MM-dd");
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance-summary-${payload.staffCategory.toLowerCase()}-${payload.month}-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export attendance summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
