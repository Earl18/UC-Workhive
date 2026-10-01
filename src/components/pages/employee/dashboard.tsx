"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkHive } from "@/lib/store";
import { usePortalNotifications } from "@/hooks/use-portal-notifications";
import { notificationTime } from "@/lib/portal-notifications";
import { getAvailableLeaveTypes, getLeaveTypeLabel, LeaveType, type Employee, type Holiday, type LeaveRequest } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HexagonAvatar,
  HexStatCard,
} from "@/components/shared/hexagon";
import {
  employmentStatusColor,
  formatDate,
  holidayColor,
  lengthOfService,
} from "@/components/shared/helpers";
import {
  Clock,
  LogIn,
  Bell,
  CalendarDays,
  Plane,
  FileText,
  User as UserIcon,
  ChevronRight,
  CalendarClock,
  Loader2,
} from "lucide-react";

type EmployeeProfile = Employee & { birthDate?: string };

type LeaveCreditSummary = {
  leaveType: LeaveType;
  maxDays: number;
  usedDays: number;
  remainingDays: number;
};

type EmployeeProfileResponse = {
  employee?: EmployeeProfile;
  error?: string;
};

type EmployeeLeaveDashboardResponse = {
  employee?: EmployeeProfile;
  credits?: LeaveCreditSummary[];
  requests?: LeaveRequest[];
  error?: string;
};

type HolidaysResponse = {
  holidays?: Holiday[];
  error?: string;
};

type CurrentTimeResponse = {
  nowMs?: number;
  timezone?: string;
  error?: string;
};

async function readProfileResponse(response: Response) {
  const payload = (await response.json()) as EmployeeProfileResponse;
  if (!response.ok || !payload.employee) {
    throw new Error(payload.error ?? "Unable to load your employee profile.");
  }
  return payload.employee;
}

async function readLeaveResponse(response: Response) {
  const payload = (await response.json()) as EmployeeLeaveDashboardResponse;
  if (!response.ok || !payload.employee || !payload.credits || !payload.requests) {
    throw new Error(payload.error ?? "Unable to load your leave data.");
  }

  return {
    employee: payload.employee,
    credits: payload.credits,
    requests: payload.requests,
  };
}

async function readHolidaysResponse(response: Response) {
  const payload = (await response.json()) as HolidaysResponse;
  if (!response.ok || !payload.holidays) {
    throw new Error(payload.error ?? "Unable to load holidays.");
  }
  return payload.holidays;
}

async function readCurrentTimeResponse(response: Response) {
  const payload = (await response.json()) as CurrentTimeResponse;
  if (!response.ok || typeof payload.nowMs !== "number") {
    throw new Error(payload.error ?? "Unable to load current time.");
  }

  return payload;
}

function daysFromNow(targetDate: string, todayStr: string) {
  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(`${targetDate}T00:00:00`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  return `In ${diffDays} days`;
}

export function DashboardPage() {
  const { currentUser, setView } = useWorkHive();
  const notificationFeed = usePortalNotifications(currentUser?.id);
  const [now, setNow] = useState<Date | null>(null);

  const profileQuery = useQuery({
    queryKey: ["employee-profile"],
    queryFn: async () => {
      const response = await fetch("/api/employee/profile", { cache: "no-store" });
      return readProfileResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const leaveQuery = useQuery({
    queryKey: ["employee-leave"],
    queryFn: async () => {
      const response = await fetch("/api/employee/leave", { cache: "no-store" });
      return readLeaveResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const holidaysQuery = useQuery({
    queryKey: ["employee-holidays"],
    queryFn: async () => {
      const response = await fetch("/api/holidays", { cache: "no-store" });
      return readHolidaysResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const timeQuery = useQuery({
    queryKey: ["internet-time", "asia-manila"],
    queryFn: async () => {
      const response = await fetch("/api/time/current", { cache: "no-store" });
      return readCurrentTimeResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 15,
  });

  useEffect(() => {
    if (typeof timeQuery.data?.nowMs !== "number") {
      return;
    }

    setNow(new Date(timeQuery.data.nowMs));
  }, [timeQuery.data?.nowMs]);

  useEffect(() => {
    if (!now) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow((current) => (current ? new Date(current.getTime() + 1000) : current));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [now]);

  const employee = profileQuery.data ?? leaveQuery.data?.employee ?? null;
  const holidays = holidaysQuery.data ?? [];
  const timezone = timeQuery.data?.timezone ?? "Asia/Manila";

  const todayStr = useMemo(() => {
    const basis = now ?? new Date();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(basis);
  }, [now, timezone]);

  const upcomingHoliday = useMemo(() => {
    const upcoming = holidays
      .filter((holiday) => holiday.date >= todayStr)
      .sort((left, right) => left.date.localeCompare(right.date));
    return upcoming[0] ?? null;
  }, [holidays, todayStr]);

  const isLoading = profileQuery.isLoading || leaveQuery.isLoading || holidaysQuery.isLoading;
  const error = profileQuery.error ?? leaveQuery.error ?? holidaysQuery.error;

  if (isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-muted-foreground">
        {error instanceof Error ? error.message : "Unable to load your dashboard."}
      </div>
    );
  }

  if (!employee) {
    return <div className="p-6 text-muted-foreground">No employee record found.</div>;
  }

  const los = lengthOfService(employee.dateHired);
  const timeLabel = now
    ? now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:-- --";
  const dateLabel = now
    ? now.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Internet time unavailable";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <HexagonAvatar
              name={`${employee.firstName} ${employee.lastName}`}
              color={employee.avatarColor ?? "#1e3a8a"}
              size={56}
            />
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
                Welcome back
              </p>
              <h2 className="text-xl font-bold sm:text-2xl">
                {employee.firstName} {employee.lastName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/85">
                <span>{employee.position}</span>
                <span aria-hidden>&bull;</span>
                <span>{employee.department}</span>
                <span aria-hidden>&bull;</span>
                <span>{los} of service</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge
              variant="secondary"
              className="border-0 bg-gold text-gold-foreground"
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: employmentStatusColor(employee.employmentStatus) }}
              />
              {employee.employmentStatus}
            </Badge>
            <p className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">
              {timeLabel}
            </p>
            <p className="text-xs text-primary-foreground/70">
              {dateLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Attendance Status
            </CardTitle>
            <CardDescription>
              Record attendance through the new employee time clock or QR attendance page.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Time In
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                --:-- --
              </p>
              <Button className="mt-3 w-full" onClick={() => setView("employee:time-clock")}>
                <LogIn className="h-4 w-4" /> Open Time Clock
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Time Out
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                --:-- --
              </p>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Today's status:</span> Use the buttons above to open the employee attendance tools and record your punches live.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Links</CardTitle>
            <CardDescription>Jump to common tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink icon={<UserIcon className="h-4 w-4" />} label="Update Profile" hint="Edit personal info" onClick={() => setView("employee:profile")} />
            <QuickLink icon={<FileText className="h-4 w-4" />} label="Upload Certificates" hint="Manage documents" onClick={() => setView("employee:documents")} />
            <QuickLink icon={<Plane className="h-4 w-4" />} label="File a Leave" hint="Submit application" onClick={() => setView("employee:leave")} />
            <QuickLink icon={<Clock className="h-4 w-4" />} label="Time In / Out" hint="Record attendance" onClick={() => setView("employee:time-clock")} />
            <QuickLink icon={<CalendarClock className="h-4 w-4" />} label="View Attendance" hint="See history" onClick={() => setView("employee:attendance")} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Leave Balance Summary</CardTitle>
                <CardDescription>Credits remaining based on your actual leave records.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("employee:leave")}>
                View all <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {getAvailableLeaveTypes(employee.department, employee.gender).map((type, index) => {
                const credit = leaveQuery.data?.credits?.find((item) => item.leaveType === type);
                const remaining = credit?.remainingDays ?? 0;
                const maxDays = credit?.maxDays ?? 0;
                const sublabel = Number.isFinite(maxDays) ? `${remaining} of ${maxDays} days left` : "Unlimited";

                return (
                  <HexStatCard
                    key={type}
                    label={getLeaveTypeLabel(type, employee.department)}
                    value={remaining}
                    sublabel={sublabel}
                    accent={index === 0}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" /> Upcoming Holiday
            </CardTitle>
            <CardDescription>Next upcoming holiday from the holiday calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingHoliday ? (() => {
              const color = holidayColor(upcomingHoliday.type);
              const date = new Date(`${upcomingHoliday.date}T00:00:00`);
              return (
                <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-white" style={{ backgroundColor: color }}>
                    <span className="text-[9px] uppercase leading-none">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                    <span className="text-base font-bold leading-none">{date.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{upcomingHoliday.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(upcomingHoliday.date)}</p>
                    <Badge variant="outline" className="mt-1" style={{ color, borderColor: color }}>{upcomingHoliday.type}</Badge>
                    <p className="mt-2 text-[11px] text-muted-foreground">{daysFromNow(upcomingHoliday.date, todayStr)}</p>
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> Latest Notifications
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("employee:notifications")}>
              View all <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>Recent updates for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {notificationFeed.notifications.slice(0, 3).map((item) => (
              <li key={item.id}>
                <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-accent/40" onClick={() => {
                  if (!item.read) void notificationFeed.markRead(item.id).catch(() => {});
                  setView(item.view);
                }}>
                  <span className={item.read ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted" : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold"} />
                  <span className="min-w-0 flex-1"><span className="block font-medium text-foreground">{item.title}</span><span className="block text-xs text-muted-foreground">{item.message}</span></span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{notificationTime(item.timestamp)}</span>
                </button>
              </li>
            ))}
            {!notificationFeed.isLoading && !notificationFeed.isError && notificationFeed.notifications.length === 0 ? <li className="px-4 py-5 text-sm text-muted-foreground">No notifications yet.</li> : null}
            {notificationFeed.isLoading ? <li className="px-4 py-5 text-sm text-muted-foreground">Loading notifications...</li> : null}
            {notificationFeed.isError ? <li className="px-4 py-5 text-sm text-destructive">Unable to load notifications.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLink({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
