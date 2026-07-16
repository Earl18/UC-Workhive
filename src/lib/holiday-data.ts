import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Holiday, HolidayType } from "@/lib/types";

const HOLIDAY_TYPES = new Set<HolidayType>([
  "Regular Holiday",
  "Special Non-Working Day",
  "Special Working Holiday",
  "Institution Holiday",
]);

const DEFAULT_HOLIDAY_SEED: Holiday[] = [
  { id: "hol-2025-001", name: "New Year's Day", date: "2025-01-01", type: "Regular Holiday" },
  { id: "hol-2025-002", name: "Chinese New Year", date: "2025-01-29", type: "Special Non-Working Day" },
  { id: "hol-2025-003", name: "Cebu Charter Day", date: "2025-02-24", type: "Special Non-Working Day" },
  { id: "hol-2025-004", name: "EDSA People Power Revolution Anniversary", date: "2025-02-25", type: "Special Working Holiday" },
  { id: "hol-2025-005", name: "Eid'l Fitr", date: "2025-04-01", type: "Regular Holiday" },
  { id: "hol-2025-006", name: "Araw ng Kagitingan", date: "2025-04-09", type: "Regular Holiday" },
  { id: "hol-2025-007", name: "Maundy Thursday", date: "2025-04-17", type: "Regular Holiday" },
  { id: "hol-2025-008", name: "Good Friday", date: "2025-04-18", type: "Regular Holiday" },
  { id: "hol-2025-009", name: "Black Saturday", date: "2025-04-19", type: "Special Non-Working Day" },
  { id: "hol-2025-010", name: "Labor Day", date: "2025-05-01", type: "Regular Holiday" },
  { id: "hol-2025-011", name: "Eid'l Adha", date: "2025-06-06", type: "Regular Holiday" },
  { id: "hol-2025-012", name: "Independence Day", date: "2025-06-12", type: "Regular Holiday" },
  { id: "hol-2025-013", name: "UC South Campus Foundation Day", date: "2025-08-15", type: "Special Working Holiday" },
  { id: "hol-2025-014", name: "Ninoy Aquino Day", date: "2025-08-21", type: "Special Non-Working Day" },
  { id: "hol-2025-015", name: "National Heroes Day", date: "2025-08-25", type: "Regular Holiday" },
  { id: "hol-2025-016", name: "All Saints' Day", date: "2025-11-01", type: "Special Non-Working Day" },
  { id: "hol-2025-017", name: "Bonifacio Day", date: "2025-11-30", type: "Regular Holiday" },
  { id: "hol-2025-018", name: "Feast of the Immaculate Conception", date: "2025-12-08", type: "Special Non-Working Day" },
  { id: "hol-2025-019", name: "Christmas Eve", date: "2025-12-24", type: "Special Non-Working Day" },
  { id: "hol-2025-020", name: "Christmas Day", date: "2025-12-25", type: "Regular Holiday" },
  { id: "hol-2025-021", name: "Rizal Day", date: "2025-12-30", type: "Regular Holiday" },
  { id: "hol-2025-022", name: "Last Day of the Year", date: "2025-12-31", type: "Special Non-Working Day" },

  { id: "hol-2026-001", name: "New Year's Day", date: "2026-01-01", type: "Regular Holiday" },
  { id: "hol-2026-002", name: "Chinese New Year", date: "2026-02-17", type: "Special Non-Working Day" },
  { id: "hol-2026-003", name: "EDSA People Power Revolution Anniversary", date: "2026-02-25", type: "Special Working Holiday" },
  { id: "hol-2026-004", name: "Eid'l Fitr", date: "2026-03-20", type: "Regular Holiday" },
  { id: "hol-2026-005", name: "Maundy Thursday", date: "2026-04-02", type: "Regular Holiday" },
  { id: "hol-2026-006", name: "Good Friday", date: "2026-04-03", type: "Regular Holiday" },
  { id: "hol-2026-007", name: "Black Saturday", date: "2026-04-04", type: "Special Non-Working Day" },
  { id: "hol-2026-008", name: "Araw ng Kagitingan", date: "2026-04-09", type: "Regular Holiday" },
  { id: "hol-2026-009", name: "Labor Day", date: "2026-05-01", type: "Regular Holiday" },
  { id: "hol-2026-010", name: "Independence Day", date: "2026-06-12", type: "Regular Holiday" },
  { id: "hol-2026-011", name: "UC South Campus Foundation Day", date: "2026-08-15", type: "Special Working Holiday" },
  { id: "hol-2026-012", name: "Ninoy Aquino Day", date: "2026-08-21", type: "Special Non-Working Day" },
  { id: "hol-2026-013", name: "National Heroes Day", date: "2026-08-31", type: "Regular Holiday" },
  { id: "hol-2026-014", name: "All Saints' Day", date: "2026-11-01", type: "Special Non-Working Day" },
  { id: "hol-2026-015", name: "All Souls' Day", date: "2026-11-02", type: "Special Non-Working Day" },
  { id: "hol-2026-016", name: "Bonifacio Day", date: "2026-11-30", type: "Regular Holiday" },
  { id: "hol-2026-017", name: "Feast of the Immaculate Conception", date: "2026-12-08", type: "Special Non-Working Day" },
  { id: "hol-2026-018", name: "Christmas Eve", date: "2026-12-24", type: "Special Non-Working Day" },
  { id: "hol-2026-019", name: "Christmas Day", date: "2026-12-25", type: "Regular Holiday" },
  { id: "hol-2026-020", name: "Rizal Day", date: "2026-12-30", type: "Regular Holiday" },
  { id: "hol-2026-021", name: "Last Day of the Year", date: "2026-12-31", type: "Special Non-Working Day" },
];

function getReferenceYear(referenceDate = new Date()) {
  return referenceDate.getFullYear();
}

function getNextNewYearDate(referenceDate = new Date()) {
  return `${getReferenceYear(referenceDate) + 1}-01-01`;
}

function buildNextNewYearHoliday(referenceDate = new Date()): Holiday {
  const nextYear = getReferenceYear(referenceDate) + 1;
  return {
    id: `hol-${nextYear}-001`,
    name: "New Year's Day",
    date: `${nextYear}-01-01`,
    type: "Regular Holiday",
  };
}

function isVisibleHolidayDate(date: string, referenceDate = new Date()) {
  const currentYearPrefix = `${getReferenceYear(referenceDate)}-`;
  return date.startsWith(currentYearPrefix) || date === getNextNewYearDate(referenceDate);
}

function getVisibleDefaultHolidaySeed(referenceDate = new Date()) {
  const visibleSeed = DEFAULT_HOLIDAY_SEED.filter((holiday) => isVisibleHolidayDate(holiday.date, referenceDate));
  const nextNewYearDate = getNextNewYearDate(referenceDate);

  if (visibleSeed.some((holiday) => holiday.date === nextNewYearDate)) {
    return visibleSeed;
  }

  return [...visibleSeed, buildNextNewYearHoliday(referenceDate)].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function filterVisibleHolidays(holidays: Holiday[], referenceDate = new Date()) {
  return holidays.filter((holiday) => isVisibleHolidayDate(holiday.date, referenceDate));
}

function isMissingTableError(error: unknown) {
  return error instanceof Error && /HolidayRecord|holidayrecord|does not exist|Unknown arg/i.test(error.message);
}

function normalizeHolidayType(value: string): HolidayType {
  return HOLIDAY_TYPES.has(value as HolidayType) ? (value as HolidayType) : "Institution Holiday";
}

function normalizeHolidayRow(row: { id: string; name: string; date: string; type: string }): Holiday {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    type: normalizeHolidayType(row.type),
  };
}

async function seedHolidayRecords() {
  for (const holiday of getVisibleDefaultHolidaySeed()) {
    await db.holidayRecord.upsert({
      where: { date: holiday.date },
      update: {
        name: holiday.name,
        type: holiday.type,
      },
      create: {
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        type: holiday.type,
      },
    });
  }
}

export async function getHolidayRecords() {
  try {
    const count = await db.holidayRecord.count();
    if (count === 0) {
      await seedHolidayRecords();
    }

    const records = await db.holidayRecord.findMany({ orderBy: [{ date: "asc" }, { name: "asc" }] });
    return filterVisibleHolidays(records.map(normalizeHolidayRow));
  } catch (error) {
    if (isMissingTableError(error)) {
      return getVisibleDefaultHolidaySeed().map((holiday) => ({ ...holiday }));
    }
    throw error;
  }
}

export async function createHolidayRecord(input: { name?: string; date?: string; type?: string }) {
  const name = input.name?.trim() ?? "";
  const date = input.date?.trim() ?? "";
  const type = normalizeHolidayType(input.type?.trim() ?? "Institution Holiday");

  if (!name || !date) {
    throw new Error("Holiday name and date are required.");
  }

  const existing = await db.holidayRecord.findUnique({ where: { date } });
  if (existing) {
    throw new Error("A holiday is already saved for that date.");
  }

  const created = await db.holidayRecord.create({
    data: {
      id: randomUUID(),
      name,
      date,
      type,
    },
  });

  return normalizeHolidayRow(created);
}

export async function updateHolidayRecord(id: string, input: { name?: string; date?: string; type?: string }) {
  const name = input.name?.trim() ?? "";
  const date = input.date?.trim() ?? "";
  const type = normalizeHolidayType(input.type?.trim() ?? "Institution Holiday");

  if (!name || !date) {
    throw new Error("Holiday name and date are required.");
  }

  const existing = await db.holidayRecord.findFirst({
    where: {
      date,
      NOT: { id },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Another holiday is already saved for that date.");
  }

  const updated = await db.holidayRecord.update({
    where: { id },
    data: { name, date, type },
  });

  return normalizeHolidayRow(updated);
}

export async function deleteHolidayRecord(id: string) {
  await db.holidayRecord.delete({ where: { id } });
}



