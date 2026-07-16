import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { requireStaff } from "@/lib/admin-auth";
import { getSystemSettings } from "@/lib/admin-data";
import { getHrAttendanceReportForExport, type AttendanceQueryFilters } from "@/lib/attendance-data";
import { exportAttendanceReportWorkbook } from "@/lib/hr-export";

function formatTimeframeLabel(filters: AttendanceQueryFilters) {
  if (filters.date) {
    return `Date: ${format(new Date(`${filters.date}T00:00:00`), "MMMM d, yyyy")}`;
  }
  if (filters.dateFrom && filters.dateTo) {
    return `Date Range: ${format(new Date(`${filters.dateFrom}T00:00:00`), "MMMM d, yyyy")} to ${format(new Date(`${filters.dateTo}T00:00:00`), "MMMM d, yyyy")}`;
  }
  if (filters.dateFrom) {
    return `Date From: ${format(new Date(`${filters.dateFrom}T00:00:00`), "MMMM d, yyyy")}`;
  }
  if (filters.dateTo) {
    return `Date To: ${format(new Date(`${filters.dateTo}T00:00:00`), "MMMM d, yyyy")}`;
  }
  return "All attendance records";
}

function formatWorkHours(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) {
    return "-";
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatTimeValue(value: string | null) {
  if (!value) {
    return "-";
  }
  return format(new Date(`2000-01-01T${value}:00`), "h:mm a");
}

export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      classification?: string;
      filters?: AttendanceQueryFilters;
      timeframeLabel?: string;
    };

    const filters = body.filters ?? {};
    const sourceRows = await getHrAttendanceReportForExport(filters);

    if (sourceRows.length === 0) {
      return NextResponse.json({ error: "No attendance records matched the selected export timeframe." }, { status: 400 });
    }

    const settings = await getSystemSettings();
    const workbook = await exportAttendanceReportWorkbook({
      organizationName: settings.organizationName,
      campusAddress: settings.campusAddress,
      reportTitle: "Attendance Report",
      classification: body.classification?.trim() || "Non-Teaching",
      timeframeLabel: body.timeframeLabel?.trim() || formatTimeframeLabel(filters),
      rows: sourceRows.map((record) => ({
        employeeName: record.employeeName,
        position: record.position,
        dateLabel: format(new Date(`${record.date}T00:00:00`), "MMM d, yyyy"),
        day: record.day,
        morningIn: formatTimeValue(record.morningIn),
        morningOut: formatTimeValue(record.morningOut),
        afternoonIn: formatTimeValue(record.afternoonIn),
        afternoonOut: formatTimeValue(record.afternoonOut),
        workHours: formatWorkHours(record.workHoursMin),
        late: record.lateMin > 0 ? `${record.lateMin}m` : "-",
        undertime: record.undertimeMin > 0 ? `${record.undertimeMin}m` : "-",
        overtime: record.overtimeHrs > 0 ? `${record.overtimeHrs.toFixed(1)}h` : "-",
        remarks: record.remarks,
      })),
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance-report-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export attendance report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
