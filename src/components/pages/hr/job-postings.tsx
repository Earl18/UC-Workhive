"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import type { JobPosting, JobQualification } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Calendar, ChevronDown, FileText, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { formatDate } from "@/components/shared/helpers";

type JobFormState = {
  title: string;
  department: string;
  positionType: string;
  summary: string;
  qualifications: JobQualification[];
};

const EMPTY_QUALIFICATION: JobQualification = {
  title: "",
  description: "",
};

const INITIAL_FORM: JobFormState = {
  title: "",
  department: "",
  positionType: "Full-Time",
  summary: "",
  qualifications: [{ ...EMPTY_QUALIFICATION }],
};

function normalizeQualifications(job: JobPosting) {
  return (job.qualifications ?? []).map((item) => ({
    title: item.title ?? "",
    description: item.description ?? "",
  }));
}

function toViewModel(job: JobPosting) {
  const qualifications = normalizeQualifications(job);
  const postedAt = job.postedAt ?? job.postedDate ?? "";
  const active = typeof job.active === "boolean" ? job.active : job.status !== "Closed";
  const summary = job.summary ?? job.description ?? "";
  const applicantCount = Number(job.applicantCount ?? 0);

  return {
    ...job,
    qualifications,
    postedAt,
    active,
    summary,
    applicantCount,
    statusLabel: active ? "Active" : "Closed",
    creatorName: job.creatorName ?? "-",
    positionTypeLabel: String(job.positionType ?? "-"),
  };
}

export function JobPostingsPage() {
  const jobPostingsQuery = useStaffJobPostings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ReturnType<typeof toViewModel> | null>(null);
  const [form, setForm] = useState<JobFormState>(INITIAL_FORM);

  const jobs = useMemo(
    () => (jobPostingsQuery.data?.jobPostings ?? []).map(toViewModel).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    [jobPostingsQuery.data?.jobPostings],
  );

  const departmentSuggestions = useMemo(
    () => jobPostingsQuery.data?.departmentSuggestions ?? [],
    [jobPostingsQuery.data?.departmentSuggestions],
  );
  const positionTypeSuggestions = useMemo(
    () => jobPostingsQuery.data?.positionTypeSuggestions ?? [],
    [jobPostingsQuery.data?.positionTypeSuggestions],
  );

  const activeCount = jobs.filter((job) => job.active).length;
  const closedCount = jobs.length - activeCount;
  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicantCount, 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hr/job-postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to create posting.");
      }
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-site-stats"] }),
      ]);
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Job posting created", description: "The new role is now available on the careers page." });
    },
    onError: (error) => {
      toast({
        title: "Unable to create posting",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      const response = await fetch(`/api/hr/job-postings/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      const body = (await response.json()) as { error?: string; jobPosting?: JobPosting };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to update posting.");
      }
      return body.jobPosting ? toViewModel(body.jobPosting) : null;
    },
    onSuccess: async (job) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-site-stats"] }),
      ]);
      if (job) {
        setSelectedJob(job);
      }
      toast({ title: "Job posting updated", description: "Changes were saved successfully." });
    },
    onError: (error) => {
      toast({
        title: "Unable to update posting",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/hr/job-postings/${id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to remove posting.");
      }
      return body.success ?? true;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-job-postings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-site-stats"] }),
      ]);
      setDetailOpen(false);
      setEditing(false);
      setSelectedJob(null);
      toast({ title: "Job posting removed", description: "The posting was deleted from the database." });
    },
    onError: (error) => {
      toast({
        title: "Unable to remove posting",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  function resetForm(value: JobFormState = INITIAL_FORM) {
    setForm({
      ...value,
      qualifications: value.qualifications.length > 0 ? value.qualifications : [{ ...EMPTY_QUALIFICATION }],
    });
  }

  function openDetails(job: ReturnType<typeof toViewModel>) {
    setSelectedJob(job);
    setEditing(false);
    resetForm({
      title: job.title,
      department: job.department,
      positionType: String(job.positionType ?? "Full-Time"),
      summary: job.summary,
      qualifications: job.qualifications,
    });
    setDetailOpen(true);
  }

  function beginEditing(job = selectedJob) {
    if (!job) {
      return;
    }

    setSelectedJob(job);
    resetForm({
      title: job.title,
      department: job.department,
      positionType: job.positionTypeLabel,
      summary: job.summary,
      qualifications: job.qualifications,
    });
    setDetailOpen(true);
    setEditing(true);
  }

  function updateQualificationRow(index: number, patch: Partial<JobQualification>) {
    setForm((current) => ({
      ...current,
      qualifications: current.qualifications.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addQualificationRow() {
    setForm((current) => ({
      ...current,
      qualifications: [...current.qualifications, { ...EMPTY_QUALIFICATION }],
    }));
  }

  function removeQualificationRow(index: number) {
    setForm((current) => {
      const nextRows = current.qualifications.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        qualifications: nextRows.length > 0 ? nextRows : [{ ...EMPTY_QUALIFICATION }],
      };
    });
  }

  async function submitEdit() {
    if (!selectedJob) {
      return;
    }

    await updateMutation.mutateAsync({
      id: selectedJob.id,
      body: form,
    });
    setEditing(false);
  }

  async function toggleStatus(job: ReturnType<typeof toViewModel>) {
    await updateMutation.mutateAsync({
      id: job.id,
      body: { action: job.active ? "close" : "reopen" },
    });
  }

  async function removePosting() {
    if (!selectedJob) {
      return;
    }

    const confirmed = window.confirm(`Remove "${selectedJob.title}" from the database?`);
    if (!confirmed) {
      return;
    }

    await deleteMutation.mutateAsync(selectedJob.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Job Postings</h1>
          <p className="text-sm text-muted-foreground">Recruitment pipeline - UC South Campus</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary">
          <Plus className="mr-2 h-4 w-4" /> Create Posting
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Postings</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Closed Postings</p>
                <p className="text-2xl font-bold">{closedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gold/40">
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Applicants</p>
                <p className="text-2xl font-bold">{totalApplicants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">All Job Postings</CardTitle>
          <CardDescription>Departments and position types are now free-text with live suggestions, and qualifications are saved as title and description rows.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[30rem] overflow-auto scroll-thin rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Posted Date</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Qualifications</TableHead>
                  <TableHead className="text-center">Applicants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobPostingsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading job postings...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No job postings yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id} className="cursor-pointer" onClick={() => openDetails(job)}>
                      <TableCell>
                        <button className="text-left text-sm font-medium text-primary hover:underline">
                          {job.title}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">{job.postedAt ? formatDate(job.postedAt) : "-"}</TableCell>
                      <TableCell className="text-xs">{job.department}</TableCell>
                      <TableCell className="text-xs">{job.creatorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{job.positionTypeLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold">{job.qualifications.length}</TableCell>
                      <TableCell className="text-center text-sm font-semibold text-primary">{job.applicantCount}</TableCell>
                      <TableCell>
                        {job.active ? (
                          <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => beginEditing(job)}
                            disabled={saving}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => toggleStatus(job)}
                            disabled={saving}
                          >
                            {job.active ? "Close" : "Reopen"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[min(96vw,62rem)] max-h-[90vh] overflow-y-auto scroll-thin sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Plus className="h-5 w-5" /> Create Job Posting
            </DialogTitle>
            <DialogDescription>Fill out the details to publish a new job opening.</DialogDescription>
          </DialogHeader>
          <JobPostingForm
            form={form}
            setForm={setForm}
            departmentSuggestions={departmentSuggestions}
            positionTypeSuggestions={positionTypeSuggestions}
            updateQualificationRow={updateQualificationRow}
            addQualificationRow={addQualificationRow}
            removeQualificationRow={removeQualificationRow}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-primary" onClick={() => createMutation.mutate()} disabled={saving}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Publish Posting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={(nextOpen) => {
        setDetailOpen(nextOpen);
        if (!nextOpen) {
          setEditing(false);
        }
      }}>
        <DialogContent className="w-[min(96vw,64rem)] max-h-[90vh] overflow-y-auto scroll-thin sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-12 text-primary">
              {selectedJob?.title ?? "Job posting"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update the posting details below." : "Complete listing information for HR review and edits."}
            </DialogDescription>
          </DialogHeader>

          {selectedJob ? editing ? (
            <>
              <JobPostingForm
                form={form}
                setForm={setForm}
                departmentSuggestions={departmentSuggestions}
                positionTypeSuggestions={positionTypeSuggestions}
                updateQualificationRow={updateQualificationRow}
                addQualificationRow={addQualificationRow}
                removeQualificationRow={removeQualificationRow}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button className="bg-primary" onClick={submitEdit} disabled={saving}>
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <InfoCard label="Department" value={selectedJob.department} />
                <InfoCard label="Type" value={selectedJob.positionTypeLabel} />
                <InfoCard label="Created By" value={selectedJob.creatorName} />
                <InfoCard label="Posted" value={selectedJob.postedAt ? formatDate(selectedJob.postedAt) : "-"} icon={Calendar} />
                <InfoCard label="Status" value={selectedJob.statusLabel} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">Job Summary</h3>
                <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">{selectedJob.summary}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary">Qualifications</h3>
                  <Badge variant="outline">{selectedJob.qualifications.length} total</Badge>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Qualification Title</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedJob.qualifications.map((qualification, index) => (
                        <TableRow key={`${qualification.title}-${index}`}>
                          <TableCell className="align-top font-medium">{qualification.title}</TableCell>
                          <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">{qualification.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => beginEditing()} disabled={saving}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => toggleStatus(selectedJob)} disabled={saving}>
                  {selectedJob.active ? "Close Posting" : "Reopen Posting"}
                </Button>
                <Button variant="destructive" onClick={() => removePosting()} disabled={saving}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove Posting
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobPostingForm({
  form,
  setForm,
  departmentSuggestions,
  positionTypeSuggestions,
  updateQualificationRow,
  addQualificationRow,
  removeQualificationRow,
}: {
  form: JobFormState;
  setForm: React.Dispatch<React.SetStateAction<JobFormState>>;
  departmentSuggestions: string[];
  positionTypeSuggestions: string[];
  updateQualificationRow: (index: number, patch: Partial<JobQualification>) => void;
  addQualificationRow: () => void;
  removeQualificationRow: (index: number) => void;
}) {
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("[data-qualification-description]");

    textareas.forEach((textarea) => {
      textarea.style.height = "0px";
      textarea.style.height = `${Math.max(textarea.scrollHeight, 64)}px`;
    });
  }, [form.qualifications]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Job Title</Label>
        <Input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="e.g., College Instructor - Computer Studies"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SuggestionField
          label="Department"
          value={form.department}
          onChange={(value) => setForm((current) => ({ ...current, department: value }))}
          placeholder="Type a department"
          suggestions={departmentSuggestions}
        />
        <SuggestionField
          label="Position Type"
          value={form.positionType}
          onChange={(value) => setForm((current) => ({ ...current, positionType: value }))}
          placeholder="Type a position type"
          suggestions={positionTypeSuggestions}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Job Summary</Label>
        <Textarea
          value={form.summary}
          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
          rows={5}
          placeholder="Responsibilities, overview, and hiring notes..."
        />
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Label>Qualifications</Label>
            <p className="text-xs text-muted-foreground">Add one or more qualification rows with a title and description.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addQualificationRow} className="self-start">
            <Plus className="mr-2 h-4 w-4" /> Add Row
          </Button>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
          {form.qualifications.map((qualification, index) => (
            <div key={index} className="rounded-lg border border-border bg-background p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Qualification {index + 1}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQualificationRow(index)}
                  disabled={form.qualifications.length === 1}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Qualification Title</Label>
                  <Input
                    className="h-[64px]"
                    value={qualification.title}
                    onChange={(event) => updateQualificationRow(index, { title: event.target.value })}
                    placeholder="e.g., Education"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                  <Textarea
                    data-qualification-description
                    value={qualification.description}
                    onChange={(event) => updateQualificationRow(index, { description: event.target.value })}
                    onInput={(event) => {
                      const textarea = event.currentTarget;
                      textarea.style.height = "0px";
                      textarea.style.height = `${Math.max(textarea.scrollHeight, 64)}px`;
                    }}
                    placeholder="Describe the qualification requirement"
                    rows={1}
                    className="min-h-[64px] resize-none overflow-hidden"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuggestionField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    return Array.from(
      new Set(
        suggestions
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).filter((item) => (query ? item.toLowerCase().includes(query) : true));
  }, [suggestions, value]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          aria-label={`Toggle ${label.toLowerCase()} suggestions`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && filteredSuggestions.length > 0 ? (
          <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-primary/10 bg-popover p-1 shadow-lg">
            <div className="max-h-56 overflow-y-auto scroll-thin">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(suggestion);
                    setOpen(false);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Calendar }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}













