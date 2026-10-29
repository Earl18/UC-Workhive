import { randomUUID } from "node:crypto";
import {
  EMPLOYEE_DOCUMENT_MAX_BYTES,
  EMPLOYEE_DOCUMENT_MAX_MB,
} from "@/lib/employee-document-config";
import {
  isAllowedEmployeeDocumentMimeType,
  uploadLeaveAttachmentToStorage,
} from "@/lib/supabase-storage";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/admin-data";
import type { AuthenticatedPortalUser } from "@/lib/auth";
import { getEmployeeMasterList, getEmployeeMasterListPage, getEmployeeMasterRecordForUser } from "@/lib/hr-data";
import type { Employee, LeaveRequest, LeaveRequestAttachment, LeaveApprovalStage, LeaveType } from "@/lib/types";
import { getAvailableLeaveTypes, isLeaveTypeApplicableToEmployee, isSummerIncentiveDepartment, LEAVE_TYPES } from "@/lib/types";

export type EmployeeLeaveCreditsSummary = {
  leaveType: LeaveType;
  maxDays: number;
  usedDays: number;
  remainingDays: number;
};

export type EmployeeLeaveDashboard = {
  employee: Employee & { birthDate?: string };
  credits: EmployeeLeaveCreditsSummary[];
  requests: LeaveRequest[];
};

export type StaffLeaveDashboard = {
  employees: Array<Employee & { birthDate?: string }>;
  requests: LeaveRequest[];
};


export type StaffLeaveSummaryRow = {
  employeeId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  department: string;
  position: string;
  employmentStatus: string;
  dateHired: string;
  gender: "Male" | "Female";
  avatarColor?: string;
  vacationLeave: number;
  sickLeave: number;
  incentiveLeave: number;
  soloParent: number;
  paternity: number;
  maternity: number;
};

export type StaffLeaveSummary = {
  departments: string[];
  rows: StaffLeaveSummaryRow[];
};

type LeaveSettings = {
  vacationLeaveDays: number;
  sickLeaveDays: number;
  incentiveLeaveDays: number;
  soloParentLeaveDays: number;
  paternityLeaveDays: number;
  maternityLeaveDays: number;
  leaveWithoutPayDays: number;
};

type CreateLeaveRequestInput = {
  leaveType: string;
  dateFrom?: string;
  dateTo?: string;
  durationType?: string;
  reason?: string;
  attachment?: File | null;
};

type UpdateLeaveRequestStageInput = {
  id?: string;
  approve?: boolean;
  reason?: string;
};

type LeaveRequestRow = {
  id: string;
  employeeId: string;
  leaveType: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  reason: string;
  dateFiled: string;
  stages: Prisma.JsonValue;
  currentStageIndex: number;
  overallStatus: string;
};

type StageRecordWithAttachment = LeaveApprovalStage & {
  attachmentDisplayName?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  attachmentStorageBucket?: string;
  attachmentStoragePath?: string;
};

const DEFAULT_STAGES: LeaveApprovalStage[] = [{ stage: "HR Approval", status: "Pending" }];
const ADVANCE_NOTICE_DAYS = 3;
const URGENT_LEAVE_TYPES = new Set<LeaveType>(["Sick Leave"]);

function isLeaveType(value: string): value is LeaveType {
  return LEAVE_TYPES.includes(value as LeaveType);
}

function employeeDisplayName(employee: { firstName: string; middleName: string; lastName: string }) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

function getLeaveLimitMap(settings: LeaveSettings): Record<LeaveType, number> {
  return {
    "Vacation Leave": settings.vacationLeaveDays,
    "Sick Leave": settings.sickLeaveDays,
    "Incentive Leave": settings.incentiveLeaveDays,
    "Solo Parent Leave": settings.soloParentLeaveDays,
    "Paternity Leave": settings.paternityLeaveDays,
    "Maternity Leave": settings.maternityLeaveDays,
    "Leave W/O Pay": Number.POSITIVE_INFINITY,
  };
}

function normalizeStages(value: Prisma.JsonValue): LeaveApprovalStage[] {
  if (!Array.isArray(value)) {
    return DEFAULT_STAGES.map((stage) => ({ ...stage }));
  }

  const parsed = value
    .map((stage) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return null;
      }

      const record = stage as Record<string, unknown>;
      const status =
        record.status === "Approved" || record.status === "Disapproved" || record.status === "Pending"
          ? record.status
          : "Pending";
      const name = record.stage === "HR Approval" ? record.stage : null;

      if (!name) {
        return null;
      }

      return {
        stage: name,
        status,
        approverName: typeof record.approverName === "string" ? record.approverName : undefined,
        reason: typeof record.reason === "string" ? record.reason : undefined,
        dateSigned: typeof record.dateSigned === "string" ? record.dateSigned : undefined,
      } satisfies LeaveApprovalStage;
    })
    .filter((stage) => stage != null);

  return parsed.length > 0 ? parsed : DEFAULT_STAGES.map((stage) => ({ ...stage }));
}

function buildLeaveAttachmentDisplayName(fileName: string, dateFiled: string) {
  const lastDot = fileName.lastIndexOf(".");
  const extension = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
  return `Leave Attachment ${dateFiled}${extension}`;
}

function extractAttachment(value: Prisma.JsonValue): LeaveRequestAttachment | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const firstStage = value[0];
  if (!firstStage || typeof firstStage !== "object" || Array.isArray(firstStage)) {
    return undefined;
  }

  const record = firstStage as Record<string, unknown>;
  const fileName = typeof record.attachmentDisplayName === "string" ? record.attachmentDisplayName : typeof record.attachmentFileName === "string" ? record.attachmentFileName : "";
  const storagePath = typeof record.attachmentStoragePath === "string" ? record.attachmentStoragePath : "";

  if (!fileName || !storagePath) {
    return undefined;
  }

  return {
    fileName,
    mimeType: typeof record.attachmentMimeType === "string" ? record.attachmentMimeType : undefined,
    sizeBytes: typeof record.attachmentSizeBytes === "number" ? record.attachmentSizeBytes : undefined,
    storageBucket: typeof record.attachmentStorageBucket === "string" ? record.attachmentStorageBucket : undefined,
    storagePath,
  };
}

function toLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveType: isLeaveType(row.leaveType) ? row.leaveType : "Vacation Leave",
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    days: row.days,
    isHalfDay: row.days === 0.5,
    reason: row.reason,
    dateFiled: row.dateFiled,
    attachment: extractAttachment(row.stages),
    stages: normalizeStages(row.stages),
    currentStageIndex: 0,
    overallStatus:
      row.overallStatus === "Approved" || row.overallStatus === "Disapproved" ? row.overallStatus : "Pending",
  };
}

function calculateDays(dateFrom: string, dateTo: string, durationType: "full-day" | "half-day" = "full-day") {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Please provide valid leave dates.");
  }

  if (end < start) {
    throw new Error("The leave end date cannot be earlier than the start date.");
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  if (durationType === "half-day") {
    if (totalDays !== 1) {
      throw new Error("Half-day leave can only be filed for a single date.");
    }

    return 0.5;
  }

  return totalDays;
}

function requiresAdvanceNotice(leaveType: LeaveType) {
  return !URGENT_LEAVE_TYPES.has(leaveType);
}

function getTodayAtMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function validateAdvanceNotice(dateFrom: string, leaveType: LeaveType) {
  if (!requiresAdvanceNotice(leaveType)) {
    return;
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const today = getTodayAtMidnight();

  if (Number.isNaN(start.getTime())) {
    throw new Error("Please provide valid leave dates.");
  }

  const diffDays = Math.floor((start.getTime() - today.getTime()) / 86400000);
  if (diffDays < ADVANCE_NOTICE_DAYS) {
    throw new Error(`Please file ${leaveType} at least ${ADVANCE_NOTICE_DAYS} days before the leave date. Only urgent leave types like Sick Leave can be filed with shorter notice.`);
  }
}
function buildCredits(settings: LeaveSettings, requests: LeaveRequest[], department?: string | null, gender?: "Male" | "Female" | null): EmployeeLeaveCreditsSummary[] {
  const limits = getLeaveLimitMap(settings);

  return getAvailableLeaveTypes(department, gender).map((leaveType) => {
    const maxDays = limits[leaveType] ?? 0;
    const usedDays = requests
      .filter((request) => request.leaveType === leaveType && request.overallStatus === "Approved")
      .reduce((sum, request) => sum + request.days, 0);

    return {
      leaveType,
      maxDays,
      usedDays,
      remainingDays: Number.isFinite(maxDays) ? Math.max(0, maxDays - usedDays) : Number.POSITIVE_INFINITY,
    };
  });
}

async function getEmployeeRequests(employeeId: string) {
  const rows = await db.leaveRequestRecord.findMany({
    where: { employeeId },
    orderBy: [{ dateFiled: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => toLeaveRequest(row as LeaveRequestRow));
}

async function getAllLeaveRequests() {
  const rows = await db.leaveRequestRecord.findMany({
    orderBy: [{ dateFiled: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => toLeaveRequest(row as LeaveRequestRow));
}


function toLeaveCreditsSummaryRow(employee: Employee & { birthDate?: string }, credits: EmployeeLeaveCreditsSummary[]): StaffLeaveSummaryRow {
  const readRemaining = (leaveType: LeaveType) => credits.find((entry) => entry.leaveType === leaveType)?.remainingDays ?? 0;

  return {
    employeeId: employee.id,
    lastName: employee.lastName,
    firstName: employee.firstName,
    middleName: employee.middleName,
    department: employee.department,
    position: employee.position,
    employmentStatus: employee.employmentStatus,
    dateHired: employee.dateHired,
    gender: employee.gender,
    avatarColor: employee.avatarColor,
    vacationLeave: readRemaining("Vacation Leave"),
    sickLeave: readRemaining("Sick Leave"),
    incentiveLeave: readRemaining("Incentive Leave"),
    soloParent: readRemaining("Solo Parent Leave"),
    paternity: readRemaining("Paternity Leave"),
    maternity: readRemaining("Maternity Leave"),
  };
}

export async function getEmployeeLeaveDashboard(user: Pick<AuthenticatedPortalUser, "employeeId" | "email">) {
  const employee = await getEmployeeMasterRecordForUser(user);
  if (!employee) {
    return null;
  }

  const [settings, requests] = await Promise.all([getSystemSettings(), getEmployeeRequests(employee.id)]);

  return {
    employee,
    requests,
    credits: buildCredits(settings, requests, employee.department, employee.gender),
  } satisfies EmployeeLeaveDashboard;
}

export async function getEmployeeLeaveRequestForUser(
  user: Pick<AuthenticatedPortalUser, "employeeId" | "email">,
  requestId: string,
) {
  const employee = await getEmployeeMasterRecordForUser(user);
  if (!employee) {
    return null;
  }

  const row = await db.leaveRequestRecord.findUnique({ where: { id: requestId } });
  if (!row || row.employeeId !== employee.id) {
    return null;
  }

  return toLeaveRequest(row as LeaveRequestRow);
}

export async function getStaffLeaveDashboard() {
  const [{ employees }, requests] = await Promise.all([getEmployeeMasterList(), getAllLeaveRequests()]);
  return {
    employees,
    requests,
  } satisfies StaffLeaveDashboard;
}


export async function getStaffLeaveSummary(department?: string) {
  const normalizedDepartment = department?.trim();
  const [{ employees }, { departments }, settings, allRequests] = await Promise.all([
    getEmployeeMasterListPage({
      department: normalizedDepartment && normalizedDepartment !== "All" ? normalizedDepartment : undefined,
      page: 1,
      pageSize: 5000,
      sortKey: "lastName",
      sortDir: "asc",
    }),
    getEmployeeMasterList(),
    getSystemSettings(),
    getAllLeaveRequests(),
  ]);

  const rows = employees.map((employee) => {
    const employeeRequests = allRequests.filter((request) => request.employeeId === employee.id);
    const credits = buildCredits(settings, employeeRequests, employee.department, employee.gender);
    return toLeaveCreditsSummaryRow(employee, credits);
  });

  return {
    departments,
    rows,
  } satisfies StaffLeaveSummary;
}

export async function getStaffLeaveRequestById(requestId: string) {
  const row = await db.leaveRequestRecord.findUnique({ where: { id: requestId } });
  return row ? toLeaveRequest(row as LeaveRequestRow) : null;
}

export async function createEmployeeLeaveRequestForUser(
  user: Pick<AuthenticatedPortalUser, "employeeId" | "email">,
  input: CreateLeaveRequestInput,
) {
  const employee = await getEmployeeMasterRecordForUser(user);
  if (!employee) {
    throw new Error("No employee record found.");
  }

  const leaveType = typeof input.leaveType === "string" ? input.leaveType.trim() : "";
  const dateFrom = typeof input.dateFrom === "string" ? input.dateFrom.trim() : "";
  const dateTo = typeof input.dateTo === "string" ? input.dateTo.trim() : "";
  const durationType = input.durationType === "half-day" ? "half-day" : "full-day";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const attachment = input.attachment instanceof File ? input.attachment : null;

  if (!isLeaveType(leaveType)) {
    throw new Error("Please select a valid leave type.");
  }

  if (!isLeaveTypeApplicableToEmployee(leaveType, { department: employee.department, gender: employee.gender })) {
    if (leaveType === "Incentive Leave") {
      throw new Error("Summer Incentive Leave is only available for the College of Nursing department.");
    }

    if (leaveType === "Paternity Leave") {
      throw new Error("Paternity Leave is only available for male employees.");
    }

    if (leaveType === "Maternity Leave") {
      throw new Error("Maternity Leave is only available for female employees.");
    }

    throw new Error("This leave type is not applicable for this employee.");
  }

  if (!dateFrom || !dateTo) {
    throw new Error("Please provide both leave dates.");
  }

  if (!reason) {
    throw new Error("Please provide a reason for your leave application.");
  }

  const days = calculateDays(dateFrom, dateTo, durationType);
  validateAdvanceNotice(dateFrom, leaveType);
  const settings = await getSystemSettings();
  const requests = await getEmployeeRequests(employee.id);
  const credits = buildCredits(settings, requests, employee.department, employee.gender);
  const credit = credits.find((item) => item.leaveType === leaveType);

  if (!credit) {
    throw new Error("Unable to determine the leave balance for this leave type.");
  }

  if (Number.isFinite(credit.remainingDays) && days > credit.remainingDays) {
    throw new Error(`Only ${credit.remainingDays} day${credit.remainingDays === 1 ? "" : "s"} remaining for ${leaveType}.`);
  }
  const today = new Date().toISOString().slice(0, 10);

  let attachmentMetadata: LeaveRequestAttachment | undefined;
  if (attachment) {
    if (attachment.size <= 0) {
      throw new Error("The selected attachment is empty.");
    }

    if (attachment.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
      throw new Error(`Each attachment must be ${EMPLOYEE_DOCUMENT_MAX_MB} MB or smaller.`);
    }

    if (!isAllowedEmployeeDocumentMimeType(attachment.type)) {
      throw new Error("Only PDF, JPG, JPEG, and PNG files are allowed for leave attachments.");
    }

    const storage = await uploadLeaveAttachmentToStorage({
      employeeName: employeeDisplayName(employee),
      file: attachment,
    });

    attachmentMetadata = {
      fileName: buildLeaveAttachmentDisplayName(attachment.name, today),
      mimeType: attachment.type,
      sizeBytes: attachment.size,
      storageBucket: storage.bucket,
      storagePath: storage.objectPath,
    };
  }
  const stagePayload: StageRecordWithAttachment = {
    ...DEFAULT_STAGES[0],
    attachmentDisplayName: attachmentMetadata?.fileName,
    attachmentFileName: attachment?.name,
    attachmentMimeType: attachmentMetadata?.mimeType,
    attachmentSizeBytes: attachmentMetadata?.sizeBytes,
    attachmentStorageBucket: attachmentMetadata?.storageBucket,
    attachmentStoragePath: attachmentMetadata?.storagePath,
  };

  const created = await db.leaveRequestRecord.create({
    data: {
      id: randomUUID(),
      employeeId: employee.id,
      leaveType,
      dateFrom,
      dateTo,
      days,
      reason,
      dateFiled: today,
      stages: [stagePayload] as unknown as Prisma.InputJsonValue,
      currentStageIndex: 0,
      overallStatus: "Pending",
    },
  });

  return toLeaveRequest(created as LeaveRequestRow);
}

export async function updateLeaveRequestStageForStaff(
  user: Pick<AuthenticatedPortalUser, "name" | "email">,
  input: UpdateLeaveRequestStageInput,
) {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const approve = input.approve === true;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (!id) {
    throw new Error("Leave request id is required.");
  }

  const existing = await db.leaveRequestRecord.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Leave request not found.");
  }

  const request = toLeaveRequest(existing as LeaveRequestRow);
  if (request.overallStatus !== "Pending") {
    throw new Error("This leave request has already been finalized.");
  }

  const rawStages = Array.isArray(existing.stages) ? (existing.stages as unknown as StageRecordWithAttachment[]) : [];
  const persistedAttachment = rawStages[0]
    ? {
        attachmentDisplayName: rawStages[0].attachmentDisplayName,
        attachmentFileName: rawStages[0].attachmentFileName,
        attachmentMimeType: rawStages[0].attachmentMimeType,
        attachmentSizeBytes: rawStages[0].attachmentSizeBytes,
        attachmentStorageBucket: rawStages[0].attachmentStorageBucket,
        attachmentStoragePath: rawStages[0].attachmentStoragePath,
      }
    : {};

  const stages: StageRecordWithAttachment[] = [
    {
      ...DEFAULT_STAGES[0],
      ...persistedAttachment,
      status: approve ? "Approved" : "Disapproved",
      approverName: user.name?.trim() || user.email,
      reason: reason || undefined,
      dateSigned: new Date().toISOString().slice(0, 10),
    },
  ];

  let overallStatus: LeaveRequest["overallStatus"] = "Pending";

  if (!approve) {
    overallStatus = "Disapproved";
  } else {
    const [settings, employeeRequests, employeeRecord] = await Promise.all([
      getSystemSettings(),
      getEmployeeRequests(request.employeeId),
      db.employeeRecord.findUnique({ where: { id: request.employeeId }, select: { department: true, gender: true } }),
    ]);
    const credits = buildCredits(settings, employeeRequests, employeeRecord?.department, employeeRecord?.gender as "Male" | "Female" | null | undefined);
    const credit = credits.find((item) => item.leaveType === request.leaveType);

    if (!credit) {
      throw new Error("Unable to determine the leave balance for this leave type.");
    }

    if (Number.isFinite(credit.remainingDays) && request.days > credit.remainingDays) {
      throw new Error(`Only ${credit.remainingDays} day${credit.remainingDays === 1 ? "" : "s"} remaining for ${request.leaveType}.`);
    }

    overallStatus = "Approved";
  }

  const updated = await db.leaveRequestRecord.update({
    where: { id },
    data: {
      stages: stages as unknown as Prisma.InputJsonValue,
      currentStageIndex: 0,
      overallStatus,
    },
  });

  return toLeaveRequest(updated as LeaveRequestRow);
}







