"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Applicant, InterviewMode, InterviewSchedule, JobPosting } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { formatDate, formatDateShort } from "@/components/shared/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableFilterSelect } from "@/components/shared/filter-controls";
import { useToast } from "@/hooks/use-toast";
import { useHrApplications } from "@/hooks/use-applications";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Pencil, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkHive } from "@/lib/store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const TODAY_STRING = "2026-07-18";
const OFFICE_OPEN_TIME = "08:00";
const LAST_START_TIME = "16:00";
const OFFICE_CLOSE_TIME = "17:00";


type ScheduleModalState = {
  applicant: Applicant;
  reschedule: boolean;
} | null;

type InterviewFormState = {
  date: string;
  startTime: string;
  endTime: string;
  mode: InterviewMode;
  venueOrLink: string;
};

type ParsedSchedule = {
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  interviewer: string;
  createdBy: string;
  mode: InterviewMode;
  venueOrLink: string;
};

type LegacySchedule = InterviewSchedule & {
  interviewer?: string;
  platform?: string;
  location?: string;
};

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applicantDisplayName(applicant: Applicant) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

function addHours(time: string, hours: number) {
  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "10:00";
  }

  const totalMinutes = Math.min((hour * 60) + minute + (hours * 60), (23 * 60) + 59);
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nextMinute = String(totalMinutes % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

function toPickerTimeParts(time: string) {
  const [hourString, minuteString] = time.split(":");
  const hour24 = Number(hourString);
  const minute = String(Number.isNaN(Number(minuteString)) ? 0 : Number(minuteString)).padStart(2, "0");
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const normalizedHour = hour24 % 12 || 12;

  return {
    hour: String(normalizedHour).padStart(2, "0"),
    minute,
    period,
  };
}

function fromPickerTimeParts(hour: string, minute: string, period: "AM" | "PM") {
  const numericHour = Number(hour);
  if (!hour || !minute || Number.isNaN(numericHour)) {
    return "";
  }

  let hour24 = numericHour % 12;
  if (period === "PM") {
    hour24 += 12;
  }
    return `${String(period === "AM" && numericHour === 12 ? 0 : hour24).padStart(2, "0")}:${minute}`;
}

function parseStoredTimeRange(schedule: LegacySchedule) {
  if (schedule.startTime && schedule.endTime) {
    return { startTime: schedule.startTime, endTime: schedule.endTime };
  }

  if (schedule.time.includes(" - ")) {
    const [startTime, endTime] = schedule.time.split(" - ").map((value) => value.trim());
    if (startTime && endTime) {
      return { startTime, endTime };
    }
  }

  const fallbackStart = schedule.time || "09:00";
  return {
    startTime: fallbackStart,
    endTime: addHours(fallbackStart, 1),
  };
}

function formatClockTime(time: string) {
  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${formatClockTime(startTime)} - ${formatClockTime(endTime)}`;
}

function toMinutes(time: string) {
  const [hourString, minuteString] = time.split(":");
  return (Number(hourString) * 60) + Number(minuteString);
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function hasScheduleWindowForDate(date: string, currentTime: string) {
  if (date != TODAY_STRING) {
    return true;
  }

  return toMinutes(currentTime) <= toMinutes(LAST_START_TIME);
}

function parseSchedule(schedule?: Applicant["schedule"] | null): ParsedSchedule | null {
  if (!schedule) {
    return null;
  }

  const legacy = schedule as LegacySchedule;
  const mode: InterviewMode = legacy.mode ?? (legacy.platform === "Face-to-Face" ? "Onsite" : "Online");
  const interviewer = legacy.panel?.[0] ?? legacy.interviewer ?? "TBD";
  const createdBy = legacy.createdBy ?? interviewer;
  const venueOrLink = legacy.venueOrLink ?? legacy.location ?? (mode === "Online" ? "Video Conferencing Room" : "");
  const { startTime, endTime } = parseStoredTimeRange(legacy);

  return {
    date: legacy.date,
    time: formatTimeRange(startTime, endTime),
    startTime,
    endTime,
    interviewer,
    createdBy,
    mode,
    venueOrLink,
  };
}

function isOwnedByUser(schedule: ParsedSchedule | null, currentUserName: string) {
  if (!schedule) {
    return false;
  }

  return schedule.createdBy === currentUserName || schedule.interviewer === currentUserName;
}

function buildForm(applicant: Applicant, date: string): InterviewFormState {
  const schedule = parseSchedule(applicant.schedule);
  return {
    date,
    startTime: schedule?.date === date ? schedule.startTime : "09:00",
    endTime: schedule?.date === date ? schedule.endTime : "10:00",
    mode: "Onsite",
    venueOrLink: schedule?.mode === "Onsite" ? schedule.venueOrLink : "HR Office, Room 201, Main Building",
  };
}

function jobTitleById(jobPostings: Array<Pick<JobPosting, "id" | "title">>, jobId?: string | null) {
  return jobPostings.find((jobPosting) => jobPosting.id === jobId)?.title ?? "Unknown position";
}

function jobDepartmentById(jobPostings: Array<Pick<JobPosting, "id" | "department">>, jobId?: string | null) {
  return jobPostings.find((jobPosting) => jobPosting.id === jobId)?.department ?? "-";
}

export function InterviewSchedulingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useWorkHive();
  const applicationsQuery = useHrApplications();
  const jobPostingsQuery = useStaffJobPostings();
  const currentUserName = currentUser?.name ?? "HR";

  const applicants = applicationsQuery.data ?? [];
  const jobPostings = jobPostingsQuery.data?.jobPostings ?? [];

  const interviewApplicants = useMemo(() => {
    return applicants
      .filter((applicant) => applicant.stage === "Interview")
      .sort((left, right) => applicantDisplayName(left).localeCompare(applicantDisplayName(right)));
  }, [applicants]);

  const ownScheduledApplicants = useMemo(() => {
    return interviewApplicants
      .map((applicant) => ({ applicant, schedule: parseSchedule(applicant.schedule) }))
      .filter((entry) => isOwnedByUser(entry.schedule, currentUserName))
      .sort((left, right) => `${left.schedule?.date} ${left.schedule?.startTime}`.localeCompare(`${right.schedule?.date} ${right.schedule?.startTime}`));
  }, [currentUserName, interviewApplicants]);

  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [positionFilter, setPositionFilter] = useState<string>("All");
  const [modeFilter, setModeFilter] = useState<string>("All");
  const [interviewerFilter, setInterviewerFilter] = useState<string>("All");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(6);
  const [modal, setModal] = useState<ScheduleModalState>(null);
  const currentTime = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, []);
  const [form, setForm] = useState<InterviewFormState>({
    date: TODAY_STRING,
    startTime: "09:00",
    endTime: "10:00",
    mode: "Onsite",
    venueOrLink: "HR Office, Room 201, Main Building",
  });

  const effectiveSelectedApplicantId = useMemo(() => {
    if (!interviewApplicants.length) {
      return null;
    }

    if (selectedApplicantId && interviewApplicants.some((applicant) => applicant.id === selectedApplicantId)) {
      return selectedApplicantId;
    }

    return interviewApplicants[0].id;
  }, [interviewApplicants, selectedApplicantId]);

  const selectedApplicant = useMemo(
    () => interviewApplicants.find((applicant) => applicant.id === effectiveSelectedApplicantId) ?? null,
    [effectiveSelectedApplicantId, interviewApplicants],
  );

  const scheduleMutation = useMutation({
    mutationFn: async ({ applicantId, schedule }: { applicantId: string; schedule: InterviewSchedule }) => {
      const response = await fetch(`/api/hr/applications/${applicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      const payload = (await response.json()) as { applicant?: Applicant; error?: string };
      if (!response.ok || !payload.applicant) {
        throw new Error(payload.error ?? "Unable to update interview schedule.");
      }
      return payload.applicant;
    },
    onSuccess: async (_updatedApplicant, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["hr-applications"] });
      const movedApplicant = interviewApplicants.find((applicant) => applicant.id === variables.applicantId);
      toast({
        title: modal?.reschedule ? "Interview Rescheduled" : "Interview Scheduled",
        description: `${applicantDisplayName(movedApplicant ?? modal?.applicant ?? ({ name: "Applicant" } as Applicant))} - ${formatDate(variables.schedule.date)} ${formatTimeRange(variables.schedule.startTime ?? "09:00", variables.schedule.endTime ?? "10:00")}`,
      });
      setModal(null);
    },
    onError: (error) => {
      toast({
        title: "Unable to save interview schedule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const departmentOptions = useMemo(
    () => Array.from(new Set(jobPostings.map((jobPosting) => jobPosting.department).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [jobPostings],
  );

  const positionOptions = useMemo(
    () => Array.from(new Set(ownScheduledApplicants.map(({ applicant }) => jobTitleById(jobPostings, applicant.jobId)).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [jobPostings, ownScheduledApplicants],
  );

  const modeOptions = useMemo(
    () => Array.from(new Set(ownScheduledApplicants.map(({ schedule }) => schedule?.mode).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [ownScheduledApplicants],
  );

  const interviewerOptions = useMemo(
    () => Array.from(new Set(ownScheduledApplicants.map(({ schedule }) => schedule?.interviewer).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [ownScheduledApplicants],
  );

  const scheduledApplicants = useMemo(() => {
    return ownScheduledApplicants.filter(({ applicant, schedule }) => {
      if (!schedule) {
        return false;
      }

      const position = jobTitleById(jobPostings, applicant.jobId);
      const department = jobDepartmentById(jobPostings, applicant.jobId);

      return (deptFilter === "All" || department === deptFilter)
        && (positionFilter === "All" || position === positionFilter)
        && (modeFilter === "All" || schedule.mode === modeFilter)
        && (interviewerFilter === "All" || schedule.interviewer === interviewerFilter);
    });
  }, [deptFilter, interviewerFilter, jobPostings, modeFilter, ownScheduledApplicants, positionFilter]);
  const scheduledThisMonth = useMemo(() => {
    return ownScheduledApplicants.filter(({ schedule }) => {
      if (!schedule) {
        return false;
      }
      const date = new Date(`${schedule.date}T00:00:00`);
      return date.getFullYear() === calendarYear && date.getMonth() === calendarMonth;
    });
  }, [calendarMonth, calendarYear, ownScheduledApplicants]);

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  function countScheduledByDay(day: number) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return scheduledThisMonth.filter(({ schedule }) => schedule?.date === dateStr).length;
  }

  function handlePrevMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((value) => value - 1);
      return;
    }
    setCalendarMonth((value) => value - 1);
  }

  function handleNextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((value) => value + 1);
      return;
    }
    setCalendarMonth((value) => value + 1);
  }

  function openScheduleForDate(applicant: Applicant, date: string) {
    setModal({ applicant, reschedule: Boolean(isOwnedByUser(parseSchedule(applicant.schedule), currentUserName)) });
    setForm(buildForm(applicant, date));
  }

  function handleCalendarDateClick(day: number) {
    if (!selectedApplicant) {
      toast({
        title: "Select an applicant first",
        description: "Choose an applicant from the Interview table before clicking a calendar date.",
        variant: "destructive",
      });
      return;
    }

    const selectedDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (selectedDate < TODAY_STRING || !hasScheduleWindowForDate(selectedDate, currentTime)) {
      return;
    }

    openScheduleForDate(selectedApplicant, selectedDate);
  }

  function openReschedule(applicant: Applicant) {
    const schedule = parseSchedule(applicant.schedule);
    if (!schedule || !isOwnedByUser(schedule, currentUserName)) {
      return;
    }

    setModal({ applicant, reschedule: true });
    setForm(buildForm(applicant, schedule.date));
  }

  function submit() {
    if (!modal || !form.date || !form.startTime || !form.endTime) {
      toast({ title: "Missing fields", description: "A valid time range is required.", variant: "destructive" });
      return;
    }

    if (form.date < TODAY_STRING) {
      toast({ title: "Invalid date", description: "You cannot schedule an interview on a past date.", variant: "destructive" });
      return;
    }

    if (toMinutes(form.startTime) < toMinutes(OFFICE_OPEN_TIME) || toMinutes(form.startTime) > toMinutes(LAST_START_TIME)) {
      toast({ title: "Outside office hours", description: "Interview start time must be between 8:00 AM and 4:00 PM.", variant: "destructive" });
      return;
    }

    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      toast({ title: "Invalid duration", description: "End time must be later than the start time.", variant: "destructive" });
      return;
    }

    if (toMinutes(form.endTime) > toMinutes(OFFICE_CLOSE_TIME)) {
      toast({ title: "Outside office hours", description: "Interview end time cannot go beyond 5:00 PM.", variant: "destructive" });
      return;
    }

    if (form.date === TODAY_STRING && toMinutes(form.startTime) <= toMinutes(currentTime)) {
      toast({ title: "Invalid time", description: "On Saturday, July 18, 2026, you cannot schedule an interview that starts in the past.", variant: "destructive" });
      return;
    }

    if (!hasScheduleWindowForDate(form.date, currentTime)) {
      toast({ title: "Office closed", description: "No more interview slots are available today after office hours.", variant: "destructive" });
      return;
    }

    if (form.mode === "Onsite" && !form.venueOrLink.trim()) {
      toast({ title: "Missing venue", description: "Please provide a room or venue for an onsite interview.", variant: "destructive" });
      return;
    }

    const conflictingApplicant = ownScheduledApplicants.find(({ applicant, schedule }) => {
      if (!schedule || applicant.id === modal.applicant.id) {
        return false;
      }

      return schedule.date === form.date && rangesOverlap(form.startTime, form.endTime, schedule.startTime, schedule.endTime);
    });

    if (conflictingApplicant?.schedule) {
      toast({
        title: "Time slot unavailable",
        description: `${formatTimeRange(form.startTime, form.endTime)} overlaps with your schedule for ${applicantDisplayName(conflictingApplicant.applicant)}.`,
        variant: "destructive",
      });
      return;
    }

    const schedule: InterviewSchedule = {
      date: form.date,
      time: `${form.startTime} - ${form.endTime}`,
      startTime: form.startTime,
      endTime: form.endTime,
      mode: form.mode,
      venueOrLink: form.mode === "Online" ? (form.venueOrLink.trim() || "Video Conferencing Room") : form.venueOrLink.trim(),
      panel: [currentUserName],
      createdBy: currentUserName,
    };

    scheduleMutation.mutate({ applicantId: modal.applicant.id, schedule });
  }

  if (applicationsQuery.isLoading || jobPostingsQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading interview scheduling...</div>;
  }

  if (applicationsQuery.error || jobPostingsQuery.error) {
    const message = applicationsQuery.error instanceof Error
      ? applicationsQuery.error.message
      : jobPostingsQuery.error instanceof Error
        ? jobPostingsQuery.error.message
        : "Unable to load interview scheduling data.";
    return <div className="p-6 text-muted-foreground">{message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Interview Scheduling</h1>
        <p className="text-sm text-muted-foreground">Click a calendar date first, then assign a time range. Only your own interview bookings are shown here.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </CardTitle>
                <CardDescription>Calendar counters and booking conflicts only use your own interview schedule.</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={handlePrevMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={handleNextMonth} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{weekday}</div>
              ))}
              {cells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const date = new Date(calendarYear, calendarMonth, day);
                const dateStr = toLocalDateString(date);
                const scheduledCount = countScheduledByDay(day);
                const disabled = dateStr < TODAY_STRING || !hasScheduleWindowForDate(dateStr, currentTime);
                const isToday = dateStr === TODAY_STRING;

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleCalendarDateClick(day)}
                    disabled={disabled}
                    className={cn(
                      "relative flex aspect-square flex-col items-start justify-start rounded-lg border bg-card p-2 text-left text-xs transition",
                      disabled ? "cursor-not-allowed border-border/60 bg-muted/20 text-muted-foreground opacity-60" : "hover:border-primary/50 hover:bg-primary/5",
                      isToday ? "border-primary ring-1 ring-primary" : "border-border",
                    )}
                  >
                    <span className={cn("font-semibold", isToday && !disabled && "text-primary")}>{day}</span>
                    {scheduledCount > 0 ? (
                      <span className="mt-1 inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {scheduledCount} interview{scheduledCount !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="mt-1 text-[10px] text-muted-foreground">{disabled ? (dateStr === TODAY_STRING ? "Office closed" : "Past date") : "Available"}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2 py-1 text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Your scheduled interviews</span>
              <span>Selected applicant: <strong className="text-foreground">{selectedApplicant ? applicantDisplayName(selectedApplicant) : "None"}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Interview Table</CardTitle>
            <CardDescription>Select an Interview-stage applicant, then click a calendar date to assign your own interview slot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground">
              1. Select an applicant here.
              <br />
              2. Click a future calendar date.
              <br />
              3. Set a start and end time for your interview.
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto scroll-thin">
              {interviewApplicants.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No applicants are currently in the Interview stage.</p>
              ) : (
                interviewApplicants.map((applicant) => {
                  const schedule = parseSchedule(applicant.schedule);
                  const ownSchedule = isOwnedByUser(schedule, currentUserName) ? schedule : null;
                  const isSelected = applicant.id === effectiveSelectedApplicantId;

                  return (
                    <button
                      key={applicant.id}
                      type="button"
                      onClick={() => setSelectedApplicantId(applicant.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition",
                        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <HexagonAvatar name={applicantDisplayName(applicant)} size={34} color="#1d4ed8" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{applicantDisplayName(applicant)}</p>
                            {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
                            {ownSchedule ? <Badge variant="outline">Your Schedule</Badge> : <Badge variant="outline">Awaiting Schedule</Badge>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{jobTitleById(jobPostings, applicant.jobId)}</p>
                          <p className="truncate text-xs text-muted-foreground">{jobDepartmentById(jobPostings, applicant.jobId)}</p>
                          {ownSchedule ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <HexagonBadge color="#1d4ed8"><Clock className="h-2.5 w-2.5" /> {formatDateShort(ownSchedule.date)} - {ownSchedule.time}</HexagonBadge>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarPlus className="h-4 w-4 text-primary" /> My Scheduled Interviews ({scheduledApplicants.length})</CardTitle>
          <CardDescription>Other HR schedules are hidden from this account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              <SearchableFilterSelect
                label="Department"
                value={deptFilter}
                onValueChange={setDeptFilter}
                options={[{ value: "All", label: "All Departments" }, ...departmentOptions.map((department) => ({ value: department, label: department }))]}
                searchPlaceholder="Search department..."
                emptyLabel="No department found."
                labelClassName="text-sm font-medium text-foreground"
                triggerClassName="h-11 rounded-xl bg-background text-left hover:bg-background"
              />
              <SearchableFilterSelect
                label="Position"
                value={positionFilter}
                onValueChange={setPositionFilter}
                options={[{ value: "All", label: "All Positions" }, ...positionOptions.map((position) => ({ value: position, label: position }))]}
                searchPlaceholder="Search position..."
                emptyLabel="No position found."
                labelClassName="text-sm font-medium text-foreground"
                triggerClassName="h-11 rounded-xl bg-background text-left hover:bg-background"
              />
              <SearchableFilterSelect
                label="Mode"
                value={modeFilter}
                onValueChange={setModeFilter}
                options={[{ value: "All", label: "All Modes" }, ...modeOptions.map((mode) => ({ value: mode, label: mode }))]}
                searchPlaceholder="Search mode..."
                emptyLabel="No mode found."
                labelClassName="text-sm font-medium text-foreground"
                triggerClassName="h-11 rounded-xl bg-background text-left hover:bg-background"
              />
              <SearchableFilterSelect
                label="Interviewer"
                value={interviewerFilter}
                onValueChange={setInterviewerFilter}
                options={[{ value: "All", label: "All Interviewers" }, ...interviewerOptions.map((interviewer) => ({ value: interviewer, label: interviewer }))]}
                searchPlaceholder="Search interviewer..."
                emptyLabel="No interviewer found."
                labelClassName="text-sm font-medium text-foreground"
                triggerClassName="h-11 rounded-xl bg-background text-left hover:bg-background"
              />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Records</Label>
                <div className="flex h-11 w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                  {scheduledApplicants.length} of {ownScheduledApplicants.length} interviews
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="align-middle">Applicant</TableHead>
                  <TableHead className="align-middle">Position</TableHead>
                  <TableHead className="align-middle">Department</TableHead>
                  <TableHead className="align-middle">Schedule</TableHead>
                  <TableHead className="align-middle">Mode</TableHead>
                  <TableHead className="align-middle">Interviewer</TableHead>
                  <TableHead className="align-middle">Venue</TableHead>
                  <TableHead className="text-right align-middle">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledApplicants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      You do not have any scheduled interviews matching the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  scheduledApplicants.map(({ applicant, schedule }) => {
                    if (!schedule) {
                      return null;
                    }

                    return (
                      <TableRow key={applicant.id} className="align-middle">
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-3 py-1">
                            <HexagonAvatar name={applicantDisplayName(applicant)} size={34} color="#1d4ed8" />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{applicantDisplayName(applicant)}</p>
                              <p className="text-xs text-muted-foreground">{applicant.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">{jobTitleById(jobPostings, applicant.jobId)}</TableCell>
                        <TableCell className="align-middle">{jobDepartmentById(jobPostings, applicant.jobId)}</TableCell>
                        <TableCell className="align-middle">
                          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {formatDateShort(schedule.date)} - {schedule.time}
                          </span>
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {schedule.mode}
                          </span>
                        </TableCell>
                        <TableCell className="align-middle">{schedule.interviewer}</TableCell>
                        <TableCell className="max-w-[220px] align-middle">{schedule.venueOrLink}</TableCell>
                        <TableCell className="text-right align-middle">
                          <Button size="sm" variant="outline" onClick={() => openReschedule(applicant)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Reschedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><Clock className="h-5 w-5" /> {modal?.reschedule ? "Reschedule Interview" : "Schedule Interview"}</DialogTitle>
            <DialogDescription>
              {modal ? `${applicantDisplayName(modal.applicant)} - ${jobTitleById(jobPostings, modal.applicant.jobId)} on ${formatDate(form.date)}` : "Select the interview details below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InterviewTimeField
                label="Start Time"
                value={form.startTime}
                minTime={form.date === TODAY_STRING ? (toMinutes(currentTime) > toMinutes(OFFICE_OPEN_TIME) ? currentTime : OFFICE_OPEN_TIME) : OFFICE_OPEN_TIME}
                maxTime={LAST_START_TIME}
                onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
              />
              <InterviewTimeField
                label="End Time"
                value={form.endTime}
                minTime={form.startTime || (form.date === TODAY_STRING ? currentTime : OFFICE_OPEN_TIME)}
                maxTime={OFFICE_CLOSE_TIME}
                onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
              />
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground">
              Duration: {formatTimeRange(form.startTime || "09:00", form.endTime || "10:00")}
            </div>
            {!hasScheduleWindowForDate(form.date, currentTime) ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Office hours for Saturday, July 18, 2026 are already closed for new interview starts.
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Interviewer</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {currentUserName}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Interview Mode</Label>
              <Select disabled value="Onsite">
                <SelectTrigger className="h-11 bg-muted/40 text-muted-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Online interviews are temporarily unavailable while this feature is under development.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Link / Room</Label>
              <Input disabled readOnly className="h-11 bg-muted/40 text-muted-foreground" value="Under development" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={scheduleMutation.isPending}>Cancel</Button>
            <Button onClick={submit} className="bg-primary" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {modal?.reschedule ? "Reschedule" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function InterviewTimeField({
  label,
  value,
  minTime,
  maxTime,
  onChange,
}: {
  label: string;
  value: string;
  minTime?: string;
  maxTime?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const timeParts = useMemo(() => toPickerTimeParts(value || "09:00"), [value]);
  const minMinutes = minTime ? toMinutes(minTime) : undefined;
  const maxMinutes = maxTime ? toMinutes(maxTime) : undefined;
  const allowedTimes = useMemo(() => {
    const values: string[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
      if (minMinutes !== undefined && minutes < minMinutes) {
        continue;
      }
      if (maxMinutes !== undefined && minutes > maxMinutes) {
        continue;
      }
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
      const minute = String(minutes % 60).padStart(2, "0");
      values.push(`${hour}:${minute}`);
    }
    return values;
  }, [maxMinutes, minMinutes]);
  const availableHours = useMemo(() => Array.from(new Set(allowedTimes.map((time) => toPickerTimeParts(time).hour))), [allowedTimes]);
  const availableMinutes = useMemo(() => {
    return Array.from(
      new Set(
        allowedTimes
          .map((time) => ({ raw: time, parts: toPickerTimeParts(time) }))
          .filter(({ parts }) => parts.hour === timeParts.hour && parts.period === timeParts.period)
          .map(({ parts }) => parts.minute),
      ),
    );
  }, [allowedTimes, timeParts.hour, timeParts.period]);
  const availablePeriods = useMemo(() => {
    return Array.from(
      new Set(
        allowedTimes
          .map((time) => toPickerTimeParts(time))
          .filter((parts) => parts.hour === timeParts.hour)
          .map((parts) => parts.period),
      ),
    );
  }, [allowedTimes, timeParts.hour]);

  function updateTime(next: Partial<ReturnType<typeof toPickerTimeParts>>) {
    const hour = next.hour ?? timeParts.hour;
    const minute = next.minute ?? timeParts.minute;
    const period = next.period ?? timeParts.period;
    const nextValue = fromPickerTimeParts(hour, minute, period);
    if (!nextValue) {
      return;
    }
    if ((minMinutes !== undefined && toMinutes(nextValue) < minMinutes) || (maxMinutes !== undefined && toMinutes(nextValue) > maxMinutes)) {
      return;
    }
    onChange(nextValue);
  }

  const outsideAllowedRange = allowedTimes.length === 0 || (minMinutes !== undefined && toMinutes(value) < minMinutes) || (maxMinutes !== undefined && toMinutes(value) > maxMinutes);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={allowedTimes.length === 0}
            className={cn(
              "h-11 w-full justify-between rounded-md border-input bg-background px-4 text-left font-normal shadow-xs hover:bg-background",
              outsideAllowedRange && "border-destructive/40 text-destructive",
            )}
          >
            <span>{allowedTimes.length === 0 ? "No available time" : formatClockTime(value)}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-[min(16.5rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <div className="mt-1 text-xs text-muted-foreground">Choose the interview time using the website picker.</div>
          </div>
          <div className="space-y-3 px-3 pb-4 pt-4">
            <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground">
              <span>{formatClockTime(value)}</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {allowedTimes.length === 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                No selectable times remain within office hours for this field.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
              <Select value={timeParts.hour} onValueChange={(nextHour) => updateTime({ hour: nextHour })}>
                <SelectTrigger className="h-9 w-full rounded-lg border-input bg-background px-3 font-medium">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-72 min-w-0">
                  {availableHours.map((hour) => (
                    <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeParts.minute} onValueChange={(nextMinute) => updateTime({ minute: nextMinute })}>
                <SelectTrigger className="h-9 w-full rounded-lg border-input bg-background px-3 font-medium">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-72 min-w-0">
                  {availableMinutes.map((minute) => (
                    <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeParts.period} onValueChange={(nextPeriod) => updateTime({ period: nextPeriod as "AM" | "PM" })}>
                <SelectTrigger className="h-9 w-full rounded-lg border-input bg-background px-3 font-medium">
                  <SelectValue placeholder="AM/PM" />
                </SelectTrigger>
                <SelectContent className="min-w-0">
                  {availablePeriods.map((period) => (
                    <SelectItem key={period} value={period}>{period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="space-y-1 text-xs text-muted-foreground">
              {minTime ? <p>Earliest allowed time: {formatClockTime(minTime)}</p> : null}
              {maxTime ? <p>Latest allowed time: {formatClockTime(maxTime)}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-9 rounded-lg px-3 text-muted-foreground" onClick={() => setOpen(false)}>Close</Button>
              <Button type="button" className="h-9 rounded-lg px-3" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}















