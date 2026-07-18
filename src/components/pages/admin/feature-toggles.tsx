"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CheckCircle2,
  EyeOff,
  Layers,
  Loader2,
  MonitorSmartphone,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkHive } from "@/lib/store";
import { useAdminFeatureToggles, useAdminUsers } from "@/hooks/use-feature-toggles";
import { FEATURE_TOGGLE_GROUPS, FEATURE_TOGGLE_META } from "@/lib/feature-access";
import type { FeatureToggles, Role, SystemUser } from "@/lib/types";

type FeatureTogglesResponse = {
  featureToggles: FeatureToggles;
};

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
  const activeHr = useMemo(
    () => users.filter((user) => user.active && user.role === "hr").length,
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
      const meta = changedKey ? FEATURE_TOGGLE_META.find((toggle) => toggle.key === changedKey) : null;
      const enabled = changedKey ? payload.featureToggles[changedKey] : true;

      toast({
        title: `${meta?.label ?? "Page"} ${enabled ? "enabled" : "disabled"}`,
        description: enabled
          ? "Saved to the database and now visible on the portal."
          : "Saved to the database and now hidden from the portal.",
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
  const totalCount = FEATURE_TOGGLE_META.length;
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
            Enable or disable the actual Employee and HR portal pages. Disabled pages are hidden from the sidebar and blocked from staying open.
          </p>
        </div>
        <Badge variant="outline" className="self-start border-primary/30 bg-primary/10 text-primary">
          {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Layers className="mr-1.5 h-3.5 w-3.5" />}
          {enabledCount} / {totalCount} pages active
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
              <p className="text-xs font-medium text-muted-foreground">Active portal pages</p>
              <p className="text-lg font-bold text-foreground">
                {enabledCount} <span className="text-muted-foreground">/ {totalCount}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">saved in the database</p>
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
            <p className="text-[11px] text-muted-foreground">pages visible</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Disabled</p>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-muted-foreground">{totalCount - enabledCount}</p>
            <p className="text-[11px] text-muted-foreground">pages hidden</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Affected Users</p>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{activeEmployees + activeHr}</p>
            <p className="text-[11px] text-muted-foreground">{activeEmployees} employees and {activeHr} HR users</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Disabling a page hides it from the Employee or HR portal.</p>
          <p className="text-muted-foreground">
            Existing records stay in the database. Users already on a disabled page are redirected to the next available page in their own portal.
          </p>
        </div>
      </div>

      {FEATURE_TOGGLE_GROUPS.map((group) => {
        const groupToggles = FEATURE_TOGGLE_META.filter((toggle) => toggle.group === group);
        const groupEnabled = groupToggles.filter((toggle) => featureToggles[toggle.key]).length;

        return (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {group === "Employee Portal" ? <MonitorSmartphone className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
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
                      style={{ backgroundColor: on ? "var(--primary)" : "var(--border)" }}
                    />
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-foreground">{toggle.label}</h3>
                            <p className="text-xs text-muted-foreground">{toggle.affects}</p>
                          </div>
                        </div>
                        <Switch
                          checked={on}
                          disabled={isSaving}
                          onCheckedChange={(checked) => handleToggle(toggle.key, checked)}
                          aria-label={`Toggle ${toggle.label}`}
                        />
                      </div>

                      <p className="text-sm leading-6 text-muted-foreground">{toggle.description}</p>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <Badge
                          className={on ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"}
                          variant="outline"
                        >
                          {on ? "Visible on portal" : "Hidden from portal"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{affectedUsers} affected users</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="text-sm text-muted-foreground">
          Public pages and Admin-only pages are not controlled here. This screen only manages the real Employee and HR portal pages.
        </div>
      </div>
    </div>
  );
}
