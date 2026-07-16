export type {
  AuditLogEntry,
  EmailTemplate,
  FeatureToggles,
  GeofenceZone,
  SystemUser,
} from "@/lib/types";

export type SystemSettingsRecord = {
  organizationName: string;
  campusAddress: string;
  campusLandmark: string;
  campusPlaceId: string;
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
  updatedAt?: string;
};

export type SystemSettingsHealth = {
  schemaMigrated: boolean;
  databaseConnected: boolean;
};

export type SystemSettingsApiResponse = {
  settings: SystemSettingsRecord;
  health?: SystemSettingsHealth;
};

export type AdminDashboardSummary = {
  generatedAt: string;
  currentDateLabel: string;
  statusLabel: string;
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    hr: number;
    employees: number;
  };
  modules: FeatureToggles;
  enabledModuleCount: number;
  geofenceZoneCount: number;
  emailTemplateCount: number;
  auditEventCount: number;
  activeSessions: number;
  apiResponse: {
    avgMs: number;
    label: string;
  };
  uptime: {
    percentage: number;
    label: string;
  };
  database: {
    connected: boolean;
    status: string;
    engine: string;
    detail: string;
  };
  backgroundJobs: {
    failedEmails: number;
    label: string;
  };
  recentAudit: AuditLogEntry[];
  auditCategories: { cat: string; count: number; color: string }[];
  activityTrend: { label: string; events: number; auth: number }[];
  dataIntegrity: { label: string; count: number; status: "ok" | "warning" }[];
  systemChecks: {
    databaseConnected: boolean;
    emailServiceConnected: boolean;
    gpsAttendanceEnabled: boolean;
  };
  settings: Pick<SystemSettingsRecord, "organizationName" | "academicYear" | "currentSemester">;
};

export type AdminUsersResponse = {
  users: SystemUser[];
};

export type AdminAuditLogResponse = {
  auditLog: AuditLogEntry[];
};

export type AdminFeatureTogglesResponse = {
  featureToggles: FeatureToggles;
};

export type AdminEmailTemplatesResponse = {
  emailTemplates: EmailTemplate[];
};

export type GeofenceAccountPresence = {
  userId: string;
  name: string;
  email: string;
  role: SystemUser["role"];
  active: boolean;
  online: boolean;
  lastLogin?: string;
  lat: number;
  lng: number;
  detectedAt: string;
  lastSyncAt: string;
  withinGeofence: boolean;
  matchedZoneId?: string;
  matchedZoneName?: string;
};

export type GeofenceOverviewResponse = {
  organizationName: string;
  campusAddress: string;
  campusLandmark: string;
  campusPlaceId: string;
  center: {
    lat: number;
    lng: number;
  };
  geofenceZones: GeofenceZone[];
  summary: {
    totalZones: number;
    totalAccounts: number;
    withinGeofenceOnline: number;
    withinGeofenceTotal: number;
    outsideGeofence: number;
    coveragePct: number;
  };
  accounts: GeofenceAccountPresence[];
};
