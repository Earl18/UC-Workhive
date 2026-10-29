import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { db } from "@/lib/db";
import type { AuthenticatedPortalUser } from "@/lib/auth";
import { parseAttendanceWorkbook, type ParsedAttendanceWorkbookPayload, type ParsedAttendanceWorkbookRow } from "@/lib/attendance-import";
import type { AttendanceRecord, AttendanceValidationFlag, StaffCategory } from "@/lib/types";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/system-settings";

const NON_TEACHING_SCHEDULE = [
  { day: "Mon", label: "Monday", in: "08:00", out: "17:00" },
  { day: "Tue", label: "Tuesday", in: "08:00", out: "17:00" },
  { day: "Wed", label: "Wednesday", in: "08:00", out: "17:00" },
  { day: "Thu", label: "Thursday", in: "08:00", out: "17:00" },
  { day: "Fri", label: "Friday", in: "08:00", out: "17:00" },
  { day: "Sat", label: "Saturday", in: "08:00", out: "12:00" },
] as const;

const ATTENDANCE_IMPORT_CHUNK_SIZE = 500;
const ATTENDANCE_METADATA_CACHE_TTL_MS = 60_000;
const ATTENDANCE_DERIVED_SYNC_TTL_MS = 60_000;
const ATTENDANCE_SUMMARY_CACHE_TTL_MS = 60_000;
const HR_TARDINESS_CACHE_TTL_MS = 60_000;
const ATTENDANCE_REPORT_CACHE_TTL_MS = 30_000;
const ATTENDANCE_VALIDATION_CACHE_TTL_MS = 30_000;
const ATTENDANCE_DELETION_RETENTION_DAYS = 7;

let attendanceEmployeeLookupCache: { checkedAt: number; value: BasicEmployee[] } | null = null;
let attendancePolicyCache: { checkedAt: number; value: AttendancePolicySettings } | null = null;
let attendanceAvailableMonthsCache: { checkedAt: number; value: string[] } | null = null;
const attendanceHolidayMonthCache = new Map<string, { checkedAt: number; value: Map<string, HolidayShape> }>();
const attendanceApprovedLeaveMonthCache = new Map<string, { checkedAt: number; value: Set<string> }>();
const attendanceDerivedSyncCache = new Map<string, { checkedAt: number; promise: Promise<AttendanceLogRow[]> }>();
const attendanceSummaryPageCache = new Map<string, { checkedAt: number; promise: ReturnType<typeof buildHrAttendanceSummaryPayload> }>();
const hrTardinessPageCache = new Map<string, { checkedAt: number; promise: ReturnType<typeof buildHrTardinessPayload> }>();
const attendanceReportPageCache = new Map<string, { checkedAt: number; promise: ReturnType<typeof buildHrAttendanceReportPayload> }>();
const attendanceValidationPageCache = new Map<string, { checkedAt: number; promise: ReturnType<typeof buildAttendanceValidationDashboardPayload> }>();
const attendanceValidationFiltersCache = new Map<string, { checkedAt: number; promise: ReturnType<typeof buildAttendanceValidationFiltersPayload> }>();

export function invalidateAttendanceMetadataCache() {
  attendanceEmployeeLookupCache = null;
  attendancePolicyCache = null;
  attendanceAvailableMonthsCache = null;
  attendanceHolidayMonthCache.clear();
  attendanceApprovedLeaveMonthCache.clear();
  attendanceDerivedSyncCache.clear();
  attendanceSummaryPageCache.clear();
  hrTardinessPageCache.clear();
  attendanceReportPageCache.clear();
  attendanceValidationPageCache.clear();
  attendanceValidationFiltersCache.clear();
}

type BasicEmployee = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  department: string;
  position: string;
  avatarColor: string | null;
  staffCategory: string | null;
  accountRole: "employee" | "hr" | "admin";
};

type HolidayShape = {
  date: string;
  name: string;
  type: string;
};

type AttendancePolicySettings = {
  gracePeriod: number;
};

export type AttendanceQueryFilters = {
  month?: string;
  employeeId?: string;
  issue?: string;
  remarks?: string;
  search?: string;
  ids?: string[];
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

type AttendanceLogRow = {
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
  overtimeDecisionBy: string | null;
  overtimeDecisionAt: Date | null;
  overtimeDecisionNote: string | null;
  requiresValidation: boolean;
  validationFlags: Prisma.JsonValue | null;
  validationStatus: string;
  deletedAt: Date | null;
  deletedByName: string | null;
  deletedByUserId: string | null;
  deletedReason: string | null;
  employeeLastName: string | null;
  employeeFirstName: string | null;
  employeeDepartment: string | null;
  employeePosition: string | null;
};

type AttendanceInsertRow = {
  id: string;
  employeeId: string | null;
  sourceEmployeeName: string;
  workDate: Date;
  dayName: string;
  monthKey: string;
  staffCategory: string;
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
  overtimeDecisionBy: string | null;
  overtimeDecisionAt: Date | null;
  overtimeDecisionNote: string | null;
  requiresValidation: boolean;
  validationFlags: AttendanceValidationFlag[];
  validationStatus: string;
  validationResolvedBy: string | null;
  validationResolvedAt: Date | null;
  validationResolutionNote: string | null;
};

type AttendanceDuplicateMatchRow = {
  imported: {
    rowNumber: number;
    employeeName: string;
    matchedEmployeeName: string | null;
    department: string;
    position: string;
    date: string;
    dayName: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    remarks: string;
    validationFlags: AttendanceValidationFlag[];
    matched: boolean;
  };
  existing: {
    id: string;
    employeeName: string;
    department: string;
    position: string;
    date: string;
    dayName: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    remarks: string;
    validationFlags: AttendanceValidationFlag[];
  };
  matchedBy: "Employee + Date + Source Name" | "Employee + Date" | "Source Name + Date";
};

type AttendanceDuplicateSummary = {
  existingAttendanceCount: number;
  uniqueRecordCount: number;
  matchRows: AttendanceDuplicateMatchRow[];
};

export type AttendanceImportPreviewPayload = {
  fileName: string;
  sheetName: string;
  monthKey: string;
  records: Array<{
    rowNumber: number;
    employeeName: string;
    matchedEmployeeName: string | null;
    department: string;
    position: string;
    date: string;
    dayName: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
    remarks: string;
    validationFlags: AttendanceValidationFlag[];
    matched: boolean;
  }>;
  matchedRecords: number;
  unmatchedRecords: number;
  validationRecords: number;
  unknownEmployees: string[];
  duplicates: AttendanceDuplicateSummary;
};
function chunkRecords<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function startOfMonthKey(input?: string) {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  return format(new Date(), "yyyy-MM");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function toDisplayNameCase(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  return text
    .toLowerCase()
    .split(" ")
    .map((part) => part.split("-").map((segment) => segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "").join("-"))
    .join(" ");
}

function formatEmployeeName(lastName: string | null | undefined, firstName: string | null | undefined) {
  return (toDisplayNameCase(lastName) + ", " + toDisplayNameCase(firstName)).replace(/^,\s*/, "").trim();
}

function normalizeComparable(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function normalizeLookupName(value: string | null | undefined) {
  const text = normalizeComparable(value).replace(/\./g, "");
  return text.replace(/\s*,\s*/g, ",");
}

function buildEmployeeLookupKeys(employee: BasicEmployee) {
  const first = normalizeComparable(employee.firstName);
  const middle = normalizeComparable(employee.middleName);
  const fullFirst = [first, middle].filter(Boolean).join(" ").trim();
  const keys = new Set<string>();
  keys.add(normalizeLookupName(`${employee.lastName}, ${employee.firstName}`));
  if (fullFirst) {
    keys.add(normalizeLookupName(`${employee.lastName}, ${fullFirst}`));
  }
  return Array.from(keys).filter(Boolean);
}

function getValidationFlagLabel(flag: AttendanceValidationFlag) {
  switch (flag) {
    case "EMPLOYEE_NOT_FOUND":
      return "Employee not found in the system";
    case "OVERTIME_REQUIRES_CONFIRMATION":
      return "Overtime requires HR confirmation";
    case "HOLIDAY_ATTENDANCE_REQUIRES_VALIDATION":
      return "Attendance was recorded on a holiday and needs HR validation";
    case "MISSING_LUNCH_OUT":
      return "Missing morning time out / lunch out";
    case "MISSING_AFTERNOON_IN":
      return "Missing afternoon time in";
    case "ONLY_TIME_IN":
      return "Time in exists without any time out";
    case "ONLY_TIME_OUT":
      return "Time out exists without any time in";
    case "MISSING_MORNING_IN":
      return "Missing morning time in";
    case "INCOMPLETE_PUNCHES":
      return "Incomplete punches require validation";
    case "POSSIBLE_HALF_DAY":
      return "Possible half-day attendance requires validation";
    default:
      return flag;
  }
}

function parseJsonFlags(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as AttendanceValidationFlag[];
  }
  return value.filter((entry): entry is AttendanceValidationFlag => typeof entry === "string") as AttendanceValidationFlag[];
}

function isPunchValidationFlag(flag: AttendanceValidationFlag) {
  return flag === "MISSING_LUNCH_OUT"
    || flag === "MISSING_AFTERNOON_IN"
    || flag === "ONLY_TIME_IN"
    || flag === "ONLY_TIME_OUT"
    || flag === "MISSING_MORNING_IN"
    || flag === "INCOMPLETE_PUNCHES";
}

function prioritizeValidationFlags(flags: AttendanceValidationFlag[]) {
  const priority: Record<AttendanceValidationFlag, number> = {
    MISSING_MORNING_IN: 0,
    MISSING_LUNCH_OUT: 1,
    MISSING_AFTERNOON_IN: 2,
    ONLY_TIME_IN: 3,
    ONLY_TIME_OUT: 4,
    INCOMPLETE_PUNCHES: 5,
    POSSIBLE_HALF_DAY: 6,
    HOLIDAY_ATTENDANCE_REQUIRES_VALIDATION: 10,
    APPROVED_LEAVE_HAS_ATTENDANCE: 10,
    EMPLOYEE_NOT_FOUND: 11,
    OVERTIME_REQUIRES_CONFIRMATION: 12,
  };

  return [...flags].sort((left, right) => (priority[left] ?? 99) - (priority[right] ?? 99));
}

function getDisplayValidationFlags(flags: AttendanceValidationFlag[]) {
  const value = new Set(prioritizeValidationFlags(flags));
  const hasPossibleHalfDay = value.has("POSSIBLE_HALF_DAY");
  const hasPunchIssue = Array.from(value).some((flag) => isPunchValidationFlag(flag));

  if (hasPossibleHalfDay) {
    for (const flag of Array.from(value)) {
      if (isPunchValidationFlag(flag)) {
        value.delete(flag);
      }
    }
  } else if (hasPunchIssue) {
    for (const flag of Array.from(value)) {
      if (isPunchValidationFlag(flag)) {
        value.delete(flag);
      }
    }
    value.add("INCOMPLETE_PUNCHES");
  }

  return prioritizeValidationFlags(Array.from(value));
}

function getDefaultPunchResolveValues(record: Pick<AttendanceRecord, "day" | "scheduledIn" | "scheduledOut">) {
  const isSaturday = record.day.toLowerCase().startsWith("sat") || record.scheduledOut === "12:00";
  return {
    morningIn: record.scheduledIn || "08:00",
    morningOut: "12:00",
    afternoonIn: isSaturday ? null : "13:00",
    afternoonOut: isSaturday ? null : (record.scheduledOut || "17:00"),
  };
}

function toDateAtMidnight(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return new Date(`${value}T12:00:00Z`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function diffMinutes(start: string | null | undefined, end: string | null | undefined) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes == null || endMinutes == null || endMinutes < startMinutes) {
    return 0;
  }
  return endMinutes - startMinutes;
}

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function deriveTimeIn(row: ParsedAttendanceWorkbookRow) {
  return row.morningIn ?? row.afternoonIn ?? null;
}

function deriveTimeOut(row: ParsedAttendanceWorkbookRow) {
  const values = [row.afternoonOut, row.morningOut].filter((entry): entry is string => Boolean(entry));
  if (values.length === 0) {
    return null;
  }
  return values.sort((left, right) => (timeToMinutes(right) ?? 0) - (timeToMinutes(left) ?? 0))[0] ?? null;
}

function getSchedule(date: string, holiday?: HolidayShape | null) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  if (holiday) {
    return { scheduledIn: null, scheduledOut: null, expectedMinutes: 0, kind: "Holiday" as const };
  }
  if (weekday === 0) {
    return { scheduledIn: null, scheduledOut: null, expectedMinutes: 0, kind: "Weekend" as const };
  }
  if (weekday === 6) {
    return { scheduledIn: "08:00", scheduledOut: "12:00", expectedMinutes: 240, kind: "Workday" as const };
  }
  return { scheduledIn: "08:00", scheduledOut: "17:00", expectedMinutes: 480, kind: "Workday" as const };
}

function lateMinutesWithGrace(actual: string | null | undefined, scheduled: string | null | undefined, gracePeriodMinutes: number) {
  const actualMinutes = timeToMinutes(actual);
  const scheduledMinutes = timeToMinutes(scheduled);
  if (actualMinutes == null || scheduledMinutes == null) {
    return 0;
  }

  const delta = Math.max(0, actualMinutes - scheduledMinutes);
  return delta > gracePeriodMinutes ? delta : 0;
}

function calculateLateMinutes(row: ParsedAttendanceWorkbookRow, weekday: number, scheduleKind: "Holiday" | "Weekend" | "Workday", gracePeriodMinutes: number) {
  if (scheduleKind === "Weekend" && weekday === 0) {
    return 0;
  }

  const morningLate = lateMinutesWithGrace(row.morningIn, "08:00", gracePeriodMinutes);
  const afternoonLate = weekday >= 1 && weekday <= 5
    ? lateMinutesWithGrace(row.afternoonIn, "13:00", gracePeriodMinutes)
    : 0;

  return morningLate + afternoonLate;
}

function inferFlags(row: ParsedAttendanceWorkbookRow, weekday: number, hasAnyPunch: boolean, overtimeMinutes: number, matchedEmployee: boolean, holidayAttendance: boolean, approvedLeaveAttendance: boolean) {
  const flags = new Set<AttendanceValidationFlag>();
  const hasAnyIn = Boolean(row.morningIn || row.afternoonIn);
  const hasAnyOut = Boolean(row.morningOut || row.afternoonOut);
  const hasCompleteMorning = Boolean(row.morningIn && row.morningOut);
  const hasCompleteAfternoon = Boolean(row.afternoonIn && row.afternoonOut);
  const hasNoMorningPunches = !row.morningIn && !row.morningOut;
  const hasNoAfternoonPunches = !row.afternoonIn && !row.afternoonOut;
  const hasSingleMorningInOnly = Boolean(row.morningIn && !row.morningOut && hasNoAfternoonPunches);
  const hasSingleMorningOutOnly = Boolean(!row.morningIn && row.morningOut && hasNoAfternoonPunches);
  const hasSingleAfternoonInOnly = Boolean(row.afternoonIn && !row.afternoonOut && hasNoMorningPunches);
  const hasSingleAfternoonOutOnly = Boolean(!row.afternoonIn && row.afternoonOut && hasNoMorningPunches);

  if (!matchedEmployee) {
    flags.add("EMPLOYEE_NOT_FOUND");
  }
  if (overtimeMinutes > 0) {
    flags.add("OVERTIME_REQUIRES_CONFIRMATION");
  }
  if (holidayAttendance) {
    flags.add("HOLIDAY_ATTENDANCE_REQUIRES_VALIDATION");
  }
  if (!hasAnyPunch) {
    return Array.from(flags);
  }
  if (hasAnyIn && !hasAnyOut) {
    flags.add("ONLY_TIME_IN");
  }
  if (hasAnyOut && !hasAnyIn) {
    flags.add("ONLY_TIME_OUT");
  }
  if (row.morningOut && !row.morningIn) {
    flags.add("MISSING_MORNING_IN");
  }
  if (weekday >= 1 && weekday <= 5) {
    if (row.morningIn && !row.morningOut && row.afternoonOut) {
      flags.add("MISSING_LUNCH_OUT");
    }
    if (!row.afternoonIn && row.afternoonOut) {
      flags.add("MISSING_AFTERNOON_IN");
    }
    if ((row.morningIn && !row.morningOut) || (row.afternoonIn && !row.afternoonOut) || (!row.morningIn && row.morningOut) || (!row.afternoonIn && row.afternoonOut)) {
      flags.add("INCOMPLETE_PUNCHES");
    }
    if ((hasCompleteMorning && hasNoAfternoonPunches) || (hasCompleteAfternoon && hasNoMorningPunches) || hasSingleMorningInOnly || hasSingleMorningOutOnly || hasSingleAfternoonInOnly || hasSingleAfternoonOutOnly) {
      flags.add("POSSIBLE_HALF_DAY");
    }
  } else if (weekday === 6 && row.morningIn && !row.morningOut && row.afternoonOut) {
    flags.add("INCOMPLETE_PUNCHES");
  }
  return Array.from(flags);
}

function isHalfDayAttendance(row: AttendancePunchRow, weekday: number) {
  if (weekday < 1 || weekday > 5) {
    return false;
  }

  const hasCompleteMorning = Boolean(row.morningIn && row.morningOut);
  const hasCompleteAfternoon = Boolean(row.afternoonIn && row.afternoonOut);
  const hasNoMorningPunches = !row.morningIn && !row.morningOut;
  const hasNoAfternoonPunches = !row.afternoonIn && !row.afternoonOut;

  return (hasCompleteMorning && hasNoAfternoonPunches) || (hasCompleteAfternoon && hasNoMorningPunches);
}

function buildRemarks(
  attendanceCategory: "Present" | "Absent" | "Holiday" | "Weekend",
  lateMinutes: number,
  undertimeMinutes: number,
  overtimeMinutes: number,
  holiday?: HolidayShape | null,
  halfDayAttendance = false,
) {
  if (attendanceCategory === "Holiday") {
    return holiday?.type ?? holiday?.name ?? "Holiday";
  }
  if (attendanceCategory === "Weekend") {
    return "Weekend";
  }
  if (attendanceCategory === "Absent") {
    return "Absent";
  }
  if (halfDayAttendance) {
    return "Half Day";
  }
  if (lateMinutes > 0 && undertimeMinutes > 0) {
    return "Late + Undertime";
  }
  if (lateMinutes > 0) {
    return "Late";
  }
  if (undertimeMinutes > 0) {
    return "Undertime";
  }
  if (overtimeMinutes > 0) {
    return "Overtime";
  }
  return "Present";
}


type AttendancePunchRow = Pick<ParsedAttendanceWorkbookRow, "morningIn" | "morningOut" | "afternoonIn" | "afternoonOut">;

type DerivedAttendanceValues = {
  timeIn: string | null;
  timeOut: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  remarks: string;
  overtimeStatus: string;
  requiresValidation: boolean;
  validationFlags: AttendanceValidationFlag[];
  validationStatus: string;
  workHoursMinutes: number;
};

function calculateBoundedSegmentMinutes(
  actualStart: string | null | undefined,
  actualEnd: string | null | undefined,
  scheduledStart: string,
  scheduledEnd: string,
) {
  const actualStartMinutes = timeToMinutes(actualStart);
  const actualEndMinutes = timeToMinutes(actualEnd);
  const scheduledStartMinutes = timeToMinutes(scheduledStart);
  const scheduledEndMinutes = timeToMinutes(scheduledEnd);

  if (
    actualStartMinutes == null ||
    actualEndMinutes == null ||
    scheduledStartMinutes == null ||
    scheduledEndMinutes == null
  ) {
    return 0;
  }

  const boundedStart = Math.max(actualStartMinutes, scheduledStartMinutes);
  const boundedEnd = Math.min(actualEndMinutes, scheduledEndMinutes);
  return Math.max(0, boundedEnd - boundedStart);
}

function calculateScheduledWorkMinutes(row: AttendancePunchRow, weekday: number) {
  if (weekday === 6) {
    return calculateBoundedSegmentMinutes(row.morningIn, row.morningOut ?? row.afternoonOut, "08:00", "12:00");
  }

  return (
    calculateBoundedSegmentMinutes(row.morningIn, row.morningOut, "08:00", "12:00") +
    calculateBoundedSegmentMinutes(row.afternoonIn, row.afternoonOut, "13:00", "17:00")
  );
}

function calculateOvertimeWorkedMinutes(row: AttendancePunchRow, weekday: number) {
  const overtimeStart = weekday === 6 ? "12:00" : "17:00";
  const finalOut = row.afternoonOut ?? row.morningOut;
  return diffMinutes(overtimeStart, finalOut);
}

function calculateWorkedMinutes(
  row: AttendancePunchRow,
  weekday: number,
  scheduleKind: "Holiday" | "Weekend" | "Workday" = "Workday",
) {
  if (scheduleKind !== "Workday") {
    if (weekday === 6) {
      return diffMinutes(row.morningIn, row.morningOut ?? row.afternoonOut);
    }
    return diffMinutes(row.morningIn, row.morningOut) + diffMinutes(row.afternoonIn, row.afternoonOut);
  }

  return calculateScheduledWorkMinutes(row, weekday) + calculateOvertimeWorkedMinutes(row, weekday);
}

function deriveAttendanceValues(input: {
  date: string;
  row: AttendancePunchRow;
  holiday: HolidayShape | null;
  gracePeriodMinutes: number;
  matchedEmployee: boolean;
  approvedLeaveAttendance?: boolean;
}) {
  const { date, row, holiday, gracePeriodMinutes, matchedEmployee, approvedLeaveAttendance = false } = input;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const schedule = getSchedule(date, holiday);
  const parsedRow = {
    rowNumber: 0,
    employeeName: "",
    date,
    dayName: "",
    morningIn: row.morningIn,
    morningOut: row.morningOut,
    afternoonIn: row.afternoonIn,
    afternoonOut: row.afternoonOut,
    nextDay: null,
    rawHoursWork: "",
  } satisfies ParsedAttendanceWorkbookRow;
  const timeIn = deriveTimeIn(parsedRow);
  const timeOut = deriveTimeOut(parsedRow);
  const hasAnyPunch = Boolean(timeIn || timeOut || row.morningOut || row.afternoonIn || row.afternoonOut);
  const holidayAttendance = Boolean(holiday && hasAnyPunch);
  const halfDayAttendance = isHalfDayAttendance(row, weekday);
  const workHoursMinutes = calculateWorkedMinutes(row, weekday, schedule.kind);
  const scheduledOutMinutes = timeToMinutes(schedule.scheduledOut);
  const timeOutMinutes = timeToMinutes(timeOut);
  const lateMinutes = calculateLateMinutes(parsedRow, weekday, schedule.kind, gracePeriodMinutes);
  const undertimeMinutes = halfDayAttendance
    ? 0
    : schedule.kind === "Workday" && scheduledOutMinutes != null && timeOutMinutes != null
      ? Math.max(0, scheduledOutMinutes - timeOutMinutes)
      : 0;
  const overtimeMinutes = schedule.kind === "Workday" && scheduledOutMinutes != null
    ? Math.max(0, (timeOutMinutes ?? 0) - scheduledOutMinutes)
    : 0;
  const attendanceCategory: "Present" | "Absent" | "Holiday" | "Weekend" = holiday
    ? "Holiday"
    : schedule.kind === "Weekend"
      ? "Weekend"
      : hasAnyPunch
        ? "Present"
        : "Absent";
  const validationFlags = inferFlags(parsedRow, weekday, hasAnyPunch, overtimeMinutes, matchedEmployee, holidayAttendance, approvedLeaveAttendance);

  return {
    timeIn,
    timeOut,
    scheduledIn: schedule.scheduledIn,
    scheduledOut: schedule.scheduledOut,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    remarks: buildRemarks(attendanceCategory, lateMinutes, undertimeMinutes, overtimeMinutes, holiday, halfDayAttendance),
    overtimeStatus: overtimeMinutes > 0 ? "Pending" : "Not Required",
    requiresValidation: validationFlags.length > 0,
    validationFlags,
    validationStatus: validationFlags.length > 0 ? "Pending" : "Resolved",
    workHoursMinutes,
  } satisfies DerivedAttendanceValues;
}

function getDeletedRetentionCutoff() {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - ATTENDANCE_DELETION_RETENTION_DAYS);
  return cutoff;
}

async function purgeExpiredDeletedAttendance() {
  await db.attendanceLog.deleteMany({
    where: {
      deletedAt: {
        lt: getDeletedRetentionCutoff(),
      },
    },
  }).catch(() => undefined);
}
async function fetchEmployeeLookupRecords() {
  if (attendanceEmployeeLookupCache && Date.now() - attendanceEmployeeLookupCache.checkedAt < ATTENDANCE_METADATA_CACHE_TTL_MS) {
    return attendanceEmployeeLookupCache.value;
  }

  const rows = await db.employeeRecord.findMany({
    where: {
      OR: [
        { staffCategory: "Non-Teaching" },
        { accountRole: "hr" },
      ],
    },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      department: true,
      position: true,
      avatarColor: true,
      staffCategory: true,
      accountRole: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const value = rows as BasicEmployee[];
  attendanceEmployeeLookupCache = { checkedAt: Date.now(), value };
  return value;
}

async function fetchAttendancePolicySettings(): Promise<AttendancePolicySettings> {
  if (attendancePolicyCache && Date.now() - attendancePolicyCache.checkedAt < ATTENDANCE_METADATA_CACHE_TTL_MS) {
    return attendancePolicyCache.value;
  }

  const settings = await db.systemSettings.findUnique({
    where: { id: "default" },
    select: { gracePeriod: true },
  }).catch(() => null);

  const value = {
    gracePeriod: settings?.gracePeriod ?? DEFAULT_SYSTEM_SETTINGS.gracePeriod,
  };
  attendancePolicyCache = { checkedAt: Date.now(), value };
  return value;
}

function normalizeAttendancePage(page?: number) {
  return Number.isFinite(page) && Number(page) > 0 ? Math.floor(Number(page)) : 1;
}

function normalizeAttendancePageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize)) {
    return 100;
  }

  return Math.min(250, Math.max(25, Math.floor(Number(pageSize))));
}

async function fetchAttendanceEmployees(monthKey?: string, selectedEmployeeId?: string) {
  const rows = await db.$queryRaw<Array<{
    employeeId: string;
    lastName: string | null;
    firstName: string | null;
    department: string | null;
    position: string | null;
  }>>(Prisma.sql`
    SELECT DISTINCT
      a."employeeId" AS "employeeId",
      e."lastName" AS "lastName",
      e."firstName" AS "firstName",
      e."department" AS "department",
      e."position" AS "position"
    FROM "AttendanceLog" a
    INNER JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    WHERE a."staffCategory" = 'Non-Teaching'
      AND a."deletedAt" IS NULL
      AND a."employeeId" IS NOT NULL
      ${monthKey ? Prisma.sql`AND a."monthKey" = ${monthKey}` : Prisma.empty}
      ${selectedEmployeeId && selectedEmployeeId !== "all" ? Prisma.sql`AND a."employeeId" = ${selectedEmployeeId}` : Prisma.empty}
    ORDER BY e."lastName" ASC, e."firstName" ASC
    LIMIT 500
  `);

  return rows.map((row) => ({
    id: row.employeeId,
    name: formatEmployeeName(row.lastName, row.firstName),
    department: row.department ?? "",
    position: row.position ?? "",
  }));
}

async function fetchHolidayMap(monthKey: string) {
  const cached = attendanceHolidayMonthCache.get(monthKey);
  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_METADATA_CACHE_TTL_MS) {
    return cached.value;
  }

  const holidays = await db.holidayRecord.findMany({
    where: { date: { startsWith: monthKey } },
    select: { date: true, name: true, type: true },
  });
  const value = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  attendanceHolidayMonthCache.set(monthKey, { checkedAt: Date.now(), value });
  return value;
}

function buildApprovedLeaveKey(employeeId: string, date: string) {
  return `${employeeId}|${date}`;
}

function enumerateDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return dates;
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(format(cursor, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function fetchApprovedLeaveDateKeys(monthKey: string) {
  const cached = attendanceApprovedLeaveMonthCache.get(monthKey);
  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_METADATA_CACHE_TTL_MS) {
    return cached.value;
  }

  const monthStart = `${monthKey}-01`;
  const monthEnd = format(new Date(`${monthKey}-01T00:00:00`), "yyyy-MM-31");
  const requests = await db.leaveRequestRecord.findMany({
    where: {
      overallStatus: "Approved",
      dateFrom: { lte: monthEnd },
      dateTo: { gte: monthStart },
    },
    select: {
      employeeId: true,
      dateFrom: true,
      dateTo: true,
    },
  });

  const value = new Set<string>();
  for (const request of requests) {
    for (const date of enumerateDateRange(request.dateFrom, request.dateTo)) {
      if (date.startsWith(monthKey)) {
        value.add(buildApprovedLeaveKey(request.employeeId, date));
      }
    }
  }

  attendanceApprovedLeaveMonthCache.set(monthKey, { checkedAt: Date.now(), value });
  return value;
}

async function fetchAvailableValidationMonths() {
  const rows = await db.$queryRaw<Array<{ monthKey: string }>>(Prisma.sql`
    SELECT DISTINCT a."monthKey"
    FROM "AttendanceLog" a
    WHERE a."staffCategory" = 'Non-Teaching'
      AND a."deletedAt" IS NULL
      AND (a."requiresValidation" = TRUE OR a."overtimeStatus" = 'Pending')
    ORDER BY a."monthKey" DESC
    LIMIT 36
  `);
  return rows.map((row) => row.monthKey);
}

async function fetchAvailableMonths() {
  if (attendanceAvailableMonthsCache && Date.now() - attendanceAvailableMonthsCache.checkedAt < ATTENDANCE_METADATA_CACHE_TTL_MS) {
    return attendanceAvailableMonthsCache.value;
  }

  const rows = await db.$queryRaw<Array<{ monthKey: string }>>(Prisma.sql`
    SELECT DISTINCT "monthKey"
    FROM "AttendanceLog"
    ORDER BY "monthKey" DESC
    LIMIT 36
  `);
  const value = rows.map((row) => row.monthKey);
  attendanceAvailableMonthsCache = { checkedAt: Date.now(), value };
  return value;
}


type AttendanceValidationPageRow = AttendanceLogRow & {
  totalRecords: bigint | number;
};

type AttendanceValidationCountRow = {
  pending: bigint | number;
  unresolvedOvertime: bigint | number;
  unmatchedEmployees: bigint | number;
  incompletePunches: bigint | number;
};

function buildValidationBaseConditions(monthKey?: string) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."staffCategory" = 'Non-Teaching'`,
    Prisma.sql`a."deletedAt" IS NULL`,
    Prisma.sql`(a."requiresValidation" = TRUE OR a."overtimeStatus" = 'Pending')`,
  ];

  if (monthKey) {
    conditions.push(Prisma.sql`a."monthKey" = ${monthKey}`);
  }

  return conditions;
}

function buildValidationWhere(filters: Pick<AttendanceQueryFilters, "employeeId" | "issue" | "search" | "date" | "dateFrom" | "dateTo" | "ids">, monthKey?: string) {
  const conditions = buildValidationBaseConditions(monthKey);

  if (filters.employeeId && filters.employeeId !== "all") {
    if (filters.employeeId.startsWith("employee:")) {
      conditions.push(Prisma.sql`a."employeeId" = ${filters.employeeId.slice("employee:".length)}`);
    } else if (filters.employeeId.startsWith("unknown:")) {
      conditions.push(Prisma.sql`a."employeeId" IS NULL`);
      conditions.push(Prisma.sql`LOWER(a."sourceEmployeeName") = ${filters.employeeId.slice("unknown:".length)}`);
    } else {
      conditions.push(Prisma.sql`a."employeeId" = ${filters.employeeId}`);
    }
  }

  if (filters.search?.trim()) {
    const trimmedSearch = filters.search.trim();
    const searchPattern = `%${trimmedSearch}%`;
    const parsedDateSearch = parseAttendanceSearchDateParts(trimmedSearch);
    const searchConditions: Prisma.Sql[] = [
      Prisma.sql`COALESCE(a."sourceEmployeeName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(e."lastName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(e."firstName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(e."department", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(e."position", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."dayName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."morningIn", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."morningOut", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."afternoonIn", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."afternoonOut", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."remarks", '') ILIKE ${searchPattern}`,
      Prisma.sql`REPLACE(REPLACE(COALESCE(a."validationFlags"::text, ''), '_', ' '), '"', '') ILIKE ${searchPattern}`,
      Prisma.sql`CASE WHEN a."overtimeStatus" = 'Pending' THEN 'Overtime requires HR confirmation' WHEN a."overtimeStatus" = 'Rejected' THEN 'Overtime Rejected' WHEN a."overtimeStatus" = 'Approved' THEN 'OT Approved' ELSE '' END ILIKE ${searchPattern}`
    ];

    if (parsedDateSearch?.year) {
      const exactDate = String(parsedDateSearch.year) + "-" + String(parsedDateSearch.month).padStart(2, "0") + "-" + String(parsedDateSearch.day).padStart(2, "0");
      searchConditions.push(Prisma.sql`a."workDate" = ${toDateAtMidnight(exactDate)}::date`);
    } else if (parsedDateSearch) {
      searchConditions.push(Prisma.sql`
        EXTRACT(MONTH FROM a."workDate") = ${parsedDateSearch.month}
        AND EXTRACT(DAY FROM a."workDate") = ${parsedDateSearch.day}
      `);
    } else {
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'Mon FMDD, YYYY') ILIKE ${searchPattern}`);
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'FMMonth FMDD, YYYY') ILIKE ${searchPattern}`);
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'YYYY-MM-DD') ILIKE ${searchPattern}`);
    }

    let combinedSearchCondition = searchConditions[0] ?? Prisma.sql`FALSE`;
    for (let index = 1; index < searchConditions.length; index += 1) {
      combinedSearchCondition = Prisma.sql`${combinedSearchCondition} OR ${searchConditions[index]}`;
    }
    conditions.push(Prisma.sql`(${combinedSearchCondition})`);
  }
  if (filters.issue && filters.issue !== "all") {
    if (filters.issue === "overtime:pending") {
      conditions.push(Prisma.sql`a."overtimeStatus" = 'Pending'`);
    } else if (filters.issue === "flag:INCOMPLETE_PUNCHES") {
      const punchIssueFlags: AttendanceValidationFlag[] = [
        "MISSING_MORNING_IN",
        "MISSING_LUNCH_OUT",
        "MISSING_AFTERNOON_IN",
        "ONLY_TIME_IN",
        "ONLY_TIME_OUT",
        "INCOMPLETE_PUNCHES",
      ];
      const punchIssueConditions = punchIssueFlags.map((flag) => Prisma.sql`a."validationFlags" @> CAST(${JSON.stringify([flag])} AS jsonb)`);
      let combinedPunchCondition = punchIssueConditions[0];
      for (let index = 1; index < punchIssueConditions.length; index += 1) {
        combinedPunchCondition = Prisma.sql`${combinedPunchCondition} OR ${punchIssueConditions[index]}`;
      }
      conditions.push(Prisma.sql`(${combinedPunchCondition})`);
      conditions.push(Prisma.sql`NOT (a."validationFlags" @> '["POSSIBLE_HALF_DAY"]'::jsonb)`);
    } else if (filters.issue.startsWith("flag:")) {
      conditions.push(Prisma.sql`a."validationFlags" @> CAST(${JSON.stringify([filters.issue.slice("flag:".length)])} AS jsonb)`);
    }
  }

  if (filters.date) {
    conditions.push(Prisma.sql`a."workDate" = ${toDateAtMidnight(filters.date)}::date`);
  } else {
    if (filters.dateFrom) {
      conditions.push(Prisma.sql`a."workDate" >= ${toDateAtMidnight(filters.dateFrom)}::date`);
    }
    if (filters.dateTo) {
      conditions.push(Prisma.sql`a."workDate" <= ${toDateAtMidnight(filters.dateTo)}::date`);
    }
  }

  if (filters.ids?.length) {
    conditions.push(Prisma.sql`a."id" IN (${Prisma.join(filters.ids)})`);
  }

  return Prisma.sql`WHERE ${combineSqlConditions(conditions)}`;
}

async function fetchAttendanceValidationEmployees(monthKey?: string) {
  const whereClause = Prisma.sql`WHERE ${combineSqlConditions(buildValidationBaseConditions(monthKey))}`;
  const rows = await db.$queryRaw<Array<{
    employeeId: string | null;
    sourceEmployeeName: string;
    lastName: string | null;
    firstName: string | null;
  }>>(Prisma.sql`
    SELECT DISTINCT
      a."employeeId" AS "employeeId",
      a."sourceEmployeeName" AS "sourceEmployeeName",
      e."lastName" AS "lastName",
      e."firstName" AS "firstName"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    ${whereClause}
    ORDER BY e."lastName" ASC NULLS LAST, e."firstName" ASC NULLS LAST, a."sourceEmployeeName" ASC
    LIMIT 500
  `);

  return rows.map((row) => {
    if (row.employeeId) {
      return {
        id: `employee:${row.employeeId}`,
        name: formatEmployeeName(row.lastName, row.firstName),
      };
    }

    const sourceName = row.sourceEmployeeName.trim() || "Unknown employee";
    return {
      id: `unknown:${sourceName.toLowerCase()}`,
      name: `${sourceName} (Unknown employee)`,
    };
  });
}

async function fetchAttendanceValidationIssues(monthKey?: string) {
  const whereClause = Prisma.sql`WHERE ${combineSqlConditions(buildValidationBaseConditions(monthKey))}`;
  const [flagRows, pendingRows] = await Promise.all([
    db.$queryRaw<Array<{ flag: AttendanceValidationFlag }>>(Prisma.sql`
      SELECT DISTINCT flag.value AS "flag"
      FROM "AttendanceLog" a
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(a."validationFlags", '[]'::jsonb)) AS flag(value)
      ${whereClause}
      AND flag.value <> 'OVERTIME_REQUIRES_CONFIRMATION'
      ORDER BY flag.value ASC
    `),
    db.$queryRaw<Array<{ hasPending: number }>>(Prisma.sql`
      SELECT 1 AS "hasPending"
      FROM "AttendanceLog" a
      ${whereClause}
      AND a."overtimeStatus" = 'Pending'
      LIMIT 1
    `),
  ]);

  const displayFlags = new Set(getDisplayValidationFlags(flagRows.map((row) => row.flag)));
  displayFlags.add("INCOMPLETE_PUNCHES");
  displayFlags.add("POSSIBLE_HALF_DAY");

  const options = Array.from(displayFlags)
    .map((flag) => ({
      value: `flag:${flag}`,
      label: getValidationFlagLabel(flag),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  if (pendingRows.length > 0) {
    options.unshift({ value: "overtime:pending", label: "Overtime requires HR confirmation" });
  }

  return options;
}

async function fetchAttendanceValidationCounts(monthKey: string | undefined, filters: Pick<AttendanceQueryFilters, "employeeId" | "issue" | "search" | "date" | "dateFrom" | "dateTo">) {
  const whereClause = buildValidationWhere({
    ...filters,
    issue: undefined,
  }, monthKey);
  const rows = await db.$queryRaw<AttendanceValidationCountRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE a."validationStatus" <> 'Resolved') AS "pending",
      COUNT(*) FILTER (WHERE a."overtimeStatus" = 'Pending') AS "unresolvedOvertime",
      COUNT(*) FILTER (WHERE a."validationFlags" @> '["EMPLOYEE_NOT_FOUND"]'::jsonb) AS "unmatchedEmployees",
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(a."validationFlags", '[]'::jsonb)) AS flag(value)
          WHERE flag.value NOT IN ('EMPLOYEE_NOT_FOUND', 'OVERTIME_REQUIRES_CONFIRMATION')
        )
      ) AS "incompletePunches"
    FROM "AttendanceLog" a
    ${whereClause}
  `);

  const row = rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    unresolvedOvertime: Number(row?.unresolvedOvertime ?? 0),
    unmatchedEmployees: Number(row?.unmatchedEmployees ?? 0),
    incompletePunches: Number(row?.incompletePunches ?? 0),
  };
}

async function fetchAttendanceValidationPage(monthKey: string | undefined, filters: Pick<AttendanceQueryFilters, "employeeId" | "issue" | "search" | "date" | "dateFrom" | "dateTo" | "page" | "pageSize">) {
  const whereClause = buildValidationWhere(filters, monthKey);
  const page = normalizeAttendancePage(filters.page);
  const pageSize = normalizeAttendancePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;

  const rows = await db.$queryRaw<AttendanceValidationPageRow[]>(Prisma.sql`
    SELECT
      filtered."id",
      filtered."employeeId",
      filtered."sourceEmployeeName",
      filtered."workDate",
      filtered."dayName",
      filtered."morningIn",
      filtered."morningOut",
      filtered."afternoonIn",
      filtered."afternoonOut",
      filtered."timeIn",
      filtered."timeOut",
      filtered."scheduledIn",
      filtered."scheduledOut",
      filtered."lateMinutes",
      filtered."undertimeMinutes",
      filtered."overtimeMinutes",
      filtered."approvedOvertimeMinutes",
      filtered."remarks",
      filtered."overtimeStatus",
      filtered."overtimeDecisionBy",
      filtered."overtimeDecisionAt",
      filtered."overtimeDecisionNote",
      filtered."requiresValidation",
      filtered."validationFlags",
      filtered."validationStatus",
      filtered."deletedAt",
      filtered."deletedByName",
      filtered."deletedByUserId",
      filtered."deletedReason",
      filtered."employeeLastName",
      filtered."employeeFirstName",
      filtered."employeeDepartment",
      filtered."employeePosition",
      filtered."totalRecords"
    FROM (
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
        a."overtimeDecisionBy",
        a."overtimeDecisionAt",
        a."overtimeDecisionNote",
        a."requiresValidation",
        a."validationFlags",
        a."validationStatus",
        a."deletedAt",
        a."deletedByName",
        a."deletedByUserId",
        a."deletedReason",
        e."lastName" AS "employeeLastName",
        e."firstName" AS "employeeFirstName",
        e."department" AS "employeeDepartment",
        e."position" AS "employeePosition",
        COUNT(*) OVER() AS "totalRecords"
      FROM "AttendanceLog" a
      LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
      ${whereClause}
      ORDER BY a."workDate" ASC, COALESCE(e."lastName", a."sourceEmployeeName") ASC, COALESCE(e."firstName", '') ASC
      LIMIT ${pageSize} OFFSET ${offset}
    ) AS filtered
  `);

  return {
    page,
    pageSize,
    totalRecords: Number(rows[0]?.totalRecords ?? 0),
    records: rows,
  };
}
function combineSqlConditions(conditions: Prisma.Sql[]) {
  if (conditions.length === 0) {
    return Prisma.empty;
  }

  let combined = conditions[0];
  for (let index = 1; index < conditions.length; index += 1) {
    combined = Prisma.sql`${combined} AND ${conditions[index]}`;
  }
  return combined;
}

const ATTENDANCE_SEARCH_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

type AttendanceSearchDateParts = {
  month: number;
  day: number;
  year?: number;
};

function parseAttendanceSearchDateParts(value: string) {
  const normalized = value.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!normalized) {
    return null as AttendanceSearchDateParts | null;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, yearRaw, monthRaw, dayRaw] = isoMatch;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day } satisfies AttendanceSearchDateParts;
    }
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (slashMatch) {
    const [, monthRaw, dayRaw, yearRaw] = slashMatch;
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day, year } satisfies AttendanceSearchDateParts;
    }
  }

  const monthFirstMatch = normalized.match(/^([a-z]+) (\d{1,2})(?: (\d{4}))?$/);
  if (monthFirstMatch) {
    const [, monthLabel, dayRaw, yearRaw] = monthFirstMatch;
    const month = ATTENDANCE_SEARCH_MONTHS[monthLabel];
    const day = Number(dayRaw);
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (month && day >= 1 && day <= 31) {
      return { month, day, year } satisfies AttendanceSearchDateParts;
    }
  }

  return null as AttendanceSearchDateParts | null;
}

function buildAttendanceWhere(
  filters: AttendanceQueryFilters,
  monthKey?: string,
  options?: { includePendingValidation?: boolean; ignoreRemarks?: boolean },
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."staffCategory" = 'Non-Teaching'`,
    Prisma.sql`a."deletedAt" IS NULL`,
  ];

  if (monthKey) {
    conditions.push(Prisma.sql`a."monthKey" = ${monthKey}`);
  }

  if (filters.employeeId && filters.employeeId !== "all") {
    conditions.push(Prisma.sql`a."employeeId" = ${filters.employeeId}`);
  }
  if (!options?.ignoreRemarks && filters.remarks && filters.remarks !== "all") {
    conditions.push(Prisma.sql`a."remarks" = ${filters.remarks}`);
  }
  if (filters.search?.trim()) {
    const trimmedSearch = filters.search.trim();
    const searchPattern = `%${trimmedSearch}%`;
    const parsedDateSearch = parseAttendanceSearchDateParts(trimmedSearch);
    const searchConditions: Prisma.Sql[] = [
      Prisma.sql`COALESCE(a."sourceEmployeeName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."dayName", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."morningIn", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."morningOut", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."afternoonIn", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."afternoonOut", '') ILIKE ${searchPattern}`,
      Prisma.sql`COALESCE(a."remarks", '') ILIKE ${searchPattern}`,
    ];

    if (parsedDateSearch?.year) {
      const exactDate = String(parsedDateSearch.year) + "-" + String(parsedDateSearch.month).padStart(2, "0") + "-" + String(parsedDateSearch.day).padStart(2, "0");
      searchConditions.push(Prisma.sql`a."workDate" = ${toDateAtMidnight(exactDate)}::date`);
    } else if (parsedDateSearch) {
      searchConditions.push(Prisma.sql`
        EXTRACT(MONTH FROM a."workDate") = ${parsedDateSearch.month}
        AND EXTRACT(DAY FROM a."workDate") = ${parsedDateSearch.day}
      `);
    } else {
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'Mon FMDD, YYYY') ILIKE ${searchPattern}`);
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'FMMonth FMDD, YYYY') ILIKE ${searchPattern}`);
      searchConditions.push(Prisma.sql`TO_CHAR(a."workDate", 'YYYY-MM-DD') ILIKE ${searchPattern}`);
    }

    let combinedSearchCondition = searchConditions[0] ?? Prisma.sql`FALSE`;
    for (let index = 1; index < searchConditions.length; index += 1) {
      combinedSearchCondition = Prisma.sql`${combinedSearchCondition} OR ${searchConditions[index]}`;
    }
    conditions.push(Prisma.sql`(${combinedSearchCondition})`);
  }
  if (filters.date) {
    conditions.push(Prisma.sql`a."workDate" = ${toDateAtMidnight(filters.date)}::date`);
  } else {
    if (filters.dateFrom) {
      conditions.push(Prisma.sql`a."workDate" >= ${toDateAtMidnight(filters.dateFrom)}::date`);
    }
    if (filters.dateTo) {
      conditions.push(Prisma.sql`a."workDate" <= ${toDateAtMidnight(filters.dateTo)}::date`);
    }
  }

  if (!options?.includePendingValidation) {
    conditions.push(Prisma.sql`NOT (a."requiresValidation" = TRUE AND a."validationStatus" <> 'Resolved')`);
  }

  const whereClause = combineSqlConditions(conditions);
  return Prisma.sql`WHERE ${whereClause}`;
}

type AttendanceLogPageRow = AttendanceLogRow & {
  totalRecords: bigint | number;
};

async function fetchAttendanceLogPage(monthKey: string | undefined, filters: AttendanceQueryFilters) {
  const whereSql = buildAttendanceWhere(filters, monthKey);
  const page = normalizeAttendancePage(filters.page);
  const pageSize = normalizeAttendancePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;

  const rows = await db.$queryRaw<AttendanceLogPageRow[]>(Prisma.sql`
    SELECT
      filtered."id",
      filtered."employeeId",
      filtered."sourceEmployeeName",
      filtered."workDate",
      filtered."dayName",
      filtered."morningIn",
      filtered."morningOut",
      filtered."afternoonIn",
      filtered."afternoonOut",
      filtered."timeIn",
      filtered."timeOut",
      filtered."scheduledIn",
      filtered."scheduledOut",
      filtered."lateMinutes",
      filtered."undertimeMinutes",
      filtered."overtimeMinutes",
      filtered."approvedOvertimeMinutes",
      filtered."remarks",
      filtered."overtimeStatus",
      filtered."overtimeDecisionBy",
      filtered."overtimeDecisionAt",
      filtered."overtimeDecisionNote",
      filtered."requiresValidation",
      filtered."validationFlags",
      filtered."validationStatus",
      filtered."deletedAt",
      filtered."deletedByName",
      filtered."deletedByUserId",
      filtered."deletedReason",
      filtered."employeeLastName",
      filtered."employeeFirstName",
      filtered."employeeDepartment",
      filtered."employeePosition",
      filtered."totalRecords"
    FROM (
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
        a."overtimeDecisionBy",
        a."overtimeDecisionAt",
        a."overtimeDecisionNote",
        a."requiresValidation",
        a."validationFlags",
        a."validationStatus",
        a."deletedAt",
        a."deletedByName",
        a."deletedByUserId",
        a."deletedReason",
        e."lastName" AS "employeeLastName",
        e."firstName" AS "employeeFirstName",
        e."department" AS "employeeDepartment",
        e."position" AS "employeePosition",
        COUNT(*) OVER()::bigint AS "totalRecords"
      FROM "AttendanceLog" a
      LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
      ${whereSql}
    ) AS filtered
    ORDER BY filtered."workDate" ASC, filtered."sourceEmployeeName" ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  if (rows.length > 0) {
    return {
      records: rows,
      totalRecords: Number(rows[0]?.totalRecords ?? 0),
    };
  }

  const countRows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "AttendanceLog" a
    ${whereSql}
  `);

  return {
    records: rows,
    totalRecords: Number(countRows[0]?.count ?? 0),
  };
}

async function fetchAttendanceLogRowsForExport(monthKey: string | undefined, filters: AttendanceQueryFilters) {
  const whereSql = buildAttendanceWhere(filters, monthKey);
  return db.$queryRaw<AttendanceLogRow[]>(Prisma.sql`
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
      a."overtimeDecisionBy",
      a."overtimeDecisionAt",
      a."overtimeDecisionNote",
      a."requiresValidation",
      a."validationFlags",
      a."validationStatus",
      a."deletedAt",
      a."deletedByName",
      a."deletedByUserId",
      a."deletedReason",
      e."lastName" AS "employeeLastName",
      e."firstName" AS "employeeFirstName",
      e."department" AS "employeeDepartment",
      e."position" AS "employeePosition"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    ${whereSql}
    ORDER BY a."workDate" ASC, a."sourceEmployeeName" ASC
  `);
}

async function countAttendanceLogRecords(monthKey: string | undefined, filters: AttendanceQueryFilters, options?: { includePendingValidation?: boolean; ignoreRemarks?: boolean }) {
  const whereSql = buildAttendanceWhere(filters, monthKey, options);
  const rows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "AttendanceLog" a
    ${whereSql}
  `);

  return Number(rows[0]?.count ?? 0);
}

async function countAttendanceValidationRecords(monthKey: string | undefined, filters: Pick<AttendanceQueryFilters, "employeeId" | "issue" | "search" | "date" | "dateFrom" | "dateTo" | "ids">) {
  const whereSql = buildValidationWhere(filters, monthKey);
  const rows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "AttendanceLog" a
    ${whereSql}
  `);

  return Number(rows[0]?.count ?? 0);
}

function buildAttendanceDerivedSyncCacheKey(monthKey: string | undefined, filters: AttendanceQueryFilters) {
  return JSON.stringify({
    monthKey: monthKey ?? "all",
    employeeId: filters.employeeId ?? "all",
    issue: filters.issue ?? "all",
    search: filters.search?.trim() ?? "",
    date: filters.date ?? "",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
  });
}

async function fetchAttendanceRemarks(monthKey: string | undefined, filters: AttendanceQueryFilters) {
  const whereSql = buildAttendanceWhere({ ...filters, remarks: "all" }, monthKey);
  const rows = await db.$queryRaw<Array<{ remarks: string }>>(Prisma.sql`
    SELECT DISTINCT a."remarks" AS "remarks"
    FROM "AttendanceLog" a
    ${whereSql}
    ORDER BY a."remarks" ASC
  `);

  return rows
    .map((row) => row.remarks?.trim())
    .filter((value): value is string => Boolean(value));
}

type AttendanceSummaryCounts = {

  distinctEmployees: bigint | number;
  daysPresent: bigint | number;
  lateIncidents: bigint | number;
  totalLateMinutes: bigint | number;
  totalUndertimeMinutes: bigint | number;
  totalOvertimeMinutes: bigint | number;
  absences: bigint | number;
  holidays: bigint | number;
  daysWorked: bigint | number;
  pendingOvertimeCount: bigint | number;
};

async function fetchAttendanceSummary(monthKey: string | undefined, filters: AttendanceQueryFilters) {
  const visibleWhereSql = buildAttendanceWhere(filters, monthKey);
  const allWhereSql = buildAttendanceWhere(filters, monthKey, { includePendingValidation: true });

  const [visibleRows, pendingRows] = await Promise.all([
    db.$queryRaw<AttendanceSummaryCounts[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT a."employeeId")::bigint AS "distinctEmployees",
        COUNT(*) FILTER (WHERE a."scheduledIn" IS NOT NULL AND a."remarks" NOT IN ('Absent', 'On Leave'))::bigint AS "daysPresent",
        COUNT(*) FILTER (WHERE a."scheduledIn" IS NOT NULL AND a."remarks" NOT IN ('Absent', 'On Leave') AND a."lateMinutes" > 0)::bigint AS "lateIncidents",
        COALESCE(SUM(CASE WHEN a."scheduledIn" IS NOT NULL AND a."remarks" NOT IN ('Absent', 'On Leave') THEN a."lateMinutes" ELSE 0 END), 0)::bigint AS "totalLateMinutes",
        COALESCE(SUM(CASE WHEN a."scheduledIn" IS NOT NULL AND a."remarks" NOT IN ('Absent', 'On Leave') THEN a."undertimeMinutes" ELSE 0 END), 0)::bigint AS "totalUndertimeMinutes",
        COALESCE(SUM(CASE WHEN a."overtimeStatus" = 'Approved' THEN a."approvedOvertimeMinutes" WHEN a."overtimeStatus" = 'Rejected' THEN 0 ELSE a."overtimeMinutes" END), 0)::bigint AS "totalOvertimeMinutes",
        COUNT(*) FILTER (WHERE a."remarks" = 'Absent')::bigint AS "absences",
        COUNT(*) FILTER (WHERE a."scheduledIn" IS NULL AND a."scheduledOut" IS NULL AND a."remarks" NOT IN ('Weekend', 'On Leave'))::bigint AS "holidays",
        COUNT(*) FILTER (WHERE a."scheduledIn" IS NOT NULL AND a."remarks" NOT IN ('Absent', 'On Leave'))::bigint AS "daysWorked",
        COUNT(*) FILTER (WHERE a."overtimeStatus" = 'Pending')::bigint AS "pendingOvertimeCount"
      FROM "AttendanceLog" a
      ${visibleWhereSql}
    `),
    db.$queryRaw<Array<{ pendingValidationCount: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE a."requiresValidation" = TRUE AND a."validationStatus" <> 'Resolved')::bigint AS "pendingValidationCount"
      FROM "AttendanceLog" a
      ${allWhereSql}
    `),
  ]);

  const visible = visibleRows[0];
  return {
    distinctEmployees: Number(visible?.distinctEmployees ?? 0),
    daysPresent: Number(visible?.daysPresent ?? 0),
    lateIncidents: Number(visible?.lateIncidents ?? 0),
    totalLateMinutes: Number(visible?.totalLateMinutes ?? 0),
    totalUndertimeMinutes: Number(visible?.totalUndertimeMinutes ?? 0),
    totalOvertimeHours: Math.round((Number(visible?.totalOvertimeMinutes ?? 0) / 60) * 10) / 10,
    absences: Number(visible?.absences ?? 0),
    holidays: Number(visible?.holidays ?? 0),
    daysWorked: Number(visible?.daysWorked ?? 0),
    pendingValidationCount: Number(pendingRows[0]?.pendingValidationCount ?? 0),
    pendingOvertimeCount: Number(visible?.pendingOvertimeCount ?? 0),
  };
}


export type AttendanceSummaryPeriod = "whole-month" | "first-half" | "second-half";

export type AttendanceSummaryFilters = {
  month?: string;
  staffCategory?: StaffCategory;
  period?: string;
};

type AttendanceSummaryEmployeeRow = {
  employeeId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  department: string;
  position: string;
  absent: number;
  leaveDays: number;
  lateMinutes: number;
  undertimeMinutes: number;
  approvedOvertimeHours: number;
  remarks: string;
};

function normalizeAttendanceSummaryMonth(month?: string) {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");
}

function normalizeAttendanceSummaryPeriod(period?: string): AttendanceSummaryPeriod {
  if (period === "first-half" || period === "second-half") {
    return period;
  }
  return "whole-month";
}

function resolveAttendanceSummaryRange(monthKey: string, requestedPeriod?: string) {
  const period = normalizeAttendanceSummaryPeriod(requestedPeriod);
  const monthStart = new Date(`${monthKey}-01T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  let dateFrom = monthStart;
  let dateTo = monthEnd;
  let periodLabel = "Whole Month";

  if (period === "first-half") {
    dateTo = new Date(monthStart.getFullYear(), monthStart.getMonth(), 15);
    periodLabel = "1st 15 Days";
  } else if (period === "second-half") {
    dateFrom = new Date(monthStart.getFullYear(), monthStart.getMonth(), 16);
    periodLabel = "2nd 15 Days";
  }

  return {
    period,
    dateFrom,
    dateTo,
    dateFromIso: format(dateFrom, "yyyy-MM-dd"),
    dateToIso: format(dateTo, "yyyy-MM-dd"),
    monthLabel: format(monthStart, "MMMM yyyy"),
    periodLabel,
    rangeLabel: `${format(dateFrom, "MMMM d, yyyy")} to ${format(dateTo, "MMMM d, yyyy")}`,
  };
}

async function fetchAttendanceSummaryRows(monthKey: string, staffCategory: StaffCategory, requestedPeriod?: string) {
  const range = resolveAttendanceSummaryRange(monthKey, requestedPeriod);
  const [employees, sourceRows, pendingRows, holidays, approvedLeaveRequests] = await Promise.all([
    db.employeeRecord.findMany({
      where: {
        staffCategory,
      },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        department: true,
        position: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.$queryRaw<AttendanceLogRow[]>(Prisma.sql`
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
        a."overtimeDecisionBy",
        a."overtimeDecisionAt",
        a."overtimeDecisionNote",
        a."requiresValidation",
        a."validationFlags",
        a."validationStatus",
        a."deletedAt",
        a."deletedByName",
        a."deletedByUserId",
        a."deletedReason",
        e."lastName" AS "employeeLastName",
        e."firstName" AS "employeeFirstName",
        e."department" AS "employeeDepartment",
        e."position" AS "employeePosition"
      FROM "AttendanceLog" a
      INNER JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
      WHERE a."deletedAt" IS NULL
        AND a."staffCategory" = ${staffCategory}
        AND a."monthKey" = ${monthKey}
        AND a."workDate" >= ${toDateAtMidnight(range.dateFromIso)}::date
        AND a."workDate" <= ${toDateAtMidnight(range.dateToIso)}::date
        AND a."requiresValidation" <> TRUE
        AND a."overtimeStatus" <> 'Pending'
      ORDER BY e."lastName" ASC, e."firstName" ASC, a."workDate" ASC
    `),
    db.$queryRaw<Array<{ employeeId: string | null; workDate: Date }>>(Prisma.sql`
      SELECT a."employeeId", a."workDate"
      FROM "AttendanceLog" a
      WHERE a."deletedAt" IS NULL
        AND a."staffCategory" = ${staffCategory}
        AND a."monthKey" = ${monthKey}
        AND a."workDate" >= ${toDateAtMidnight(range.dateFromIso)}::date
        AND a."workDate" <= ${toDateAtMidnight(range.dateToIso)}::date
        AND (a."requiresValidation" = TRUE OR a."overtimeStatus" = 'Pending')
    `),
    fetchHolidayMap(monthKey),
    db.leaveRequestRecord.findMany({
      where: {
        overallStatus: "Approved",
        dateFrom: { lte: range.dateToIso },
        dateTo: { gte: range.dateFromIso },
        employee: {
          staffCategory,
        },
      },
      select: {
        employeeId: true,
        dateFrom: true,
        dateTo: true,
      },
    }),
  ]);

  const rows = await normalizeAttendanceLogRows(sourceRows);
  const workDates = enumerateDateRange(range.dateFromIso, range.dateToIso).filter((date) => getSchedule(date, holidays.get(date) ?? null).kind === "Workday");
  const blockedKeys = new Set(pendingRows.flatMap((row) => row.employeeId ? [buildApprovedLeaveKey(row.employeeId, format(row.workDate, "yyyy-MM-dd"))] : []));
  const leaveKeysByEmployee = new Map<string, Set<string>>();
  for (const request of approvedLeaveRequests) {
    const current = leaveKeysByEmployee.get(request.employeeId) ?? new Set<string>();
    for (const date of enumerateDateRange(request.dateFrom, request.dateTo)) {
      if (date >= range.dateFromIso && date <= range.dateToIso && getSchedule(date, holidays.get(date) ?? null).kind === "Workday") {
        current.add(date);
      }
    }
    leaveKeysByEmployee.set(request.employeeId, current);
  }

  const attendanceByEmployeeDate = new Map<string, AttendanceLogRow>();
  for (const row of rows) {
    if (!row.employeeId) {
      continue;
    }
    attendanceByEmployeeDate.set(buildApprovedLeaveKey(row.employeeId, format(row.workDate, "yyyy-MM-dd")), row);
  }

  return employees.map((employee) => {
    const leaveDates = leaveKeysByEmployee.get(employee.id) ?? new Set<string>();
    const summary: AttendanceSummaryEmployeeRow = {
      employeeId: employee.id,
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      department: employee.department ?? "",
      position: employee.position ?? "",
      absent: 0,
      leaveDays: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      approvedOvertimeHours: 0,
      remarks: "",
    };

    for (const date of workDates) {
      const key = buildApprovedLeaveKey(employee.id, date);
      if (blockedKeys.has(key)) {
        summary.absent += 1;
        continue;
      }

      if (leaveDates.has(date)) {
        summary.leaveDays += 1;
        continue;
      }

      const row = attendanceByEmployeeDate.get(key);
      if (!row) {
        summary.absent += 1;
        continue;
      }

      if (row.remarks === "On Leave") {
        summary.leaveDays += 1;
        continue;
      }
      if (row.remarks === "Absent") {
        summary.absent += 1;
      } else if (row.remarks === "Half Day") {
        summary.absent += 0.5;
      }

      summary.lateMinutes += row.lateMinutes;
      summary.undertimeMinutes += row.undertimeMinutes;
      if (row.overtimeStatus === "Approved") {
        summary.approvedOvertimeHours += row.approvedOvertimeMinutes / 60;
      }
    }

    summary.absent = Math.round(summary.absent * 10) / 10;
    summary.leaveDays = Math.round(summary.leaveDays * 10) / 10;
    summary.approvedOvertimeHours = Math.round(summary.approvedOvertimeHours * 10) / 10;

    const remarkLabels: string[] = [];
    if (summary.absent >= 3) {
      remarkLabels.push("Multiple absences");
    } else if (summary.absent >= 1) {
      remarkLabels.push("With absences");
    } else if (summary.absent === 0.5) {
      remarkLabels.push("Half-day attendance");
    }
    if (summary.leaveDays >= 3) {
      remarkLabels.push("Extended approved leave");
    } else if (summary.leaveDays > 0) {
      remarkLabels.push("With approved leave");
    }
    if (summary.lateMinutes >= 60) {
      remarkLabels.push("Frequent tardiness");
    } else if (summary.lateMinutes > 0) {
      remarkLabels.push("With tardiness");
    }
    if (summary.undertimeMinutes >= 120) {
      remarkLabels.push("High undertime");
    } else if (summary.undertimeMinutes > 0) {
      remarkLabels.push("With undertime");
    }
    if (summary.approvedOvertimeHours >= 4) {
      remarkLabels.push("High approved overtime");
    } else if (summary.approvedOvertimeHours > 0) {
      remarkLabels.push("With approved overtime");
    }

    summary.remarks = remarkLabels.join(", ") || "Complete attendance";

    return summary;
  }).sort((left, right) => {
    const lastNameCompare = left.lastName.localeCompare(right.lastName);
    return lastNameCompare !== 0 ? lastNameCompare : left.firstName.localeCompare(right.firstName);
  });
}

function buildHrAttendanceSummaryCacheKey(monthKey: string, staffCategory: StaffCategory, period: AttendanceSummaryPeriod) {
  return [monthKey, staffCategory, period].join("::");
}

function buildHrTardinessCacheKey(input: {
  monthKey: string;
  staffCategory: StaffCategory;
  period: AttendanceSummaryPeriod;
  department?: string;
  employmentStatus?: string;
  sortKey: HrTardinessSortKey;
  sortDir: "asc" | "desc";
}) {
  return [
    input.monthKey,
    input.staffCategory,
    input.period,
    input.department ?? "all",
    input.employmentStatus ?? "all",
    input.sortKey,
    input.sortDir,
  ].join("::");
}

async function buildHrAttendanceSummaryPayload(monthKey: string, staffCategory: StaffCategory, period: AttendanceSummaryPeriod) {
  const range = resolveAttendanceSummaryRange(monthKey, period);
  const rows = await fetchAttendanceSummaryRows(monthKey, staffCategory, range.period);

  return {
    month: monthKey,
    monthLabel: range.monthLabel,
    period: range.period,
    periodLabel: range.periodLabel,
    rangeLabel: range.rangeLabel,
    dateFrom: range.dateFromIso,
    dateTo: range.dateToIso,
    staffCategory,
    rows,
    summary: {
      employeesCount: rows.length,
      totalAbsences: Math.round(rows.reduce((sum, row) => sum + row.absent, 0) * 10) / 10,
      totalLeaveDays: Math.round(rows.reduce((sum, row) => sum + row.leaveDays, 0) * 10) / 10,
      totalLateMinutes: rows.reduce((sum, row) => sum + row.lateMinutes, 0),
      totalUndertimeMinutes: rows.reduce((sum, row) => sum + row.undertimeMinutes, 0),
      totalApprovedOvertimeHours: Math.round(rows.reduce((sum, row) => sum + row.approvedOvertimeHours, 0) * 10) / 10,
    },
  };
}

export async function getHrAttendanceSummary(filters: AttendanceSummaryFilters) {
  await purgeExpiredDeletedAttendance();
  const monthKey = normalizeAttendanceSummaryMonth(filters.month);
  const staffCategory = filters.staffCategory === "Teaching" ? "Teaching" : "Non-Teaching";
  const period = normalizeAttendanceSummaryPeriod(filters.period);
  const cacheKey = buildHrAttendanceSummaryCacheKey(monthKey, staffCategory, period);
  const cached = attendanceSummaryPageCache.get(cacheKey);

  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_SUMMARY_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildHrAttendanceSummaryPayload(monthKey, staffCategory, period).catch((error) => {
    attendanceSummaryPageCache.delete(cacheKey);
    throw error;
  });

  attendanceSummaryPageCache.set(cacheKey, { checkedAt: Date.now(), promise });
  return promise;
}
function toAttendanceRow(record: AttendanceLogRow) {
  const flags = getDisplayValidationFlags(parseJsonFlags(record.validationFlags));
  const displayOvertimeMinutes = record.overtimeStatus === "Approved"
    ? record.approvedOvertimeMinutes
    : 0;
  const workday = new Date(`${format(record.workDate, "yyyy-MM-dd")}T00:00:00`).getDay();
  const attendanceCategory = getAttendanceCategoryFromRemarks(record);
  const scheduleKind = attendanceCategory === "Weekend" ? "Weekend" : attendanceCategory === "Holiday" ? "Holiday" : "Workday";
  const workHoursMinutes = scheduleKind === "Workday"
    ? calculateScheduledWorkMinutes(record, workday) + displayOvertimeMinutes
    : calculateWorkedMinutes(record, workday, scheduleKind);

  return {
    id: record.id,
    employeeId: record.employeeId ?? "",
    sourceEmployeeName: record.sourceEmployeeName,
    date: format(record.workDate, "yyyy-MM-dd"),
    day: record.dayName,
    morningIn: record.morningIn,
    morningOut: record.morningOut,
    afternoonIn: record.afternoonIn,
    afternoonOut: record.afternoonOut,
    timeIn: record.timeIn,
    timeOut: record.timeOut,
    scheduledIn: record.scheduledIn ?? "",
    scheduledOut: record.scheduledOut ?? "",
    remarks: record.remarks,
    workHoursMin: workHoursMinutes,
    workHoursHrs: minutesToHours(workHoursMinutes),
    lateMin: record.lateMinutes,
    undertimeMin: record.undertimeMinutes,
    overtimeHrs: minutesToHours(record.overtimeMinutes),
    approvedOvertimeHrs: minutesToHours(displayOvertimeMinutes),
    overtimeStatus: (record.overtimeStatus as AttendanceRecord["overtimeStatus"]) ?? "Not Required",
    validationFlags: flags,
    validationStatus: record.validationStatus === "Resolved" ? "Resolved" : "Pending",
    overtimeDecisionBy: record.overtimeDecisionBy,
    overtimeDecisionAt: record.overtimeDecisionAt ? record.overtimeDecisionAt.toISOString() : null,
    overtimeDecisionNote: record.overtimeDecisionNote,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    deletedByName: record.deletedByName,
    employeeName: record.employeeLastName && record.employeeFirstName ? formatEmployeeName(record.employeeLastName, record.employeeFirstName) : toDisplayNameCase(record.sourceEmployeeName),
    department: record.employeeDepartment ?? "Unknown employee",
    position: record.employeePosition ?? "Needs validation",
    requiresValidation: record.requiresValidation,
  };
}

function getNormalizedOvertimeStatus(record: AttendanceLogRow, derivedOvertimeMinutes: number) {
  if (derivedOvertimeMinutes <= 0) {
    return "Not Required";
  }

  return record.overtimeStatus === "Approved" || record.overtimeStatus === "Rejected"
    ? record.overtimeStatus
    : "Pending";
}

function shouldPreserveStoredAttendanceResolution(record: AttendanceLogRow) {
  return Boolean(record.deletedAt) || record.remarks === "On Leave";
}

function buildNormalizedAttendanceLogRow(record: AttendanceLogRow, derived: DerivedAttendanceValues) {
  const overtimeStatus = getNormalizedOvertimeStatus(record, derived.overtimeMinutes);
  const approvedOvertimeMinutes = overtimeStatus === "Approved"
    ? Math.min(record.approvedOvertimeMinutes, derived.overtimeMinutes)
    : 0;

  return {
    ...record,
    timeIn: derived.timeIn,
    timeOut: derived.timeOut,
    scheduledIn: derived.scheduledIn,
    scheduledOut: derived.scheduledOut,
    lateMinutes: derived.lateMinutes,
    undertimeMinutes: derived.undertimeMinutes,
    overtimeMinutes: derived.overtimeMinutes,
    approvedOvertimeMinutes,
    remarks: derived.remarks,
    overtimeStatus,
  } satisfies AttendanceLogRow;
}

async function normalizeAttendanceLogRows(records: AttendanceLogRow[]) {
  if (records.length === 0) {
    return records;
  }

  const policies = await fetchAttendancePolicySettings();
  const monthKeys = Array.from(new Set(records.map((record) => format(record.workDate, "yyyy-MM"))));
  const holidayEntries = await Promise.all(monthKeys.map(async (monthKey) => [monthKey, await fetchHolidayMap(monthKey)] as const));
  const approvedLeaveEntries = await Promise.all(monthKeys.map(async (monthKey) => [monthKey, await fetchApprovedLeaveDateKeys(monthKey)] as const));
  const holidayMaps = new Map(holidayEntries);
  const approvedLeaveMaps = new Map(approvedLeaveEntries);

  return records.map((record) => {
    if (shouldPreserveStoredAttendanceResolution(record)) {
      return record;
    }

    const date = format(record.workDate, "yyyy-MM-dd");
    const monthKey = date.slice(0, 7);
    const holidays = holidayMaps.get(monthKey) ?? new Map<string, HolidayShape>();
    const approvedLeaveKeys = approvedLeaveMaps.get(monthKey) ?? new Set<string>();
    const derived = deriveAttendanceValues({
      date,
      row: {
        morningIn: record.morningIn,
        morningOut: record.morningOut,
        afternoonIn: record.afternoonIn,
        afternoonOut: record.afternoonOut,
      },
      holiday: holidays.get(date) ?? null,
      gracePeriodMinutes: Math.max(0, policies.gracePeriod || 0),
      matchedEmployee: Boolean(record.employeeId),
      approvedLeaveAttendance: Boolean(record.employeeId && approvedLeaveKeys.has(buildApprovedLeaveKey(record.employeeId, date))),
    });

    return buildNormalizedAttendanceLogRow(record, derived);
  });
}

function filterAttendanceRowsByRemarks(records: AttendanceLogRow[], remarks?: string) {
  if (!remarks || remarks === "all") {
    return records;
  }

  return records.filter((record) => record.remarks === remarks);
}

function hasNormalizedAttendanceDifference(current: AttendanceLogRow, normalized: AttendanceLogRow) {
  return current.timeIn !== normalized.timeIn
    || current.timeOut !== normalized.timeOut
    || current.scheduledIn !== normalized.scheduledIn
    || current.scheduledOut !== normalized.scheduledOut
    || current.lateMinutes !== normalized.lateMinutes
    || current.undertimeMinutes !== normalized.undertimeMinutes
    || current.overtimeMinutes !== normalized.overtimeMinutes
    || current.approvedOvertimeMinutes !== normalized.approvedOvertimeMinutes
    || current.remarks !== normalized.remarks
    || current.overtimeStatus !== normalized.overtimeStatus;
}

async function persistNormalizedAttendanceLogRows(records: AttendanceLogRow[]) {
  if (records.length === 0) {
    return records;
  }

  const normalizedRows = await normalizeAttendanceLogRows(records);
  const changedRows = normalizedRows.filter((row, index) => hasNormalizedAttendanceDifference(records[index], row));
  if (changedRows.length === 0) {
    return normalizedRows;
  }

  for (const chunk of chunkRecords(changedRows, ATTENDANCE_IMPORT_CHUNK_SIZE)) {
    const values = chunk.map((row) => Prisma.sql`(
      ${row.id},
      ${row.timeIn},
      ${row.timeOut},
      ${row.scheduledIn},
      ${row.scheduledOut},
      ${row.lateMinutes},
      ${row.undertimeMinutes},
      ${row.overtimeMinutes},
      ${row.approvedOvertimeMinutes},
      ${row.remarks},
      ${row.overtimeStatus}
    )`);

    await db.$executeRaw(Prisma.sql`
      UPDATE "AttendanceLog" AS target
      SET
        "timeIn" = incoming."timeIn",
        "timeOut" = incoming."timeOut",
        "scheduledIn" = incoming."scheduledIn",
        "scheduledOut" = incoming."scheduledOut",
        "lateMinutes" = incoming."lateMinutes",
        "undertimeMinutes" = incoming."undertimeMinutes",
        "overtimeMinutes" = incoming."overtimeMinutes",
        "approvedOvertimeMinutes" = incoming."approvedOvertimeMinutes",
        "remarks" = incoming."remarks",
        "overtimeStatus" = incoming."overtimeStatus",
        "updatedAt" = NOW()
      FROM (
        VALUES ${Prisma.join(values)}
      ) AS incoming(
        "id", "timeIn", "timeOut", "scheduledIn", "scheduledOut", "lateMinutes", "undertimeMinutes",
        "overtimeMinutes", "approvedOvertimeMinutes", "remarks", "overtimeStatus"
      )
      WHERE target."id" = incoming."id"
    `);
  }

  return normalizedRows;
}

async function synchronizeStoredAttendanceDerivedFields(
  monthKey: string | undefined,
  filters: AttendanceQueryFilters,
) {
  const cacheKey = buildAttendanceDerivedSyncCacheKey(monthKey, filters);
  const cached = attendanceDerivedSyncCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_DERIVED_SYNC_TTL_MS) {
    return cached.promise;
  }

  const syncPromise = fetchAttendanceLogRowsForExport(monthKey, { ...filters, remarks: "all", page: undefined, pageSize: undefined })
    .then((rows) => persistNormalizedAttendanceLogRows(rows))
    .catch((error) => {
      attendanceDerivedSyncCache.delete(cacheKey);
      throw error;
    });

  attendanceDerivedSyncCache.set(cacheKey, {
    checkedAt: Date.now(),
    promise: syncPromise,
  });

  return syncPromise;
}

function buildImportRows(payload: ParsedAttendanceWorkbookPayload, employees: BasicEmployee[], holidays: Map<string, HolidayShape>, policies: AttendancePolicySettings, approvedLeaveKeys: Set<string>) {
  const employeeLookup = new Map<string, BasicEmployee>();
  for (const employee of employees) {
    for (const key of buildEmployeeLookupKeys(employee)) {
      if (!employeeLookup.has(key)) {
        employeeLookup.set(key, employee);
      }
    }
  }

  const rows: AttendanceInsertRow[] = [];
  for (let index = 0; index < payload.rows.length; index += 1) {
    const row = payload.rows[index];
    const lookupKey = normalizeLookupName(row.employeeName);
    const matchedEmployee = employeeLookup.get(lookupKey) ?? null;
    const holiday = holidays.get(row.date) ?? null;
    const weekday = new Date(`${row.date}T00:00:00`).getDay();
    const schedule = getSchedule(row.date, holiday);
    const timeIn = deriveTimeIn(row);
    const timeOut = deriveTimeOut(row);
    const hasAnyPunch = Boolean(timeIn || timeOut || row.morningOut || row.afternoonIn || row.afternoonOut);
    if (weekday === 0 && !hasAnyPunch) {
      continue;
    }
    const holidayAttendance = Boolean(holiday && hasAnyPunch);
    const halfDayAttendance = isHalfDayAttendance(row, weekday);
    const approvedLeaveAttendance = Boolean(matchedEmployee?.id && hasAnyPunch && approvedLeaveKeys.has(buildApprovedLeaveKey(matchedEmployee.id, row.date)));
    const actualMinutes = weekday === 6
      ? diffMinutes(row.morningIn, row.morningOut ?? row.afternoonOut)
      : diffMinutes(row.morningIn, row.morningOut) + diffMinutes(row.afternoonIn, row.afternoonOut);
    const scheduledOutMinutes = timeToMinutes(schedule.scheduledOut);
    const gracePeriodMinutes = Math.max(0, policies.gracePeriod || 0);
    const lateMinutes = calculateLateMinutes(row, weekday, schedule.kind, gracePeriodMinutes);
    const timeOutMinutes = timeToMinutes(timeOut);
    const undertimeMinutes = halfDayAttendance
      ? 0
      : schedule.kind === "Workday" && scheduledOutMinutes != null && timeOutMinutes != null
        ? Math.max(0, scheduledOutMinutes - timeOutMinutes)
        : 0;
    const overtimeMinutes = schedule.kind === "Workday" && scheduledOutMinutes != null
      ? Math.max(0, (timeOutMinutes ?? 0) - scheduledOutMinutes)
      : 0;
    const attendanceCategory: "Present" | "Absent" | "Holiday" | "Weekend" = holiday
      ? "Holiday"
      : schedule.kind === "Weekend"
        ? "Weekend"
        : hasAnyPunch
          ? "Present"
          : "Absent";
    const flags = inferFlags(row, weekday, hasAnyPunch, overtimeMinutes, Boolean(matchedEmployee), holidayAttendance, approvedLeaveAttendance);

    rows.push({
      id: randomUUID(),
      employeeId: matchedEmployee?.id ?? null,
      sourceEmployeeName: toDisplayNameCase(row.employeeName),
      workDate: toDateAtMidnight(row.date),
      dayName: row.dayName,
      monthKey: row.date.slice(0, 7),
      staffCategory: "Non-Teaching",
      morningIn: row.morningIn,
      morningOut: row.morningOut,
      afternoonIn: row.afternoonIn,
      afternoonOut: row.afternoonOut,
      timeIn,
      timeOut,
      scheduledIn: schedule.scheduledIn,
      scheduledOut: schedule.scheduledOut,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
      approvedOvertimeMinutes: 0,
      remarks: buildRemarks(attendanceCategory, lateMinutes, undertimeMinutes, overtimeMinutes, holiday, halfDayAttendance),
      overtimeStatus: overtimeMinutes > 0 ? "Pending" : "Not Required",
      overtimeDecisionBy: null,
      overtimeDecisionAt: null,
      overtimeDecisionNote: null,
      requiresValidation: flags.length > 0,
      validationFlags: flags,
      validationStatus: flags.length > 0 ? "Pending" : "Resolved",
      validationResolvedBy: null,
      validationResolvedAt: null,
      validationResolutionNote: null,
    } satisfies AttendanceInsertRow);
  }

  return rows;
}

type ExistingAttendanceImportMatch = {
  id: string;
  employeeId: string | null;
  sourceEmployeeName: string;
  workDate: string;
  dayName: string;
  morningIn: string | null;
  morningOut: string | null;
  afternoonIn: string | null;
  afternoonOut: string | null;
  remarks: string;
  validationFlags: AttendanceValidationFlag[];
  employeeName: string;
  department: string;
  position: string;
};

function formatAttendanceWorkDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function buildAttendanceImportDuplicateKey(input: {
  employeeId: string | null | undefined;
  sourceEmployeeName: string | null | undefined;
  workDate: string;
}) {
  if (input.employeeId) {
    return `employee:${input.employeeId}|date:${input.workDate}`;
  }

  const normalizedName = normalizeLookupName(input.sourceEmployeeName);
  return normalizedName ? `source:${normalizedName}|date:${input.workDate}` : "";
}

function buildAttendanceImportDuplicateKeys(input: {
  employeeId: string | null | undefined;
  sourceEmployeeName: string | null | undefined;
  workDate: string;
}) {
  const employeeKey = input.employeeId ? `employee:${input.employeeId}|date:${input.workDate}` : "";
  const normalizedName = normalizeLookupName(input.sourceEmployeeName);
  const sourceKey = normalizedName ? `source:${normalizedName}|date:${input.workDate}` : "";

  return {
    employeeKey,
    sourceKey,
    allKeys: [employeeKey, sourceKey].filter(Boolean),
  };
}

function findExistingAttendanceImportMatch(
  existingByKey: Map<string, ExistingAttendanceImportMatch[]>,
  input: {
    employeeId: string | null | undefined;
    sourceEmployeeName: string | null | undefined;
    workDate: string;
  },
) {
  const { employeeKey, sourceKey } = buildAttendanceImportDuplicateKeys(input);
  const candidates = new Map<string, {
    existing: ExistingAttendanceImportMatch;
    score: number;
    matchedBy: AttendanceDuplicateMatchRow["matchedBy"];
  }>();

  if (employeeKey) {
    for (const existing of existingByKey.get(employeeKey) ?? []) {
      candidates.set(existing.id, {
        existing,
        score: 2,
        matchedBy: "Employee + Date",
      });
    }
  }

  if (sourceKey) {
    for (const existing of existingByKey.get(sourceKey) ?? []) {
      const current = candidates.get(existing.id);
      if (current) {
        current.score = 3;
        current.matchedBy = "Employee + Date + Source Name";
        continue;
      }

      candidates.set(existing.id, {
        existing,
        score: 1,
        matchedBy: "Source Name + Date",
      });
    }
  }

  let bestMatch: {
    existing: ExistingAttendanceImportMatch;
    score: number;
    matchedBy: AttendanceDuplicateMatchRow["matchedBy"];
  } | null = null;

  for (const candidate of candidates.values()) {
    if (!bestMatch || candidate.score > bestMatch.score || (candidate.score === bestMatch.score && candidate.existing.id < bestMatch.existing.id)) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
async function fetchExistingAttendanceImportMatches(rows: AttendanceInsertRow[]) {
  const monthKeys = Array.from(new Set(rows.map((row) => row.monthKey).filter(Boolean)));
  const workDates = Array.from(new Set(rows.map((row) => formatAttendanceWorkDate(row.workDate)).filter(Boolean)));

  if (monthKeys.length === 0 || workDates.length === 0) {
    return [] as ExistingAttendanceImportMatch[];
  }

  const existingRows = await db.$queryRaw<Array<{
    id: string;
    employeeId: string | null;
    sourceEmployeeName: string;
    workDate: string;
    dayName: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    remarks: string;
    validationFlags: Prisma.JsonValue | null;
    employeeLastName: string | null;
    employeeFirstName: string | null;
    employeeDepartment: string | null;
    employeePosition: string | null;
  }>>(Prisma.sql`
    SELECT
      a."id",
      a."employeeId",
      a."sourceEmployeeName",
      TO_CHAR(a."workDate", 'YYYY-MM-DD') AS "workDate",
      a."dayName",
      a."morningIn",
      a."morningOut",
      a."afternoonIn",
      a."afternoonOut",
      a."remarks",
      a."validationFlags",
      e."lastName" AS "employeeLastName",
      e."firstName" AS "employeeFirstName",
      e."department" AS "employeeDepartment",
      e."position" AS "employeePosition"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    WHERE a."staffCategory" = 'Non-Teaching'
      AND a."monthKey" IN (${Prisma.join(monthKeys)})
      AND TO_CHAR(a."workDate", 'YYYY-MM-DD') IN (${Prisma.join(workDates)})
  `);

  return existingRows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    sourceEmployeeName: row.sourceEmployeeName,
    workDate: row.workDate,
    dayName: row.dayName,
    morningIn: row.morningIn,
    morningOut: row.morningOut,
    afternoonIn: row.afternoonIn,
    afternoonOut: row.afternoonOut,
    remarks: row.remarks,
    validationFlags: parseJsonFlags(row.validationFlags),
    employeeName: row.employeeLastName && row.employeeFirstName
      ? formatEmployeeName(row.employeeLastName, row.employeeFirstName)
      : toDisplayNameCase(row.sourceEmployeeName),
    department: row.employeeDepartment ?? "Unknown employee",
    position: row.employeePosition ?? "Needs validation",
  }));
}

async function getAttendanceImportDuplicateSummary(rows: AttendanceInsertRow[], employeeById: Map<string, BasicEmployee>) {
  if (rows.length === 0) {
    return {
      existingAttendanceCount: 0,
      uniqueRecordCount: 0,
      matchRows: [],
    } satisfies AttendanceDuplicateSummary;
  }

  const existingMatches = await fetchExistingAttendanceImportMatches(rows);
  const existingByKey = new Map<string, ExistingAttendanceImportMatch[]>();

  for (const existing of existingMatches) {
    for (const key of buildAttendanceImportDuplicateKeys({
      employeeId: existing.employeeId,
      sourceEmployeeName: existing.sourceEmployeeName,
      workDate: existing.workDate,
    }).allKeys) {
      const current = existingByKey.get(key) ?? [];
      current.push(existing);
      existingByKey.set(key, current);
    }
  }

  const matchRows = rows.flatMap((row, index) => {
    const workDate = formatAttendanceWorkDate(row.workDate);
    const duplicateMatch = findExistingAttendanceImportMatch(existingByKey, {
      employeeId: row.employeeId,
      sourceEmployeeName: row.sourceEmployeeName,
      workDate,
    });

    if (!duplicateMatch) {
      return [];
    }

    const existing = duplicateMatch.existing;

    const matchedEmployee = row.employeeId ? employeeById.get(row.employeeId) ?? null : null;

    return [{
      imported: {
        rowNumber: index + 1,
        employeeName: row.sourceEmployeeName,
        matchedEmployeeName: matchedEmployee ? formatEmployeeName(matchedEmployee.lastName, matchedEmployee.firstName) : null,
        department: matchedEmployee?.department ?? "Unknown employee",
        position: matchedEmployee?.position ?? "Needs validation",
        date: workDate,
        dayName: row.dayName,
        morningIn: row.morningIn,
        morningOut: row.morningOut,
        afternoonIn: row.afternoonIn,
        afternoonOut: row.afternoonOut,
        remarks: row.remarks,
        validationFlags: row.validationFlags,
        matched: Boolean(row.employeeId),
      },
      existing: {
        id: existing.id,
        employeeName: existing.employeeName,
        department: existing.department,
        position: existing.position,
        date: existing.workDate,
        dayName: existing.dayName,
        morningIn: existing.morningIn,
        morningOut: existing.morningOut,
        afternoonIn: existing.afternoonIn,
        afternoonOut: existing.afternoonOut,
        remarks: existing.remarks,
        validationFlags: existing.validationFlags,
      },
      matchedBy: duplicateMatch.matchedBy,
    } satisfies AttendanceDuplicateMatchRow];
  }).sort((left, right) => {
    const nameCompare = left.imported.employeeName.localeCompare(right.imported.employeeName);
    return nameCompare !== 0 ? nameCompare : left.imported.date.localeCompare(right.imported.date);
  });

  return {
    existingAttendanceCount: new Set(matchRows.map((row) => row.existing.id)).size,
    uniqueRecordCount: Math.max(0, rows.length - matchRows.length),
    matchRows,
  } satisfies AttendanceDuplicateSummary;
}

type UpdateAttendanceImportRow = AttendanceInsertRow & {
  targetId: string;
};
async function insertAttendanceImportChunk(tx: Prisma.TransactionClient, batchId: string, chunk: AttendanceInsertRow[]) {
  if (chunk.length === 0) {
    return;
  }

  const values = chunk.map((row) => Prisma.sql`(
    ${row.id},
    ${row.employeeId},
    ${row.sourceEmployeeName},
    ${row.workDate}::date,
    ${row.dayName},
    ${row.monthKey},
    ${row.staffCategory},
    ${row.morningIn},
    ${row.morningOut},
    ${row.afternoonIn},
    ${row.afternoonOut},
    ${row.timeIn},
    ${row.timeOut},
    ${row.scheduledIn},
    ${row.scheduledOut},
    ${row.lateMinutes},
    ${row.undertimeMinutes},
    ${row.overtimeMinutes},
    ${row.approvedOvertimeMinutes},
    ${row.remarks},
    ${row.overtimeStatus},
    ${row.overtimeDecisionBy},
    ${row.overtimeDecisionAt},
    ${row.overtimeDecisionNote},
    ${row.requiresValidation},
    CAST(${JSON.stringify(row.validationFlags)} AS jsonb),
    ${row.validationStatus},
    ${row.validationResolvedBy},
    ${row.validationResolvedAt},
    ${row.validationResolutionNote},
    ${batchId},
    NOW(),
    NOW()
  )`);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "AttendanceLog" (
      "id", "employeeId", "sourceEmployeeName", "workDate", "dayName", "monthKey", "staffCategory",
      "morningIn", "morningOut", "afternoonIn", "afternoonOut", "timeIn", "timeOut", "scheduledIn", "scheduledOut",
      "lateMinutes", "undertimeMinutes", "overtimeMinutes", "approvedOvertimeMinutes", "remarks", "overtimeStatus",
      "overtimeDecisionBy", "overtimeDecisionAt", "overtimeDecisionNote", "requiresValidation", "validationFlags", "validationStatus",
      "validationResolvedBy", "validationResolvedAt", "validationResolutionNote", "importBatchId", "createdAt", "updatedAt"
    )
    VALUES ${Prisma.join(values)}
  `);
}

async function updateAttendanceImportChunk(tx: Prisma.TransactionClient, batchId: string, chunk: UpdateAttendanceImportRow[]) {
  if (chunk.length === 0) {
    return;
  }

  const values = chunk.map((row) => Prisma.sql`(
    ${row.targetId},
    ${row.employeeId},
    ${row.sourceEmployeeName},
    ${row.workDate}::date,
    ${row.dayName},
    ${row.monthKey},
    ${row.staffCategory},
    ${row.morningIn},
    ${row.morningOut},
    ${row.afternoonIn},
    ${row.afternoonOut},
    ${row.timeIn},
    ${row.timeOut},
    ${row.scheduledIn},
    ${row.scheduledOut},
    ${row.lateMinutes},
    ${row.undertimeMinutes},
    ${row.overtimeMinutes},
    ${row.approvedOvertimeMinutes},
    ${row.remarks},
    ${row.overtimeStatus},
    ${row.overtimeDecisionBy},
    ${row.overtimeDecisionAt},
    ${row.overtimeDecisionNote},
    ${row.requiresValidation},
    CAST(${JSON.stringify(row.validationFlags)} AS jsonb),
    ${row.validationStatus},
    ${row.validationResolvedBy},
    ${row.validationResolvedAt},
    ${row.validationResolutionNote},
    ${batchId}
  )`);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog" AS target
    SET
      "employeeId" = incoming."employeeId",
      "sourceEmployeeName" = incoming."sourceEmployeeName",
      "workDate" = incoming."workDate",
      "dayName" = incoming."dayName",
      "monthKey" = incoming."monthKey",
      "staffCategory" = incoming."staffCategory",
      "morningIn" = incoming."morningIn",
      "morningOut" = incoming."morningOut",
      "afternoonIn" = incoming."afternoonIn",
      "afternoonOut" = incoming."afternoonOut",
      "timeIn" = incoming."timeIn",
      "timeOut" = incoming."timeOut",
      "scheduledIn" = incoming."scheduledIn",
      "scheduledOut" = incoming."scheduledOut",
      "lateMinutes" = incoming."lateMinutes",
      "undertimeMinutes" = incoming."undertimeMinutes",
      "overtimeMinutes" = incoming."overtimeMinutes",
      "approvedOvertimeMinutes" = incoming."approvedOvertimeMinutes",
      "remarks" = incoming."remarks",
      "overtimeStatus" = incoming."overtimeStatus",
      "overtimeDecisionBy" = incoming."overtimeDecisionBy",
      "overtimeDecisionAt" = incoming."overtimeDecisionAt",
      "overtimeDecisionNote" = incoming."overtimeDecisionNote",
      "requiresValidation" = incoming."requiresValidation",
      "validationFlags" = incoming."validationFlags",
      "validationStatus" = incoming."validationStatus",
      "validationResolvedBy" = incoming."validationResolvedBy",
      "validationResolvedAt" = incoming."validationResolvedAt",
      "validationResolutionNote" = incoming."validationResolutionNote",
      "importBatchId" = incoming."importBatchId",
      "updatedAt" = NOW()
    FROM (
      VALUES ${Prisma.join(values)}
    ) AS incoming(
      "targetId", "employeeId", "sourceEmployeeName", "workDate", "dayName", "monthKey", "staffCategory",
      "morningIn", "morningOut", "afternoonIn", "afternoonOut", "timeIn", "timeOut", "scheduledIn", "scheduledOut",
      "lateMinutes", "undertimeMinutes", "overtimeMinutes", "approvedOvertimeMinutes", "remarks", "overtimeStatus",
      "overtimeDecisionBy", "overtimeDecisionAt", "overtimeDecisionNote", "requiresValidation", "validationFlags", "validationStatus",
      "validationResolvedBy", "validationResolvedAt", "validationResolutionNote", "importBatchId"
    )
    WHERE target."id" = incoming."targetId"
  `);
}
function summarizeImportRows(rows: AttendanceInsertRow[]) {
  let matchedRecords = 0;
  let unmatchedRecords = 0;
  let validationRecords = 0;
  const unknownEmployees: string[] = [];

  for (const row of rows) {
    if (row.employeeId) {
      matchedRecords += 1;
    } else {
      unmatchedRecords += 1;
      unknownEmployees.push(row.sourceEmployeeName);
    }

    if (row.requiresValidation) {
      validationRecords += 1;
    }
  }

  return {
    matchedRecords,
    unmatchedRecords,
    validationRecords,
    unknownEmployees,
  };
}

async function fetchAttendanceLogById(id: string) {
  const rows = await db.$queryRaw<AttendanceLogRow[]>(Prisma.sql`
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
      a."overtimeDecisionBy",
      a."overtimeDecisionAt",
      a."overtimeDecisionNote",
      a."requiresValidation",
      a."validationFlags",
      a."validationStatus",
      a."deletedAt",
      a."deletedByName",
      a."deletedByUserId",
      a."deletedReason",
      e."lastName" AS "employeeLastName",
      e."firstName" AS "employeeFirstName",
      e."department" AS "employeeDepartment",
      e."position" AS "employeePosition"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    WHERE a."id" = ${id}
    LIMIT 1
  `);
  return rows[0] ?? null;
}


function normalizeEditedAttendanceTime(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  if (timeToMinutes(normalized) == null) {
    throw new Error(`Invalid time value: ${value}`);
  }
  const [hour, minute] = normalized.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

type AttendanceEditInput = {
  id?: string;
  morningIn?: string | null;
  morningOut?: string | null;
  afternoonIn?: string | null;
  afternoonOut?: string | null;
  markHalfDay?: boolean;
};

export async function updateAttendanceRecordTimes(
  user: Pick<AuthenticatedPortalUser, "id" | "name">,
  input: AttendanceEditInput,
) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }
  if (existing.deletedAt) {
    throw new Error("Deleted attendance records cannot be edited.");
  }

  const date = format(existing.workDate, "yyyy-MM-dd");
  const monthKey = format(existing.workDate, "yyyy-MM");
  const [holidays, policies, approvedLeaveKeys] = await Promise.all([
    fetchHolidayMap(monthKey),
    fetchAttendancePolicySettings(),
    fetchApprovedLeaveDateKeys(monthKey),
  ]);

  const morningIn = normalizeEditedAttendanceTime(Object.prototype.hasOwnProperty.call(input, "morningIn") ? input.morningIn : existing.morningIn);
  const morningOut = normalizeEditedAttendanceTime(Object.prototype.hasOwnProperty.call(input, "morningOut") ? input.morningOut : existing.morningOut);
  const afternoonIn = normalizeEditedAttendanceTime(Object.prototype.hasOwnProperty.call(input, "afternoonIn") ? input.afternoonIn : existing.afternoonIn);
  const afternoonOut = normalizeEditedAttendanceTime(Object.prototype.hasOwnProperty.call(input, "afternoonOut") ? input.afternoonOut : existing.afternoonOut);
  const holiday = holidays.get(date) ?? null;
  const hasAnyEditedPunch = Boolean(morningIn || morningOut || afternoonIn || afternoonOut);
  const approvedLeaveAttendance = Boolean(existing.employeeId && hasAnyEditedPunch && approvedLeaveKeys.has(buildApprovedLeaveKey(existing.employeeId, date)));
  const derived = deriveAttendanceValues({
    date,
    row: { morningIn, morningOut, afternoonIn, afternoonOut },
    holiday,
    gracePeriodMinutes: Math.max(0, policies.gracePeriod || 0),
    matchedEmployee: Boolean(existing.employeeId),
    approvedLeaveAttendance,
  });

  const resolvedHalfDayFlags = input.markHalfDay
    ? derived.validationFlags.filter((flag) => flag !== "POSSIBLE_HALF_DAY")
    : derived.validationFlags;
  const nextRequiresValidation = resolvedHalfDayFlags.length > 0;
  const nextValidationStatus = nextRequiresValidation ? "Pending" : "Resolved";
  const nextRemarks = derived.remarks;
  const nextResolutionNote = input.markHalfDay && !nextRequiresValidation
    ? "Half-day attendance confirmed by HR."
    : null;

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "morningIn" = ${morningIn},
      "morningOut" = ${morningOut},
      "afternoonIn" = ${afternoonIn},
      "afternoonOut" = ${afternoonOut},
      "timeIn" = ${derived.timeIn},
      "timeOut" = ${derived.timeOut},
      "scheduledIn" = ${derived.scheduledIn},
      "scheduledOut" = ${derived.scheduledOut},
      "lateMinutes" = ${derived.lateMinutes},
      "undertimeMinutes" = ${derived.undertimeMinutes},
      "overtimeMinutes" = ${derived.overtimeMinutes},
      "approvedOvertimeMinutes" = 0,
      "remarks" = ${nextRemarks},
      "overtimeStatus" = ${derived.overtimeStatus},
      "overtimeDecisionBy" = NULL,
      "overtimeDecisionAt" = NULL,
      "overtimeDecisionNote" = NULL,
      "requiresValidation" = ${nextRequiresValidation},
      "validationFlags" = CAST(${JSON.stringify(resolvedHalfDayFlags)} AS jsonb),
      "validationStatus" = ${nextValidationStatus},
      "validationResolvedBy" = ${input.markHalfDay && !nextRequiresValidation ? user.name : null},
      "validationResolvedAt" = ${input.markHalfDay && !nextRequiresValidation ? Prisma.sql`NOW()` : null},
      "validationResolutionNote" = ${nextResolutionNote},
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);

  const updated = await fetchAttendanceLogById(input.id);
  if (!updated) {
    throw new Error("Attendance record could not be reloaded after update.");
  }
  return toAttendanceRow(updated);
}

export async function softDeleteAttendanceRecord(
  user: Pick<AuthenticatedPortalUser, "id" | "name">,
  input: { id?: string },
) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }
  if (existing.deletedAt) {
    throw new Error("Attendance record is already deleted.");
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "deletedAt" = NOW(),
      "deletedByName" = ${user.name},
      "deletedByUserId" = ${user.id},
      "deletedReason" = 'Deleted by HR.',
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);
}

export async function restoreDeletedAttendanceRecord(
  input: { id?: string },
) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }
  if (!existing.deletedAt) {
    throw new Error("Attendance record is not in deleted status.");
  }

  if (existing.employeeId) {
    const conflict = await db.attendanceLog.findFirst({
      where: {
        employeeId: existing.employeeId,
        workDate: existing.workDate,
        deletedAt: null,
        NOT: { id: input.id },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new Error("An active attendance record already exists for this employee and date.");
    }
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "deletedAt" = NULL,
      "deletedByName" = NULL,
      "deletedByUserId" = NULL,
      "deletedReason" = NULL,
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);

  const restored = await fetchAttendanceLogById(input.id);
  if (!restored) {
    throw new Error("Attendance record could not be reloaded after restore.");
  }
  return toAttendanceRow(restored);
}
export async function previewAttendanceWorkbookForStaff(fileName: string, bytes: Buffer): Promise<AttendanceImportPreviewPayload> {
  const payload = await parseAttendanceWorkbook(fileName, bytes);
  if (payload.rows.length === 0) {
    throw new Error("The attendance workbook does not contain any dated rows.");
  }

  const monthKey = payload.rows[0]?.date.slice(0, 7);
  if (!monthKey) {
    throw new Error("Unable to determine the target month for this workbook.");
  }

  const [employees, holidays, policies, approvedLeaveKeys] = await Promise.all([
    fetchEmployeeLookupRecords(),
    fetchHolidayMap(monthKey),
    fetchAttendancePolicySettings(),
    fetchApprovedLeaveDateKeys(monthKey),
  ]);
  const importRows = buildImportRows(payload, employees, holidays, policies, approvedLeaveKeys);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const summary = summarizeImportRows(importRows);
  const duplicates = await getAttendanceImportDuplicateSummary(importRows, employeeById);

  return {
    fileName,
    sheetName: payload.sheetName,
    monthKey,
    records: importRows.map((row, index) => {
      const matchedEmployee = row.employeeId ? employeeById.get(row.employeeId) ?? null : null;
      return {
        rowNumber: payload.rows[index]?.rowNumber ?? index + 1,
        employeeName: row.sourceEmployeeName,
        matchedEmployeeName: matchedEmployee ? formatEmployeeName(matchedEmployee.lastName, matchedEmployee.firstName) : null,
        department: matchedEmployee?.department ?? "Unknown employee",
        position: matchedEmployee?.position ?? "Needs validation",
        date: formatAttendanceWorkDate(row.workDate),
        dayName: row.dayName,
        morningIn: row.morningIn,
        morningOut: row.morningOut,
        afternoonIn: row.afternoonIn,
        afternoonOut: row.afternoonOut,
        lateMinutes: row.lateMinutes,
        undertimeMinutes: row.undertimeMinutes,
        overtimeMinutes: row.overtimeMinutes,
        remarks: row.remarks,
        validationFlags: row.validationFlags,
        matched: Boolean(row.employeeId),
      };
    }),
    matchedRecords: summary.matchedRecords,
    unmatchedRecords: summary.unmatchedRecords,
    validationRecords: summary.validationRecords,
    unknownEmployees: summary.unknownEmployees,
    duplicates,
  };
}
type AttendanceImportOptions = {
  overwriteExisting?: boolean;
};

export async function importAttendanceWorkbookForStaff(
  user: Pick<AuthenticatedPortalUser, "id" | "name">,
  fileName: string,
  bytes: Buffer,
  options: AttendanceImportOptions = {},
) {
  const payload = await parseAttendanceWorkbook(fileName, bytes);
  if (payload.rows.length === 0) {
    throw new Error("The attendance workbook does not contain any dated rows.");
  }

  const monthKey = payload.rows[0]?.date.slice(0, 7);
  if (!monthKey) {
    throw new Error("Unable to determine the target month for this workbook.");
  }

  const [employees, holidays, policies, approvedLeaveKeys] = await Promise.all([
    fetchEmployeeLookupRecords(),
    fetchHolidayMap(monthKey),
    fetchAttendancePolicySettings(),
    fetchApprovedLeaveDateKeys(monthKey),
  ]);
  const rows = buildImportRows(payload, employees, holidays, policies, approvedLeaveKeys);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const summary = summarizeImportRows(rows);
  const matchedRecords = summary.matchedRecords;
  const unmatchedRecords = summary.unmatchedRecords;
  const validationRecords = summary.validationRecords;
  const duplicates = await getAttendanceImportDuplicateSummary(rows, employeeById);
  const existingMatches = await fetchExistingAttendanceImportMatches(rows);
  const existingByKey = new Map<string, ExistingAttendanceImportMatch[]>();

  for (const existing of existingMatches) {
    for (const key of buildAttendanceImportDuplicateKeys({
      employeeId: existing.employeeId,
      sourceEmployeeName: existing.sourceEmployeeName,
      workDate: existing.workDate,
    }).allKeys) {
      const current = existingByKey.get(key) ?? [];
      current.push(existing);
      existingByKey.set(key, current);
    }
  }

  const insertRows: AttendanceInsertRow[] = [];
  const updateRows: UpdateAttendanceImportRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    const duplicateMatch = findExistingAttendanceImportMatch(existingByKey, {
      employeeId: row.employeeId,
      sourceEmployeeName: row.sourceEmployeeName,
      workDate: formatAttendanceWorkDate(row.workDate),
    });

    if (!duplicateMatch) {
      insertRows.push(row);
      continue;
    }

    if (options.overwriteExisting) {
      updateRows.push({ ...row, targetId: duplicateMatch.existing.id });
    } else {
      skipped += 1;
    }
  }

  const created = insertRows.length;
  const updated = updateRows.length;
  const imported = created + updated;
  const targetYear = Number(monthKey.slice(0, 4));
  const targetMonth = Number(monthKey.slice(5, 7));
  const batchId = randomUUID();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AttendanceImportBatch" (
        "id", "fileName", "targetYear", "targetMonth", "importedByName", "importedByUserId",
        "recordsImported", "matchedRecords", "unmatchedRecords", "validationRecords", "createdAt", "updatedAt"
      ) VALUES (
        ${batchId}, ${fileName}, ${targetYear}, ${targetMonth}, ${user.name}, ${user.id},
        ${imported}, ${matchedRecords}, ${unmatchedRecords}, ${validationRecords}, NOW(), NOW()
      )
    `);

    for (const chunk of chunkRecords(insertRows, ATTENDANCE_IMPORT_CHUNK_SIZE)) {
      await insertAttendanceImportChunk(tx, batchId, chunk);
    }

    for (const chunk of chunkRecords(updateRows, ATTENDANCE_IMPORT_CHUNK_SIZE)) {
      await updateAttendanceImportChunk(tx, batchId, chunk);
    }
  });

  invalidateAttendanceMetadataCache();

  return {
    fileName,
    sheetName: payload.sheetName,
    monthKey,
    imported,
    created,
    updated,
    skipped,
    duplicateRecords: duplicates.matchRows.length,
    matchedRecords,
    unmatchedRecords,
    validationRecords,
    unknownEmployees: summary.unknownEmployees,
  };
}

async function fetchDeletedAttendanceRows(monthKey: string | undefined) {
  const cutoff = getDeletedRetentionCutoff();
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."staffCategory" = 'Non-Teaching'`,
    Prisma.sql`a."deletedAt" IS NOT NULL`,
    Prisma.sql`a."deletedAt" >= ${cutoff}`,
  ];

  if (monthKey) {
    conditions.push(Prisma.sql`a."monthKey" = ${monthKey}`);
  }

  const whereClause = combineSqlConditions(conditions);
  return db.$queryRaw<AttendanceLogRow[]>(Prisma.sql`
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
      a."overtimeDecisionBy",
      a."overtimeDecisionAt",
      a."overtimeDecisionNote",
      a."requiresValidation",
      a."validationFlags",
      a."validationStatus",
      a."deletedAt",
      a."deletedByName",
      a."deletedByUserId",
      a."deletedReason",
      e."lastName" AS "employeeLastName",
      e."firstName" AS "employeeFirstName",
      e."department" AS "employeeDepartment",
      e."position" AS "employeePosition"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    WHERE ${whereClause}
    ORDER BY a."deletedAt" DESC, a."workDate" DESC, a."sourceEmployeeName" ASC
  `);
}
function buildAttendanceReportCacheKey(monthKey: string | undefined, filters: AttendanceQueryFilters, page: number, pageSize: number) {
  return JSON.stringify({
    monthKey: monthKey ?? "all",
    employeeId: filters.employeeId ?? "all",
    remarks: filters.remarks ?? "all",
    search: filters.search?.trim() ?? "",
    date: filters.date ?? "",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
    page,
    pageSize,
  });
}

function buildAttendanceValidationFiltersCacheKey(monthKey: string | undefined) {
  return monthKey ?? "all";
}

function buildAttendanceValidationDashboardCacheKey(monthKey: string | undefined, filters: AttendanceQueryFilters, page: number, pageSize: number) {
  return JSON.stringify({
    monthKey: monthKey ?? "all",
    employeeId: filters.employeeId ?? "all",
    issue: filters.issue ?? "all",
    search: filters.search?.trim() ?? "",
    date: filters.date ?? "",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
    page,
    pageSize,
  });
}

async function buildHrAttendanceReportPayload(filters: AttendanceQueryFilters, monthKey: string | undefined, page: number, pageSize: number) {
  const requiresNormalizedRemarksFilter = Boolean(filters.remarks && filters.remarks !== "all");
  await synchronizeStoredAttendanceDerivedFields(monthKey, filters);

  const [employees, availableMonths, remarksOptions, summary, deletedRows, filteredRows, pageData, scopedTotalRecords] = await Promise.all([
    fetchAttendanceEmployees(monthKey, filters.employeeId),
    fetchAvailableMonths(),
    fetchAttendanceRemarks(monthKey, filters),
    fetchAttendanceSummary(monthKey, requiresNormalizedRemarksFilter ? { ...filters, remarks: "all" } : filters),
    fetchDeletedAttendanceRows(monthKey),
    requiresNormalizedRemarksFilter
      ? fetchAttendanceLogRowsForExport(monthKey, { ...filters, remarks: "all" }).then(normalizeAttendanceLogRows).then((rows) => filterAttendanceRowsByRemarks(rows, filters.remarks))
      : Promise.resolve(null),
    requiresNormalizedRemarksFilter
      ? Promise.resolve(null)
      : fetchAttendanceLogPage(monthKey, { ...filters, page, pageSize }),
    countAttendanceLogRecords(monthKey, {}),
  ]);

  const normalizedPageRecords = filteredRows
    ? filteredRows.slice((page - 1) * pageSize, page * pageSize)
    : await normalizeAttendanceLogRows(pageData?.records ?? []);
  const totalRecords = filteredRows ? filteredRows.length : (pageData?.totalRecords ?? 0);

  return {
    month: monthKey ?? "all",
    monthLabel: monthKey ? format(new Date(monthKey + "-01T00:00:00"), "MMMM yyyy") : "All records",
    availableMonths,
    employees,
    remarksOptions,
    schedule: NON_TEACHING_SCHEDULE,
    summary: {
      ...summary,
      employeesCount: summary.distinctEmployees,
    },
    records: normalizedPageRecords.map(toAttendanceRow).filter((row) => row.employeeId),
    deletedRecords: deletedRows.map(toAttendanceRow),
    pagination: {
      page,
      pageSize,
      totalRecords,
      scopedTotalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    },
  };
}

async function buildAttendanceValidationFiltersPayload(requestedMonth: string | undefined) {
  const availableMonths = await fetchAvailableValidationMonths();
  const effectiveMonth = requestedMonth && availableMonths.includes(requestedMonth)
    ? requestedMonth
    : (availableMonths[0] ?? requestedMonth ?? undefined);

  const [employees, issues] = await Promise.all([
    fetchAttendanceValidationEmployees(effectiveMonth),
    fetchAttendanceValidationIssues(effectiveMonth),
  ]);

  return {
    month: effectiveMonth ?? "all",
    monthLabel: effectiveMonth ? format(new Date(`${effectiveMonth}-01T00:00:00`), "MMMM yyyy") : "All records",
    availableMonths,
    employees,
    issues,
  };
}

async function buildAttendanceValidationDashboardPayload(filters: AttendanceQueryFilters, requestedMonth: string | undefined, page: number, pageSize: number) {
  const availableMonths = await fetchAvailableValidationMonths();
  const effectiveMonth = requestedMonth && availableMonths.includes(requestedMonth)
    ? requestedMonth
    : (availableMonths[0] ?? requestedMonth ?? undefined);

  await synchronizeStoredAttendanceDerivedFields(effectiveMonth, { month: effectiveMonth });

  const [employees, issues, counts, pageData, scopedTotalRecords] = await Promise.all([
    fetchAttendanceValidationEmployees(effectiveMonth),
    fetchAttendanceValidationIssues(effectiveMonth),
    fetchAttendanceValidationCounts(effectiveMonth, filters),
    fetchAttendanceValidationPage(effectiveMonth, { ...filters, page, pageSize }),
    countAttendanceValidationRecords(effectiveMonth, {}),
  ]);

  const rows = pageData.records.map((record) => {
    const mapped = toAttendanceRow(record);
    return {
      ...mapped,
      validationFlagLabels: getDisplayValidationFlags(mapped.validationFlags ?? []).map(getValidationFlagLabel),
    };
  });

  return {
    month: effectiveMonth ?? "all",
    monthLabel: effectiveMonth ? format(new Date(`${effectiveMonth}-01T00:00:00`), "MMMM yyyy") : "All records",
    availableMonths,
    employees,
    issues,
    counts,
    records: rows,
    pagination: {
      page,
      pageSize,
      totalRecords: pageData.totalRecords,
      scopedTotalRecords,
      totalPages: Math.max(1, Math.ceil(pageData.totalRecords / pageSize)),
    },
  };
}

export async function getHrAttendanceReport(filters: AttendanceQueryFilters) {
  await purgeExpiredDeletedAttendance();
  const monthKey = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : undefined;
  const page = normalizeAttendancePage(filters.page);
  const pageSize = normalizeAttendancePageSize(filters.pageSize);
  const cacheKey = buildAttendanceReportCacheKey(monthKey, filters, page, pageSize);
  const cached = attendanceReportPageCache.get(cacheKey);

  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_REPORT_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildHrAttendanceReportPayload(filters, monthKey, page, pageSize).catch((error) => {
    attendanceReportPageCache.delete(cacheKey);
    throw error;
  });

  attendanceReportPageCache.set(cacheKey, { checkedAt: Date.now(), promise });
  return promise;
}

export async function getHrAttendanceReportForExport(filters: AttendanceQueryFilters) {
  await purgeExpiredDeletedAttendance();
  const monthKey = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : undefined;
  await synchronizeStoredAttendanceDerivedFields(monthKey, filters);
  const rows = await fetchAttendanceLogRowsForExport(monthKey, filters.remarks && filters.remarks !== "all" ? { ...filters, remarks: "all" } : filters);
  const normalizedRows = filterAttendanceRowsByRemarks(await normalizeAttendanceLogRows(rows), filters.remarks);
  return normalizedRows
    .map(toAttendanceRow)
    .filter((row) => row.employeeId);
}

function getValidationIssueLabel(issue: string) {
  if (issue === "overtime:pending") {
    return "Overtime requires HR confirmation";
  }
  if (issue.startsWith("flag:")) {
    return getValidationFlagLabel(issue.slice("flag:".length) as AttendanceValidationFlag);
  }
  return issue;
}

async function fetchAttendanceValidationPreviewRows(monthKey: string | undefined, filters: Pick<AttendanceQueryFilters, "employeeId" | "issue" | "search" | "date" | "dateFrom" | "dateTo">) {
  const whereClause = buildValidationWhere(filters, monthKey);
  return db.$queryRaw<AttendanceLogRow[]>(Prisma.sql`
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
      a."overtimeDecisionBy",
      a."overtimeDecisionAt",
      a."overtimeDecisionNote",
      a."requiresValidation",
      a."validationFlags",
      a."validationStatus",
      a."deletedAt",
      a."deletedByName",
      a."deletedByUserId",
      a."deletedReason",
      e."lastName" AS "employeeLastName",
      e."firstName" AS "employeeFirstName",
      e."department" AS "employeeDepartment",
      e."position" AS "employeePosition"
    FROM "AttendanceLog" a
    LEFT JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
    ${whereClause}
    ORDER BY a."workDate" ASC, COALESCE(e."lastName", a."sourceEmployeeName") ASC, COALESCE(e."firstName", '') ASC
  `);
}

export async function getAttendanceValidationFilters(filters: Pick<AttendanceQueryFilters, "month">) {
  await purgeExpiredDeletedAttendance();
  const requestedMonth = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : undefined;
  const cacheKey = buildAttendanceValidationFiltersCacheKey(requestedMonth);
  const cached = attendanceValidationFiltersCache.get(cacheKey);

  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_VALIDATION_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildAttendanceValidationFiltersPayload(requestedMonth).catch((error) => {
    attendanceValidationFiltersCache.delete(cacheKey);
    throw error;
  });

  attendanceValidationFiltersCache.set(cacheKey, { checkedAt: Date.now(), promise });
  return promise;
}

export async function getAttendanceValidationDashboard(filters: AttendanceQueryFilters) {
  await purgeExpiredDeletedAttendance();
  const requestedMonth = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : undefined;
  const page = normalizeAttendancePage(filters.page);
  const pageSize = normalizeAttendancePageSize(filters.pageSize);
  const cacheKey = buildAttendanceValidationDashboardCacheKey(requestedMonth, filters, page, pageSize);
  const cached = attendanceValidationPageCache.get(cacheKey);

  if (cached && Date.now() - cached.checkedAt < ATTENDANCE_VALIDATION_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildAttendanceValidationDashboardPayload(filters, requestedMonth, page, pageSize).catch((error) => {
    attendanceValidationPageCache.delete(cacheKey);
    throw error;
  });

  attendanceValidationPageCache.set(cacheKey, { checkedAt: Date.now(), promise });
  return promise;
}

export async function previewAttendanceValidationBulkResolve(filters: AttendanceQueryFilters) {
  await purgeExpiredDeletedAttendance();
  if (!filters.issue || filters.issue === "all") {
    throw new Error("Select a specific issue first before bulk resolving.");
  }

  const requestedMonth = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : undefined;
  const availableMonths = await fetchAvailableValidationMonths();
  const effectiveMonth = requestedMonth && availableMonths.includes(requestedMonth)
    ? requestedMonth
    : (availableMonths[0] ?? requestedMonth ?? undefined);

  await synchronizeStoredAttendanceDerivedFields(effectiveMonth, { month: effectiveMonth });

  const previewRows = await fetchAttendanceValidationPreviewRows(effectiveMonth, filters);
  const records = previewRows.map((record) => {
    const mapped = toAttendanceRow(record);
    return {
      ...mapped,
      validationFlagLabels: getDisplayValidationFlags(mapped.validationFlags ?? []).map(getValidationFlagLabel),
    };
  });
  const blockedRecords = filters.issue === "overtime:pending" || filters.issue === "flag:APPROVED_LEAVE_HAS_ATTENDANCE" ? 0 : records.filter((record) => record.overtimeStatus === "Pending").length;

  return {
    month: effectiveMonth ?? "all",
    monthLabel: effectiveMonth ? format(new Date(`${effectiveMonth}-01T00:00:00`), "MMMM yyyy") : "All records",
    issue: filters.issue,
    issueLabel: getValidationIssueLabel(filters.issue),
    totalRecords: records.length,
    blockedRecords,
    resolvableRecords: records.length - blockedRecords,
    records,
  };
}

export async function bulkResolveAttendanceValidation(user: Pick<AuthenticatedPortalUser, "name">, filters: AttendanceQueryFilters) {
  const preview = await previewAttendanceValidationBulkResolve(filters);
  if (preview.totalRecords === 0) {
    throw new Error("No attendance records matched the selected bulk resolve filters.");
  }
  if (preview.issue === "overtime:pending") {
    const updatedRecords: Awaited<ReturnType<typeof updateAttendanceOvertimeDecision>>[] = [];
    for (const batch of chunkRecords(preview.records, 25)) {
      const batchResults = await Promise.all(batch.map((record) => updateAttendanceOvertimeDecision(user, {
        id: record.id,
        approve: true,
        note: "Bulk overtime confirmation approved by HR.",
      })));
      updatedRecords.push(...batchResults);
    }

    return {
      resolvedCount: updatedRecords.length,
      issue: preview.issue,
      issueLabel: preview.issueLabel,
    };
  }
  if (preview.issue === "flag:APPROVED_LEAVE_HAS_ATTENDANCE") {
    const ids = preview.records.map((record) => record.id).filter(Boolean);
    await db.$executeRaw(Prisma.sql`
      UPDATE "AttendanceLog"
      SET
        "morningIn" = NULL,
        "morningOut" = NULL,
        "afternoonIn" = NULL,
        "afternoonOut" = NULL,
        "timeIn" = NULL,
        "timeOut" = NULL,
        "lateMinutes" = 0,
        "undertimeMinutes" = 0,
        "overtimeMinutes" = 0,
        "approvedOvertimeMinutes" = 0,
        "remarks" = 'On Leave',
        "overtimeStatus" = 'Not Required',
        "overtimeDecisionBy" = NULL,
        "overtimeDecisionAt" = NULL,
        "overtimeDecisionNote" = NULL,
        "requiresValidation" = FALSE,
        "validationFlags" = '[]'::jsonb,
        "validationStatus" = 'Resolved',
        "validationResolvedBy" = ${user.name},
        "validationResolvedAt" = NOW(),
        "validationResolutionNote" = ${`Bulk attendance review marked as On Leave for ${preview.issueLabel}.`},
        "updatedAt" = NOW()
      WHERE "id" IN (${Prisma.join(ids)})
    `);

    return {
      resolvedCount: ids.length,
      issue: preview.issue,
      issueLabel: preview.issueLabel,
      markedOnLeave: true,
    };
  }
  if (preview.blockedRecords > 0) {
    throw new Error("Some selected records still have pending overtime. Review those overtime items first.");
  }

  const ids = preview.records.map((record) => record.id).filter(Boolean);
  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "requiresValidation" = FALSE,
      "validationStatus" = 'Resolved',
      "validationResolvedBy" = ${user.name},
      "validationResolvedAt" = NOW(),
      "validationResolutionNote" = ${`Bulk attendance validation resolved for ${preview.issueLabel}.`},
      "updatedAt" = NOW()
    WHERE "id" IN (${Prisma.join(ids)})
  `);

  return {
    resolvedCount: ids.length,
    issue: preview.issue,
    issueLabel: preview.issueLabel,
  };
}

export async function bulkResolveAttendanceValidationWithPunchAutoFill(user: Pick<AuthenticatedPortalUser, "id" | "name">, filters: AttendanceQueryFilters) {
  const preview = await previewAttendanceValidationBulkResolve(filters);
  if (preview.issue !== "flag:INCOMPLETE_PUNCHES") {
    throw new Error("Bulk auto-complete is only available for incomplete punches.");
  }
  if (preview.totalRecords === 0) {
    throw new Error("No attendance records matched the selected bulk resolve filters.");
  }
  if (preview.blockedRecords > 0) {
    throw new Error("Some selected records still have pending overtime. Review those overtime items first.");
  }

  const updatedRecords: Awaited<ReturnType<typeof updateAttendanceRecordTimes>>[] = [];
  for (const batch of chunkRecords(preview.records, 25)) {
    const batchResults = await Promise.all(batch.map((record) => {
      const defaults = getDefaultPunchResolveValues(record);
      return updateAttendanceRecordTimes(user, {
        id: record.id,
        morningIn: record.morningIn ?? defaults.morningIn,
        morningOut: record.morningOut ?? defaults.morningOut,
        afternoonIn: record.afternoonIn ?? defaults.afternoonIn,
        afternoonOut: record.afternoonOut ?? defaults.afternoonOut,
      });
    }));
    updatedRecords.push(...batchResults);
  }

  const resolvedCount = updatedRecords.filter((record) => !record.requiresValidation).length;
  const remainingCount = updatedRecords.length - resolvedCount;

  return {
    updatedCount: updatedRecords.length,
    resolvedCount,
    remainingCount,
    issue: preview.issue,
    issueLabel: preview.issueLabel,
  };
}
export async function updateAttendanceOvertimeDecision(user: Pick<AuthenticatedPortalUser, "name">, input: { id?: string; approve?: boolean; note?: string }) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }
  if (existing.overtimeMinutes <= 0) {
    throw new Error("This attendance record has no overtime to review.");
  }

  const existingFlags = parseJsonFlags(existing.validationFlags);
  const remainingFlags = existingFlags.filter((flag) => flag !== "OVERTIME_REQUIRES_CONFIRMATION");
  const approve = input.approve === true;

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "overtimeStatus" = ${approve ? "Approved" : "Rejected"},
      "approvedOvertimeMinutes" = ${approve ? existing.overtimeMinutes : 0},
      "overtimeDecisionBy" = ${user.name},
      "overtimeDecisionAt" = NOW(),
      "overtimeDecisionNote" = ${normalizeText(input.note) || (approve ? "Overtime accepted by HR." : "Overtime was not accepted by HR.")},
      "validationFlags" = CAST(${JSON.stringify(remainingFlags)} AS jsonb),
      "requiresValidation" = ${remainingFlags.length > 0},
      "validationStatus" = ${remainingFlags.length > 0 ? existing.validationStatus : "Resolved"},
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);

  const updated = await fetchAttendanceLogById(input.id);
  if (!updated) {
    throw new Error("Attendance record could not be reloaded after update.");
  }
  return toAttendanceRow(updated);
}

export async function resolveAttendanceValidationWithPunches(
  user: Pick<AuthenticatedPortalUser, "id" | "name">,
  input: AttendanceEditInput & { id?: string },
) {
  return updateAttendanceRecordTimes(user, input);
}

export async function resolveAttendanceValidationAsOnLeave(user: Pick<AuthenticatedPortalUser, "name">, input: { id?: string }) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "morningIn" = NULL,
      "morningOut" = NULL,
      "afternoonIn" = NULL,
      "afternoonOut" = NULL,
      "timeIn" = NULL,
      "timeOut" = NULL,
      "lateMinutes" = 0,
      "undertimeMinutes" = 0,
      "overtimeMinutes" = 0,
      "approvedOvertimeMinutes" = 0,
      "remarks" = 'On Leave',
      "overtimeStatus" = 'Not Required',
      "overtimeDecisionBy" = NULL,
      "overtimeDecisionAt" = NULL,
      "overtimeDecisionNote" = NULL,
      "requiresValidation" = FALSE,
      "validationFlags" = '[]'::jsonb,
      "validationStatus" = 'Resolved',
      "validationResolvedBy" = ${user.name},
      "validationResolvedAt" = NOW(),
      "validationResolutionNote" = 'Attendance marked as On Leave by HR.',
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);

  const updated = await fetchAttendanceLogById(input.id);
  if (!updated) {
    throw new Error("Attendance record could not be reloaded after update.");
  }
  return toAttendanceRow(updated);
}

export async function resolveAttendanceValidation(user: Pick<AuthenticatedPortalUser, "name">, input: { id?: string; note?: string }) {
  if (!input.id) {
    throw new Error("Attendance record id is required.");
  }

  const existing = await fetchAttendanceLogById(input.id);
  if (!existing) {
    throw new Error("Attendance record not found.");
  }
  if (existing.overtimeStatus === "Pending") {
    throw new Error("Please decide the overtime request first before resolving this validation item.");
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "AttendanceLog"
    SET
      "requiresValidation" = FALSE,
      "validationStatus" = 'Resolved',
      "validationResolvedBy" = ${user.name},
      "validationResolvedAt" = NOW(),
      "validationResolutionNote" = ${normalizeText(input.note) || "Attendance reviewed by HR."},
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `);

  const updated = await fetchAttendanceLogById(input.id);
  if (!updated) {
    throw new Error("Attendance record could not be reloaded after update.");
  }
  return toAttendanceRow(updated);
}




























































export type HrTardinessSortKey = "timesLate" | "totalLateMinutes" | "avgLateMinutes";

export type HrTardinessFilters = {
  month?: string;
  staffCategory?: StaffCategory;
  period?: string;
  department?: string;
  employmentStatus?: string;
  sortKey?: HrTardinessSortKey;
  sortDir?: "asc" | "desc";
};

type HrTardinessTrendPoint = {
  date: string;
  lateMinutes: number;
};

type HrTardinessEmployeeRow = {
  employeeId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  department: string;
  position: string;
  employmentStatus: string;
  avatarColor: string | null;
  timesLate: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  tardinessStatus: "Habitual" | "Normal";
  trend: HrTardinessTrendPoint[];
};

function normalizeHrTardinessSortKey(sortKey?: string): HrTardinessSortKey {
  if (sortKey === "timesLate" || sortKey === "avgLateMinutes") {
    return sortKey;
  }
  return "totalLateMinutes";
}

function normalizeHrTardinessSortDir(sortDir?: string): "asc" | "desc" {
  return sortDir === "asc" ? "asc" : "desc";
}

async function buildHrTardinessPayload(input: {
  monthKey: string;
  staffCategory: StaffCategory;
  period: AttendanceSummaryPeriod;
  department?: string;
  employmentStatus?: string;
  sortKey: HrTardinessSortKey;
  sortDir: "asc" | "desc";
}) {
  const range = resolveAttendanceSummaryRange(input.monthKey, input.period);

  const [settings, departmentRows, statusRows, sourceRows, scopedCountRows] = await Promise.all([
    db.systemSettings.findUnique({
      where: { id: "default" },
      select: { tardinessThreshold: true },
    }).catch(() => null),
    db.employeeRecord.findMany({
      where: { staffCategory: input.staffCategory },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
    }),
    db.employeeRecord.findMany({
      where: { staffCategory: input.staffCategory },
      select: { employmentStatus: true },
      distinct: ["employmentStatus"],
      orderBy: { employmentStatus: "asc" },
    }),
    db.$queryRaw<Array<{
      employeeId: string;
      workDate: Date;
      lateMinutes: number;
      lastName: string;
      firstName: string;
      middleName: string;
      department: string;
      position: string;
      employmentStatus: string;
      avatarColor: string | null;
    }>>(Prisma.sql`
      SELECT
        a."employeeId" AS "employeeId",
        a."workDate" AS "workDate",
        a."lateMinutes" AS "lateMinutes",
        e."lastName" AS "lastName",
        e."firstName" AS "firstName",
        e."middleName" AS "middleName",
        e."department" AS "department",
        e."position" AS "position",
        e."employmentStatus" AS "employmentStatus",
        e."avatarColor" AS "avatarColor"
      FROM "AttendanceLog" a
      INNER JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
      WHERE a."deletedAt" IS NULL
        AND a."employeeId" IS NOT NULL
        AND a."staffCategory" = ${input.staffCategory}
        AND a."workDate" >= ${toDateAtMidnight(range.dateFromIso)}::date
        AND a."workDate" <= ${toDateAtMidnight(range.dateToIso)}::date
        AND a."lateMinutes" > 0
        AND NOT (a."requiresValidation" = TRUE AND a."validationStatus" <> 'Resolved')
        ${input.department ? Prisma.sql`AND e."department" = ${input.department}` : Prisma.empty}
        ${input.employmentStatus ? Prisma.sql`AND e."employmentStatus" = ${input.employmentStatus}` : Prisma.empty}
      ORDER BY e."lastName" ASC, e."firstName" ASC, a."workDate" ASC
    `),
    db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT a."employeeId")::bigint AS "count"
      FROM "AttendanceLog" a
      INNER JOIN "EmployeeRecord" e ON e."id" = a."employeeId"
      WHERE a."deletedAt" IS NULL
        AND a."employeeId" IS NOT NULL
        AND a."staffCategory" = ${input.staffCategory}
        AND a."workDate" >= ${toDateAtMidnight(range.dateFromIso)}::date
        AND a."workDate" <= ${toDateAtMidnight(range.dateToIso)}::date
        AND a."lateMinutes" > 0
        AND NOT (a."requiresValidation" = TRUE AND a."validationStatus" <> 'Resolved')
    `),
  ]);

  const threshold = settings?.tardinessThreshold ?? DEFAULT_SYSTEM_SETTINGS.tardinessThreshold;
  const departments = departmentRows
    .map((row) => row.department.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  const employmentStatuses = statusRows
    .map((row) => row.employmentStatus.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  const groupedRows = new Map<string, HrTardinessEmployeeRow>();
  for (const row of sourceRows) {
    const current = groupedRows.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      lastName: row.lastName,
      firstName: row.firstName,
      middleName: row.middleName,
      department: row.department,
      position: row.position,
      employmentStatus: row.employmentStatus,
      avatarColor: row.avatarColor,
      timesLate: 0,
      totalLateMinutes: 0,
      avgLateMinutes: 0,
      tardinessStatus: "Normal",
      trend: [],
    };

    current.timesLate += 1;
    current.totalLateMinutes += row.lateMinutes;
    current.trend.push({
      date: format(row.workDate, "MMM d"),
      lateMinutes: row.lateMinutes,
    });

    groupedRows.set(row.employeeId, current);
  }

  const rows = Array.from(groupedRows.values()).map((row) => {
    const avgLateMinutes = row.timesLate > 0 ? Math.round(row.totalLateMinutes / row.timesLate) : 0;
    return {
      ...row,
      avgLateMinutes,
      tardinessStatus: row.timesLate >= threshold ? "Habitual" : "Normal",
    } satisfies HrTardinessEmployeeRow;
  }).sort((left, right) => {
    const leftValue = left[input.sortKey];
    const rightValue = right[input.sortKey];
    const diff = Number(leftValue) - Number(rightValue);
    if (diff !== 0) {
      return input.sortDir === "asc" ? diff : -diff;
    }

    const lastNameCompare = left.lastName.localeCompare(right.lastName);
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }

    return left.firstName.localeCompare(right.firstName);
  });

  return {
    month: input.monthKey,
    monthLabel: range.monthLabel,
    period: range.period,
    periodLabel: range.periodLabel,
    rangeLabel: range.rangeLabel,
    dateFrom: range.dateFromIso,
    dateTo: range.dateToIso,
    staffCategory: input.staffCategory,
    threshold,
    sortKey: input.sortKey,
    sortDir: input.sortDir,
    departments,
    employmentStatuses,
    rows,
    summary: {
      habitualOffenders: rows.filter((row) => row.tardinessStatus === "Habitual").length,
      totalLateMinutes: rows.reduce((sum, row) => sum + row.totalLateMinutes, 0),
      employeesWithTardiness: rows.length,
      recordsCount: rows.length,
      scopedTotalRecords: Number(scopedCountRows[0]?.count ?? 0),
    },
  };
}

export async function getHrTardinessMonitoring(filters: HrTardinessFilters) {
  await purgeExpiredDeletedAttendance();

  const monthKey = normalizeAttendanceSummaryMonth(filters.month);
  const staffCategory = filters.staffCategory === "Teaching" ? "Teaching" : "Non-Teaching";
  const period = normalizeAttendanceSummaryPeriod(filters.period);
  const sortKey = normalizeHrTardinessSortKey(filters.sortKey);
  const sortDir = normalizeHrTardinessSortDir(filters.sortDir);
  const departmentFilter = filters.department?.trim() && filters.department !== "all" ? filters.department.trim() : undefined;
  const employmentStatusFilter = filters.employmentStatus?.trim() && filters.employmentStatus !== "all" ? filters.employmentStatus.trim() : undefined;
  const cacheKey = buildHrTardinessCacheKey({
    monthKey,
    staffCategory,
    period,
    department: departmentFilter,
    employmentStatus: employmentStatusFilter,
    sortKey,
    sortDir,
  });
  const cached = hrTardinessPageCache.get(cacheKey);

  if (cached && Date.now() - cached.checkedAt < HR_TARDINESS_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = buildHrTardinessPayload({
    monthKey,
    staffCategory,
    period,
    department: departmentFilter,
    employmentStatus: employmentStatusFilter,
    sortKey,
    sortDir,
  }).catch((error) => {
    hrTardinessPageCache.delete(cacheKey);
    throw error;
  });

  hrTardinessPageCache.set(cacheKey, { checkedAt: Date.now(), promise });
  return promise;
}
