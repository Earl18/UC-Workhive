"use client";

import { create } from "zustand";
import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  LeaveCredits,
  Holiday,
  JobPosting,
  Applicant,
  SystemUser,
  EmailTemplate,
  FeatureToggles,
  GeofenceZone,
  AuditLogEntry,
  NotificationItem,
  Role,
  InterviewScore,
  InterviewSchedule,
  LeaveType,
} from "./types";
import {
  EMPLOYEES,
  ATTENDANCE,
  LEAVE_CREDITS,
  LEAVE_REQUESTS,
  JOB_POSTINGS,
  APPLICANTS,
  SYSTEM_USERS,
  EMAIL_TEMPLATES,
  FEATURE_TOGGLES,
  GEOFENCE_ZONES,
  AUDIT_LOG,
  NOTIFICATIONS,
} from "./mock-data";

export type View =
  | "public:landing"
  | "public:about"
  | "public:careers"
  | "public:job-detail"
  | "public:login"
  | "employee:dashboard"
  | "employee:profile"
  | "employee:attendance"
  | "employee:leave"
  | "employee:holidays"
  | "employee:documents"
  | "employee:notifications"
  | "hr:dashboard"
  | "hr:employee-details"
  | "hr:master-list"
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
  | "admin:dashboard"
  | "admin:settings"
  | "admin:feature-toggles"
  | "admin:gps-zones"
  | "admin:users"
  | "admin:email-templates"
  | "admin:audit-log";

const DASHBOARD_VIEWS: Record<Role, View> = {
  employee: "employee:dashboard",
  hr: "hr:dashboard",
  admin: "admin:dashboard",
};

interface WorkHiveState {
  currentUser: SystemUser | null;
  view: View;
  selectedJobId: string | null;
  selectedEmployeeId: string | null;
  selectedApplicantId: string | null;
  selectedInterviewApplicantId: string | null;
  sidebarCollapsed: boolean;
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveCredits: LeaveCredits[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  setHolidays: (holidays: Holiday[]) => void;
  jobPostings: JobPosting[];
  applicants: Applicant[];
  users: SystemUser[];
  emailTemplates: EmailTemplate[];
  featureToggles: FeatureToggles;
  geofenceZones: GeofenceZone[];
  auditLog: AuditLogEntry[];
  notifications: NotificationItem[];
  setAuthenticatedUser: (user: SystemUser) => void;
  hydrateSession: (user: SystemUser | null) => void;
  logout: () => Promise<void>;
  setView: (v: View) => void;
  setSelectedJobId: (id: string | null) => void;
  setSelectedEmployeeId: (id: string | null) => void;
  setSelectedApplicantId: (id: string | null) => void;
  setSelectedInterviewApplicantId: (id: string | null) => void;
  toggleSidebar: () => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  addEmployee: (emp: Employee) => void;
  bulkAddEmployees: (emps: Employee[]) => void;
  approveOvertime: (attendanceId: string, approve: boolean) => void;
  approveLeave: (requestId: string, stageIndex: number, approve: boolean, reason?: string) => void;
  fileLeave: (req: LeaveRequest) => void;
  updateLeaveCredits: (employeeId: string, patch: Partial<LeaveCredits>) => void;
  addHoliday: (h: Holiday) => void;
  updateHoliday: (id: string, patch: Partial<Holiday>) => void;
  deleteHoliday: (id: string) => void;
  addJobPosting: (j: JobPosting) => void;
  updateJobPosting: (id: string, patch: Partial<JobPosting>) => void;
  moveApplicantStage: (id: string, stage: Applicant["stage"]) => void;
  scheduleInterview: (id: string, schedule: InterviewSchedule) => void;
  rescheduleInterview: (id: string, schedule: InterviewSchedule) => void;
  saveInterviewScore: (applicantId: string, score: InterviewScore) => void;
  addApplicant: (a: Applicant) => void;
  updateUser: (id: string, patch: Partial<SystemUser>) => void;
  updateEmailTemplate: (type: EmailTemplate["type"], patch: Partial<EmailTemplate>) => void;
  setFeatureToggles: (featureToggles: FeatureToggles) => void;
  updateFeatureToggle: (key: keyof FeatureToggles, value: boolean) => void;
  addGeofenceZone: (z: GeofenceZone) => void;
  updateGeofenceZone: (id: string, patch: Partial<GeofenceZone>) => void;
  deleteGeofenceZone: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (role?: Role, employeeId?: string) => void;
}

export const useWorkHive = create<WorkHiveState>((set, get) => ({
  currentUser: null,
  view: "public:landing",
  selectedJobId: null,
  selectedEmployeeId: null,
  selectedApplicantId: null,
  selectedInterviewApplicantId: null,
  sidebarCollapsed: false,
  employees: EMPLOYEES,
  attendance: ATTENDANCE,
  leaveCredits: LEAVE_CREDITS,
  leaveRequests: LEAVE_REQUESTS,
  holidays: [],
  jobPostings: JOB_POSTINGS,
  applicants: APPLICANTS,
  users: SYSTEM_USERS,
  emailTemplates: EMAIL_TEMPLATES,
  featureToggles: FEATURE_TOGGLES,
  geofenceZones: GEOFENCE_ZONES,
  auditLog: AUDIT_LOG,
  notifications: NOTIFICATIONS,

  setHolidays: (holidays) => set({ holidays }),

  setAuthenticatedUser: (user) => {
    set({ currentUser: user, view: DASHBOARD_VIEWS[user.role] });
  },

  hydrateSession: (user) => {
    if (!user) {
      set((state) => ({
        currentUser: null,
        view: state.currentUser ? "public:landing" : state.view,
      }));
      return;
    }

    set((state) => ({
      currentUser: user,
      view: state.view.startsWith("public:") ? DASHBOARD_VIEWS[user.role] : state.view,
    }));
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } finally {
      set({ currentUser: null, view: "public:landing" });
    }
  },

  setView: (v) => set({ view: v }),
  setSelectedJobId: (id) => set({ selectedJobId: id }),
  setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),
  setSelectedApplicantId: (id) => set({ selectedApplicantId: id }),
  setSelectedInterviewApplicantId: (id) => set({ selectedInterviewApplicantId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  updateEmployee: (id, patch) =>
    set((s) => ({
      employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  addEmployee: (emp) => set((s) => ({ employees: [...s.employees, emp] })),
  bulkAddEmployees: (emps) => set((s) => ({ employees: [...s.employees, ...emps] })),

  approveOvertime: (attendanceId, approve) =>
    set((s) => ({
      attendance: s.attendance.map((a) =>
        a.id === attendanceId ? { ...a, overtimeStatus: approve ? "Approved" : "Rejected" } : a,
      ),
      auditLog: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
          user: get().currentUser?.name ?? "System",
          action: approve ? "Approve Overtime" : "Reject Overtime",
          category: "Attendance",
          detail: `${approve ? "Approved" : "Rejected"} overtime for attendance ${attendanceId}`,
        },
        ...s.auditLog,
      ],
    })),

  approveLeave: (requestId, stageIndex, approve, reason) =>
    set((s) => ({
      leaveRequests: s.leaveRequests.map((r) => {
        if (r.id !== requestId) return r;
        const newStages = r.stages.map((st, idx) =>
          idx === stageIndex
            ? {
                ...st,
                status: (approve ? "Approved" : "Disapproved") as LeaveRequest["stages"][number]["status"],
                approverName: get().currentUser?.name,
                reason: reason ?? st.reason,
                dateSigned: new Date().toISOString().slice(0, 10),
              }
            : st,
        );
        const nextIndex = approve ? stageIndex + 1 : stageIndex;
        const overall: LeaveRequest["overallStatus"] = !approve
          ? "Disapproved"
          : nextIndex >= r.stages.length
            ? "Approved"
            : "Pending";
        return {
          ...r,
          stages: newStages,
          currentStageIndex: Math.min(nextIndex, r.stages.length - 1),
          overallStatus: overall,
        };
      }),
    })),

  fileLeave: (req) => set((s) => ({ leaveRequests: [req, ...s.leaveRequests] })),

  updateLeaveCredits: (employeeId, patch) =>
    set((s) => ({
      leaveCredits: s.leaveCredits.map((c) => (c.employeeId === employeeId ? { ...c, ...patch } : c)),
    })),

  addHoliday: (h) => set((s) => ({ holidays: [...s.holidays, h] })),
  updateHoliday: (id, patch) =>
    set((s) => ({
      holidays: s.holidays.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    })),
  deleteHoliday: (id) => set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),

  addJobPosting: (j) => set((s) => ({ jobPostings: [...s.jobPostings, j] })),
  updateJobPosting: (id, patch) =>
    set((s) => ({
      jobPostings: s.jobPostings.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),

  moveApplicantStage: (id, stage) =>
    set((s) => ({
      applicants: s.applicants.map((a) => (a.id === id ? { ...a, stage } : a)),
    })),

  scheduleInterview: (id, schedule) =>
    set((s) => ({
      applicants: s.applicants.map((a) => (a.id === id ? { ...a, schedule, stage: "Interview" } : a)),
    })),

  rescheduleInterview: (id, schedule) =>
    set((s) => ({
      applicants: s.applicants.map((a) =>
        a.id === id
          ? {
              ...a,
              schedule: {
                ...schedule,
                rescheduled: true,
                previousDate: a.schedule?.date,
              },
            }
          : a,
      ),
    })),

  saveInterviewScore: (applicantId, score) =>
    set((s) => ({
      applicants: s.applicants.map((a) => (a.id === applicantId ? { ...a, interviewScore: score } : a)),
    })),

  addApplicant: (a) => set((s) => ({ applicants: [...s.applicants, a] })),

  updateUser: (id, patch) =>
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    })),

  updateEmailTemplate: (type, patch) =>
    set((s) => ({
      emailTemplates: s.emailTemplates.map((t) => (t.type === type ? { ...t, ...patch } : t)),
    })),

  setFeatureToggles: (featureToggles) => set({ featureToggles }),

  updateFeatureToggle: (key, value) =>
    set((s) => ({
      featureToggles: { ...s.featureToggles, [key]: value },
    })),

  addGeofenceZone: (z) => set((s) => ({ geofenceZones: [...s.geofenceZones, z] })),
  updateGeofenceZone: (id, patch) =>
    set((s) => ({
      geofenceZones: s.geofenceZones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    })),
  deleteGeofenceZone: (id) => set((s) => ({ geofenceZones: s.geofenceZones.filter((z) => z.id !== id) })),

  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllNotificationsRead: (role, employeeId) =>
    set((s) => ({
      notifications: s.notifications.map((n) => {
        if (role && n.role !== role) return n;
        if (employeeId && n.employeeId !== employeeId) return n;
        return { ...n, read: true };
      }),
    })),
}));

export function useEmployeeById(id: string | null) {
  return useWorkHive((s) => s.employees.find((e) => e.id === id) ?? null);
}

export function useApplicantById(id: string | null) {
  return useWorkHive((s) => s.applicants.find((a) => a.id === id) ?? null);
}

export function useJobById(id: string | null) {
  return useWorkHive((s) => s.jobPostings.find((j) => j.id === id) ?? null);
}

export function getLeaveCreditsFor(credits: LeaveCredits[], type: LeaveType, employeeId: string): number {
  const c = credits.find((x) => x.employeeId === employeeId);
  if (!c) return 0;
  const map: Record<LeaveType, number> = {
    "Vacation Leave": c.vacationLeave,
    "Sick Leave": c.sickLeave,
    "Incentive Leave": c.incentiveLeave,
    "Solo Parent Leave": c.soloParent,
    "Paternity Leave": c.paternity,
    "Maternity Leave": c.maternity,
    "Leave W/O Pay": c.leaveWithoutPay,
  };
  return map[type];
}


