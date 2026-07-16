export type AttendanceCategory = "Present" | "Absent" | "Holiday" | "Weekend" | "Leave";

type AttendanceRemarkShape = {
  remarks?: string | null;
  scheduledIn?: string | null;
  scheduledOut?: string | null;
};

export function getAttendanceCategoryFromRemarks(record: AttendanceRemarkShape): AttendanceCategory {
  const remarks = record.remarks?.trim() ?? "";

  if (remarks === "Absent") {
    return "Absent";
  }
  if (remarks === "Weekend") {
    return "Weekend";
  }
  if (remarks === "On Leave") {
    return "Leave";
  }
  if (!record.scheduledIn && !record.scheduledOut && remarks) {
    return "Holiday";
  }
  return "Present";
}

export function isPresentAttendanceRemark(record: AttendanceRemarkShape) {
  return getAttendanceCategoryFromRemarks(record) === "Present";
}
