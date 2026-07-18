"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Applicant, ApplicantStage, JobPosting } from "@/lib/types";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { applicantStageColor, formatDate, formatDateShort } from "@/components/shared/helpers";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { useHrApplications } from "@/hooks/use-applications";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Download,
  FileArchive,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserSquare2,
  Users,
  Video,
  X,
} from "lucide-react";

const STAGES: { id: ApplicantStage; label: string; color: string }[] = [
  { id: "New", label: "New", color: "#0e7490" },
  { id: "Screening", label: "Screening", color: "#7c3aed" },
  { id: "Interview", label: "Interview", color: "#1d4ed8" },
  { id: "Offer", label: "Offer", color: "#ca8a04" },
  { id: "Hired", label: "Hired", color: "#16a34a" },
  { id: "Rejected", label: "Rejected", color: "#dc2626" },
];

const ORDER: ApplicantStage[] = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"];

const NEXT_STAGE: Partial<Record<ApplicantStage, ApplicantStage>> = {
  New: "Screening",
  Screening: "Interview",
  Interview: "Offer",
  Offer: "Hired",
};

const DEFAULT_STAGE_PAGE_SIZE = 10;
const STAGE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function ApplicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const jobPostingsQuery = useStaffJobPostings();
  const applicationsQuery = useHrApplications();
  const jobPostings = useMemo(
    () => (jobPostingsQuery.data?.jobPostings ?? []).map((jobPosting) => ({
      ...jobPosting,
      positionTypeLabel: String(jobPosting.positionType ?? "-") || "-",
    })),
    [jobPostingsQuery.data?.jobPostings],
  ) as Array<JobPosting & { positionTypeLabel: string }>;
  const applicants = applicationsQuery.data ?? [];
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detailApplicant, setDetailApplicant] = useState<Applicant | null>(null);
  const [downloadingApplicantId, setDownloadingApplicantId] = useState<string | null>(null);
  const activeDetailApplicant = detailApplicant ? applicants.find((item) => item.id === detailApplicant.id) ?? detailApplicant : null;
  const [stagePages, setStagePages] = useState<Record<ApplicantStage, number>>(() => createStageNumberRecord(1));
  const [stagePageSizes, setStagePageSizes] = useState<Record<ApplicantStage, number>>(() => createStageNumberRecord(DEFAULT_STAGE_PAGE_SIZE));

  const stageMutation = useMutation({
    mutationFn: async ({ applicantId, stage }: { applicantId: string; stage: ApplicantStage }) => {
      const response = await fetch(`/api/hr/applications/${applicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });

      const payload = (await response.json()) as { applicant?: Applicant; error?: string };
      if (!response.ok || !payload.applicant) {
        throw new Error(payload.error ?? "Unable to update applicant stage.");
      }

      return payload.applicant;
    },
    onSuccess: (updatedApplicant) => {
      void queryClient.invalidateQueries({ queryKey: ["hr-applications"] });
      setDetailApplicant((current) => current && current.id === updatedApplicant.id ? updatedApplicant : current);
    },
  });

  const scopedApplicants = useMemo(() => {
    let filtered = jobFilter === "all"
      ? applicants
      : applicants.filter((applicant) => applicant.jobId === jobFilter);

    if (departmentFilter !== "all") {
      filtered = filtered.filter((applicant) => String(applicant.department ?? "-") === departmentFilter);
    }

    if (nameFilter !== "all") {
      filtered = filtered.filter((applicant) => applicantDisplayName(applicant) === nameFilter);
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return filtered;
    }

    return filtered.filter((applicant) => {
      const name = applicantDisplayName(applicant).toLowerCase();
      const email = applicant.email.toLowerCase();
      const position = jobTitleById(jobPostings, applicant.jobId).toLowerCase();
      const department = String(applicant.department ?? "").toLowerCase();
      return (
        name.includes(query) ||
        email.includes(query) ||
        position.includes(query) ||
        department.includes(query)
      );
    });
  }, [applicants, jobFilter, departmentFilter, nameFilter, search, jobPostings]);

  const applicantsByStage = useMemo(() => {
    const grouped: Record<ApplicantStage, Applicant[]> = {
      New: [],
      Screening: [],
      Interview: [],
      Offer: [],
      Hired: [],
      Rejected: [],
    };

    scopedApplicants.forEach((applicant) => {
      grouped[applicant.stage].push(applicant);
    });

    return grouped;
  }, [scopedApplicants]);

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(applicants.map((applicant) => String(applicant.department ?? "-")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [applicants]);

  const nameOptions = useMemo(() => {
    return Array.from(new Set(applicants.map((applicant) => applicantDisplayName(applicant)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [applicants]);

  function openApplicantDetail(applicant: Applicant) {
    setDetailApplicant(applicant);
  }

  function closeApplicantDetail() {
    setDetailApplicant(null);
  }

  function jumpToStage(applicant: Applicant, stage: ApplicantStage) {
    if (applicant.stage === stage || stageMutation.isPending) {
      return;
    }

    stageMutation.mutate(
      { applicantId: applicant.id, stage },
      {
        onSuccess: (updatedApplicant) => {
          toast({
            title: "Stage Updated",
            description: `${applicantDisplayName(applicant)} -> ${stage}`,
          });
        },
        onError: (error) => {
          toast({
            title: "Unable to update stage",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  }
  async function downloadRequirementsArchive(applicant: Applicant) {
    if (!applicant.requirementsArchiveName) {
      toast({
        title: "Archive unavailable",
        description: "This applicant does not have a downloadable requirements archive yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDownloadingApplicantId(applicant.id);
      const response = await fetch(`/api/hr/applications/${applicant.id}/requirements-archive`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Unable to download requirements archive.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = applicant.requirementsArchiveName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast({
        title: "Download started",
        description: `${applicant.requirementsArchiveName} is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Unable to download archive",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingApplicantId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">Job Applications</h1>
            <p className="text-base text-muted-foreground">Applicant pipeline per job posting - UC South Campus</p>
          </div>
        </div>
      </div>

      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="pb-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Search Applicants</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, position, or department..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5 md:w-[220px] md:shrink-0">
                <Label className="text-sm font-medium text-foreground">Applicants</Label>
                <div className="flex h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                  <Users className="mr-2 h-4 w-4" />
                  {scopedApplicants.length} applicant{scopedApplicants.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <SearchableFilterSelect
                label="Job Posting"
                value={jobFilter}
                onValueChange={setJobFilter}
                options={[
                  { value: "all", label: "All job applications" },
                  ...jobPostings.map((jobPosting) => {
                    const count = applicants.filter((applicant) => applicant.jobId === jobPosting.id).length;
                    return { value: jobPosting.id, label: `${jobPosting.title} (${count})` };
                  }),
                ]}
                searchPlaceholder="Search job posting..."
                emptyLabel="No job posting found."
              />
              <SearchableFilterSelect
                label="Department"
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
                options={[{ value: "all", label: "All departments" }, ...departmentOptions.map((department) => ({ value: department, label: department }))]}
                searchPlaceholder="Search department..."
                emptyLabel="No department found."
              />
              <SearchableFilterSelect
                label="Name"
                value={nameFilter}
                onValueChange={setNameFilter}
                options={[{ value: "all", label: "All applicants" }, ...nameOptions.map((name) => ({ value: name, label: name }))]}
                searchPlaceholder="Search applicant..."
                emptyLabel="No applicant found."
              />
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className="space-y-3">
        {STAGES.map((stage) => {
          const stageApplicants = applicantsByStage[stage.id];
          const pageSize = stagePageSizes[stage.id] ?? DEFAULT_STAGE_PAGE_SIZE;
          const totalPages = Math.max(1, Math.ceil(stageApplicants.length / pageSize));
          const currentPage = Math.min(stagePages[stage.id] ?? 1, totalPages);
          const startIndex = stageApplicants.length === 0 ? 0 : (currentPage - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, stageApplicants.length);
          const visibleApplicants = stageApplicants.slice(startIndex, endIndex);

          return (
            <Card key={stage.id} className="border-primary/15 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="hexagon inline-block" style={{ width: 12, height: 13.5, backgroundColor: stage.color }} />
                    <div>
                      <CardTitle className="text-xl text-foreground">{stage.label}</CardTitle>
                      <p className="text-base text-muted-foreground">
                        {stageApplicants.length} applicant{stageApplicants.length !== 1 ? "s" : ""} in this stage
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table className="[&_td]:align-middle">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-center">Requirements</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleApplicants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                            No applicants in this stage.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleApplicants.map((applicant) => {
                          const isDownloading = downloadingApplicantId === applicant.id;
                          const nextStage = NEXT_STAGE[applicant.stage];

                          return (
                            <TableRow key={applicant.id} className="cursor-pointer" onClick={() => openApplicantDetail(applicant)}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <HexagonAvatar name={applicantDisplayName(applicant)} color={applicantStageColor(applicant.stage)} size={36} />
                                  <div className="min-w-0">
                                    <div className="font-medium text-foreground">{applicantDisplayName(applicant)}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{formatDateShort(applicant.appliedDate ?? applicant.submittedAt ?? "")}</TableCell>
                              <TableCell>{jobTitleById(jobPostings, applicant.jobId)}</TableCell>
                              <TableCell>{applicant.department ?? "-"}</TableCell>
                              <TableCell>{applicant.email}</TableCell>
                              <TableCell>{applicant.phone ?? applicant.contact ?? "-"}</TableCell>
                              <TableCell className="text-center">{submittedRequirements(applicant)}/{totalRequirements(applicant)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                  <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); downloadRequirementsArchive(applicant); }} disabled={isDownloading}>
                                    <Download className="mr-1.5 h-4 w-4" />
                                    {isDownloading ? "Downloading..." : "ZIP"}
                                  </Button>
                                  {nextStage ? (
                                    <Button size="sm" className="bg-primary text-white hover:bg-primary/90" onClick={(event) => { event.stopPropagation(); jumpToStage(applicant, nextStage); }} disabled={stageMutation.isPending}>
                                      {nextStage}
                                    </Button>
                                  ) : null}
                                  {applicant.stage !== "Rejected" && applicant.stage !== "Hired" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                      onClick={(event) => { event.stopPropagation(); jumpToStage(applicant, "Rejected"); }}
                                      disabled={stageMutation.isPending}
                                    >
                                      Reject
                                    </Button>
                                  ) : null}
                                  {!nextStage && applicant.stage !== "Rejected" && applicant.stage !== "Hired" ? (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {stageApplicants.length === 0 ? 0 : startIndex + 1}-{endIndex} of {stageApplicants.length} applicants
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground">Rows</Label>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setStagePageSizes((current) => ({ ...current, [stage.id]: Number(value) }));
                          setStagePages((current) => ({ ...current, [stage.id]: 1 }));
                        }}
                      >
                        <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGE_PAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStagePages((current) => ({ ...current, [stage.id]: Math.max(1, currentPage - 1) }))}
                        disabled={currentPage <= 1}
                      >
                        Previous
                      </Button>
                      <div className="min-w-[110px] text-center text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStagePages((current) => ({ ...current, [stage.id]: Math.min(totalPages, currentPage + 1) }))}
                        disabled={currentPage >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeDetailApplicant} onOpenChange={(open) => !open && closeApplicantDetail()}>
        <DialogContent className="max-h-[84vh] w-[calc(100%-1rem)] sm:w-auto sm:min-w-[56rem] max-w-[96vw] overflow-x-hidden overflow-y-auto scroll-thin">
          {activeDetailApplicant ? (
            <>
              <DialogHeader className="border-b border-border/60 pb-4">
                <div className="flex items-start gap-3">
                  <HexagonAvatar name={applicantDisplayName(activeDetailApplicant)} color={applicantStageColor(activeDetailApplicant.stage)} size={48} />
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-2xl font-bold text-primary">{applicantDisplayName(activeDetailApplicant)}</DialogTitle>
                    <DialogDescription className="text-base text-muted-foreground">
                      {jobTitleById(jobPostings, activeDetailApplicant.jobId)} - Applied {formatDate(activeDetailApplicant.appliedDate ?? activeDetailApplicant.submittedAt ?? "")}
                    </DialogDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">{activeDetailApplicant.stage}</Badge>
                      <Badge variant="secondary" className="px-3 py-1 text-sm">
                        {submittedRequirements(activeDetailApplicant)}/{totalRequirements(activeDetailApplicant)} docs submitted
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <UserSquare2 className="h-5 w-5 text-primary" />
                    Applicant Information
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoField icon={Mail} label="Email Address" value={activeDetailApplicant.email} />
                    <InfoField icon={Phone} label="Contact Number" value={activeDetailApplicant.phone ?? activeDetailApplicant.contact ?? "-"} />
                    <InfoField label="Department" value={activeDetailApplicant.department ?? "-"} />
                    <InfoField label="Position Applied" value={jobTitleById(jobPostings, activeDetailApplicant.jobId)} />
                    <InfoField label="Date Applied" value={formatDate(activeDetailApplicant.appliedDate ?? activeDetailApplicant.submittedAt ?? "")} />
                    <InfoField label="Current Stage" value={activeDetailApplicant.stage} />
                    <InfoField label="SSS Number" value={activeDetailApplicant.sssNumber ?? "-"} />
                    <InfoField label="TIN Number" value={activeDetailApplicant.tinNumber ?? "-"} />
                    <InfoField label="PAG-IBIG Number" value={activeDetailApplicant.pagIbigNumber ?? "-"} />
                    <InfoField label="PHILHEALTH Number" value={activeDetailApplicant.philHealthNumber ?? "-"} />
                  </div>
                  <div className="mt-3 rounded-xl border border-border bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant Message</div>
                    <div className="mt-2 text-sm leading-6 text-foreground">{activeDetailApplicant.message?.trim() ? activeDetailApplicant.message : "No message provided."}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="mb-3 rounded-lg border border-dashed border-border/80 bg-white/80 px-3 py-2 text-xs text-muted-foreground">Review the applicant details above, then use the checklist below for document completeness.</div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Requirements Checklist
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="text-sm font-medium text-muted-foreground">
                          {submittedRequirements(activeDetailApplicant)}/{totalRequirements(activeDetailApplicant)} submitted
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadRequirementsArchive(activeDetailApplicant)}
                          disabled={downloadingApplicantId === activeDetailApplicant.id || !activeDetailApplicant.requirementsArchiveName}
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          {downloadingApplicantId === activeDetailApplicant.id ? "Downloading ZIP..." : "Download ZIP"}
                        </Button>
                      </div>
                    </div>
                    <Progress
                      value={(submittedRequirements(activeDetailApplicant) / Math.max(1, totalRequirements(activeDetailApplicant))) * 100}
                      className="mb-3 h-2"
                    />
                    <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {(activeDetailApplicant.requirements ?? []).map((requirement) => (
                        <div
                          key={requirement.key}
                          className={`flex min-h-[52px] items-start gap-3 rounded-lg border p-2.5 text-sm leading-5 ${requirement.submitted ? "border-emerald-300 bg-emerald-50" : "border-border bg-background"}`}
                        >
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${requirement.submitted ? "text-emerald-600" : "text-muted-foreground"}`} />
                          <span className={requirement.submitted ? "text-foreground" : "text-muted-foreground"}>{requirement.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {activeDetailApplicant.schedule ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <CalendarClock className="h-4 w-4" /> Interview Scheduled
                      </p>
                      <div className="mt-2 grid gap-2 text-xs text-foreground sm:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">Date:</span> {formatDate(activeDetailApplicant.schedule.date)} at {activeDetailApplicant.schedule.time}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mode:</span> {activeDetailApplicant.schedule.mode}
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">Panel:</span> {activeDetailApplicant.schedule.panel.join(", ") || "-"}
                        </div>
                        <div className="flex items-center gap-1.5 sm:col-span-2">
                          {activeDetailApplicant.schedule.mode === "Online" ? (
                            <Video className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span>{activeDetailApplicant.schedule.venueOrLink}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <DialogFooter className="border-t border-border/60 pt-4">
                <div className="flex w-full justify-end">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    {activeDetailApplicant.stage !== "Rejected" && activeDetailApplicant.stage !== "Hired" ? (
                      <Button
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                        onClick={() => jumpToStage(activeDetailApplicant, "Rejected")}
                      >
                        Reject
                      </Button>
                    ) : null}
                    {activeDetailApplicant.stage !== "Interview" ? (
                      <Button className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto" onClick={() => jumpToStage(activeDetailApplicant, "Interview")}>
                        <ArrowRight className="mr-1.5 h-4 w-4" /> Move to Interview
                      </Button>
                    ) : null}
                  </div>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SearchableFilterSelect({
  label,
  value,
  onValueChange,
  options,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "Select";

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between rounded-md border bg-transparent px-3 text-sm font-normal shadow-xs hover:bg-transparent">
            <span className="truncate text-left">{selectedLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function InfoField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Mail;
}) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <div className="flex items-start gap-2">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 text-primary" /> : null}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 break-words text-sm font-medium leading-6 text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}
function createStageNumberRecord(defaultValue: number): Record<ApplicantStage, number> {
  return {
    New: defaultValue,
    Screening: defaultValue,
    Interview: defaultValue,
    Offer: defaultValue,
    Hired: defaultValue,
    Rejected: defaultValue,
  };
}

function applicantDisplayName(applicant: Applicant) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

function stageTransferLabel(stage: ApplicantStage) {
  if (stage === "Screening" || stage === "Interview") {
    return "Reviewed By";
  }

  if (stage === "Offer") {
    return "Interviewed By";
  }

  if (stage === "Hired") {
    return "Hired By";
  }

  if (stage === "Rejected") {
    return "Rejected By";
  }

  return "Transferred By";
}

function stageTransferRecord(applicant: Applicant, stage: ApplicantStage) {
  return applicant.stageHistory?.find((entry) => entry.stage === stage) ?? null;
}

function submittedRequirements(applicant: Applicant) {
  return (applicant.requirements ?? []).filter((requirement) => requirement.submitted).length;
}

function totalRequirements(applicant: Applicant) {
  return applicant.requirements?.length ?? 0;
}

function jobTitleById(jobPostings: { id: string; title: string }[], jobId?: string | null) {
  return jobPostings.find((jobPosting) => jobPosting.id === jobId)?.title ?? "Unknown posting";
}

function jobDepartmentById(jobPostings: { id: string; department?: string }[], jobId?: string | null) {
  return jobPostings.find((jobPosting) => jobPosting.id === jobId)?.department ?? "-";
}

function jobTypeById(jobPostings: { id: string; positionType?: string }[], jobId?: string | null) {
  return String(jobPostings.find((jobPosting) => jobPosting.id === jobId)?.positionType ?? "-");
}














































