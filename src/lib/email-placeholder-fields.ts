export const PLACEHOLDER_FIELDS = {
  employee: ["firstName", "lastName", "fullName", "email", "department", "position", "idNumber", "dateHired", "employmentStatus"],
  user: ["name", "email", "role", "department"],
  applicant: ["fullName", "email", "contact", "positionApplied", "department", "stage", "appliedDate", "interviewDate", "interviewTime", "interviewMode", "interviewLocation"],
  leave: ["leaveType", "dateFrom", "dateTo", "days", "reason", "dateFiled", "overallStatus"],
  holiday: ["name", "date", "type"],
  settings: ["organizationName", "campusAddress", "contactNumber", "hrEmail", "academicYear", "currentSemester"],
  event: ["date", "time", "hours", "reason", "platform", "locationLink", "resetLink", "newDate", "newTime"],
} as const;

export type PlaceholderSource = keyof typeof PLACEHOLDER_FIELDS;
export type EmailPlaceholder = { label: string; token: string; source: PlaceholderSource; field: string };
