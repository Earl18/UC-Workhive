"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Server,
  ShieldCheck,
  ToggleLeft,
  Mail,
  Database,
  Activity,
  CircleDot,
  Cpu,
  Wifi,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useWorkHive } from "@/lib/store";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminDashboardSummary } from "@/hooks/use-feature-toggles";

function categoryColor(cat: string): string {
  switch (cat) {
    case "Auth":
      return "#1d4ed8";
    case "Employee":
      return "#0e7490";
    case "Attendance":
      return "#ca8a04";
    case "Leave":
      return "#7c3aed";
    case "Recruitment":
      return "#16a34a";
    case "System":
      return "#6b7280";
    default:
      return "#1e3a8a";
  }
}

export function DashboardPage() {
  const { setView } = useWorkHive();
  const { data: summary, isLoading, error } = useAdminDashboardSummary();

  if (isLoading && !summary) {
    return <div className="p-6 text-sm text-muted-foreground">Loading system dashboard...</div>;
  }

  if (error && !summary) {
    return <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load system dashboard."}</div>;
  }

  if (!summary) {
    return <div className="p-6 text-sm text-muted-foreground">No dashboard data available.</div>;
  }

  const organizationName = summary.settings.organizationName;
  const academicYear = summary.settings.academicYear;
  const currentSemester = summary.settings.currentSemester;
  const totalModules = Object.keys(summary.modules).length;
  const totalAuditEvents = Math.max(summary.auditEventCount, 1);

  const healthMetrics = [
    {
      label: "API Response",
      value: `${summary.apiResponse.avgMs} ms`,
      icon: Activity,
      detail: summary.apiResponse.label,
      healthy: true,
    },
    {
      label: "Uptime",
      value: `${summary.uptime.percentage}%`,
      icon: Server,
      detail: summary.uptime.label,
      healthy: summary.uptime.percentage >= 99,
    },
    {
      label: "Database",
      value: summary.database.status,
      icon: Database,
      detail: `${summary.database.engine} - ${summary.database.detail}`,
      healthy: summary.database.connected,
    },
    {
      label: "Background Jobs",
      value: `${summary.backgroundJobs.failedEmails} failed`,
      icon: Cpu,
      detail: summary.backgroundJobs.label,
      healthy: summary.backgroundJobs.failedEmails === 0,
    },
  ];

  const securitySummary = [
    { label: "Active Sessions", value: summary.activeSessions, icon: Lock },
    { label: "Geofence Zones", value: summary.geofenceZoneCount, icon: ShieldCheck },
    { label: "Email Templates", value: summary.emailTemplateCount, icon: Mail },
    { label: "Audit Events", value: summary.auditEventCount, icon: Clock },
  ];

  const moduleRegistry = [
    { key: "manualAttendance", label: "Manual Attendance", desc: "Time In/Out logging", on: summary.modules.manualAttendance },
    { key: "qrAttendance", label: "QR Attendance", desc: "QR code scanning", on: summary.modules.qrAttendance },
    { key: "gpsAttendance", label: "GPS Geofencing", desc: "Location-based attendance", on: summary.modules.gpsAttendance },
    { key: "leaveModule", label: "Leave Management", desc: "Filing & approvals", on: summary.modules.leaveModule },
    { key: "overtimeModule", label: "Overtime", desc: "OT approval workflow", on: summary.modules.overtimeModule },
    { key: "recruitmentModule", label: "Recruitment", desc: "Job postings & applicants", on: summary.modules.recruitmentModule },
  ];

  const operationalChecks = [
    {
      label: "Database Connection",
      value: summary.systemChecks.databaseConnected ? "Online" : "Offline",
      pct: summary.systemChecks.databaseConnected ? 100 : 0,
      icon: Database,
      healthy: summary.systemChecks.databaseConnected,
      detail: summary.database.engine,
    },
    {
      label: "Email Service",
      value: summary.systemChecks.emailServiceConnected ? "Connected" : "Not configured",
      pct: summary.systemChecks.emailServiceConnected ? 100 : 0,
      icon: Mail,
      healthy: summary.systemChecks.emailServiceConnected,
      detail: "Supabase recovery email API",
    },
    {
      label: "GPS Geofencing",
      value: summary.systemChecks.gpsAttendanceEnabled ? "Online" : "Offline",
      pct: summary.systemChecks.gpsAttendanceEnabled ? 100 : 0,
      icon: Wifi,
      healthy: summary.systemChecks.gpsAttendanceEnabled,
      detail: summary.systemChecks.gpsAttendanceEnabled ? "Location attendance active" : "GPS attendance is disabled",
    },
    {
      label: "30-Day Uptime",
      value: `${summary.uptime.percentage}%`,
      pct: Math.max(0, Math.min(100, summary.uptime.percentage)),
      icon: Activity,
      healthy: summary.uptime.percentage >= 99,
      detail: summary.uptime.label,
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">System Dashboard</h1>
          <Badge
            className={
              summary.statusLabel === "All Systems Operational"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-gold/30 bg-gold/10 text-gold"
            }
          >
            <span
              className={
                summary.statusLabel === "All Systems Operational"
                  ? "mr-1.5 flex h-2 w-2 rounded-full bg-emerald-500"
                  : "mr-1.5 flex h-2 w-2 rounded-full bg-gold"
              }
            />
            {summary.statusLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {organizationName} - {currentSemester} - {academicYear} -{" "}
          <span className="font-medium text-foreground">{summary.currentDateLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {healthMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-muted-foreground">{m.label}</p>
                    {m.healthy ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-gold" />
                    )}
                  </div>
                  <p className="text-lg font-bold text-foreground">{m.value}</p>
                  <p className="text-[11px] text-muted-foreground">{m.detail}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {securitySummary.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              System Activity - Last 14 Days
            </CardTitle>
            <CardDescription>
              Audit events logged per day across all modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.activityTrend} margin={{ top: 5, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#gradEvents)"
                    name="Audit events"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity by Category</CardTitle>
            <CardDescription>Total events per module</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.auditCategories.map((c) => {
              const pct = Math.round((c.count / totalAuditEvents) * 100);
              return (
                <div key={c.cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-medium text-foreground">{c.cat}</span>
                    </span>
                    <span className="text-muted-foreground">{c.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: c.color }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-primary" />
              Module Registry
            </CardTitle>
            <CardDescription>
              {summary.enabledModuleCount} of {totalModules} modules enabled - Employee portal visibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {moduleRegistry.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.desc}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      m.on
                        ? "ml-2 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "ml-2 shrink-0 border-muted-foreground/30 bg-muted text-muted-foreground"
                    }
                  >
                    <CircleDot className="mr-1 h-3 w-3" />
                    {m.on ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Live Service Health
            </CardTitle>
            <CardDescription>Operational checks from the live system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {operationalChecks.map((item) => {
              const Icon = item.icon;
              const barColor = item.healthy ? "var(--primary)" : item.label === "GPS Geofencing" ? "var(--gold)" : "#dc2626";
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.detail}</p>
                </div>
              );
            })}
            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Live checks are based on database queries, feature config, and email API configuration</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/70">No mocked server-load percentages</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Access Control
            </CardTitle>
            <CardDescription>Role distribution & accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-primary">{summary.users.admins}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Admins</p>
              </div>
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-center">
                <p className="text-xl font-bold text-gold">{summary.users.hr}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">HR</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-foreground">{summary.users.employees}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Employees</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Active accounts
              </span>
              <span className="font-semibold text-foreground">{summary.users.active}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                Deactivated
              </span>
              <span className="font-semibold text-foreground">{summary.users.inactive}</span>
            </div>
            <button
              onClick={() => setView("admin:users")}
              className="mt-1 w-full rounded-lg border border-primary/20 bg-primary/5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              View user and role management
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Data Integrity
            </CardTitle>
            <CardDescription>Live database record counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.dataIntegrity.map((d) => (
              <div
                key={d.label}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{d.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{d.count}</span>
                  {d.status === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-gold" />
                  )}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Live counts loaded from the database
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Live Audit Feed
            </CardTitle>
            <CardDescription>Most recent system events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px] px-6">
              <div className="space-y-2 pb-4">
                {summary.recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2.5 border-b border-border py-2 last:border-0"
                  >
                    <HexagonAvatar name={entry.user} size={26} color={categoryColor(entry.category)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-foreground">{entry.user}</p>
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                          style={{
                            backgroundColor: `${categoryColor(entry.category)}1a`,
                            color: categoryColor(entry.category),
                          }}
                        >
                          {entry.category}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{entry.action}</p>
                      <p className="text-[10px] text-muted-foreground/60">{entry.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <button
              onClick={() => setView("admin:audit-log")}
              className="w-full border-t border-border py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              View full audit log
            </button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">WorkHive HRMS v1.0.0</span>
            <span> - </span>
            <span>Single-campus deployment</span>
            <span> - </span>
            <span>{organizationName}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${summary.systemChecks.databaseConnected ? "bg-emerald-500" : "bg-destructive"}`} /> Database online
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${summary.systemChecks.emailServiceConnected ? "bg-emerald-500" : "bg-destructive"}`} /> Email service connected
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {summary.systemChecks.gpsAttendanceEnabled ? (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-gold" />
              )}
              GPS online
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
