import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { requireAuthenticated } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getEmployeeMasterRecordForUser } from "@/lib/hr-data";
import type { AttendanceRecord, Employee } from "@/lib/types";

type EmployeeAttendanceRow = {
  id: string;
  employeeId: string | null;
  sourceEmployeeName: string;
  workDate: Date;
  dayName: string;
  morningIn: string | null;
  morningOut: string | null;
  afternoonIn: string | null;
  afternoonOut: string | null;
  timeIn: string | null;
  timeOut: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  approvedOvertimeMinutes: number;
  remarks: string;
  overtimeStatus: string;
  validationStatus: string;
  requiresValidation: boolean;
};

type EmployeeAttendanceResponse = {
  employee: Pick<Employee, "id" | "idNumber" | "firstName" | "lastName" | "position" | "avatarColor">;
  records: Array<AttendanceRecord & {
    approvedOvertimeHrs: number;
    requiresValidation: boolean;
  }>;
};

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function mapAttendanceRow(row: EmployeeAttendanceRow): EmployeeAttendanceResponse["records"][number] {
  const displayOvertimeMinutes = row.overtimeStatus === "Approved"
    ? row.approvedOvertimeMinutes
    : row.overtimeMinutes;

  return {
    id: row.id,
    employeeId: row.employeeId ?? "",
    sourceEmployeeName: row.sourceEmployeeName,
    date: format(row.workDate, "yyyy-MM-dd"),
    day: row.dayName,
    morningIn: row.morningIn,
    morningOut: row.morningOut,
    afternoonIn: row.afternoonIn,
    afternoonOut: row.afternoonOut,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    scheduledIn: row.scheduledIn ?? "",
    scheduledOut: row.scheduledOut ?? "",
    remarks: row.remarks,
    lateMin: row.lateMinutes,
    undertimeMin: row.undertimeMinutes,
    overtimeHrs: minutesToHours(row.overtimeMinutes),
    approvedOvertimeHrs: minutesToHours(displayOvertimeMinutes),
    overtimeStatus: (row.overtimeStatus as AttendanceRecord["overtimeStatus"]) ?? "Not Required",
    validationStatus: row.validationStatus === "Resolved" ? "Resolved" : "Pending",
    requiresValidation: row.requiresValidation,
    workHoursHrs: undefined,
    workHoursMin: undefined,
    overtimeDecisionBy: null,
    overtimeDecisionAt: null,
    overtimeDecisionNote: null,
    deletedAt: null,
    deletedByName: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  const employee = await getEmployeeMasterRecordForUser(auth.user);
  if (!employee) {
    return NextResponse.json({ error: "No employee record found." }, { status: 404 });
  }

  const rows = await db.$queryRaw<EmployeeAttendanceRow[]>(Prisma.sql`
    SELECT
      a."id",
      a."employeeId",
      a."sourceEmployeeName",
      a."workDate",
      a."dayName",
      a."morningIn",
      a."morningOut",
      a."afternoonIn",
      a."afternoonOut",
      a."timeIn",
      a."timeOut",
      a."scheduledIn",
      a."scheduledOut",
      a."lateMinutes",
      a."undertimeMinutes",
      a."overtimeMinutes",
      a."approvedOvertimeMinutes",
      a."remarks",
      a."overtimeStatus",
      a."validationStatus",
      a."requiresValidation"
    FROM "AttendanceLog" a
    WHERE a."employeeId" = ${employee.id}
      AND a."deletedAt" IS NULL
    ORDER BY a."workDate" DESC, a."timeIn" DESC NULLS LAST, a."createdAt" DESC
  `);

  return NextResponse.json({
    employee: {
      id: employee.id,
      idNumber: employee.idNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      position: employee.position,
      avatarColor: employee.avatarColor,
    },
    records: rows.map(mapAttendanceRow),
  } satisfies EmployeeAttendanceResponse, { headers: { "Cache-Control": "no-store" } });
}
