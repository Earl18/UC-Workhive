"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Play,
  Square,
  Coffee,
  MapPin,
  TrendingUp,
  LogOut,
  Utensils,
  RotateCw,
  Loader2,
  AlertCircle,
} from "lucide-react";

type ClockAction = "clock-in" | "break-start" | "break-end" | "clock-out";
type ClockStatus = "ready" | "working" | "on-break" | "clocked-out";

type TimelineEntry = {
  key: string;
  label: string;
  time: string;
  type: ClockAction | "working" | "ready";
};

type ClockPayload = {
  employee: {
    id: string;
    name: string;
    idNumber: string | null;
    position: string;
    department: string;
    staffCategory: string | null;
  };
  dateKey: string;
  dayName: string;
  isSaturday: boolean;
  status: ClockStatus;
  availableActions: ClockAction[];
  todayRecord: {
    id: string;
    date: string;
    day: string;
    morningIn: string | null;
    morningOut: string | null;
    afternoonIn: string | null;
    afternoonOut: string | null;
    timeIn: string | null;
    timeOut: string | null;
    remarks: string;
    lateMin: number;
    undertimeMin: number;
    overtimeHrs: string;
    overtimeStatus: string;
  } | null;
  timeline: TimelineEntry[];
  todayHours: number;
  weekHours: number;
  weeklySummary: Array<{
    day: string;
    date: string;
    hours: number;
    regular: number;
    overtime: number;
  }>;
  site: {
    enabled: boolean;
    zoneCount: number;
    primaryZone: string | null;
  };
};

type ClockResponse = {
  data?: ClockPayload;
  error?: string;
  meta?: {
    action?: ClockAction;
    distanceMeters?: number | null;
  };
};

const TIME_ZONE = "Asia/Manila";
const HEXAGON = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

type CurrentTimeResponse = {
  nowMs?: number;
  timezone?: string;
  error?: string;
};

async function readCurrentTimeResponse(response: Response) {
  const payload = (await response.json()) as CurrentTimeResponse;
  if (!response.ok || typeof payload.nowMs !== "number") {
    throw new Error(payload.error ?? "Unable to load current time.");
  }
  return payload;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatClockFace(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatSeconds(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    second: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s?(AM|PM)/, "");
}

function formatHours(hours: number) {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const whole = Math.floor(safe);
  const minutes = Math.round((safe - whole) * 60);
  return `${whole}h ${minutes}m`;
}

function actionLabel(action: ClockAction) {
  switch (action) {
    case "clock-in":
      return "Clock In";
    case "break-start":
      return "Lunch Out";
    case "break-end":
      return "Lunch In";
    case "clock-out":
      return "End Shift";
  }
}

function statusLabel(status: ClockStatus) {
  switch (status) {
    case "working":
      return "Currently clocked in";
    case "on-break":
      return "Currently on lunch";
    case "clocked-out":
      return "Clocked out for today";
    default:
      return "Ready to clock in";
  }
}

function getTimelineStyle(type: TimelineEntry["type"]): { icon: React.ReactNode; color: string } {
  switch (type) {
    case "clock-in":
      return { icon: <Play className="h-4 w-4 text-white" />, color: "#16a34a" };
    case "clock-out":
      return { icon: <LogOut className="h-4 w-4 text-white" />, color: "var(--primary)" };
    case "break-start":
      return { icon: <Utensils className="h-4 w-4 text-white" />, color: "var(--gold)" };
    case "break-end":
      return { icon: <Play className="h-4 w-4 text-white" />, color: "var(--gold)" };
    case "ready":
      return { icon: <Clock className="h-4 w-4 text-white" />, color: "#64748b" };
    default:
      return { icon: <RotateCw className="h-4 w-4 text-white" />, color: "#0f766e" };
  }
}

async function readClockResponse(response: Response) {
  const payload = (await response.json()) as ClockResponse;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Unable to load attendance clock.");
  }
  return payload;
}

async function getDeviceLocation() {
  if (!("geolocation" in navigator)) {
    throw new Error("This browser does not support geolocation.");
  }

  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => reject(new Error(error.message || "Unable to get your current location.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export function TimeClockPage() {
  const { toast } = useToast();
  const [clockTick, setClockTick] = useState(0);
  const [timeAnchor, setTimeAnchor] = useState(() => ({ clientNowMs: Date.now(), serverNowMs: Date.now() }));
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<ClockAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const clockQuery = useQuery({
    queryKey: ["employee-attendance-clock"],
    queryFn: async () => readClockResponse(await fetch("/api/employee/attendance/clock", { cache: "no-store" })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const timeQuery = useQuery({
    queryKey: ["internet-time", "asia-manila"],
    queryFn: async () => readCurrentTimeResponse(await fetch("/api/time/current", { cache: "no-store" })),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 15,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const serverNowMs = timeQuery.data?.nowMs;
    if (typeof serverNowMs !== "number") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setTimeAnchor({ clientNowMs: Date.now(), serverNowMs });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [timeQuery.data?.nowMs]);

  const data = clockQuery.data?.data ?? null;

  const handleAction = async (action: ClockAction) => {
    try {
      setActionLoading(action);
      setActionError(null);
      const coords = await getDeviceLocation();
      const payload = await readClockResponse(
        await fetch("/api/employee/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...coords }),
        }),
      );
      queryClient.setQueryData(["employee-attendance-clock"], payload);
      void queryClient.invalidateQueries({ queryKey: ["employee-attendance-clock"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance-validation"] });
      toast({
        title: actionLabel(action),
        description:
          payload.meta?.distanceMeters != null
            ? `Attendance saved successfully. Distance to allowed zone: ${payload.meta.distanceMeters}m.`
            : "Attendance saved successfully.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update attendance.";
      setActionError(message);
      toast({ title: "Attendance update failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const displayTimeline = useMemo(() => {
    if (!data) return [] as TimelineEntry[];
    const actualEntries = data.timeline.filter((entry) => entry.type !== "working");
    return actualEntries.slice().reverse();
  }, [data]);

  if (clockQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading attendance clock...</div>;
  }

  if (clockQuery.error && !data) {
    return <div className="p-6 text-muted-foreground">{clockQuery.error instanceof Error ? clockQuery.error.message : "Unable to load attendance clock."}</div>;
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground">No employee attendance record is available.</div>;
  }

  const timezone = timeQuery.data?.timezone ?? TIME_ZONE;
  const timeBasis = new Date(timeAnchor.serverNowMs + (Date.now() - timeAnchor.clientNowMs));
  void clockTick;
  const isClockedIn = data.status !== "ready" && data.status !== "clocked-out";
  const canClockIn = data.availableActions.includes("clock-in");
  const canBreak = data.availableActions.includes("break-start") || data.availableActions.includes("break-end");
  const canClockOut = data.availableActions.includes("clock-out");
  const breakAction: ClockAction = data.availableActions.includes("break-end") ? "break-end" : "break-start";
  const weekTotal = data.weekHours.toFixed(1);
  const maxHours = Math.max(10, ...data.weeklySummary.map((entry) => entry.hours));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clock In/Clock Out</h1>
        <p className="text-sm text-muted-foreground">{formatDateLabel(timeBasis)}</p>
      </div>

      {actionError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{actionError}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="relative mb-6 flex items-center justify-center">
              <div
                className="flex items-center justify-center"
                style={{ width: 240, height: 277, clipPath: HEXAGON, background: "var(--gold)" }}
              >
                <div
                  className="flex flex-col items-center justify-center"
                  style={{ width: 228, height: 263, clipPath: HEXAGON, background: "var(--card)" }}
                >
                  <Clock className="h-6 w-6 text-gold" />
                  <p className="mt-3 text-4xl font-bold text-foreground tabular-nums">{new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(timeBasis)}</p>
                  <p className="mt-1 text-xl text-muted-foreground tabular-nums">{new Intl.DateTimeFormat("en-US", { timeZone: timezone, second: "2-digit" }).format(timeBasis)}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 text-sm font-medium text-muted-foreground">{statusLabel(data.status)}</div>

            <div className="mb-6 w-full max-w-md space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => { if (canClockIn) void handleAction("clock-in"); }}
                  size="lg"
                  disabled={actionLoading !== null || !canClockIn}
                  className="bg-gold text-gold-foreground hover:bg-gold/90 disabled:opacity-60"
                >
                  {actionLoading === "clock-in" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                  Clock In
                </Button>
                <Button
                  onClick={() => { if (canClockOut) void handleAction("clock-out"); }}
                  size="lg"
                  disabled={actionLoading !== null || !canClockOut}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {actionLoading === "clock-out" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                  End Shift
                </Button>
              </div>

              {canBreak ? (
                <Button
                  onClick={() => { if (canBreak) void handleAction(breakAction); }}
                  size="lg"
                  variant={breakAction === "break-end" ? "default" : "outline"}
                  disabled={actionLoading !== null}
                  className={breakAction === "break-end" ? "w-full bg-primary text-primary-foreground hover:bg-primary/90" : "w-full border-gold/40 text-gold hover:bg-gold/10"}
                >
                  {actionLoading === breakAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : breakAction === "break-end" ? <Play className="mr-2 h-4 w-4" /> : <Coffee className="mr-2 h-4 w-4" />}
                  {breakAction === "break-end" ? "Lunch In" : "Lunch Out"}
                </Button>
              ) : null}
            </div>

            <div className="flex items-center text-sm text-primary">
              <MapPin className="mr-2 h-4 w-4" />
              <span>{data.site.primaryZone ?? `${data.employee.department} attendance zone not configured`}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Today's Timeline</h2>
                <RotateCw className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="space-y-4">
                {displayTimeline.map((entry) => {
                  const { icon, color } = getTimelineStyle(entry.type);
                  return (
                    <div key={entry.key} className="flex items-center">
                      <div className="mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                        {icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{entry.label}</div>
                        <div className="text-sm text-muted-foreground">{entry.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">TODAY</div>
                <div className="text-2xl font-bold text-primary">{formatHours(data.todayHours)}</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">THIS WEEK</div>
                <div className="text-2xl font-bold text-gold">{data.weekHours.toFixed(1)}h</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Weekly Summary</h2>
              <p className="text-sm text-muted-foreground">{weekTotal}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-end gap-3" style={{ height: 160 }}>
            {data.weeklySummary.map((entry) => {
              const totalH = entry.hours;
              const barHeight = totalH > 0 ? (totalH / maxHours) * 130 : 4;
              const regularHeight = entry.regular > 0 ? (entry.regular / maxHours) * 130 : 0;
              return (
                <div key={entry.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-foreground">{totalH > 0 ? totalH.toFixed(1) : "?"}</span>
                  <div className="flex w-full flex-col items-center" style={{ height: 130, justifyContent: "flex-end" }}>
                    {entry.overtime > 0 ? (
                      <div className="w-full rounded-t-lg" style={{ height: barHeight - regularHeight, background: "var(--gold)", minHeight: 3 }} />
                    ) : null}
                    <div
                      className="w-full rounded-b-lg"
                      style={{
                        height: regularHeight,
                        background: totalH > 0 ? "var(--primary)" : "#d1d5db",
                        minHeight: totalH > 0 ? 4 : 2,
                      }}
                    />
                  </div>
                  <span className={totalH > 0 ? "text-[11px] font-semibold text-foreground" : "text-[11px] font-semibold text-muted-foreground"}>{entry.day}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 border-t border-border pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ background: "var(--primary)" }} />
              <span className="text-[11px] text-muted-foreground">Regular Hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ background: "var(--gold)" }} />
              <span className="text-[11px] text-muted-foreground">Overtime</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
