import { db } from "@/lib/db";
import { getSubmittedApplicants } from "@/lib/application-data";
import { getEmployeeMasterRecordForUser } from "@/lib/hr-data";
import type { AuthenticatedPortalUser } from "@/lib/auth";
import type { PortalNotification } from "@/lib/portal-notifications";

type NotificationWithoutRead = Omit<PortalNotification, "read">;

function employeeName(employee: { firstName: string; lastName: string }) {
  return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
}

function applicantName(applicant: { fullName?: string; name?: string }) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

function ownsInterview(user: AuthenticatedPortalUser, schedule: { moderatorUserId?: string; createdBy?: string; panel?: string[] }) {
  return schedule.moderatorUserId
    ? schedule.moderatorUserId === user.id
    : schedule.createdBy === user.name || schedule.panel?.[0] === user.name;
}

export async function listPortalNotifications(user: AuthenticatedPortalUser): Promise<NotificationWithoutRead[]> {
  const items: NotificationWithoutRead[] = [];

  if (user.role === "hr") {
    const [leaveRequests, overtimeRecords, validationRecords, applicants] = await Promise.all([
      db.leaveRequestRecord.findMany({
        where: { overallStatus: "Pending" },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.attendanceLog.findMany({
        where: { overtimeStatus: "Pending", deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.attendanceLog.findMany({
        where: { requiresValidation: true, validationStatus: "Pending", deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      getSubmittedApplicants(),
    ]);

    for (const request of leaveRequests) {
      items.push({
        id: "hr-leave:" + request.id,
        title: "Leave approval needed",
        message: employeeName(request.employee) + " filed " + request.leaveType + " leave for " + request.dateFrom + ".",
        timestamp: request.updatedAt.toISOString(),
        type: "leave",
        view: "hr:leave-management",
        targetId: request.id,
      });
    }
    for (const record of overtimeRecords) {
      items.push({
        id: "hr-overtime:" + record.id,
        title: "Overtime approval needed",
        message: record.sourceEmployeeName + " has " + (record.overtimeMinutes / 60).toFixed(1) + " overtime hours awaiting review.",
        timestamp: record.updatedAt.toISOString(),
        type: "overtime",
        view: "hr:attendance",
        targetId: record.id,
      });
    }
    for (const record of validationRecords) {
      items.push({
        id: "hr-attendance:" + record.id,
        title: "Attendance needs validation",
        message: record.sourceEmployeeName + " has an attendance record that needs review.",
        timestamp: record.updatedAt.toISOString(),
        type: "attendance",
        view: "hr:attendance-validation",
        targetId: record.id,
      });
    }
    for (const applicant of applicants) {
      if (applicant.stage === "New") {
        items.push({
          id: "hr-application:" + applicant.id,
          title: "New job application",
          message: applicantName(applicant) + " applied for " + (applicant.positionApplied ?? "a position") + ".",
          timestamp: applicant.submittedAt ?? applicant.appliedDate ?? "",
          type: "recruitment",
          view: "hr:applications",
          targetId: applicant.id,
        });
      }
      if (!applicant.schedule || !ownsInterview(user, applicant.schedule)) continue;
      if (applicant.schedule.status === "Done" && applicant.interviewEvaluation?.status === "submitted") {
        items.push({
          id: "hr-interview-result:" + applicant.id + ":" + applicant.interviewEvaluation.updatedAt,
          title: "Interview result ready",
          message: "Review the submitted report for " + applicantName(applicant) + ".",
          timestamp: applicant.interviewEvaluation.updatedAt,
          type: "interview",
          view: "hr:interviews",
          targetId: applicant.id,
        });
      } else if (applicant.interviewEvaluation?.status === "draft") {
        items.push({
          id: "hr-interview-draft:" + applicant.id + ":" + applicant.interviewEvaluation.updatedAt,
          title: "Interview report draft saved",
          message: "Continue the draft report for " + applicantName(applicant) + ".",
          timestamp: applicant.interviewEvaluation.updatedAt,
          type: "interview",
          view: "hr:interviews",
          targetId: applicant.id,
        });
      } else if (applicant.schedule.status !== "Done") {
        items.push({
          id: "hr-interview:" + applicant.id + ":" + applicant.schedule.date,
          title: "Interview scheduled",
          message: applicantName(applicant) + " is scheduled for " + applicant.schedule.date + " at " + (applicant.schedule.startTime ?? applicant.schedule.time) + ".",
          timestamp: applicant.schedule.date + "T00:00:00",
          type: "interview",
          view: applicant.schedule.mode === "Online" ? "hr:video-conferencing" : "hr:interview-scheduling",
          targetId: applicant.id,
        });
      }
    }
  } else if (user.role === "employee") {
    const employee = await getEmployeeMasterRecordForUser(user);
    if (employee) {
      const [leaveRequests, attendanceRecords, holidays] = await Promise.all([
        db.leaveRequestRecord.findMany({ where: { employeeId: employee.id }, orderBy: { updatedAt: "desc" }, take: 25 }),
        db.attendanceLog.findMany({
          where: { employeeId: employee.id, overtimeStatus: { in: ["Approved", "Rejected"] }, deletedAt: null },
          orderBy: { overtimeDecisionAt: "desc" },
          take: 15,
        }),
        db.holidayRecord.findMany({ orderBy: { date: "asc" }, take: 200 }),
      ]);
      for (const request of leaveRequests) {
        items.push({
          id: "employee-leave:" + request.id + ":" + request.overallStatus + ":" + request.updatedAt.toISOString(),
          title: request.overallStatus === "Pending" ? "Leave request pending" : "Leave request " + request.overallStatus.toLowerCase(),
          message: request.leaveType + " leave from " + request.dateFrom + " to " + request.dateTo + ".",
          timestamp: request.updatedAt.toISOString(),
          type: "leave",
          view: "employee:leave",
          targetId: request.id,
        });
      }
      for (const record of attendanceRecords) {
        items.push({
          id: "employee-overtime:" + record.id + ":" + record.overtimeStatus,
          title: "Overtime " + record.overtimeStatus.toLowerCase(),
          message: "Your overtime for " + record.workDate.toISOString().slice(0, 10) + " was " + record.overtimeStatus.toLowerCase() + ".",
          timestamp: (record.overtimeDecisionAt ?? record.updatedAt).toISOString(),
          type: "overtime",
          view: "employee:attendance",
          targetId: record.id,
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      for (const holiday of holidays.filter((item) => item.date >= today && item.date <= end).slice(0, 5)) {
        items.push({
          id: "employee-holiday:" + holiday.id + ":" + holiday.date,
          title: "Upcoming holiday",
          message: holiday.name + " is on " + holiday.date + ".",
          timestamp: holiday.createdAt.toISOString(),
          type: "holiday",
          view: "employee:holidays",
          targetId: holiday.id,
        });
      }
    }
  } else if (user.role === "admin") {
    const auditEntries = await db.auditLog.findMany({
      where: { category: { in: ["System", "Employee", "Auth"] } },
      orderBy: { timestamp: "desc" },
      take: 25,
    });
    for (const entry of auditEntries) {
      const action = entry.action.toLowerCase();
      items.push({
        id: "admin-audit:" + entry.id,
        title: entry.action,
        message: entry.detail,
        timestamp: entry.timestamp.toISOString(),
        type: "system",
        view: action.includes("geofence") || action.includes("gps") ? "admin:gps-zones"
          : action.includes("user") || action.includes("account") || entry.category === "Employee" ? "admin:users"
            : entry.category === "Auth" ? "admin:audit-log" : "admin:settings",
        targetId: entry.id,
      });
    }
  }

  return items
    .filter((item) => item.timestamp && !Number.isNaN(Date.parse(item.timestamp)))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 80);
}
