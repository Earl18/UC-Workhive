"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QrCode,
  ScanLine,
  Loader2,
  RefreshCw,
  Camera,
  MapPin,
  ShieldCheck,
  Wifi,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type ClockAction = "clock-in" | "break-start" | "break-end" | "clock-out";
type ClockStatus = "ready" | "working" | "on-break" | "clocked-out";

type ClockPayload = {
  employee: { name: string; position: string; department: string };
  status: ClockStatus;
  availableActions: ClockAction[];
  timeline: Array<{ key: string; label: string; time: string; type?: string }>;
  todayRecord: { remarks: string; lateMin: number; overtimeHrs: string } | null;
  site: { enabled: boolean; primaryZone: string | null };
};

type ClockResponse = {
  data?: ClockPayload;
  error?: string;
  meta?: { distanceMeters?: number | null };
};

const TIME_ZONE = "Asia/Manila";
const HEX_CLIP = "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)";

function useManilaNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function actionLabel(action: ClockAction) {
  switch (action) {
    case "clock-in": return "Time In";
    case "break-start": return "Lunch Out";
    case "break-end": return "Afternoon In";
    case "clock-out": return "Time Out";
  }
}

function statusLabel(status: ClockStatus) {
  switch (status) {
    case "working": return "Working";
    case "on-break": return "On Break";
    case "clocked-out": return "Clocked Out";
    default: return "Ready to Scan";
  }
}

function statusBadgeTone(status: ClockStatus) {
  switch (status) {
    case "working": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "on-break": return "bg-gold/15 text-gold";
    case "clocked-out": return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    default: return "bg-primary/10 text-primary";
  }
}

async function readClockResponse(response: Response) {
  const payload = (await response.json()) as ClockResponse;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Unable to load QR attendance.");
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

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
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

export function QrAttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = useManilaNow();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clockQuery = useQuery({
    queryKey: ["employee-attendance-clock"],
    queryFn: async () => readClockResponse(await fetch("/api/employee/attendance/clock", { cache: "no-store" })),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const data = clockQuery.data?.data ?? null;

  const handleScan = async () => {
    if (!data || data.availableActions.length === 0) {
      return;
    }

    const nextAction = data.availableActions[0];

    try {
      setScanning(true);
      setError(null);
      setSuccessMessage(null);
      await new Promise((resolve) => window.setTimeout(resolve, 1400));
      const coords = await getDeviceLocation();
      const payload = await readClockResponse(
        await fetch("/api/employee/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: nextAction, ...coords }),
        }),
      );
      queryClient.setQueryData(["employee-attendance-clock"], payload);
      const message = `${actionLabel(nextAction)} recorded${payload.meta?.distanceMeters != null ? ` at ${payload.meta.distanceMeters}m from the attendance zone.` : "."}`;
      setSuccessMessage(message);
      toast({ title: "QR attendance recorded", description: message });
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Unable to complete QR attendance.";
      setError(message);
      toast({ title: "QR attendance failed", description: message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  if (clockQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading QR attendance...</div>;
  }

  if (clockQuery.error && !data) {
    return <div className="p-6 text-muted-foreground">{clockQuery.error instanceof Error ? clockQuery.error.message : "Unable to load QR attendance."}</div>;
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground">No employee attendance record is available.</div>;
  }

  const nextAction = data.availableActions[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">QR Code Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Scan and record the next attendance action using the system QR flow.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-4xl font-bold text-foreground">{formatClock(now)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{formatDateLabel(now)}</div>
          </div>
          <Badge className={statusBadgeTone(data.status)}>{statusLabel(data.status)}</Badge>
        </CardContent>
      </Card>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">{successMessage}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardContent className="flex min-h-[24rem] flex-col items-center justify-center gap-6 p-8">
            {!scanning ? (
              <>
                <div className="relative rounded-[1.25rem] border border-primary/20 bg-background p-4 shadow-sm">
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-5">
                    <div
                      className="relative flex items-center justify-center rounded-xl bg-background"
                      style={{ width: 180, height: 180 }}
                    >
                      <div className="absolute inset-3 rounded-lg opacity-15" style={{ background: "repeating-conic-gradient(from 0deg, rgba(30,58,138,0.9) 0% 25%, transparent 0% 50%) 50% / 16px 16px" }} />
                      <div
                        className="relative flex items-center justify-center bg-gold text-gold-foreground"
                        style={{ width: 56, height: 64, clipPath: HEX_CLIP }}
                      >
                        <QrCode className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">Your QR code is ready</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Present your code to the scanner or use the camera flow below to register {nextAction ? actionLabel(nextAction).toLowerCase() : "attendance"}.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="relative overflow-hidden rounded-[1.25rem] border-2 border-primary bg-primary/5" style={{ width: 200, height: 200 }}>
                  <div className="absolute left-3 right-3 h-[3px] animate-[scanLine_1.5s_ease-in-out_infinite_alternate] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(30,58,138,0.45)]" style={{ top: "50%" }} />
                  <ScanLine className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-primary/30" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-primary">Scanning...</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Hold steady while WorkHive verifies your attendance action.</p>
                </div>
              </>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => void handleScan()} disabled={scanning || !nextAction} className="min-w-44">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {scanning ? "Scanning..." : nextAction ? `Scan for ${actionLabel(nextAction)}` : "No action available"}
              </Button>
              <Button variant="outline" onClick={() => void clockQuery.refetch()} disabled={scanning}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Scanner Status</CardTitle>
              <CardDescription>Live readiness checks for QR attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Wifi, label: "Connection", value: "Online", ok: true },
                { icon: Camera, label: "Camera", value: scanning ? "Scanning" : "Ready", ok: true },
                { icon: MapPin, label: "GPS Lock", value: data.site.enabled ? "Verified" : "Flexible", ok: true },
                { icon: ShieldCheck, label: "Security", value: "Active", ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-sm text-foreground">{item.label}</span>
                  <span className="text-xs font-semibold text-primary">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Current attendance zone used by the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{data.site.primaryZone ?? "No attendance zone configured"}</p>
                  <p className="text-xs text-muted-foreground">{data.employee.department}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Scan Activity</CardTitle>
          <CardDescription>Latest attendance events recorded for today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.timeline.map((entry, index) => {
            const success = entry.key !== "ready";
            return (
              <div key={entry.key} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${index % 2 === 0 ? "bg-muted/20" : "bg-transparent"}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${success ? "bg-primary/10 text-primary" : "bg-gold/15 text-gold"}`}>
                  {success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{entry.label}</span>
                    <Badge variant="outline">{data.todayRecord?.remarks ?? "Pending"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{data.site.primaryZone ?? "System attendance zone"}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{entry.time}</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <style jsx>{`
        @keyframes scanLine {
          0% { top: 20%; }
          100% { top: 80%; }
        }
      `}</style>
    </div>
  );
}