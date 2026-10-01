"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Applicant } from "@/lib/types";
import { useHrApplications } from "@/hooks/use-applications";
import { useWorkHive } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus, Copy, Loader2, Video } from "lucide-react";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { SearchableFilterSelect } from "@/components/shared/filter-controls";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { formatDateShort } from "@/components/shared/helpers";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InterviewScoringPanel, type InterviewScoringPanelHandle } from "@/components/pages/hr/interview-scoring-panel";

type ExternalApi = {
  addListener: (event: string, handler: (event: { role?: string }) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
};

type JitsiWindow = Window & {
  JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => ExternalApi;
};

function applicantName(applicant: Applicant) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

function interviewTitle(applicant: Applicant) {
  const parts = applicantName(applicant).trim().split(/\s+/);
  const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
  return `Interview: ${displayName}`;
}

function HiveConnectRoom({ applicantId, compact, onMeetingStarted, onMeetingEnded }: { applicantId: string; compact: boolean; onMeetingStarted: () => void; onMeetingEnded: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Connecting to UC HiveConnect...");
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let api: ExternalApi | undefined;
    let script: HTMLScriptElement | undefined;

    async function join() {
      setError(false);
      setMessage("Connecting to UC HiveConnect...");
      try {
        const response = await fetch(`/api/hr/interviews/${encodeURIComponent(applicantId)}/moderator`, { cache: "no-store" });
        const data = await response.json() as { baseUrl?: string; room?: string; token?: string; error?: string };
        if (!response.ok || !data.baseUrl || !data.room || !data.token) {
          throw new Error(data.error || "Unable to open the interview room.");
        }
        if (disposed) return;
        const base = new URL(data.baseUrl);
        script = document.createElement("script");
        script.src = `${base.origin}/external_api.js`;
        script.async = true;
        script.onload = () => {
          if (disposed || !container.current) return;
          const Constructor = (window as JitsiWindow).JitsiMeetExternalAPI;
          if (!Constructor) {
            setError(true);
            setMessage("UC HiveConnect did not load.");
            return;
          }
          api = new Constructor(base.host, {
            roomName: data.room,
            jwt: data.token,
            parentNode: container.current,
            width: "100%",
            height: "100%",
          });
          api.addListener("participantRoleChanged", (event) => {
            if (event.role === "moderator") {
              api?.executeCommand("toggleLobby", true);
              setMessage("Moderator connected. Admit guests from the HiveConnect lobby.");
            }
          });
          api.addListener("videoConferenceJoined", onMeetingStarted);
          api.addListener("videoConferenceLeft", () => { if (!disposed) onMeetingEnded(); });
          api.addListener("readyToClose", () => { if (!disposed) onMeetingEnded(); });
        };
        script.onerror = () => {
          if (!disposed) {
            setError(true);
            setMessage("Cannot reach UC HiveConnect. Check that its server is running and the browser trusts its HTTPS certificate.");
          }
        };
        document.body.appendChild(script);
      } catch (cause) {
        if (!disposed) {
          setError(true);
          setMessage(cause instanceof Error ? cause.message : "Unable to open the interview room.");
        }
      }
    }

    void join();
    return () => {
      disposed = true;
      api?.dispose();
      script?.remove();
    };
  }, [applicantId, onMeetingStarted, onMeetingEnded]);

  return <div className={`flex h-full flex-col overflow-hidden rounded-xl border bg-card ${compact ? "min-h-0" : "min-h-[540px]"}`}>
    <div role="status" className={`border-b px-4 py-2 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message}</div>
    <div ref={container} className={compact ? "min-h-0 flex-1" : "min-h-[500px] flex-1"} />
  </div>;
}

export function VideoConferencingPage({ active = true }: { active?: boolean }) {
  const { toast } = useToast();
  const { currentUser, selectedVideoApplicantId, setSelectedVideoApplicantId, setView } = useWorkHive();
  const [meetingStartedApplicantId, setMeetingStartedApplicantId] = useState<string | null>(null);
  const [hasUnsavedEvaluation, setHasUnsavedEvaluation] = useState(false);
  const scoringPanelRef = useRef<InterviewScoringPanelHandle>(null);
  const endingRef = useRef(false);
  const closeRoom = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      const saved = await scoringPanelRef.current?.saveBeforeClose();
      if (saved === false) return;
      setMeetingStartedApplicantId(null);
      setHasUnsavedEvaluation(false);
      setSelectedVideoApplicantId(null);
    } finally {
      endingRef.current = false;
    }
  }, [setSelectedVideoApplicantId]);
  const closeSubmittedRoom = useCallback(() => {
    setMeetingStartedApplicantId(null);
    setHasUnsavedEvaluation(false);
    setSelectedVideoApplicantId(null);
  }, [setSelectedVideoApplicantId]);
  const meetingStarted = useCallback(() => {
    setMeetingStartedApplicantId(useWorkHive.getState().selectedVideoApplicantId);
  }, []);
  const openRoom = useCallback((applicantId: string) => {
    if (hasUnsavedEvaluation && !window.confirm("This interview evaluation has unsaved changes. Open another room anyway?")) return;
    setMeetingStartedApplicantId(null);
    setHasUnsavedEvaluation(false);
    setSelectedVideoApplicantId(applicantId);
  }, [hasUnsavedEvaluation, setSelectedVideoApplicantId]);
  const applicationsQuery = useHrApplications();
  const jobPostingsQuery = useStaffJobPostings();
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const [interviewerFilter, setInterviewerFilter] = useState("All");
  const roomRef = useRef<HTMLElement>(null);
  const jobPostings = jobPostingsQuery.data?.jobPostings ?? [];
  const meetings = useMemo(() => (applicationsQuery.data ?? [])
    .filter((applicant) => applicant.schedule?.mode === "Online"
      && (applicant.schedule.moderatorUserId
        ? applicant.schedule.moderatorUserId === currentUser?.id
        : applicant.schedule.createdBy === currentUser?.name || applicant.schedule.panel?.[0] === currentUser?.name))
    .sort((left, right) => `${left.schedule?.date} ${left.schedule?.startTime}`.localeCompare(`${right.schedule?.date} ${right.schedule?.startTime}`)),
  [applicationsQuery.data, currentUser?.id, currentUser?.name]);
  const positionFor = (applicant: Applicant) => jobPostings.find((posting) => posting.id === applicant.jobId)?.title ?? applicant.positionApplied ?? "Unknown position";
  const departmentFor = (applicant: Applicant) => jobPostings.find((posting) => posting.id === applicant.jobId)?.department ?? applicant.department ?? "-";
  const interviewerFor = (applicant: Applicant) => applicant.schedule?.panel?.[0] ?? applicant.schedule?.createdBy ?? "TBD";
  const departments = Array.from(new Set(meetings.map(departmentFor))).sort();
  const positions = Array.from(new Set(meetings.map(positionFor))).sort();
  const interviewers = Array.from(new Set(meetings.map(interviewerFor))).sort();
  const filteredMeetings = meetings.filter((applicant) =>
    (departmentFilter === "All" || departmentFor(applicant) === departmentFilter)
    && (positionFilter === "All" || positionFor(applicant) === positionFilter)
    && (interviewerFilter === "All" || interviewerFor(applicant) === interviewerFilter));
  const selected = meetings.find((applicant) => applicant.id === selectedVideoApplicantId && applicant.schedule?.mode === "Online");
  const showReport = selected && (meetingStartedApplicantId === selected.id || selected.interviewEvaluation?.status === "draft");

  useEffect(() => {
    if (active && selected) roomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, selected?.id]);

  async function copyGuestLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Guest link copied", description: "Share this link with the interview participant." });
    } catch {
      toast({ title: "Unable to copy link", description: "Please check clipboard permission and try again.", variant: "destructive" });
    }
  }

  return <div className={active ? "space-y-5" : "fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border bg-card p-2 shadow-2xl"}>
    <div className={active ? "" : "hidden"}>
      <h1 className="text-2xl font-bold text-primary">Video Conferencing</h1>
      <p className="text-sm text-muted-foreground">Open your UC HiveConnect interview room here. Your WorkHive account grants moderator access.</p>
    </div>

    {active && (applicationsQuery.isLoading || jobPostingsQuery.isLoading) ? <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading interviews...</p> : null}
    {active && (applicationsQuery.error || jobPostingsQuery.error) ? <p className="text-sm text-destructive">Unable to load scheduled interviews.</p> : null}

    {selected ? <section ref={roomRef} className={active ? "scroll-mt-20 space-y-3" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={active ? "text-lg font-semibold" : "truncate text-sm font-semibold"}>{active ? `Meeting with ${applicantName(selected)}` : interviewTitle(selected)}</h2>
        {!active ? <Button size="sm" variant="outline" onClick={() => setView("hr:video-conferencing")}>Return to room</Button> : null}
      </div>
      <div className={active && showReport ? "interview-room-with-score" : ""}>
        <div className={active ? "h-[min(75vh,850px)] min-h-[540px] min-w-0" : "h-[260px]"}>
          <HiveConnectRoom key={selected.id} applicantId={selected.id} compact={!active} onMeetingStarted={meetingStarted} onMeetingEnded={closeRoom} />
        </div>
        {showReport ? <div className={active ? "h-[min(75vh,850px)] min-h-[540px] min-w-0" : "hidden"}>
          <InterviewScoringPanel ref={scoringPanelRef} key={selected.id} applicant={selected} position={positionFor(selected)} department={departmentFor(selected)} interviewer={currentUser?.name ?? interviewerFor(selected)} onDirtyChange={setHasUnsavedEvaluation} onSubmitted={closeSubmittedRoom} />
        </div> : null}
      </div>
    </section> : null}

    <Card className={active ? "border-border" : "hidden"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarPlus className="h-4 w-4 text-primary" /> My Scheduled Interviews ({filteredMeetings.length})</CardTitle>
        <p className="text-sm text-muted-foreground">Other HR schedules are hidden from this account.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SearchableFilterSelect label="Department" value={departmentFilter} onValueChange={setDepartmentFilter} options={[{ value: "All", label: "All Departments" }, ...departments.map((value) => ({ value, label: value }))]} searchPlaceholder="Search department..." emptyLabel="No department found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <SearchableFilterSelect label="Position" value={positionFilter} onValueChange={setPositionFilter} options={[{ value: "All", label: "All Positions" }, ...positions.map((value) => ({ value, label: value }))]} searchPlaceholder="Search position..." emptyLabel="No position found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <SearchableFilterSelect label="Interviewer" value={interviewerFilter} onValueChange={setInterviewerFilter} options={[{ value: "All", label: "All Interviewers" }, ...interviewers.map((value) => ({ value, label: value }))]} searchPlaceholder="Search interviewer..." emptyLabel="No interviewer found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-11 items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">{filteredMeetings.length} of {meetings.length} interviews</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="[&_td]:align-middle">
            <TableHeader><TableRow>
              <TableHead>Applicant</TableHead><TableHead>Position</TableHead><TableHead>Department</TableHead><TableHead>Schedule</TableHead><TableHead>Interviewer</TableHead><TableHead className="text-center">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredMeetings.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No online interviews match these filters.</TableCell></TableRow> : null}
              {filteredMeetings.map((applicant) => {
                const schedule = applicant.schedule!;
                const isOpen = selectedVideoApplicantId === applicant.id;
                const isDone = schedule.status === "Done" || applicant.interviewEvaluation?.status === "submitted";
                return <TableRow key={applicant.id}>
                  <TableCell><div className="flex min-w-[190px] items-center gap-3"><HexagonAvatar name={applicantName(applicant)} size={34} color="#1d4ed8" /><p className="font-semibold">{applicantName(applicant)}</p></div></TableCell>
                  <TableCell>{positionFor(applicant)}</TableCell>
                  <TableCell>{departmentFor(applicant)}</TableCell>
                  <TableCell><span className="whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{formatDateShort(schedule.date)} - {schedule.time}</span></TableCell>
                  <TableCell>{interviewerFor(applicant)}</TableCell>
                  <TableCell><div className="flex flex-wrap items-center justify-center gap-2">{isDone ? <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Done</span> : <>
                    <Button size="sm" variant="outline" onClick={() => void copyGuestLink(schedule.venueOrLink)}><Copy className="mr-1.5 h-4 w-4" /> Copy guest link</Button>
                    <Button size="sm" variant={isOpen ? "outline" : "default"} onClick={() => isOpen ? void closeRoom() : openRoom(applicant.id)}><Video className="mr-1.5 h-4 w-4" />{isOpen ? "Close room" : "Open room"}</Button>
                  </>}</div></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>;
}
