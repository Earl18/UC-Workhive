"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { InterviewSchedule, Applicant, DEPARTMENTS } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { formatDate, formatDateShort } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Video,
  MapPin,
  Clock,
  Pencil,
  CalendarPlus,
  RotateCcw,
} from "lucide-react";

const INTERVIEWERS = [
  "Maria Dela Cruz",
  "Juan Reyes",
  "Sophia Tan",
  "Anna Villanueva",
  "Christine Lim",
  "Patricia Bautista",
];

export function InterviewSchedulingPage() {
  const { applicants, jobPostings, employees, scheduleInterview, rescheduleInterview } = useWorkHive();
  const { toast } = useToast();

  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [interviewerFilter, setInterviewerFilter] = useState<string>("All");
  const [modal, setModal] = useState<{ applicant: Applicant; reschedule: boolean } | null>(null);

  const [form, setForm] = useState({
    date: "",
    time: "",
    interviewer: INTERVIEWERS[0],
    platform: "Video Conferencing" as "Video Conferencing" | "Face-to-Face",
    location: "",
  });

  // Interview-stage applicants
  const interviewApplicants = useMemo(
    () => applicants.filter((a) => a.stage === "Interview"),
    [applicants]
  );

  // All upcoming scheduled interviews
  const allScheduled = useMemo(() => {
    return applicants
      .filter((a) => a.schedule)
      .filter((a) => {
        if (deptFilter !== "All") {
          const job = jobPostings.find((j) => j.id === a.jobId);
          if (!job || job.department !== deptFilter) return false;
        }
        if (interviewerFilter !== "All" && a.schedule!.interviewer !== interviewerFilter) return false;
        return true;
      })
      .sort((a, b) => (a.schedule!.date).localeCompare(b.schedule!.date));
  }, [applicants, jobPostings, deptFilter, interviewerFilter]);

  function jobTitle(jobId: string) {
    return jobPostings.find((j) => j.id === jobId)?.title ?? "Unknown";
  }
  function jobDept(jobId: string) {
    return jobPostings.find((j) => j.id === jobId)?.department ?? "—";
  }

  function openSchedule(applicant: Applicant) {
    setModal({ applicant, reschedule: false });
    setForm({
      date: "",
      time: "",
      interviewer: INTERVIEWERS[0],
      platform: "Video Conferencing",
      location: "",
    });
  }
  function openReschedule(applicant: Applicant) {
    setModal({ applicant, reschedule: true });
    if (applicant.schedule) {
      setForm({
        date: applicant.schedule.date,
        time: applicant.schedule.time,
        interviewer: applicant.schedule.interviewer,
        platform: applicant.schedule.platform,
        location: applicant.schedule.location ?? "",
      });
    }
  }

  function submit() {
    if (!modal || !form.date || !form.time) {
      toast({ title: "Missing fields", description: "Date and time are required.", variant: "destructive" });
      return;
    }
    const schedule: InterviewSchedule = {
      id: modal.applicant.schedule?.id ?? `sch-${Date.now()}`,
      date: form.date,
      time: form.time,
      interviewer: form.interviewer,
      platform: form.platform,
      location: form.platform === "Face-to-Face" ? form.location : undefined,
    };
    if (modal.reschedule) {
      rescheduleInterview(modal.applicant.id, schedule);
      toast({ title: "Interview Rescheduled", description: `${modal.applicant.name} — ${formatDate(form.date)} ${form.time}` });
    } else {
      scheduleInterview(modal.applicant.id, schedule);
      toast({ title: "Interview Scheduled", description: `${modal.applicant.name} — ${formatDate(form.date)} ${form.time}` });
    }
    setModal(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Interview Scheduling</h1>
        <p className="text-sm text-muted-foreground">
          Plot and manage interviews for applicants in Interview stage
        </p>
      </div>

      {/* Two-column layout: to-schedule list + upcoming interviews */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* To Schedule */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" /> Awaiting Schedule ({interviewApplicants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-96 overflow-y-auto scroll-thin space-y-2">
              {interviewApplicants.length === 0 && (
                <p className="text-center text-muted-foreground py-6">No applicants awaiting scheduling.</p>
              )}
              {interviewApplicants.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <HexagonAvatar name={a.name} size={28} color="#1d4ed8" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{jobTitle(a.jobId)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {a.schedule && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => openReschedule(a)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reschedule
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 bg-primary"
                      onClick={() => openSchedule(a)}
                    >
                      <CalendarPlus className="h-3 w-3 mr-1" />
                      {a.schedule ? "Edit" : "Schedule"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming interviews */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <Calendar className="h-4 w-4" /> All Scheduled Interviews ({allScheduled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Departments</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={interviewerFilter} onValueChange={setInterviewerFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Interviewer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Interviewers</SelectItem>
                  {INTERVIEWERS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-80 overflow-y-auto scroll-thin space-y-2">
              {allScheduled.length === 0 && (
                <p className="text-center text-muted-foreground py-6">No scheduled interviews.</p>
              )}
              {allScheduled.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <HexagonAvatar name={a.name} size={28} color="#1d4ed8" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{jobTitle(a.jobId)} · {jobDept(a.jobId)}</p>
                      </div>
                    </div>
                    {a.schedule?.rescheduled && (
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                        <RotateCcw className="h-2.5 w-2.5 mr-1" /> Rescheduled
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <HexagonBadge color="#1d4ed8">
                      <Calendar className="h-2.5 w-2.5" /> {formatDateShort(a.schedule!.date)} · {a.schedule!.time}
                    </HexagonBadge>
                    <HexagonBadge color={a.schedule!.platform === "Video Conferencing" ? "#0e7490" : "#ca8a04"}>
                      {a.schedule!.platform === "Video Conferencing" ? <Video className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                      {a.schedule!.platform}
                    </HexagonBadge>
                    <span className="text-muted-foreground">· {a.schedule!.interviewer}</span>
                  </div>
                  {a.schedule?.location && (
                    <p className="text-[10px] text-muted-foreground mt-1">📍 {a.schedule.location}</p>
                  )}
                  {a.schedule?.rescheduled && a.schedule.previousDate && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      Previously: {formatDateShort(a.schedule.previousDate)}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => openReschedule(a)}>
                      <Pencil className="h-3 w-3 mr-1" /> Reschedule
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduling modal */}
      <Dialog open={!!modal} onOpenChange={(o) => { if (!o) setModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {modal?.reschedule ? "Reschedule Interview" : "Schedule Interview"}
            </DialogTitle>
            <DialogDescription>
              {modal && `Applicant: ${modal.applicant.name} — ${jobTitle(modal.applicant.jobId)}`}
            </DialogDescription>
          </DialogHeader>

          {modal?.applicant.schedule?.rescheduled && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              This interview has been rescheduled at least once. Previous slot:{" "}
              {modal.applicant.schedule.previousDate && formatDateShort(modal.applicant.schedule.previousDate)}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer</Label>
              <Select value={form.interviewer} onValueChange={(v) => setForm({ ...form, interviewer: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVIEWERS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  {/* Suggest employees from same dept */}
                  {employees
                    .filter((e) => !INTERVIEWERS.includes(e.lastName + ", " + e.firstName))
                    .slice(0, 3)
                    .map((e) => (
                      <SelectItem key={e.id} value={`${e.lastName}, ${e.firstName}`}>
                        {e.lastName}, {e.firstName} ({e.department})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as InterviewSchedule["platform"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Video Conferencing">Video Conferencing (auto-links to VC Room)</SelectItem>
                  <SelectItem value="Face-to-Face">Face-to-Face</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.platform === "Face-to-Face" && (
              <div className="space-y-1.5">
                <Label>Location / Room</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., HR Office, Room 201, Main Building"
                />
              </div>
            )}
            {form.platform === "Video Conferencing" && (
              <div className="rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
                <Video className="inline h-3.5 w-3.5 mr-1" />
                A Video Conferencing room will be auto-created. Find it under &quot;Video Conferencing&quot; once scheduled.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={submit} className="bg-primary">
              {modal?.reschedule ? "Reschedule" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
