"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Hand,
  QrCode,
  CalendarDays,
  Briefcase,
  MapPin,
  Clock,
  Info,
  EyeOff,
  Users,
  Layers,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkHive } from "@/lib/store";
import { useAdminFeatureToggles, useAdminUsers } from "@/hooks/use-feature-toggles";
import type { FeatureToggles, Role, SystemUser } from "@/lib/types";

type ToggleMeta = {
  key: keyof FeatureToggles;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Attendance" | "People" | "Recruitment";
  affects: string;
  affectedRoles: Role[];
};

type FeatureTogglesResponse = {
  featureToggles: FeatureToggles;
};

const TOGGLES: ToggleMeta[] = [
  {
    key: "manualAttendance",
    label: "Manual Attendance",
    icon: Hand,
    group: "Attendance",
    affects: "Employee portal � Attendance page",
    affectedRoles: ["employee"],
    description: "Employees can manually enter their time-in / time-out. Fallback when QR or GPS is unavailable.",
  },
  {
    key: "qrAttendance",
    label: "QR Attendance",
    icon: QrCode,
    group: "Attendance",
    affects: "Employee portal � Attendance page",
    affectedRoles: ["employee"],
    description: "Employees scan a daily QR code displayed at the campus entrance to register attendance.",
  },
  {
    key: "gpsAttendance",
    label: "GPS Attendance",
    icon: MapPin,
    group: "Attendance",
    affects: "Employee portal � Admin � GPS Zones",
    affectedRoles: ["employee", "admin"],
    description: "Location-based attendance via geofence zones. Configure zones on the GPS Zones page.",
  },
  {
    key: "leaveModule",
    label: "Leave Module",
    icon: CalendarDays,
    group: "People",
    affects: "Employee portal � HR portal",
    affectedRoles: ["employee", "hr"],
    description: "Single-stage HR leave approval. Hides the Leave menu when off.",
  },
  {
    key: "overtimeModule",
    label: "Overtime Module",
    icon: Clock,
    group: "People",
    affects: "Employee portal � HR portal",
    affectedRoles: ["employee", "hr"],
    description: "Employees log overtime hours; HR approves or rejects. Reflects in payroll and attendance reports.",
  },
  {
    key: "recruitmentModule",
    label: "Recruitment Module",
    icon: Briefcase,
    group: "Recruitment",
    affects: "HR portal � Public Careers",
    affectedRoles: ["hr"],
    description: "Job postings, applicant Kanban, interview scheduling, and scoring. Hides Recruitment from the HR portal.",
  },
];

const GROUPS = ["Attendance", "People", "Recruitment"] as const;

function getAffectedUserCount(users: SystemUser[], roles: Role[]) {
  return users.filter((user) => user.active && roles.includes(user.role)).length;
}

export function FeatureTogglesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { featureToggles: fallbackFeatureToggles, setFeatureToggles } = useWorkHive();
  const { data, isLoading, error } = useAdminFeatureToggles();
  const { data: usersData } = useAdminUsers();

  const featureToggles = data?.featureToggles ?? fallbackFeatureToggles;
  const users = usersData?.users ?? [];
  const activeEmployees = useMemo(
    () => users.filter((user) => user.active && user.role === "employee").length,
    [users],
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<FeatureToggles>) => {
      const response = await fetch("/api/admin/feature-toggles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const next = (await response.json()) as FeatureTogglesResponse & { error?: string };
      if (!response.ok || !next.featureToggles) {
        throw new Error(next.error ?? "Unable to save feature toggles.");
      }

      return next;
    },
    onSuccess: (payload, variables) => {
      setFeatureToggles(payload.featureToggles);
      queryClient.setQueryData(["admin-feature-toggles"], payload);
      queryClient.setQueryData(["feature-toggles"], payload);

      const changedKey = Object.keys(variables)[0] as keyof FeatureToggles | undefined;
      const meta = changedKey ? TOGGLES.find((toggle) => toggle.key === changedKey) : null;
      const enabled = changedKey ? payload.featureToggles[changedKey] : true;

      toast({
        title: `${meta?.label ?? "Module"} ${enabled ? "enabled" : "disabled"}`,
        description: enabled
          ? "Saved to the database and now visible across devices."
          : "Saved to the database and now hidden across devices.",
      });
    },
    onError: (mutationError) => {
      toast({
        title: "Unable to save feature toggle",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof FeatureToggles, value: boolean) => {
    const previous = featureToggles;
    const optimistic = { ...featureToggles, [key]: value };
    setFeatureToggles(optimistic);

    saveMutation.mutate(
      { [key]: value },
      {
        onError: () => {
          setFeatureToggles(previous);
        },
      },
    );
  };

  const enabledCount = Object.values(featureToggles).filter(Boolean).length;
  const totalCount = TOGGLES.length;
  const enabledPct = Math.round((enabledCount / totalCount) * 100);

  if (isLoading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading feature toggles...</div>;
  }

  if (error && !data) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Unable to load feature toggles."}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Toggles</h1>
          <p className="text-sm text-muted-foreground">
            Enable or disable WorkHive modules for the Employee portal.
          </p>
        </div>
        <Badge variant="outline" className="self-start border-primary/30 bg-primary/10 text-primary">
          {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Layers className="mr-1.5 h-3.5 w-3.5" />}
          {enabledCount} / {totalCount} modules active
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${enabledPct} 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">{enabledPct}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active modules</p>
              <p className="text-lg font-bold text-foreground">
                {enabledCount} <span className="text-muted-foreground">/ {totalCount}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">visible to employees</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Enabled</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{enabledCount}</p>
            <p className="text-[11px] text-muted-foreground">modules running</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Disabled</p>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-muted-foreground">{totalCount - enabledCount}</p>
            <p className="text-[11px] text-muted-foreground">modules hidden</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Affected Users</p>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{activeEmployees}</p>
            <p className="text-[11px] text-muted-foreground">active employees from the database</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Disabling a module hides it from the Employee portal.</p>
          <p className="text-muted-foreground">
            Existing data is preserved and remains accessible to HR and Admin. The saved toggle state is now loaded from the database for every device.
          </p>
        </div>
      </div>

      {GROUPS.map((group) => {
        const groupToggles = TOGGLES.filter((toggle) => toggle.group === group);
        const groupEnabled = groupToggles.filter((toggle) => featureToggles[toggle.key]).length;

        return (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {group === "Attendance" && <Clock className="h-4 w-4" />}
                {group === "People" && <Users className="h-4 w-4" />}
                {group === "Recruitment" && <Briefcase className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-foreground">{group}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {groupEnabled} of {groupToggles.length} active
                </p>
              </div>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(groupEnabled / groupToggles.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupToggles.map((toggle) => {
                const on = featureToggles[toggle.key];
                const Icon = toggle.icon;
                const affectedUsers = getAffectedUserCount(users, toggle.affectedRoles);
                const isSaving = saveMutation.isPending && saveMutation.variables && toggle.key in saveMutation.variables;

                return (
                  <Card
                    key={toggle.key}
                    className={`relative overflow-hidden transition-all ${on ? "border-primary/30 shadow-sm" : "border-border opacity-95"}`}
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-1"
                      style={{ backgroundColor: on ? "var(--primary)" : "var(--muted-foreground)" }}
                      aria-hidden
                    />
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pl-5">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{toggle.label}</CardTitle>
                          <CardDescription className="mt-0.5 text-[11px]">{toggle.affects}</CardDescription>
                        </div>
                      </div>
                      <Switch checked={on} onCheckedChange={(value) => handleToggle(toggle.key, value)} disabled={isSaving} />
                    </CardHeader>
                    <CardContent className="pl-5">
                      <p className="text-xs leading-relaxed text-muted-foreground">{toggle.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <Badge
                          variant="outline"
                          className={
                            on
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-muted-foreground/30 bg-muted text-muted-foreground"
                          }
                        >
                          <span
                            className="mr-1 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: on ? "#10b981" : "var(--muted-foreground)" }}
                          />
                          {on ? "Visible to employees" : "Hidden from employees"}
                        </Badge>
                        {toggle.key === "gpsAttendance" && on ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                            <Info className="h-3 w-3" /> Configure zones
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{affectedUsers} affected users</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Card className="border-gold/30 bg-gold/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Changing module visibility takes effect immediately.</p>
            <p className="text-muted-foreground">
              Employees refreshing their portal will see the updated menu, and the same saved toggle values will load when you open the system on another device.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

