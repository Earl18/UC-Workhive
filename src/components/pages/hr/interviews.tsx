"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Eye, Loader2, Pencil } from "lucide-react";
import type { Applicant, JobPosting } from "@/lib/types";
import { useHrApplications } from "@/hooks/use-applications";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { useWorkHive } from "@/lib/store";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { formatDateShort } from "@/components/shared/helpers";
import { SearchableFilterSelect } from "@/components/shared/filter-controls";
import { InterviewScoringPanel } from "@/components/pages/hr/interview-scoring-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReportMode = "view" | "edit";

function applicantName(applicant: Applicant) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

function positionFor(applicant: Applicant, postings: JobPosting[]) {
  return postings.find((posting) => posting.id === applicant.jobId)?.title ?? applicant.positionApplied ?? "Unknown position";
}

function departmentFor(applicant: Applicant, postings: JobPosting[]) {
  return postings.find((posting) => posting.id === applicant.jobId)?.department ?? applicant.department ?? "-";
}

function interviewerFor(applicant: Applicant) {
  return applicant.schedule?.panel?.[0] ?? applicant.schedule?.createdBy ?? "TBD";
}

export function InterviewsPage() {
  const { currentUser, selectedApplicantId, setSelectedApplicantId } = useWorkHive();
  const applicationsQuery = useHrApplications();
  const postingsQuery = useStaffJobPostings();
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const [interviewerFilter, setInterviewerFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("view");
  const [dirty, setDirty] = useState(false);
  const postings = postingsQuery.data?.jobPostings ?? [];

  const interviews = useMemo(() => (applicationsQuery.data ?? [])
    .filter((applicant) => applicant.schedule && (applicant.schedule.moderatorUserId
      ? applicant.schedule.moderatorUserId === currentUser?.id
      : applicant.schedule.createdBy === currentUser?.name || applicant.schedule.panel?.[0] === currentUser?.name))
    .sort((left, right) => String(left.schedule?.date).localeCompare(String(right.schedule?.date))),
  [applicationsQuery.data, currentUser?.id, currentUser?.name]);

  const departments = Array.from(new Set(interviews.map((applicant) => departmentFor(applicant, postings)))).sort();
  const positions = Array.from(new Set(interviews.map((applicant) => positionFor(applicant, postings)))).sort();
  const interviewers = Array.from(new Set(interviews.map(interviewerFor))).sort();
  const filteredInterviews = interviews.filter((applicant) =>
    (departmentFilter === "All" || departmentFor(applicant, postings) === departmentFilter)
    && (positionFilter === "All" || positionFor(applicant, postings) === positionFilter)
    && (interviewerFilter === "All" || interviewerFor(applicant) === interviewerFilter));
  const selected = interviews.find((applicant) => applicant.id === (selectedApplicantId ?? selectedId));

  function openReport(applicantId: string, mode: ReportMode) {
    setSelectedApplicantId(null);
    setSelectedId(applicantId);
    setReportMode(mode);
    setDirty(false);
  }

  function closeReport() {
    if (dirty && !window.confirm("This interview report has unsaved changes. Close without saving?")) return;
    setSelectedApplicantId(null);
    setSelectedId(null);
    setDirty(false);
  }

  if (applicationsQuery.isLoading || postingsQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading interview results...</div>;
  }
  if (applicationsQuery.error || postingsQuery.error) {
    return <div className="p-6 text-destructive">Unable to load interview results.</div>;
  }

  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-primary">Interview Result</h1>
      <p className="text-sm text-muted-foreground">Review saved interview reports before deciding an applicant&apos;s next stage.</p>
    </div>
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarPlus className="h-4 w-4 text-primary" /> My Interviews ({filteredInterviews.length})</CardTitle>
        <p className="text-sm text-muted-foreground">Review reports for interviews assigned to you.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SearchableFilterSelect label="Department" value={departmentFilter} onValueChange={setDepartmentFilter} options={[{ value: "All", label: "All Departments" }, ...departments.map((value) => ({ value, label: value }))]} searchPlaceholder="Search department..." emptyLabel="No department found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <SearchableFilterSelect label="Position" value={positionFilter} onValueChange={setPositionFilter} options={[{ value: "All", label: "All Positions" }, ...positions.map((value) => ({ value, label: value }))]} searchPlaceholder="Search position..." emptyLabel="No position found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <SearchableFilterSelect label="Interviewer" value={interviewerFilter} onValueChange={setInterviewerFilter} options={[{ value: "All", label: "All Interviewers" }, ...interviewers.map((value) => ({ value, label: value }))]} searchPlaceholder="Search interviewer..." emptyLabel="No interviewer found." labelClassName="text-sm font-medium text-foreground" triggerClassName="h-11 rounded-xl bg-background text-left" />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-11 items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">{filteredInterviews.length} of {interviews.length} interviews</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="[&_td]:align-middle">
            <TableHeader><TableRow>
              <TableHead>Applicant</TableHead><TableHead>Position</TableHead><TableHead>Department</TableHead><TableHead>Schedule</TableHead><TableHead>Interviewer</TableHead><TableHead className="text-center">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredInterviews.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No interviews match these filters.</TableCell></TableRow> : null}
              {filteredInterviews.map((applicant) => {
                const schedule = applicant.schedule!;
                const reportAvailable = applicant.interviewEvaluation?.status === "draft"
                  || (schedule.status === "Done" && applicant.interviewEvaluation?.status === "submitted");
                return <TableRow key={applicant.id}>
                  <TableCell><div className="flex min-w-[190px] items-center gap-3"><HexagonAvatar name={applicantName(applicant)} size={34} color="#1d4ed8" /><p className="font-semibold">{applicantName(applicant)}</p></div></TableCell>
                  <TableCell>{positionFor(applicant, postings)}</TableCell>
                  <TableCell>{departmentFor(applicant, postings)}</TableCell>
                  <TableCell><span className="whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{formatDateShort(schedule.date)} - {schedule.time}</span></TableCell>
                  <TableCell>{interviewerFor(applicant)}</TableCell>
                  <TableCell><div className="flex flex-wrap items-center justify-center gap-2">
                    {reportAvailable ? <>
                      <Button size="sm" variant="outline" onClick={() => openReport(applicant.id, "view")}><Eye className="mr-1.5 h-4 w-4" /> View</Button>
                      <Button size="sm" variant="outline" onClick={() => openReport(applicant.id, "edit")}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button>
                    </> : <span className="text-sm text-muted-foreground">No saved report yet</span>}
                  </div></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeReport(); }}>
      <DialogContent className="flex flex-col overflow-hidden p-0" style={{ width: "min(92vw, 720px)", maxWidth: "min(92vw, 720px)", height: "min(88dvh, 900px)" }}>
        <DialogHeader className="sr-only">
          <DialogTitle>{reportMode === "view" ? "View" : "Edit"} interview report</DialogTitle>
          <DialogDescription>Interview evaluation for the selected applicant.</DialogDescription>
        </DialogHeader>
        {selected ? <div className="min-h-0 flex-1">
          <InterviewScoringPanel key={selected.id + "-" + reportMode} applicant={selected} position={positionFor(selected, postings)} department={departmentFor(selected, postings)} interviewer={interviewerFor(selected)} context="result" readOnly={reportMode === "view"} onDirtyChange={setDirty} />
        </div> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
