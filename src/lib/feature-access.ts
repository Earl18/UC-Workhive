import {
  Bell,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MoonStar,
  Plane,
  ScrollText,
  User,
  Users,
  Video,
  BarChart3,
} from "lucide-react";
import type { ComponentType } from "react";
import type { FeatureToggles, Role } from "@/lib/types";

export type FeatureToggleGroup = "Employee Portal" | "HR Portal";

export type FeatureToggleMeta = {
  key: keyof FeatureToggles;
  label: string;
  description: string;
  group: FeatureToggleGroup;
  icon: ComponentType<{ className?: string }>;
  affects: string;
  affectedRoles: Role[];
};

export const FEATURE_TOGGLE_META: FeatureToggleMeta[] = [
  { key: "employeeDashboard", label: "Employee Dashboard", description: "Shows the employee home page with attendance, leave, and announcement summaries.", group: "Employee Portal", icon: LayoutDashboard, affects: "Employee portal • Dashboard", affectedRoles: ["employee"] },
  { key: "employeeProfile", label: "Employee Profile", description: "Lets employees open and review their personal profile records.", group: "Employee Portal", icon: User, affects: "Employee portal • My Profile", affectedRoles: ["employee"] },
  { key: "employeeTimeClock", label: "Clock In/Clock Out", description: "Controls the live time clock page used for clock in, lunch, and end-of-shift attendance.", group: "Employee Portal", icon: Clock3, affects: "Employee portal • Clock In/Clock Out", affectedRoles: ["employee"] },
  { key: "employeeAttendanceHistory", label: "Attendance History", description: "Shows the employee attendance history and logged daily records.", group: "Employee Portal", icon: CalendarClock, affects: "Employee portal • Attendance History", affectedRoles: ["employee"] },
  { key: "employeeLeave", label: "Employee Leave", description: "Lets employees file leave requests and review their leave submissions.", group: "Employee Portal", icon: Plane, affects: "Employee portal • File a Leave", affectedRoles: ["employee"] },
  { key: "employeeHolidays", label: "Employee Holidays", description: "Shows the holiday calendar page inside the employee portal.", group: "Employee Portal", icon: CalendarDays, affects: "Employee portal • Holiday Calendar", affectedRoles: ["employee"] },
  { key: "employeeDocuments", label: "Employee Documents", description: "Shows the employee documents and certificates page.", group: "Employee Portal", icon: FileText, affects: "Employee portal • Documents / Certificates", affectedRoles: ["employee"] },
  { key: "employeeNotifications", label: "Employee Notifications", description: "Shows the employee notifications page and related alerts section.", group: "Employee Portal", icon: Bell, affects: "Employee portal • Notifications", affectedRoles: ["employee"] },
  { key: "hrDashboard", label: "HR Dashboard", description: "Shows the HR dashboard with attendance, leave, and recruitment summary cards.", group: "HR Portal", icon: LayoutDashboard, affects: "HR portal • Dashboard", affectedRoles: ["hr"] },
  { key: "hrEmployees", label: "Employee Master List", description: "Controls the HR employee master list and its related employee detail flows.", group: "HR Portal", icon: Users, affects: "HR portal • Employee Master List / Employee Details / Add Employee", affectedRoles: ["hr"] },
  { key: "hrAttendanceReport", label: "Attendance Report", description: "Shows the HR attendance report page for daily attendance monitoring.", group: "HR Portal", icon: ClipboardList, affects: "HR portal • Attendance Report", affectedRoles: ["hr"] },
  { key: "hrAttendanceValidation", label: "Attendance Validation", description: "Shows the validation page for incomplete or flagged attendance records.", group: "HR Portal", icon: CheckCheck, affects: "HR portal • Attendance Validation", affectedRoles: ["hr"] },
  { key: "hrAttendanceSummary", label: "Attendance Summary", description: "Shows attendance summary analytics for HR.", group: "HR Portal", icon: BarChart3, affects: "HR portal • Attendance Summary", affectedRoles: ["hr"] },
  { key: "hrTardiness", label: "Tardiness Monitoring", description: "Shows the tardiness monitoring page for HR review.", group: "HR Portal", icon: MoonStar, affects: "HR portal • Tardiness Monitoring", affectedRoles: ["hr"] },
  { key: "hrLeaveManagement", label: "Leave Management", description: "Shows the HR leave management and approval page.", group: "HR Portal", icon: Plane, affects: "HR portal • Leave Management", affectedRoles: ["hr"] },
  { key: "hrLeaveSummary", label: "Leave Summary", description: "Shows the leave balance and leave summary page for HR.", group: "HR Portal", icon: FileText, affects: "HR portal • Leave Summary Remaining", affectedRoles: ["hr"] },
  { key: "hrJobPostings", label: "Job Postings", description: "Shows the HR job postings page used to manage career openings.", group: "HR Portal", icon: Briefcase, affects: "HR portal • Job Postings", affectedRoles: ["hr"] },
  { key: "hrApplications", label: "Job Applications", description: "Shows the HR applications page for applicant pipeline review.", group: "HR Portal", icon: Users, affects: "HR portal • Job Applications", affectedRoles: ["hr"] },
  { key: "hrInterviewScheduling", label: "Interview Scheduling", description: "Shows the HR interview scheduling page.", group: "HR Portal", icon: CalendarClock, affects: "HR portal • Interview Scheduling", affectedRoles: ["hr"] },
  { key: "hrInterviews", label: "Interview Result", description: "Shows the HR interview result page used for scoring and outcomes.", group: "HR Portal", icon: GraduationCap, affects: "HR portal • Interview Result", affectedRoles: ["hr"] },
  { key: "hrVideoConferencing", label: "Video Conferencing", description: "Shows the HR video conferencing room page.", group: "HR Portal", icon: Video, affects: "HR portal • Video Conferencing", affectedRoles: ["hr"] },
  { key: "hrHolidays", label: "HR Holidays", description: "Shows the holiday calendar page inside the HR portal.", group: "HR Portal", icon: CalendarDays, affects: "HR portal • Holiday Calendar", affectedRoles: ["hr"] },
  { key: "hrReports", label: "HR Reports", description: "Shows the HR reports page.", group: "HR Portal", icon: ScrollText, affects: "HR portal • Reports", affectedRoles: ["hr"] },
];

export const FEATURE_TOGGLE_GROUPS = ["Employee Portal", "HR Portal"] as const;
export const FEATURE_TOGGLE_KEYS = FEATURE_TOGGLE_META.map((item) => item.key) as Array<keyof FeatureToggles>;

type PortalView =
  | "employee:dashboard"
  | "employee:profile"
  | "employee:time-clock"
  | "employee:attendance"
  | "employee:leave"
  | "employee:holidays"
  | "employee:documents"
  | "employee:notifications"
  | "hr:dashboard"
  | "hr:master-list"
  | "hr:employee-details"
  | "hr:add-employee"
  | "hr:attendance"
  | "hr:attendance-validation"
  | "hr:attendance-summary"
  | "hr:tardiness"
  | "hr:leave-management"
  | "hr:leave-summary"
  | "hr:job-postings"
  | "hr:applications"
  | "hr:interview-scheduling"
  | "hr:interviews"
  | "hr:video-conferencing"
  | "hr:holidays"
  | "hr:reports"
  | "admin:dashboard";

const VIEW_TOGGLE_KEY_MAP: Partial<Record<PortalView, keyof FeatureToggles>> = {
  "employee:dashboard": "employeeDashboard",
  "employee:profile": "employeeProfile",
  "employee:time-clock": "employeeTimeClock",
  "employee:attendance": "employeeAttendanceHistory",
  "employee:leave": "employeeLeave",
  "employee:holidays": "employeeHolidays",
  "employee:documents": "employeeDocuments",
  "employee:notifications": "employeeNotifications",
  "hr:dashboard": "hrDashboard",
  "hr:master-list": "hrEmployees",
  "hr:employee-details": "hrEmployees",
  "hr:add-employee": "hrEmployees",
  "hr:attendance": "hrAttendanceReport",
  "hr:attendance-validation": "hrAttendanceValidation",
  "hr:attendance-summary": "hrAttendanceSummary",
  "hr:tardiness": "hrTardiness",
  "hr:leave-management": "hrLeaveManagement",
  "hr:leave-summary": "hrLeaveSummary",
  "hr:job-postings": "hrJobPostings",
  "hr:applications": "hrApplications",
  "hr:interview-scheduling": "hrInterviewScheduling",
  "hr:interviews": "hrInterviews",
  "hr:video-conferencing": "hrVideoConferencing",
  "hr:holidays": "hrHolidays",
  "hr:reports": "hrReports",
};

const DEFAULT_ROLE_VIEWS: Record<Role, PortalView[]> = {
  employee: ["employee:dashboard", "employee:profile", "employee:time-clock", "employee:attendance", "employee:leave", "employee:holidays", "employee:documents", "employee:notifications"],
  hr: ["hr:dashboard", "hr:master-list", "hr:attendance", "hr:attendance-validation", "hr:attendance-summary", "hr:tardiness", "hr:leave-management", "hr:leave-summary", "hr:job-postings", "hr:applications", "hr:interview-scheduling", "hr:interviews", "hr:video-conferencing", "hr:holidays", "hr:reports"],
  admin: ["admin:dashboard"],
};

export function isViewEnabled(view: string, featureToggles: FeatureToggles) {
  const toggleKey = VIEW_TOGGLE_KEY_MAP[view as PortalView];
  return toggleKey ? featureToggles[toggleKey] : true;
}

export function getFallbackViewForRole(role: Role, featureToggles: FeatureToggles): PortalView {
  const candidate = DEFAULT_ROLE_VIEWS[role].find((view) => isViewEnabled(view, featureToggles));
  return candidate ?? DEFAULT_ROLE_VIEWS[role][0];
}
