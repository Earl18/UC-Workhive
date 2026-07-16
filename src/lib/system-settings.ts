import type { SystemSettingsRecord } from "@/lib/admin-types";

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsRecord = {
  organizationName: "University of Cebu - South Campus",
  campusAddress: "Sanciangko St., Cebu City, 6000 Cebu, Philippines",
  campusLandmark: "",
  campusPlaceId: "",
  contactNumber: "(032) 412-1234",
  hrEmail: "hr.south@uc.edu.ph",
  academicYear: "2026-2027",
  currentSemester: "1st Semester",
  gracePeriod: 10,
  tardinessThreshold: 5,
  holidayReminderLead: 7,
  vacationLeaveDays: 10,
  sickLeaveDays: 8,
  incentiveLeaveDays: 3,
  soloParentLeaveDays: 7,
  paternityLeaveDays: 0,
  maternityLeaveDays: 60,
  leaveWithoutPayDays: 0,
  employeeDefaultPassword: "Employee@123",
  hrDefaultPassword: "HR@123",
  adminDefaultPassword: "Admin@123",
};

export function normalizeAcademicYear(value: string) {
  return value.replace(/[]/g, "-").trim();
}

export function getAcademicYearLabel(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

export function getCurrentAcademicYearStart(date = new Date()) {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

export function buildAcademicYearOptions(selectedValue?: string, yearsBefore = 1, yearsAfter = 5) {
  const currentStartYear = getCurrentAcademicYearStart();
  const values = new Set<string>();

  for (let year = currentStartYear - yearsBefore; year <= currentStartYear + yearsAfter; year += 1) {
    values.add(getAcademicYearLabel(year));
  }

  if (selectedValue) {
    values.add(normalizeAcademicYear(selectedValue));
  }

  return Array.from(values).sort((left, right) => {
    const leftYear = Number(left.split("-")[0]);
    const rightYear = Number(right.split("-")[0]);
    return leftYear - rightYear;
  });
}
