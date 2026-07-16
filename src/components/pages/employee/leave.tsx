"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, LeaveRequest, LeaveType } from "@/lib/types";
import { getAvailableLeaveTypes, getLeaveTypeLabel } from "@/lib/types";
import { EMPLOYEE_DOCUMENT_ACCEPT, EMPLOYEE_DOCUMENT_MAX_MB } from "@/lib/employee-document-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexagonAvatar, HexStatCard } from "@/components/shared/hexagon";
import {
  formatAttachmentDisplayName,
  formatDate,
  formatDateShort,
  formatLeaveDayCount,
  formatLeaveDayLabel,
  leaveStatusColor,
} from "@/components/shared/helpers";
import { useToast } from "@/hooks/use-toast";
import {
  Plane,
  Plus,
  PenLine,
  Loader2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Upload,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EmployeeProfile = Employee & { birthDate?: string };

type LeaveCreditSummary = {
  leaveType: LeaveType;
  maxDays: number;
  usedDays: number;
  remainingDays: number;
};

type LeaveDurationType = "full-day" | "half-day";

const ADVANCE_NOTICE_DAYS = 3;
const URGENT_LEAVE_TYPES = new Set<LeaveType>(["Sick Leave"]);

type EmployeeLeavePageResponse = {
  employee?: EmployeeProfile;
  credits?: LeaveCreditSummary[];
  requests?: LeaveRequest[];
  error?: string;
};

const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MIN_PICKER_YEAR = 2025;

async function readLeaveResponse(response: Response) {
  const payload = (await response.json()) as EmployeeLeavePageResponse;
  if (!response.ok || !payload.employee || !payload.credits || !payload.requests) {
    throw new Error(payload.error ?? "Unable to load your leave data.");
  }

  return {
    employee: payload.employee,
    credits: payload.credits,
    requests: payload.requests,
  };
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes || sizeBytes <= 0) {
    return "";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeavePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<LeaveRequest | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const createLeaveMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const response = await fetch("/api/employee/leave", {
        method: "POST",
        body: payload,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to file leave application.");
      }
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["employee-leave"] });
      setDialogOpen(false);
      toast({
        title: "Leave application filed",
        description: "Your leave application has been submitted to HR for approval.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to file leave",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const employee = leaveQuery.data?.employee ?? null;
  const credits = leaveQuery.data?.credits ?? [];
  const requests = leaveQuery.data?.requests ?? [];

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          (typeFilter === "all" || request.leaveType === typeFilter) &&
          (statusFilter === "all" || request.overallStatus === statusFilter),
      ),
    [requests, statusFilter, typeFilter],
  );

  if (leaveQuery.isLoading) {
    return <div className="p-6 text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your leave data...</div>;
  }

  if (leaveQuery.error) {
    return <div className="p-6 text-muted-foreground">{leaveQuery.error instanceof Error ? leaveQuery.error.message : "No employee record found."}</div>;
  }

  if (!employee) {
    return <div className="p-6 text-muted-foreground">No employee record found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <HexagonAvatar name={`${employee.firstName} ${employee.lastName}`} color={employee.avatarColor ?? "#1e3a8a"} size={40} />
          <div>
            <h2 className="text-lg font-bold">File a Leave</h2>
            <p className="text-xs text-muted-foreground">{employee.position} - {employee.department}</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> File a Leave Application
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plane className="h-4 w-4 text-primary" /> Leave Credits Summary</CardTitle>
          <CardDescription>Available leave credits remaining based on the leave limits set by the admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {credits.map((credit, index) => (
              <HexStatCard key={credit.leaveType} label={getLeaveTypeLabel(credit.leaveType, employee.department)} value={formatLeaveDayCount(credit.remainingDays)} sublabel={Number.isFinite(credit.maxDays) ? `${formatLeaveDayCount(credit.remainingDays)} of ${formatLeaveDayCount(credit.maxDays)} days left` : "Unlimited leave without pay"} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Filed Leave Applications</CardTitle>
              <CardDescription>Track the approval status of your submitted applications.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {getAvailableLeaveTypes(employee.department, employee.gender).map((type) => <SelectItem key={type} value={type}>{getLeaveTypeLabel(type, employee.department)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="w-[130px]"><SelectValue placeholder="All status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Disapproved">Disapproved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">No leave applications match your filters.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> File your first leave
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <LeaveApplicationCard key={request.id} req={request} employeeDepartment={employee.department} onOpen={() => setDetailsRequest(request)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FileLeaveDialog open={dialogOpen} onOpenChange={setDialogOpen} employee={employee} credits={credits} isSubmitting={createLeaveMutation.isPending} onFile={(payload) => createLeaveMutation.mutate(payload)} />
      <LeaveDetailsDialog request={detailsRequest} employeeDepartment={employee.department} onOpenChange={(open) => { if (!open) setDetailsRequest(null); }} />
    </div>
  );
}

function LeaveApplicationCard({ req, employeeDepartment, onOpen }: { req: LeaveRequest; employeeDepartment: string; onOpen: () => void }) {
  const color = leaveStatusColor(req.overallStatus);

  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
        <Plane className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{getLeaveTypeLabel(req.leaveType, employeeDepartment)}</p>
          <Badge variant="outline" style={{ color, borderColor: color }}>{req.overallStatus}</Badge>
          {req.attachment ? <Badge variant="outline" className="gap-1"><Paperclip className="h-3 w-3" /> Attachment</Badge> : null}
          <span className="text-xs text-muted-foreground">- Filed {formatDateShort(req.dateFiled)}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{formatDate(req.dateFrom)} - {formatDate(req.dateTo)} - {formatLeaveDayLabel(req.days)} - {req.reason}</p>
      </div>
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LeaveDetailsDialog({ request, employeeDepartment, onOpenChange }: { request: LeaveRequest | null; employeeDepartment: string; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const stage = request?.stages[0] ?? null;
  const overallColor = request ? leaveStatusColor(request.overallStatus) : "#ca8a04";
  const approvalColor = stage?.status === "Approved" ? "#16a34a" : stage?.status === "Disapproved" ? "#dc2626" : "#ca8a04";
  const statusIcon = request?.overallStatus === "Approved"
    ? <CheckCircle2 className="h-4 w-4" />
    : request?.overallStatus === "Disapproved"
      ? <AlertCircle className="h-4 w-4" />
      : <Clock3 className="h-4 w-4" />;

  async function openAttachment() {
    if (!request?.attachment) {
      return;
    }

    const popup = window.open("", "_blank");
    if (popup) {
      popup.document.title = "Opening attachment...";
      popup.document.body.innerHTML = '<div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">Opening attachment...</div>';
    }

    try {
      setOpeningAttachment(true);
      const response = await fetch(`/api/employee/leave/${request.id}/attachment`, { cache: "no-store" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Unable to open the attachment.");
      }

      if (popup) {
        popup.location.replace(body.url);
      } else {
        window.open(body.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (popup) {
        popup.close();
      }
      toast({
        title: "Unable to open attachment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOpeningAttachment(false);
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        {request && (
          <>
            <div className="border-b border-border bg-gradient-to-r from-primary/[0.08] via-background to-amber-50/60 px-6 py-5">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">Leave Application Details</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Review the details and current HR decision for this {getLeaveTypeLabel(request.leaveType, employeeDepartment).toLowerCase()} request.
                    </DialogDescription>
                  </div>
                  <div className="hidden rounded-2xl border border-primary/15 bg-white/80 p-3 shadow-sm sm:flex">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ color: overallColor, borderColor: `${overallColor}66`, backgroundColor: `${overallColor}12` }}>
                    {statusIcon}
                    {request.overallStatus}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: approvalColor, borderColor: `${approvalColor}66`, backgroundColor: `${approvalColor}12` }}>
                    HR Approval - {stage?.status ?? "Pending"}
                  </Badge>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailCard label="Date From" value={formatDate(request.dateFrom)} />
                <DetailCard label="Date To" value={formatDate(request.dateTo)} />
                <DetailCard label="Days Applied" value={formatLeaveDayLabel(request.days)} />
                <DetailCard label="Date Filed" value={formatDate(request.dateFiled)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reason for Leave</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{request.reason}</p>
                  </div>

                  {request.attachment ? (
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Attachment</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{formatAttachmentDisplayName(request.attachment.fileName)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {request.attachment.mimeType ?? "File"}{request.attachment.sizeBytes ? ` - ${formatFileSize(request.attachment.sizeBytes)}` : ""}
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={openAttachment} disabled={openingAttachment}>
                          {openingAttachment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                          View File
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 shadow-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">HR Decision</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <DecisionRow label="Status" value={stage?.status ?? "Pending"} valueColor={approvalColor} />
                    <DecisionRow label="Handled By (HR)" value={stage?.approverName ?? "Not yet reviewed"} />
                    <DecisionRow label="Review Date" value={stage?.dateSigned ? formatDate(stage.dateSigned) : "-"} />
                    <DecisionRow label="HR Remarks" value={stage?.reason ?? (stage?.status === "Pending" ? "Waiting for HR review." : "No remarks provided.")} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="border-t border-border bg-muted/10 px-6 py-4 sm:justify-end">
          <Button variant="outline" className="min-w-24" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DecisionRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium" style={valueColor ? { color: valueColor } : undefined}>{value}</p>
    </div>
  );
}

function FileLeaveDialog({
  open,
  onOpenChange,
  employee,
  credits,
  isSubmitting,
  onFile,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employee: EmployeeProfile;
  credits: LeaveCreditSummary[];
  isSubmitting: boolean;
  onFile: (payload: FormData) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [leaveDuration, setLeaveDuration] = useState<LeaveDurationType>("full-day");
  const [reason, setReason] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const selectedCredit = useMemo(() => credits.find((credit) => credit.leaveType === leaveType) ?? null, [credits, leaveType]);

  const days = useMemo(() => {
    if (!dateFrom || !dateTo) {
      return 1;
    }
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return 1;
    }
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return leaveDuration === "half-day" ? 0.5 : totalDays;
  }, [dateFrom, dateTo, leaveDuration]);

  const hasInvalidRange = !!dateFrom && !!dateTo && new Date(`${dateTo}T00:00:00`) < new Date(`${dateFrom}T00:00:00`);
  const hasHalfDayRangeIssue = leaveDuration === "half-day" && !!dateFrom && !!dateTo && dateFrom !== dateTo;
  const requiresAdvanceNotice = !!leaveType && !URGENT_LEAVE_TYPES.has(leaveType as LeaveType);
  const daysUntilLeave = useMemo(() => {
    if (!dateFrom) {
      return null;
    }

    const start = new Date(`${dateFrom}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      return null;
    }

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((start.getTime() - todayDate.getTime()) / 86400000);
  }, [dateFrom]);
  const insufficientAdvanceNotice = requiresAdvanceNotice && daysUntilLeave !== null && daysUntilLeave < ADVANCE_NOTICE_DAYS;
  const exceedsRemaining = selectedCredit ? days > selectedCredit.remainingDays : false;

  const reset = () => {
    setLeaveType("");
    setDateFrom(today);
    setDateTo(today);
    setLeaveDuration("full-day");
    setReason("");
    setSelectedFile(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };


  const handleSubmit = () => {
    if (!leaveType || !reason.trim() || exceedsRemaining || hasInvalidRange || hasHalfDayRangeIssue || insufficientAdvanceNotice) {
      return;
    }

    const formData = new FormData();
    formData.set("leaveType", leaveType);
    formData.set("dateFrom", dateFrom);
    formData.set("dateTo", dateTo);
    formData.set("durationType", leaveDuration);
    formData.set("reason", reason.trim());
    if (selectedFile) {
      formData.set("attachment", selectedFile);
    }
    onFile(formData);
  };

  const canSubmit = !!leaveType && reason.trim().length > 0 && !exceedsRemaining && !hasInvalidRange && !hasHalfDayRangeIssue && !insufficientAdvanceNotice && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-5 w-5 text-primary" /> Leave Application Form</DialogTitle>
          <DialogDescription>University of Cebu - South Campus - Employee Leave Application</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Name</Label><Input value={`${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ""}`} disabled /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Position</Label><Input value={employee.position} disabled /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Department</Label><Input value={employee.department} disabled /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Date Filed</Label><Input value={formatDate(today)} disabled /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] sm:items-start">
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {credits.map((credit) => <SelectItem key={credit.leaveType} value={credit.leaveType}>{getLeaveTypeLabel(credit.leaveType, employee.department)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={leaveDuration} onValueChange={(value) => setLeaveDuration(value as LeaveDurationType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-day">Full Day</SelectItem>
                  <SelectItem value="half-day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedCredit ? (
              <div className={cn("rounded-xl border p-3 text-sm", exceedsRemaining ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-muted-foreground")}>
                <p className="font-medium text-foreground">{getLeaveTypeLabel(selectedCredit.leaveType, employee.department)}: {formatLeaveDayLabel(selectedCredit.remainingDays)} remaining</p>
                <p className="mt-1">{Number.isFinite(selectedCredit.maxDays) ? `${formatLeaveDayLabel(selectedCredit.usedDays)} used out of ${formatLeaveDayLabel(selectedCredit.maxDays)} allowed.` : "Leave W/O Pay is unlimited by default."}</p>
                {leaveDuration === "half-day" && <p className="mt-1">This request will be filed as a half-day leave.</p>}
                {exceedsRemaining && <p className="mt-1 font-medium">This request is for {formatLeaveDayLabel(days)}, which is more than the remaining balance.</p>}
              </div>
            ) : <div />}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LeaveDateField label="From" value={dateFrom} onChange={setDateFrom} />
            <LeaveDateField label="To" value={dateTo} onChange={setDateTo} />
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Total Days</Label><Input value={formatLeaveDayCount(days)} disabled /></div>
          </div>

          {hasInvalidRange && <p className="text-xs text-destructive">The leave end date cannot be earlier than the start date.</p>}
          {hasHalfDayRangeIssue && <p className="text-xs text-destructive">Half-day leave can only be filed for a single date.</p>}
          {insufficientAdvanceNotice && <p className="text-xs text-destructive">This leave type must be filed at least {ADVANCE_NOTICE_DAYS} days before the leave start date. Sick Leave may still be filed urgently.</p>}

          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Reason</Label><Textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="State the reason for your leave request." /></div>

          <div className="rounded-2xl border border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.03] via-background to-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-foreground">Leave Attachment (Optional)</Label>
                    <p className="text-xs text-muted-foreground">Upload a supporting file HR can review for authenticity.</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Accepted: PDF, JPG, JPEG, PNG. Maximum file size: {EMPLOYEE_DOCUMENT_MAX_MB} MB.</p>
              </div>

              <div className="shrink-0">
                <Input
                  id="leave-attachment"
                  type="file"
                  accept={EMPLOYEE_DOCUMENT_ACCEPT}
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <Label htmlFor="leave-attachment" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground">
                  <Paperclip className="mr-2 h-4 w-4" />
                  {selectedFile ? "Change File" : "Choose File"}
                </Label>
              </div>
            </div>

            {selectedFile ? (
              <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex flex-1 items-center gap-3 overflow-hidden">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-foreground">{formatAttachmentDisplayName(selectedFile.name, "Selected Attachment")}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} attached</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 justify-start text-muted-foreground hover:text-destructive sm:justify-center" onClick={() => setSelectedFile(null)}>
                  Remove file
                </Button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                No attachment selected. You can still submit the leave request without one.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Submit Leave</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDateField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const [displayMonth, setDisplayMonth] = useState<Date>(isValidDate ? parsedDate : new Date());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_PICKER_YEAR + 6 }, (_, index) => currentYear + 5 - index);
  }, []);


  const activeMonthLabel = MONTH_OPTIONS[displayMonth.getMonth()];
  const activeYear = displayMonth.getFullYear();

  function moveMonth(direction: -1 | 1) {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectMonth(monthIndex: number) {
    setDisplayMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setMonthOpen(false);
  }

  function selectYear(nextYear: number) {
    setDisplayMonth((current) => new Date(nextYear, current.getMonth(), 1));
    setYearOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className={cn("h-10 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background", !isValidDate && "text-muted-foreground")}>
            <span>{isValidDate && parsedDate ? format(parsedDate, "MMMM d, yyyy") : `Select ${label.toLowerCase()}`}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="relative flex items-center justify-center px-8">
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 size-8 rounded-lg" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="flex items-center justify-center gap-2.5">
                <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[6.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium"><span>{activeMonthLabel}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="max-h-72 overflow-y-auto pr-1"><div className="grid gap-1">{MONTH_OPTIONS.map((monthName, index) => <Button key={monthName} type="button" variant={index === displayMonth.getMonth() ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectMonth(index)}>{monthName}</Button>)}</div></div>
                  </PopoverContent>
                </Popover>
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[5.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium"><span>{activeYear}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-28 overflow-y-auto p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="grid gap-1">{years.map((entryYear) => <Button key={entryYear} type="button" variant={entryYear === activeYear ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectYear(entryYear)}>{entryYear}</Button>)}</div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 size-8 rounded-lg" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              onChange(format(selectedDate, "yyyy-MM-dd"));
            }}
            hideNavigation
            className="flex justify-center px-4 pb-4 pt-4"
            classNames={{
              root: "mx-auto w-fit",
              months: "w-fit",
              month: "w-fit gap-3",
              month_caption: "hidden",
              table: "w-full table-fixed border-collapse",
              weekdays: "grid grid-cols-7",
              week: "mt-2 grid grid-cols-7",
              weekday: "text-center text-[0.8rem] font-normal text-muted-foreground",
              day: "relative p-0 text-center",
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}















