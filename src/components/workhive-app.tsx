"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { getFallbackViewForRole, isViewEnabled } from "@/lib/feature-access";
import { AppShell } from "@/components/app-shell";
import { useFeatureToggles } from "@/hooks/use-feature-toggles";
import { useHolidayRecords } from "@/hooks/use-holidays";

// Public pages
import { LandingPage } from "@/components/pages/public/landing";
import { AboutPage } from "@/components/pages/public/about";
import { CareersPage } from "@/components/pages/public/careers";
import { PrivacyPage } from "@/components/pages/public/privacy";
import { JobDetailPage } from "@/components/pages/public/job-detail";
import { LoginPage } from "@/components/pages/public/login";

// Employee portal
import { DashboardPage as EmpDashboard } from "@/components/pages/employee/dashboard";
import { ProfilePage as EmpProfile } from "@/components/pages/employee/profile";
import { AttendancePage as EmpAttendance } from "@/components/pages/employee/attendance";
import { TimeClockPage as EmpTimeClock } from "@/components/pages/employee/time-clock";
import { LeavePage as EmpLeave } from "@/components/pages/employee/leave";
import { HolidaysPage as EmpHolidays } from "@/components/pages/employee/holidays";
import { DocumentsPage as EmpDocuments } from "@/components/pages/employee/documents";
import { NotificationsPage as EmpNotifications } from "@/components/pages/employee/notifications";

// HR portal
import { DashboardPage as HrDashboard } from "@/components/pages/hr/dashboard";
import { EmployeeDetailsPage as HrEmployeeDetails } from "@/components/pages/hr/employee-details";
import { MasterListPage as HrMasterList } from "@/components/pages/hr/master-list";
import { AddEmployeePage as HrAddEmployee } from "@/components/pages/hr/add-employee";
import { LeaveManagementPage as HrLeaveManagement } from "@/components/pages/hr/leave-management";
import { LeaveSummaryPage as HrLeaveSummary } from "@/components/pages/hr/leave-summary";
import { JobPostingsPage as HrJobPostings } from "@/components/pages/hr/job-postings";
import { ApplicationsPage as HrApplications } from "@/components/pages/hr/applications";
import { InterviewSchedulingPage as HrInterviewScheduling } from "@/components/pages/hr/interview-scheduling";
import { InterviewsPage as HrInterviews } from "@/components/pages/hr/interviews";
import { VideoConferencingPage as HrVideoConferencing } from "@/components/pages/hr/video-conferencing";
import { HolidaysPage as HrHolidays } from "@/components/pages/hr/holidays";
import { ReportsPage as HrReports } from "@/components/pages/hr/reports";

// Admin portal
import { DashboardPage as AdminDashboard } from "@/components/pages/admin/dashboard";
import { SettingsPage as AdminSettings } from "@/components/pages/admin/settings";
import { FeatureTogglesPage as AdminFeatureToggles } from "@/components/pages/admin/feature-toggles";
import { GpsZonesPage as AdminGpsZones } from "@/components/pages/admin/gps-zones";
import { UsersPage as AdminUsers } from "@/components/pages/admin/users";
import { EmailTemplatesPage as AdminEmailTemplates } from "@/components/pages/admin/email-templates";
import { AuditLogPage as AdminAuditLog } from "@/components/pages/admin/audit-log";
import type { SystemUser } from "@/lib/types";

const HrAttendance = dynamic(
  () => import("@/components/pages/hr/attendance").then((module) => module.AttendancePage),
  { loading: () => null },
);
const HrAttendanceValidation = dynamic(
  () => import("@/components/pages/hr/attendance-validation").then((module) => module.AttendanceValidationPage),
  { loading: () => null },
);
const HrAttendanceSummary = dynamic(
  () => import("@/components/pages/hr/attendance-summary").then((module) => module.AttendanceSummaryPage),
  { loading: () => null },
);
const HrTardiness = dynamic(
  () => import("@/components/pages/hr/tardiness").then((module) => module.TardinessPage),
  { loading: () => null },
);

const PERSISTENT_HR_ATTENDANCE_VIEWS = [
  "hr:attendance",
  "hr:attendance-validation",
  "hr:attendance-summary",
  "hr:tardiness",
] as const satisfies readonly string[];

const persistentHrAttendanceViewCache: Array<(typeof PERSISTENT_HR_ATTENDANCE_VIEWS)[number]> = [];

function isPersistentHrAttendanceView(view: string): view is (typeof PERSISTENT_HR_ATTENDANCE_VIEWS)[number] {
  return PERSISTENT_HR_ATTENDANCE_VIEWS.includes(view as (typeof PERSISTENT_HR_ATTENDANCE_VIEWS)[number]);
}

function renderPersistentHrAttendanceView(view: (typeof PERSISTENT_HR_ATTENDANCE_VIEWS)[number]) {
  switch (view) {
    case "hr:attendance":
      return <HrAttendance />;
    case "hr:attendance-validation":
      return <HrAttendanceValidation />;
    case "hr:attendance-summary":
      return <HrAttendanceSummary />;
    case "hr:tardiness":
      return <HrTardiness />;
    default:
      return null;
  }
}

function PersistentHrAttendancePages({ activeView }: { activeView: (typeof PERSISTENT_HR_ATTENDANCE_VIEWS)[number] }) {
  if (!persistentHrAttendanceViewCache.includes(activeView)) {
    persistentHrAttendanceViewCache.push(activeView);
  }

  return (
    <>
      {persistentHrAttendanceViewCache.map((view) => (
        <div key={view} className={view === activeView ? "block" : "hidden"} aria-hidden={view !== activeView}>
          {renderPersistentHrAttendanceView(view)}
        </div>
      ))}
    </>
  );
}

export function WorkHiveApp() {
  const { currentUser, view, selectedVideoApplicantId, hydrateSession, setFeatureToggles, setHolidays, featureToggles, setView } = useWorkHive();
  const [authReady, setAuthReady] = useState(false);
  const { data: featureToggleData } = useFeatureToggles();
  const { data: holidayData } = useHolidayRecords();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (featureToggleData?.featureToggles) {
      setFeatureToggles(featureToggleData.featureToggles);
    }
  }, [featureToggleData, setFeatureToggles]);

  useEffect(() => {
    if (holidayData?.holidays) {
      setHolidays(holidayData.holidays);
    }
  }, [holidayData, setHolidays]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!isViewEnabled(view, featureToggles)) {
      setView(getFallbackViewForRole(currentUser.role, featureToggles));
    }
  }, [currentUser, featureToggles, setView, view]);

  const syncSession = useCallback(async (allowLogoutOnFailure: boolean) => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as { user: SystemUser | null };
      hydrateSession(payload.user ?? null);
    } catch {
      if (allowLogoutOnFailure) {
        hydrateSession(null);
      }
    } finally {
      if (allowLogoutOnFailure) {
        setAuthReady(true);
      }
    }
  }, [hydrateSession]);

  useEffect(() => {
    void syncSession(true);
  }, [syncSession]);

  useEffect(() => {
    if (currentUser?.role !== "hr") {
      return;
    }

    const preloadTimer = window.setTimeout(() => {
      void Promise.all([
        import("@/components/pages/hr/attendance"),
        import("@/components/pages/hr/attendance-validation"),
        import("@/components/pages/hr/attendance-summary"),
        import("@/components/pages/hr/tardiness"),
      ]);
    }, 150);

    return () => {
      window.clearTimeout(preloadTimer);
    };
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const refreshSession = () => {
      if (document.visibilityState === "visible") {
        void syncSession(false);
      }
    };

    const intervalId = window.setInterval(refreshSession, 60_000);
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", refreshSession);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", refreshSession);
    };
  }, [currentUser, syncSession]);

  if (!authReady) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!currentUser) {
    switch (view) {
      case "public:landing": return <LandingPage />;
      case "public:about": return <AboutPage />;
      case "public:careers": return <CareersPage />;
      case "public:privacy": return <PrivacyPage />;
      case "public:job-detail": return <JobDetailPage />;
      case "public:login": return <LoginPage />;
      default: return <LandingPage />;
    }
  }

  return (
    <AppShell>
      {view === "hr:video-conferencing" ? null : isPersistentHrAttendanceView(view) ? (
        <PersistentHrAttendancePages activeView={view} />
      ) : (
        renderPortalView(view)
      )}
      {currentUser.role === "hr" && (view === "hr:video-conferencing" || selectedVideoApplicantId) ? (
        <HrVideoConferencing active={view === "hr:video-conferencing"} />
      ) : null}
    </AppShell>
  );
}

function renderPortalView(view: string) {
  switch (view) {
    case "employee:dashboard": return <EmpDashboard />;
    case "employee:profile": return <EmpProfile />;
    case "employee:attendance": return <EmpAttendance />;
    case "employee:time-clock": return <EmpTimeClock />;
    case "employee:leave": return <EmpLeave />;
    case "employee:holidays": return <EmpHolidays />;
    case "employee:documents": return <EmpDocuments />;
    case "employee:notifications": return <EmpNotifications />;
    case "hr:dashboard": return <HrDashboard />;
    case "hr:employee-details": return <HrEmployeeDetails />;
    case "hr:master-list": return <HrMasterList />;
    case "hr:add-employee": return <HrAddEmployee />;
    case "hr:attendance": return <HrAttendance />;
    case "hr:attendance-validation": return <HrAttendanceValidation />;
    case "hr:attendance-summary": return <HrAttendanceSummary />;
    case "hr:tardiness": return <HrTardiness />;
    case "hr:leave-management": return <HrLeaveManagement />;
    case "hr:leave-summary": return <HrLeaveSummary />;
    case "hr:job-postings": return <HrJobPostings />;
    case "hr:applications": return <HrApplications />;
    case "hr:interview-scheduling": return <HrInterviewScheduling />;
    case "hr:interviews": return <HrInterviews />;
    case "hr:holidays": return <HrHolidays />;
    case "hr:reports": return <HrReports />;
    case "admin:dashboard": return <AdminDashboard />;
    case "admin:settings": return <AdminSettings />;
    case "admin:feature-toggles": return <AdminFeatureToggles />;
    case "admin:gps-zones": return <AdminGpsZones />;
    case "admin:users": return <AdminUsers />;
    case "admin:email-templates": return <AdminEmailTemplates />;
    case "admin:audit-log": return <AdminAuditLog />;
    default: return <EmpDashboard />;
  }
}





