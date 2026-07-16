import type {
  AuditLogEntry,
  EmailTemplate,
  FeatureToggles,
  GeofenceZone,
  SystemUser,
} from "@/lib/types";
import type { AdminDashboardSummary, SystemSettingsHealth, SystemSettingsRecord } from "@/lib/admin-types";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const AUDIT_CATEGORY_COLORS: Record<string, string> = {
  Auth: "#1d4ed8",
  Employee: "#0e7490",
  Attendance: "#ca8a04",
  Leave: "#7c3aed",
  Recruitment: "#16a34a",
  System: "#6b7280",
};

const DEFAULT_SETTINGS: SystemSettingsRecord = {
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

const DEFAULT_TOGGLES: FeatureToggles = {
  manualAttendance: true,
  qrAttendance: true,
  leaveModule: true,
  recruitmentModule: true,
  gpsAttendance: false,
  overtimeModule: true,
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    type: "Leave Approved",
    subject: "Your Leave Application Has Been Approved",
    body: "Dear [Employee Name],\n\nWe are pleased to inform you that your [Leave Type] application from [Date From] to [Date To] has been approved.\n\nPlease ensure proper turnover of your duties before your leave begins.\n\nThank you,\nUC South Campus - Human Resource Department",
  },
  {
    type: "Leave Rejected",
    subject: "Update on Your Leave Application",
    body: "Dear [Employee Name],\n\nYour [Leave Type] application from [Date From] to [Date To] was not approved.\n\nReason: [Reason]\n\nIf you have questions, please contact the HR Office.\n\nUC South Campus - Human Resource Department",
  },
  {
    type: "Job Application Received",
    subject: "Application Received - [Position]",
    body: "Dear [Applicant Name],\n\nThank you for applying for the [Position] position at University of Cebu - South Campus. We have received your application and will review it shortly.\n\nYou will hear from us within 5 to 7 business days.\n\nUC South Campus - HR Recruitment",
  },
  {
    type: "Interview Invitation",
    subject: "Interview Invitation - [Position]",
    body: "Dear [Applicant Name],\n\nYou have been shortlisted for the [Position] position. Your interview is scheduled on:\n\nDate: [Date]\nTime: [Time]\nPlatform: [Platform]\n[Location/Link]\n\nPlease confirm your attendance.\n\nUC South Campus - HR Recruitment",
  },
  {
    type: "Interview Rescheduled",
    subject: "Interview Rescheduled - [Position]",
    body: "Dear [Applicant Name],\n\nYour interview for the [Position] position has been rescheduled to:\n\nDate: [New Date]\nTime: [New Time]\nPlatform: [Platform]\n\nWe apologize for any inconvenience.\n\nUC South Campus - HR Recruitment",
  },
  {
    type: "Overtime Approved",
    subject: "Overtime Request Approved",
    body: "Dear [Employee Name],\n\nYour overtime request for [Date] ([Hours] hrs) has been approved and will be reflected in your attendance records.\n\nUC South Campus - HR Department",
  },
  {
    type: "Overtime Rejected",
    subject: "Overtime Request Update",
    body: "Dear [Employee Name],\n\nYour overtime request for [Date] was not approved.\n\nReason: [Reason]\n\nUC South Campus - HR Department",
  },
  {
    type: "Upcoming Holiday Reminder",
    subject: "Upcoming Holiday Reminder: [Holiday Name]",
    body: "Dear [Employee Name],\n\nThis is a reminder that [Holiday Name] on [Date] is a [Holiday Type]. No classes or work on this day.\n\nPlease plan accordingly.\n\nUC South Campus - HR Department",
  },
  {
    type: "Welcome Email",
    subject: "Welcome to UC South Campus!",
    body: "Dear [Employee Name],\n\nWelcome to the WorkHive family at University of Cebu - South Campus. Your account has been created.\n\nLogin at workhive.uc.edu.ph using your registered email address.\n\nUC South Campus - HR Department",
  },
  {
    type: "Password Reset",
    subject: "Password Reset Request",
    body: "Dear [User],\n\nWe received a request to reset your WorkHive password. Click the link below to proceed:\n\n[Reset Link]\n\nIf you did not request this, please ignore this email.\n\nUC South Campus - IT Department",
  },
];

const ADMIN_SETTINGS_TABLE = "SystemSettings";
const ADMIN_SCHEMA_TABLES = [
  "SystemSettings",
  "FeatureToggleConfig",
  "EmailTemplateRecord",
  "GeofenceZone",
  "AuditLog",
] as const;
const ADMIN_SCHEMA_CACHE_TTL_MS = 30_000;
const DASHBOARD_SUMMARY_CACHE_TTL_MS = 15_000;
const API_LATENCY_CACHE_TTL_MS = 30_000;
const SETTINGS_VALUE_CACHE_TTL_MS = 15_000;

let settingsTableCache: { checkedAt: number; available: boolean } | null = null;
let adminSchemaCache: { checkedAt: number; available: boolean } | null = null;
let dashboardSummaryCache: { checkedAt: number; summary: AdminDashboardSummary } | null = null;
let apiLatencyCache: { checkedAt: number; avgMs: number; label: string } | null = null;
let systemSettingsValueCache: { checkedAt: number; value: SystemSettingsRecord } | null = null;
let featureTogglesValueCache: { checkedAt: number; value: FeatureToggles } | null = null;

function isMissingTableError(error: unknown, tableName?: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (!tableName || String(error.meta?.table ?? "").includes(tableName))
  );
}

function isMissingColumnError(error: unknown, columnName?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2010") {
    return false;
  }

  const meta = error.meta as { code?: string; message?: string } | undefined;
  return meta?.code === "42703" && (!columnName || String(meta.message ?? "").includes(columnName));
}

async function hasTable(tableName: string) {
  const cache = tableName === ADMIN_SETTINGS_TABLE ? settingsTableCache : adminSchemaCache;
  if (cache && Date.now() - cache.checkedAt < ADMIN_SCHEMA_CACHE_TTL_MS) {
    return cache.available;
  }

  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS present`,
      tableName,
    )) as Array<{ present: boolean }>;

    const available = Boolean(rows[0]?.present);
    const nextCache = { checkedAt: Date.now(), available };
    if (tableName === ADMIN_SETTINGS_TABLE) {
      settingsTableCache = nextCache;
    } else {
      adminSchemaCache = nextCache;
    }
    return available;
  } catch {
    const nextCache = { checkedAt: Date.now(), available: false };
    if (tableName === ADMIN_SETTINGS_TABLE) {
      settingsTableCache = nextCache;
    } else {
      adminSchemaCache = nextCache;
    }
    return false;
  }
}

async function hasAdminSchema() {
  if (adminSchemaCache && Date.now() - adminSchemaCache.checkedAt < ADMIN_SCHEMA_CACHE_TTL_MS) {
    return adminSchemaCache.available;
  }

  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1)`,
      ADMIN_SCHEMA_TABLES,
    )) as Array<{ count: number }>;

    const available = Number(rows[0]?.count ?? 0) >= ADMIN_SCHEMA_TABLES.length;
    adminSchemaCache = { checkedAt: Date.now(), available };
    return available;
  } catch {
    adminSchemaCache = { checkedAt: Date.now(), available: false };
    return false;
  }
}

async function ensureSystemSettingsSeed() {
  if (!(await hasTable(ADMIN_SETTINGS_TABLE))) {
    return false;
  }

  try {
    await db.systemSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", ...DEFAULT_SETTINGS },
    });
    settingsTableCache = { checkedAt: Date.now(), available: true };
    return true;
  } catch (error) {
    if (isMissingTableError(error, ADMIN_SETTINGS_TABLE)) {
      settingsTableCache = { checkedAt: Date.now(), available: false };
      return false;
    }
    throw error;
  }
}

async function ensureFeatureToggleSeed() {
  if (!(await hasAdminSchema())) {
    return false;
  }

  try {
    await db.featureToggleConfig.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", ...DEFAULT_TOGGLES },
    });
    return true;
  } catch (error) {
    if (isMissingTableError(error)) {
      adminSchemaCache = { checkedAt: Date.now(), available: false };
      return false;
    }
    throw error;
  }
}

async function ensureEmailTemplateSeed() {
  if (!(await hasAdminSchema())) {
    return false;
  }

  try {
    const existingCount = await db.emailTemplateRecord.count();
    if (existingCount === 0) {
      await db.emailTemplateRecord.createMany({
        data: DEFAULT_EMAIL_TEMPLATES.map((template) => ({
          type: template.type,
          subject: template.subject,
          body: template.body,
        })),
      });
    }
    return true;
  } catch (error) {
    if (isMissingTableError(error)) {
      adminSchemaCache = { checkedAt: Date.now(), available: false };
      return false;
    }
    throw error;
  }
}

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function timed<T>(fn: () => Promise<T>) {
  const startedAt = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - startedAt };
}async function measureCoreApiLatencyBenchmark(onlineThreshold: Date) {
  if (apiLatencyCache && Date.now() - apiLatencyCache.checkedAt < API_LATENCY_CACHE_TTL_MS) {
    return apiLatencyCache;
  }

  const benchmarks = [
    () => getSystemSettings(),
    () => getFeatureToggles(),
    () => db.user.count(),
    () => db.emailTemplateRecord.count(),
    () => db.geofenceZone.count(),
    () => db.auditLog.count(),
    () => Promise.all([
      db.geofenceZone.count(),
      db.userLocationStatus.count(),
      db.user.count({ where: { lastLogin: { gte: onlineThreshold } } }),
    ]),
  ];

  const warmDurations: number[] = [];
  for (const benchmark of benchmarks) {
    await timed(benchmark);
    const warmRun = await timed(benchmark);
    warmDurations.push(warmRun.durationMs);
  }

  const avgMs = Math.round(warmDurations.reduce((sum, value) => sum + value, 0) / warmDurations.length);
  const payload = {
    checkedAt: Date.now(),
    avgMs,
    label: `avg core APIs (${benchmarks.length})`,
  };
  apiLatencyCache = payload;
  return payload;
}

export function toSystemUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: string;
  employeeId: string | null;
  department?: string | null;
  active: boolean;
  lastLogin: Date | null;
}): SystemUser {
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.role as SystemUser["role"],
    employeeId: user.employeeId ?? undefined,
    department: user.department ?? undefined,
    active: user.active,
    lastLogin: formatTimestamp(user.lastLogin) || undefined,
  };
}

function toAuditLogEntry(entry: {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  category: string;
  detail: string;
}): AuditLogEntry {
  return {
    id: entry.id,
    timestamp: formatTimestamp(entry.timestamp),
    user: entry.user,
    action: entry.action,
    category: entry.category as AuditLogEntry["category"],
    detail: entry.detail,
  };
}

export async function ensureAdminSeedData() {
  const [settingsReady, togglesReady, templatesReady] = await Promise.all([
    ensureSystemSettingsSeed(),
    ensureFeatureToggleSeed(),
    ensureEmailTemplateSeed(),
  ]);

  return settingsReady || togglesReady || templatesReady;
}

export async function logAuditEvent(input: {
  user: string;
  action: string;
  category: AuditLogEntry["category"];
  detail: string;
}) {
  return db.auditLog.create({
    data: {
      user: input.user,
      action: input.action,
      category: input.category,
      detail: input.detail,
    },
  });
}

type SystemSettingsRow = {
  organizationName: string;
  campusAddress: string;
  campusLandmark: string | null;
  campusPlaceId: string | null;
  contactNumber: string;
  hrEmail: string;
  academicYear: string;
  currentSemester: string;
  gracePeriod: number;
  tardinessThreshold: number;
  holidayReminderLead: number;
  vacationLeaveDays: number;
  sickLeaveDays: number;
  incentiveLeaveDays: number;
  soloParentLeaveDays: number;
  paternityLeaveDays: number;
  maternityLeaveDays: number;
  leaveWithoutPayDays: number;
  employeeDefaultPassword: string;
  hrDefaultPassword: string;
  adminDefaultPassword: string;
  employeePasswordVersion: number;
  hrPasswordVersion: number;
  adminPasswordVersion: number;
  updatedAt: Date;
};

export async function getSystemSettings(): Promise<SystemSettingsRecord> {
  if (systemSettingsValueCache && Date.now() - systemSettingsValueCache.checkedAt < SETTINGS_VALUE_CACHE_TTL_MS) {
    return systemSettingsValueCache.value;
  }

  try {
    const settings = await db.systemSettings.findUnique({ where: { id: "default" } });
    const value = settings
      ? {
          organizationName: settings.organizationName,
          campusAddress: settings.campusAddress,
          campusLandmark: settings.campusLandmark ?? "",
          campusPlaceId: settings.campusPlaceId ?? "",
          contactNumber: settings.contactNumber,
          hrEmail: settings.hrEmail,
          academicYear: settings.academicYear,
          currentSemester: settings.currentSemester,
          gracePeriod: settings.gracePeriod,
          tardinessThreshold: settings.tardinessThreshold,
          holidayReminderLead: settings.holidayReminderLead,
          vacationLeaveDays: settings.vacationLeaveDays,
          sickLeaveDays: settings.sickLeaveDays,
          incentiveLeaveDays: settings.incentiveLeaveDays,
          soloParentLeaveDays: settings.soloParentLeaveDays,
          paternityLeaveDays: settings.paternityLeaveDays,
          maternityLeaveDays: settings.maternityLeaveDays,
          leaveWithoutPayDays: settings.leaveWithoutPayDays,
          employeeDefaultPassword: settings.employeeDefaultPassword,
          hrDefaultPassword: settings.hrDefaultPassword,
          adminDefaultPassword: settings.adminDefaultPassword,
          updatedAt: formatTimestamp(settings.updatedAt),
        }
      : (() => {
          systemSettingsValueCache = { checkedAt: Date.now(), value: { ...DEFAULT_SETTINGS } };
          return { ...DEFAULT_SETTINGS };
        })();

    if (settings) {
      systemSettingsValueCache = { checkedAt: Date.now(), value };
      return value;
    }

    const created = await db.systemSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", ...DEFAULT_SETTINGS },
    });

    const seededValue = {
      organizationName: created.organizationName,
      campusAddress: created.campusAddress,
      campusLandmark: created.campusLandmark ?? "",
      campusPlaceId: created.campusPlaceId ?? "",
      contactNumber: created.contactNumber,
      hrEmail: created.hrEmail,
      academicYear: created.academicYear,
      currentSemester: created.currentSemester,
      gracePeriod: created.gracePeriod,
      tardinessThreshold: created.tardinessThreshold,
      holidayReminderLead: created.holidayReminderLead,
      vacationLeaveDays: created.vacationLeaveDays,
      sickLeaveDays: created.sickLeaveDays,
      incentiveLeaveDays: created.incentiveLeaveDays,
      soloParentLeaveDays: created.soloParentLeaveDays,
      paternityLeaveDays: created.paternityLeaveDays,
      maternityLeaveDays: created.maternityLeaveDays,
      leaveWithoutPayDays: created.leaveWithoutPayDays,
      employeeDefaultPassword: created.employeeDefaultPassword,
      hrDefaultPassword: created.hrDefaultPassword,
      adminDefaultPassword: created.adminDefaultPassword,
      updatedAt: formatTimestamp(created.updatedAt),
    };

    systemSettingsValueCache = { checkedAt: Date.now(), value: seededValue };
    return seededValue;
  } catch (error) {
    if (isMissingTableError(error, ADMIN_SETTINGS_TABLE)) {
      settingsTableCache = { checkedAt: Date.now(), available: false };
      return { ...DEFAULT_SETTINGS };
    }

    if (isMissingColumnError(error, "campusLandmark") || isMissingColumnError(error, "campusPlaceId")) {
      const settings = await db.systemSettings.findUnique({ where: { id: "default" } });
      if (!settings) {
        return { ...DEFAULT_SETTINGS };
      }

      const fallbackValue = {
        organizationName: settings.organizationName,
        campusAddress: settings.campusAddress,
        campusLandmark: "",
        campusPlaceId: "",
        contactNumber: settings.contactNumber,
        hrEmail: settings.hrEmail,
        academicYear: settings.academicYear,
        currentSemester: settings.currentSemester,
        gracePeriod: settings.gracePeriod,
        tardinessThreshold: settings.tardinessThreshold,
        holidayReminderLead: settings.holidayReminderLead,
        vacationLeaveDays: DEFAULT_SETTINGS.vacationLeaveDays,
        sickLeaveDays: DEFAULT_SETTINGS.sickLeaveDays,
        incentiveLeaveDays: DEFAULT_SETTINGS.incentiveLeaveDays,
        soloParentLeaveDays: DEFAULT_SETTINGS.soloParentLeaveDays,
        paternityLeaveDays: DEFAULT_SETTINGS.paternityLeaveDays,
        maternityLeaveDays: DEFAULT_SETTINGS.maternityLeaveDays,
        leaveWithoutPayDays: DEFAULT_SETTINGS.leaveWithoutPayDays,
        employeeDefaultPassword: DEFAULT_SETTINGS.employeeDefaultPassword,
        hrDefaultPassword: DEFAULT_SETTINGS.hrDefaultPassword,
        adminDefaultPassword: DEFAULT_SETTINGS.adminDefaultPassword,
        updatedAt: formatTimestamp(settings.updatedAt),
      };

      systemSettingsValueCache = { checkedAt: Date.now(), value: fallbackValue };
      return fallbackValue;
    }

    throw error;
  }
}

export async function getSystemSettingsHealth(): Promise<SystemSettingsHealth> {
  let databaseConnected = false;

  try {
    await db.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  return {
    schemaMigrated: databaseConnected ? await hasTable(ADMIN_SETTINGS_TABLE) : false,
    databaseConnected,
  };
}

export async function getFeatureToggles(): Promise<FeatureToggles> {
  if (featureTogglesValueCache && Date.now() - featureTogglesValueCache.checkedAt < SETTINGS_VALUE_CACHE_TTL_MS) {
    return featureTogglesValueCache.value;
  }

  try {
    const toggles = await db.featureToggleConfig.findUnique({ where: { id: "default" } });
    if (toggles) {
      const value = {
        manualAttendance: toggles.manualAttendance,
        qrAttendance: toggles.qrAttendance,
        leaveModule: toggles.leaveModule,
        recruitmentModule: toggles.recruitmentModule,
        gpsAttendance: toggles.gpsAttendance,
        overtimeModule: toggles.overtimeModule,
      };
      featureTogglesValueCache = { checkedAt: Date.now(), value };
      return value;
    }

    const created = await db.featureToggleConfig.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", ...DEFAULT_TOGGLES },
    });

    const seededValue = {
      manualAttendance: created.manualAttendance,
      qrAttendance: created.qrAttendance,
      leaveModule: created.leaveModule,
      recruitmentModule: created.recruitmentModule,
      gpsAttendance: created.gpsAttendance,
      overtimeModule: created.overtimeModule,
    };
    featureTogglesValueCache = { checkedAt: Date.now(), value: seededValue };
    return seededValue;
  } catch (error) {
    if (isMissingTableError(error)) {
      adminSchemaCache = { checkedAt: Date.now(), available: false };
      return { ...DEFAULT_TOGGLES };
    }
    throw error;
  }
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const seeded = await ensureEmailTemplateSeed();
  if (!seeded) {
    return DEFAULT_EMAIL_TEMPLATES.map((template) => ({ ...template }));
  }

  const templates = await db.emailTemplateRecord.findMany({ orderBy: { type: "asc" } });
  if (templates.length === 0) {
    return DEFAULT_EMAIL_TEMPLATES.map((template) => ({ ...template }));
  }

  return templates.map((template) => ({
    type: template.type as EmailTemplate["type"],
    subject: template.subject,
    body: template.body,
  }));
}

export async function getGeofenceZones(): Promise<GeofenceZone[]> {
  if (!(await hasAdminSchema())) {
    return [];
  }

  try {
    return await db.geofenceZone.findMany({ orderBy: { createdAt: "asc" } });
  } catch (error) {
    if (isMissingTableError(error)) {
      adminSchemaCache = { checkedAt: Date.now(), available: false };
      return [];
    }
    throw error;
  }
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  if (!(await hasAdminSchema())) {
    return [];
  }

  try {
    const entries = await db.auditLog.findMany({ orderBy: { timestamp: "desc" } });
    return entries.map(toAuditLogEntry);
  } catch (error) {
    if (isMissingTableError(error)) {
      adminSchemaCache = { checkedAt: Date.now(), available: false };
      return [];
    }
    throw error;
  }
}

export async function getAdminUsers(): Promise<SystemUser[]> {
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeId: true,
      department: true,
      active: true,
      lastLogin: true,
    },
  });

  return users.map(toSystemUser);
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  if (dashboardSummaryCache && Date.now() - dashboardSummaryCache.checkedAt < DASHBOARD_SUMMARY_CACHE_TTL_MS) {
    return dashboardSummaryCache.summary;
  }

  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const onlineThreshold = new Date(now.getTime() - 30 * 60 * 1000);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);
  const emailServiceConnected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const [
    totalUsersProbe,
    activeUsersProbe,
    adminUsersProbe,
    hrUsersProbe,
    employeeUsersProbe,
    activeSessionsProbe,
    togglesProbe,
    zoneCountProbe,
    templateCountProbe,
    auditCountProbe,
    recentAuditProbe,
    auditCategoriesProbe,
    trendAuditProbe,
    auditLast30DaysProbe,
    settingsProbe,
    databaseProbe,
    locationStatusProbe,
    apiLatencyProbe,
  ] = await Promise.all([
    timed(() => db.user.count()),
    timed(() => db.user.count({ where: { active: true } })),
    timed(() => db.user.count({ where: { role: "admin" } })),
    timed(() => db.user.count({ where: { role: "hr" } })),
    timed(() => db.user.count({ where: { role: "employee" } })),
    timed(() => db.user.count({ where: { lastLogin: { gte: onlineThreshold } } })),
    timed(() => getFeatureToggles()),
    timed(() => db.geofenceZone.count()),
    timed(() => db.emailTemplateRecord.count()),
    timed(() => db.auditLog.count()),
    timed(() =>
      db.auditLog.findMany({
        take: 8,
        orderBy: { timestamp: "desc" },
      }),
    ),
    timed(() =>
      db.auditLog.groupBy({
        by: ["category"],
        _count: { _all: true },
      }),
    ),
    timed(() =>
      db.auditLog.findMany({
        where: { timestamp: { gte: fourteenDaysAgo } },
        select: { timestamp: true, category: true },
        orderBy: { timestamp: "asc" },
      }),
    ),
    timed(() =>
      db.auditLog.findMany({
        where: { timestamp: { gte: monthAgo } },
        select: { timestamp: true, action: true, detail: true },
        orderBy: { timestamp: "desc" },
      }),
    ),
    timed(() => getSystemSettings()),
    timed(() =>
      db.$queryRaw`
        SELECT
          current_database()::text AS database_name,
          pg_database_size(current_database())::bigint AS size_bytes
      `,
    ),
    timed(() => db.userLocationStatus.count()),
    timed(() => measureCoreApiLatencyBenchmark(onlineThreshold)),
  ]);

  const total = totalUsersProbe.result;
  const active = activeUsersProbe.result;
  const admins = adminUsersProbe.result;
  const hr = hrUsersProbe.result;
  const employees = employeeUsersProbe.result;
  const activeSessions = activeSessionsProbe.result;
  const toggles = togglesProbe.result;
  const zoneCount = zoneCountProbe.result;
  const templateCount = templateCountProbe.result;
  const auditCount = auditCountProbe.result;
  const settings = settingsProbe.result;
  const locationStatusCount = locationStatusProbe.result;
  const recentAudit = recentAuditProbe.result.map(toAuditLogEntry);
  const auditLast30Days = auditLast30DaysProbe.result.map((entry) => ({
    timestamp: formatTimestamp(entry.timestamp) || "",
    action: entry.action,
    detail: entry.detail,
  }));
  const trendAudit = trendAuditProbe.result.map((entry) => ({
    timestamp: formatTimestamp(entry.timestamp) || "",
    category: entry.category,
  }));
  const databaseResult = databaseProbe.result as Array<{ database_name?: string; size_bytes?: bigint | number | null }>;

  const recentFailures = auditLast30Days.filter((entry) => {
    const text = `${entry.action} ${entry.detail}`.toLowerCase();
    return text.includes("email") && (text.includes("fail") || text.includes("error") || text.includes("bounce"));
  });

  const failureDays = new Set(
    auditLast30Days
      .filter((entry) => {
        const text = `${entry.action} ${entry.detail}`.toLowerCase();
        return text.includes("fail") || text.includes("error") || text.includes("outage") || text.includes("down");
      })
      .map((entry) => entry.timestamp.slice(0, 10)),
  );

  const uptimePercentage = Number((((30 - failureDays.size) / 30) * 100).toFixed(2));

  const trendMap = new Map<string, { events: number; auth: number }>();
  for (const entry of trendAudit) {
    const key = entry.timestamp.slice(0, 10);
    const current = trendMap.get(key) ?? { events: 0, auth: 0 };
    current.events += 1;
    if (entry.category === "Auth") {
      current.auth += 1;
    }
    trendMap.set(key, current);
  }

  const trend: { label: string; events: number; auth: number }[] = [];
  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);
  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date(currentDay);
    day.setDate(day.getDate() - index);
    const key = getDateKey(day);
    const dayEntry = trendMap.get(key) ?? { events: 0, auth: 0 };
    trend.push({
      label: formatDateLabel(day),
      events: dayEntry.events,
      auth: dayEntry.auth,
    });
  }

  const averageResponseMs = apiLatencyProbe.result.avgMs;
  const databaseName = databaseResult[0]?.database_name ?? "postgres";
  const databaseSizeValue = databaseResult[0]?.size_bytes;
  const databaseSizeBytes = typeof databaseSizeValue === "bigint"
    ? Number(databaseSizeValue)
    : Number(databaseSizeValue ?? 0);
  const databaseSizeMb = databaseSizeBytes > 0 ? `${(databaseSizeBytes / (1024 * 1024)).toFixed(1)} MB` : "size unavailable";

  const summary: AdminDashboardSummary = {
    generatedAt: now.toISOString(),
    currentDateLabel: formatLongDate(now),
    statusLabel: recentFailures.length === 0 ? "All Systems Operational" : "Attention Required",
    users: {
      total,
      active,
      inactive: total - active,
      admins,
      hr,
      employees,
    },
    modules: toggles,
    enabledModuleCount: Object.values(toggles).filter(Boolean).length,
    geofenceZoneCount: zoneCount,
    emailTemplateCount: templateCount,
    auditEventCount: auditCount,
    activeSessions,
    apiResponse: {
      avgMs: averageResponseMs,
      label: apiLatencyProbe.result.label,
    },
    uptime: {
      percentage: uptimePercentage,
      label: "last 30 days",
    },
    database: {
      connected: true,
      status: "Operational",
      engine: "Supabase PostgreSQL",
      detail: `${databaseName} - ${databaseSizeMb}`,
    },
    backgroundJobs: {
      failedEmails: recentFailures.length,
      label: recentFailures.length === 0 ? "email queue ok" : "email failures detected",
    },
    recentAudit,
    auditCategories: auditCategoriesProbe.result
      .map((entry) => ({
        cat: entry.category,
        count: entry._count._all,
        color: AUDIT_CATEGORY_COLORS[entry.category] ?? "#1e3a8a",
      }))
      .sort((a, b) => b.count - a.count),
    activityTrend: trend,
    dataIntegrity: [
      { label: "User Accounts", count: total, status: "ok" },
      { label: "Employee Accounts", count: employees, status: "ok" },
      { label: "Location Sync Records", count: locationStatusCount, status: "ok" },
      { label: "Geofence Zones", count: zoneCount, status: "ok" },
      { label: "Email Templates", count: templateCount, status: "ok" },
      { label: "Audit Log Entries", count: auditCount, status: "ok" },
    ],
    systemChecks: {
      databaseConnected: true,
      emailServiceConnected,
      gpsAttendanceEnabled: toggles.gpsAttendance,
    },
    settings: {
      organizationName: settings.organizationName,
      academicYear: settings.academicYear,
      currentSemester: settings.currentSemester,
    },
  };

  dashboardSummaryCache = { checkedAt: Date.now(), summary };
  return summary;
}

