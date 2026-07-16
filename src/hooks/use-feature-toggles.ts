"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminDashboardSummary, SystemSettingsApiResponse } from "@/lib/admin-types";
import type { AuditLogEntry, EmailTemplate, FeatureToggles, SystemUser } from "@/lib/types";

type FeatureTogglesResponse = {
  featureToggles: FeatureToggles;
};

type AdminUsersResponse = {
  users: SystemUser[];
};

type AdminEmailTemplatesResponse = {
  emailTemplates: EmailTemplate[];
};

type AdminAuditLogResponse = {
  auditLog: AuditLogEntry[];
};

async function fetchFeatureToggles(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as FeatureTogglesResponse & { error?: string };

  if (!response.ok || !payload.featureToggles) {
    throw new Error(payload.error ?? "Unable to load feature toggles.");
  }

  return payload;
}

async function fetchAdminUsers() {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const payload = (await response.json()) as AdminUsersResponse & { error?: string };

  if (!response.ok || !payload.users) {
    throw new Error(payload.error ?? "Unable to load users.");
  }

  return payload;
}

async function fetchAdminEmailTemplates() {
  const response = await fetch("/api/admin/email-templates", { cache: "no-store" });
  const payload = (await response.json()) as AdminEmailTemplatesResponse & { error?: string };

  if (!response.ok || !payload.emailTemplates) {
    throw new Error(payload.error ?? "Unable to load email templates.");
  }

  return payload;
}

async function fetchAdminAuditLog() {
  const response = await fetch("/api/admin/audit-log", { cache: "no-store" });
  const payload = (await response.json()) as AdminAuditLogResponse & { error?: string };

  if (!response.ok || !payload.auditLog) {
    throw new Error(payload.error ?? "Unable to load audit log.");
  }

  return payload;
}

async function fetchAdminDashboardSummary() {
  const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
  const payload = (await response.json()) as AdminDashboardSummary & { error?: string };

  if (!response.ok || !payload.generatedAt) {
    throw new Error(payload.error ?? "Unable to load dashboard summary.");
  }

  return payload;
}

const SHARED_QUERY_OPTIONS = {
  retry: false,
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;

export function useFeatureToggles() {
  return useQuery({
    queryKey: ["feature-toggles"],
    queryFn: () => fetchFeatureToggles("/api/feature-toggles"),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useAdminFeatureToggles() {
  return useQuery({
    queryKey: ["admin-feature-toggles"],
    queryFn: () => fetchFeatureToggles("/api/admin/feature-toggles"),
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminEmailTemplates() {
  return useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: fetchAdminEmailTemplates,
    ...SHARED_QUERY_OPTIONS,
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: fetchAdminAuditLog,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminDashboardSummary() {
  return useQuery({
    queryKey: ["admin-dashboard-summary"],
    queryFn: fetchAdminDashboardSummary,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}
