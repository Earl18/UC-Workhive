import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getEmployeeMasterRecordForUser } from "@/lib/hr-data";
import { updateAttendanceRecordTimes } from "@/lib/attendance-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIME_ZONE = "Asia/Manila";

type ClockAction = "clock-in" | "break-start" | "break-end" | "clock-out";
type ClockStatus = "ready" | "working" | "on-break" | "clocked-out";

type AttendanceClockRecord = {
  id: string;
  workDate: Date;
  dayName: string;
  morningIn: string | null;
  morningOut: string | null;
  afternoonIn: string | null;
  afternoonOut: string | null;
  timeIn: string | null;
  timeOut: string | null;
  remarks: string;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  approvedOvertimeMinutes: number;
  overtimeStatus: string;
  deletedAt: Date | null;
};

type TimelineEntry = {
  key: string;
  label: string;
  time: string;
  type: ClockAction | "working" | "ready";
};

function manilaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

function getManilaDateKey(now = new Date()) {
  const { year, month, day } = manilaDateParts(now);
  return `${year}-${month}-${day}`;
}

function getManilaMonthKey(now = new Date()) {
  const { year, month } = manilaDateParts(now);
  return `${year}-${month}`;
}

function getManilaTimeKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function getManilaWeekdayShort(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(now);
}

function getWorkDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function isSaturday(dayName: string) {
  return dayName === "Sat";
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function formatDisplayTime(value: string | null | undefined) {
  if (!value) {
    return "--:--";
  }

  const minutes = timeToMinutes(value);
  if (minutes == null) {
    return value;
  }

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const sample = new Date(Date.UTC(2000, 0, 1, hour, minute));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(sample);
}

function getClockStatus(record: AttendanceClockRecord | null, saturday: boolean): ClockStatus {
  if (!record || (!record.morningIn && !record.morningOut && !record.afternoonIn && !record.afternoonOut)) {
    return "ready";
  }

  if (saturday) {
    if (record.morningIn && !record.morningOut) {
      return "working";
    }
    if (record.morningOut) {
      return "clocked-out";
    }
    return "ready";
  }

  if (record.afternoonOut) {
    return "clocked-out";
  }
  if (record.afternoonIn && !record.afternoonOut) {
    return "working";
  }
  if (record.morningOut && !record.afternoonIn) {
    return "on-break";
  }
  if (record.morningIn && !record.morningOut) {
    return "working";
  }

  return "ready";
}

function getAvailableActions(record: AttendanceClockRecord | null, saturday: boolean, status: ClockStatus): ClockAction[] {
  if (!record || status === "ready") {
    return ["clock-in", "clock-out"];
  }

  if (status === "on-break") {
    return saturday ? [] : ["break-end"];
  }

  if (status === "working") {
    if (saturday || record.afternoonIn) {
      return ["clock-out"];
    }
    return ["break-start", "clock-out"];
  }

  return [];
}

function buildTimeline(record: AttendanceClockRecord | null, saturday: boolean, status: ClockStatus): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];

  if (record?.morningIn) {
    timeline.push({ key: "clock-in", label: "Clocked In", time: formatDisplayTime(record.morningIn), type: "clock-in" });
  }
  if (record?.morningOut) {
    timeline.push({
      key: "break-start",
      label: saturday ? "Clocked Out" : "Lunch",
      time: formatDisplayTime(record.morningOut),
      type: saturday ? "clock-out" : "break-start",
    });
  }
  if (!saturday && record?.afternoonIn) {
    timeline.push({ key: "break-end", label: "Lunch In", time: formatDisplayTime(record.afternoonIn), type: "break-end" });
  }
  if (!saturday && record?.afternoonOut) {
    timeline.push({ key: "clock-out", label: "Clocked Out", time: formatDisplayTime(record.afternoonOut), type: "clock-out" });
  }

  if (timeline.length === 0) {
    timeline.push({ key: "ready", label: "Ready to Clock In", time: "Today", type: "ready" });
  } else if (status === "working") {
    timeline.push({ key: "working", label: "Working...", time: "Live", type: "working" });
  } else if (status === "on-break") {
    timeline.push({ key: "working", label: "On Lunch", time: "Live", type: "working" });
  }

  return timeline;
}

function getNearestZone(latitude: number, longitude: number, zones: Array<{ id: string; name: string; lat: number; lng: number; radius: number }>) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  let nearest: { id: string; name: string; radius: number; distanceMeters: number } | null = null;

  for (const zone of zones) {
    const dLat = toRad(zone.lat - latitude);
    const dLng = toRad(zone.lng - longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latitude)) * Math.cos(toRad(zone.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = earthRadius * c;

    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = {
        id: zone.id,
        name: zone.name,
        radius: zone.radius,
        distanceMeters,
      };
    }
  }

  return nearest;
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return 0;
  }
  return endMinutes - startMinutes;
}

function calculateWorkedMinutes(record: AttendanceClockRecord | null) {
  if (!record) {
    return 0;
  }

  return minutesBetween(record.morningIn, record.morningOut) + minutesBetween(record.afternoonIn, record.afternoonOut);
}

function getWeekStart(date = new Date()) {
  const manila = new Date(date.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const start = new Date(manila);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWorkDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

async function getTodayAttendanceRecord(employeeId: string, workDate: Date) {
  return db.attendanceLog.findFirst({
    where: {
      employeeId,
      workDate,
      deletedAt: null,
    },
    select: {
      id: true,
      workDate: true,
      dayName: true,
      morningIn: true,
      morningOut: true,
      afternoonIn: true,
      afternoonOut: true,
      timeIn: true,
      timeOut: true,
      remarks: true,
      lateMinutes: true,
      undertimeMinutes: true,
      overtimeMinutes: true,
      approvedOvertimeMinutes: true,
      overtimeStatus: true,
      deletedAt: true,
    },
  });
}

async function buildClockPayload(user: { id: string; name: string; employeeId?: string | null; email: string }) {
  const employee = await getEmployeeMasterRecordForUser({ ...user, employeeId: user.employeeId ?? undefined });
  if (!employee) {
    throw new Error("No employee record found.");
  }

  const dateKey = getManilaDateKey();
  const dayName = getManilaWeekdayShort();
  const workDate = getWorkDate(dateKey);
  const saturday = isSaturday(dayName);
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [record, zones, weeklyRecords] = await Promise.all([
    getTodayAttendanceRecord(employee.id, workDate),
    db.geofenceZone.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, lat: true, lng: true, radius: true },
    }),
    db.attendanceLog.findMany({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      orderBy: { workDate: "asc" },
      select: {
        id: true,
        workDate: true,
        dayName: true,
        morningIn: true,
        morningOut: true,
        afternoonIn: true,
        afternoonOut: true,
        timeIn: true,
        timeOut: true,
        remarks: true,
        lateMinutes: true,
        undertimeMinutes: true,
        overtimeMinutes: true,
        approvedOvertimeMinutes: true,
        overtimeStatus: true,
        deletedAt: true,
      },
    }),
  ]);

  const status = getClockStatus(record, saturday);
  const availableActions = getAvailableActions(record, saturday, status);

  const weeklySummary = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);
    const row = weeklyRecords.find((entry) => formatWorkDate(entry.workDate) === formatWorkDate(dayDate)) ?? null;
    const workedMinutes = calculateWorkedMinutes(row);
    const approvedOvertimeMinutes = row ? (row.approvedOvertimeMinutes > 0 ? row.approvedOvertimeMinutes : row.overtimeMinutes) : 0;
    const workedHours = Math.round((workedMinutes / 60) * 100) / 100;
    const overtimeHours = Math.round((approvedOvertimeMinutes / 60) * 100) / 100;
    const regularHours = Math.max(0, Math.round((workedHours - overtimeHours) * 100) / 100);

    return {
      day: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(dayDate),
      date: formatWorkDate(dayDate),
      hours: workedHours,
      regular: regularHours,
      overtime: overtimeHours,
    };
  });

  const todayHours = Math.round((calculateWorkedMinutes(record) / 60) * 100) / 100;
  const weekHours = Math.round(weeklySummary.reduce((sum, entry) => sum + entry.hours, 0) * 100) / 100;

  return {
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      idNumber: employee.idNumber ?? null,
      position: employee.position,
      department: employee.department,
      staffCategory: employee.staffCategory ?? null,
    },
    dateKey,
    dayName,
    isSaturday: saturday,
    status,
    availableActions,
    todayRecord: record
      ? {
          id: record.id,
          date: dateKey,
          day: record.dayName,
          morningIn: record.morningIn,
          morningOut: record.morningOut,
          afternoonIn: record.afternoonIn,
          afternoonOut: record.afternoonOut,
          timeIn: record.timeIn,
          timeOut: record.timeOut,
          remarks: record.remarks,
          lateMin: record.lateMinutes,
          undertimeMin: record.undertimeMinutes,
          overtimeHrs: Number((record.approvedOvertimeMinutes > 0 ? record.approvedOvertimeMinutes : record.overtimeMinutes) / 60).toFixed(1),
          overtimeStatus: record.overtimeStatus,
        }
      : null,
    timeline: buildTimeline(record, saturday, status),
    todayHours,
    weekHours,
    weeklySummary,
    site: zones[0]
      ? {
          enabled: true,
          zoneCount: zones.length,
          primaryZone: zones[0].name,
        }
      : {
          enabled: false,
          zoneCount: 0,
          primaryZone: null,
        },
  };
}

async function ensureTodayRecord(user: { name: string }, employee: Awaited<ReturnType<typeof getEmployeeMasterRecordForUser>>) {
  if (!employee) {
    throw new Error("No employee record found.");
  }

  const dateKey = getManilaDateKey();
  const dayName = getManilaWeekdayShort();
  const monthKey = getManilaMonthKey();
  const workDate = getWorkDate(dateKey);
  const existing = await getTodayAttendanceRecord(employee.id, workDate);
  if (existing) {
    return existing;
  }

  return db.attendanceLog.create({
    data: {
      employeeId: employee.id,
      sourceEmployeeName: `${employee.firstName} ${employee.lastName}`.trim() || user.name,
      workDate,
      dayName,
      monthKey,
      staffCategory: employee.staffCategory ?? "Non-Teaching",
      remarks: "Present",
      validationStatus: "Resolved",
    },
    select: {
      id: true,
      workDate: true,
      dayName: true,
      morningIn: true,
      morningOut: true,
      afternoonIn: true,
      afternoonOut: true,
      timeIn: true,
      timeOut: true,
      remarks: true,
      lateMinutes: true,
      undertimeMinutes: true,
      overtimeMinutes: true,
      approvedOvertimeMinutes: true,
      overtimeStatus: true,
      deletedAt: true,
    },
  });
}

function resolveActionPatch(action: ClockAction, record: AttendanceClockRecord | null, saturday: boolean, timeKey: string) {
  switch (action) {
    case "clock-in":
      if (!record?.morningIn) {
        return { morningIn: timeKey };
      }
      if (!saturday && record.morningOut && !record.afternoonIn) {
        return { afternoonIn: timeKey };
      }
      throw new Error("You have already timed in for the available shift today.");
    case "break-start":
      if (saturday) {
        throw new Error("Saturday schedule does not use lunch break actions.");
      }
      if (!record?.morningIn) {
        throw new Error("Time in first before starting lunch break.");
      }
      if (record.morningOut) {
        throw new Error("Lunch break has already been recorded.");
      }
      return { morningOut: timeKey };
    case "break-end":
      if (saturday) {
        throw new Error("Saturday schedule does not use lunch break actions.");
      }
      if (!record?.morningOut) {
        throw new Error("Record lunch out first before timing back in.");
      }
      if (record.afternoonIn) {
        throw new Error("Afternoon time in has already been recorded.");
      }
      return { afternoonIn: timeKey };
    case "clock-out":
      if (saturday) {
        if (!record?.morningIn && !record?.morningOut) {
          return { morningOut: timeKey };
        }
        if (!record?.morningIn) {
          throw new Error("Your time out has already been recorded.");
        }
        if (record.morningOut) {
          throw new Error("Your time out has already been recorded.");
        }
        return { morningOut: timeKey };
      }
      if (!record?.morningIn && !record?.morningOut && !record?.afternoonIn && !record?.afternoonOut) {
        return { afternoonOut: timeKey };
      }
      if (record?.afternoonIn && !record.afternoonOut) {
        return { afternoonOut: timeKey };
      }
      if (record?.morningIn && !record.morningOut) {
        return { morningOut: timeKey };
      }
      throw new Error("Your time out has already been recorded for today.");
    default:
      throw new Error("Invalid action.");
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const data = await buildClockPayload(auth.user);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attendance clock." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuthenticated(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      action?: ClockAction;
      latitude?: number;
      longitude?: number;
    };

    const action = body.action;
    if (!action || !["clock-in", "break-start", "break-end", "clock-out"].includes(action)) {
      return NextResponse.json({ error: "A valid attendance action is required." }, { status: 400 });
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Device location is required for attendance." }, { status: 400 });
    }

    const employee = await getEmployeeMasterRecordForUser(auth.user);
    if (!employee) {
      return NextResponse.json({ error: "No employee record found." }, { status: 404 });
    }

    const zones = await db.geofenceZone.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, lat: true, lng: true, radius: true },
    });

    let distanceMeters: number | null = null;
    if (zones.length > 0) {
      const nearest = getNearestZone(latitude, longitude, zones);
      distanceMeters = nearest ? Math.round(nearest.distanceMeters) : null;
      const withinAnyZone = nearest ? nearest.distanceMeters <= nearest.radius : false;
      if (!withinAnyZone) {
        return NextResponse.json(
          {
            error: nearest
              ? `You must be within ${nearest.radius}m of ${nearest.name} to record attendance.`
              : "No configured attendance zone is available.",
          },
          { status: 403 },
        );
      }
    }

    await db.userLocationStatus.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        lat: latitude,
        lng: longitude,
      },
      update: {
        lat: latitude,
        lng: longitude,
        detectedAt: new Date(),
        lastSyncAt: new Date(),
      },
    }).catch(() => null);

    const record = await ensureTodayRecord(auth.user, employee);
    const saturday = isSaturday(record.dayName);
    const patch = resolveActionPatch(action, record, saturday, getManilaTimeKey());

    await updateAttendanceRecordTimes(
      { id: auth.user.id, name: auth.user.name },
      {
        id: record.id,
        ...patch,
      },
    );

    const data = await buildClockPayload(auth.user);
    return NextResponse.json({ data, meta: { action, distanceMeters } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update attendance." },
      { status: 500 },
    );
  }
}
