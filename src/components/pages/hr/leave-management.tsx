"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, LeaveRequest, LeaveStageStatus } from "@/lib/types";
import { getAdminLeaveTypeLabel, getLeaveTypeLabel, LEAVE_TYPES } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { formatAttachmentDisplayName, formatDate, formatDateShort, formatLeaveDayCount, leaveStatusColor } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/shared/filter-controls";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Check, X, FileText, Clock, Loader2, ExternalLink } from "lucide-react";

type StatusFilter = "All" | "Pending" | "Approved" | "Disapproved" | "Cancelled";
type ModalMode = "view" | "approve" | "disapprove";

type StaffLeaveDashboardResponse = {
  employees?: Array<Employee & { birthDate?: string }>;
  requests?: LeaveRequest[];
  error?: string;
};

async function readDashboardResponse(response: Response) {
  const payload = (await response.json()) as StaffLeaveDashboardResponse;
  if (!response.ok || !payload.employees || !payload.requests) {
    throw new Error(payload.error ?? "Unable to load leave requests.");
  }
  return {
    employees: payload.employees,
    requests: payload.requests,
  };
}

function getHrDecisionStage(request: LeaveRequest) {
  return request.stages[0] ?? null;
}

function getApprovalLabel(request: LeaveRequest) {
  const stage = getHrDecisionStage(request);

  if (request.overallStatus === "Cancelled") {
    return {
      primary: "Cancelled by employee",
      secondary: "No HR decision required",
      colorClass: "text-muted-foreground",
    };
  }

  if (!stage) {
    return {
      primary: "HR Approval",
      secondary: "Pending assignment",
      colorClass: "text-amber-600",
    };
  }

  if (request.overallStatus === "Pending") {
    return {
      primary: "HR Approval",
      secondary: request.attachment ? "With supporting attachment" : "Waiting for HR decision",
      colorClass: "text-amber-600",
    };
  }

  if (request.overallStatus === "Approved") {
    return {
      primary: stage.approverName ?? "HR",
      secondary: "Approved this leave request",
      colorClass: "text-green-600",
    };
  }

  return {
    primary: stage.approverName ?? "HR",
    secondary: "Disapproved this leave request",
    colorClass: "text-red-600",
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

export function LeaveManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [actionModal, setActionModal] = useState<{ req: LeaveRequest; mode: ModalMode } | null>(null);
  const [reason, setReason] = useState("");
  const [openingAttachment, setOpeningAttachment] = useState(false);

  const leaveQuery = useQuery({
    queryKey: ["staff-leave-management"],
    queryFn: async () => {
      const response = await fetch("/api/hr/leave", { cache: "no-store" });
      return readDashboardResponse(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; approve: boolean; reason?: string }) => {
      const response = await fetch("/api/hr/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to update leave request.");
      }
      return body;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["staff-leave-management"] });
      await queryClient.invalidateQueries({ queryKey: ["employee-leave"] });
      toast({
        title: variables.approve ? "Leave approved" : "Leave disapproved",
        description: variables.approve
          ? "The leave request has been approved by HR."
          : "The leave request has been disapproved by HR and the reason was saved.",
      });
      setActionModal(null);
      setReason("");
    },
    onError: (error) => {
      toast({
        title: "Unable to update leave",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const employees = leaveQuery.data?.employees ?? [];
  const leaveRequests = leaveQuery.data?.requests ?? [];

  const filtered = useMemo(() => {
    return leaveRequests
      .filter((request) => statusFilter === "All" || request.overallStatus === statusFilter)
      .filter((request) => typeFilter === "All" || request.leaveType === typeFilter)
      .sort((left, right) => right.dateFiled.localeCompare(left.dateFiled));
  }, [leaveRequests, statusFilter, typeFilter]);

  const pendingRequests = useMemo(
    () => filtered.filter((request) => request.overallStatus === "Pending"),
    [filtered],
  );

  const historyRequests = useMemo(
    () => filtered.filter((request) => request.overallStatus !== "Pending"),
    [filtered],
  );

  function emp(id: string) {
    return employees.find((employee) => employee.id === id) ?? null;
  }

  async function openAttachment(request: LeaveRequest) {
    if (!request.attachment?.storagePath) {
      return;
    }

    const popup = window.open("", "_blank");
    if (popup) {
      popup.document.title = "Opening attachment...";
      popup.document.body.innerHTML = '<div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">Opening attachment...</div>';
    }

    try {
      setOpeningAttachment(true);
      const response = await fetch(`/api/hr/leave/${request.id}/attachment`, { cache: "no-store" });
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

  function openModal(req: LeaveRequest, mode: ModalMode = "view") {
    setActionModal({ req, mode });
    setReason(mode === "disapprove" ? "" : req.stages[0]?.reason ?? "");
  }

  function submitAction() {
    if (!actionModal) {
      return;
    }

    if (actionModal.mode !== "approve" && actionModal.mode !== "disapprove") {
      return;
    }

    if (actionModal.mode === "disapprove" && !reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason before disapproving this leave request.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      id: actionModal.req.id,
      approve: actionModal.mode === "approve",
      reason: reason.trim() || undefined,
    });
  }

  const pendingCount = leaveRequests.filter((request) => request.overallStatus === "Pending").length;
  const approvedCount = leaveRequests.filter((request) => request.overallStatus === "Approved").length;
  const disapprovedCount = leaveRequests.filter((request) => request.overallStatus === "Disapproved").length;
  const cancelledCount = leaveRequests.filter((request) => request.overallStatus === "Cancelled").length;

  const isLeaveLoading = leaveQuery.isLoading;

  if (leaveQuery.error) {
    return <div className="p-6 text-muted-foreground">{leaveQuery.error instanceof Error ? leaveQuery.error.message : "Unable to load leave requests."}</div>;
  }

  return (
    <div className="space-y-4 px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Leave Management</h1>
        <p className="text-sm text-muted-foreground">Single-stage HR approval queue - UC South Campus HR Department</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={pendingCount > 0 ? "border-gold/40" : ""}>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Pending Approvals</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Disapproved</p>
            <p className="text-2xl font-bold text-red-600">{disapprovedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Cancelled</p>
            <p className="text-2xl font-bold text-muted-foreground">{cancelledCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <FilterSelect
              label="Status"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
              options={[
                { value: "All", label: "All" },
                { value: "Pending", label: "Pending" },
                { value: "Approved", label: "Approved" },
                { value: "Disapproved", label: "Disapproved" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
            <FilterSelect
              label="Leave Type"
              value={typeFilter}
              onValueChange={setTypeFilter}
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
              options={[
                { value: "All", label: "All Types" },
                ...LEAVE_TYPES.map((type) => ({
                  value: type,
                  label: getAdminLeaveTypeLabel(type),
                })),
              ]}
            />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                {isLeaveLoading ? 0 : filtered.length} of {leaveRequests.length} requests
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">Leave Requests</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[36rem] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="w-[90px] text-right">Days</TableHead>
                  <TableHead className="min-w-[220px] pl-6">Approval</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLeaveLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading leave requests...
                    </TableCell>
                  </TableRow>
                ) : pendingRequests.map((request) => {
                  const employee = emp(request.employeeId);
                  const approvalLabel = getApprovalLabel(request);
                  return (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer transition-colors hover:bg-accent/30"
                      onClick={() => openModal(request, "view")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HexagonAvatar
                            name={employee ? `${employee.firstName} ${employee.lastName}` : "?"}
                            color={employee?.avatarColor || "#1e3a8a"}
                            size={26}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{employee ? `${employee.lastName}, ${employee.firstName}` : request.employeeId}</p>
                            <p className="truncate text-xs text-muted-foreground">{employee?.department ?? "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{getLeaveTypeLabel(request.leaveType, employee?.department)}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {formatDateShort(request.dateFrom)} - {formatDateShort(request.dateTo)}
                        <p className="text-[10px] text-muted-foreground">Filed {formatDateShort(request.dateFiled)}</p>
                      </TableCell>
                      <TableCell className="w-[90px] pr-6 text-right text-sm font-medium">{formatLeaveDayCount(request.days)}</TableCell>
                      <TableCell className="min-w-[220px] pl-6">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium ${approvalLabel.colorClass}`}>{approvalLabel.primary}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{approvalLabel.secondary}</p>
                        </div>
                      </TableCell>
                      <TableCell><HexagonBadge color={leaveStatusColor(request.overallStatus)}>{request.overallStatus}</HexagonBadge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 bg-green-600 text-white hover:bg-green-700" disabled={updateMutation.isPending} onClick={(event) => { event.stopPropagation(); openModal(request, "approve"); }}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 border-red-300 text-red-600 hover:bg-red-50" disabled={updateMutation.isPending} onClick={(event) => { event.stopPropagation(); openModal(request, "disapprove"); }}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLeaveLoading && pendingRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No pending leave requests match the filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">Leave History</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[36rem] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="w-[90px] text-right">Days</TableHead>
                  <TableHead className="min-w-[220px] pl-6">Approval</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLeaveLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading leave history...
                    </TableCell>
                  </TableRow>
                ) : historyRequests.map((request) => {
                  const employee = emp(request.employeeId);
                  const approvalLabel = getApprovalLabel(request);
                  return (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer transition-colors hover:bg-accent/30"
                      onClick={() => openModal(request, "view")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HexagonAvatar
                            name={employee ? `${employee.firstName} ${employee.lastName}` : "?"}
                            color={employee?.avatarColor || "#1e3a8a"}
                            size={26}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{employee ? `${employee.lastName}, ${employee.firstName}` : request.employeeId}</p>
                            <p className="truncate text-xs text-muted-foreground">{employee?.department ?? "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{getLeaveTypeLabel(request.leaveType, employee?.department)}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {formatDateShort(request.dateFrom)} - {formatDateShort(request.dateTo)}
                        <p className="text-[10px] text-muted-foreground">Filed {formatDateShort(request.dateFiled)}</p>
                      </TableCell>
                      <TableCell className="w-[90px] pr-6 text-right text-sm font-medium">{formatLeaveDayCount(request.days)}</TableCell>
                      <TableCell className="min-w-[220px] pl-6">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium ${approvalLabel.colorClass}`}>{approvalLabel.primary}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{approvalLabel.secondary}</p>
                        </div>
                      </TableCell>
                      <TableCell><HexagonBadge color={leaveStatusColor(request.overallStatus)}>{request.overallStatus}</HexagonBadge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(event) => { event.stopPropagation(); openModal(request, "view"); }}>
                          <FileText className="h-3.5 w-3.5" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLeaveLoading && historyRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No leave history matches the filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!actionModal} onOpenChange={(open) => { if (!open) { setActionModal(null); setReason(""); } }}>
        <DialogContent className="w-[min(92vw,42rem)] max-h-[90vh] overflow-x-hidden overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              {actionModal?.mode === "approve"
                ? "Approve Leave Request"
                : actionModal?.mode === "disapprove"
                  ? "Disapprove Leave Request"
                  : "Leave Request Details"}
            </DialogTitle>
            <DialogDescription>
              {actionModal && emp(actionModal.req.employeeId)
                ? `${emp(actionModal.req.employeeId)?.lastName}, ${emp(actionModal.req.employeeId)?.firstName} - ${getLeaveTypeLabel(actionModal.req.leaveType, emp(actionModal.req.employeeId)?.department)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {actionModal && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">Date From</p><p className="font-medium">{formatDate(actionModal.req.dateFrom)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date To</p><p className="font-medium">{formatDate(actionModal.req.dateTo)}</p></div>
                <div><p className="text-xs text-muted-foreground">Days Requested</p><p className="font-medium">{formatLeaveDayCount(actionModal.req.days)}</p></div>
                <div><p className="text-xs text-muted-foreground">Date Filed</p><p className="font-medium">{formatDate(actionModal.req.dateFiled)}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Reason</p><p className="font-medium">{actionModal.req.reason}</p></div>
              </div>

              {actionModal.req.attachment ? (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Leave Attachment</p>
                      <p className="max-w-full truncate text-sm font-medium text-foreground" title={formatAttachmentDisplayName(actionModal.req.attachment.fileName)}>
                        {formatAttachmentDisplayName(actionModal.req.attachment.fileName)}
                      </p>
                      <p className="text-xs text-muted-foreground">{actionModal.req.attachment.mimeType ?? "File"}{actionModal.req.attachment.sizeBytes ? ` - ${formatFileSize(actionModal.req.attachment.sizeBytes)}` : ""}</p>
                    </div>
                    <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => openAttachment(actionModal.req)} disabled={openingAttachment}>
                      {openingAttachment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                      View Attachment
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">HR Approval</p>
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    {actionModal.req.overallStatus === "Cancelled" ? <X className="h-4 w-4 text-muted-foreground" /> : <StageStatusIcon status={actionModal.req.stages[0]?.status ?? "Pending"} />}
                    <div>
                      <p className="font-medium">HR Approval</p>
                      {actionModal.req.overallStatus === "Cancelled" && <p className="text-xs text-muted-foreground">Cancelled by employee before HR review.</p>}
                      {actionModal.req.stages[0]?.approverName && <p className="text-xs text-muted-foreground">Handled by {actionModal.req.stages[0]?.approverName} - {actionModal.req.stages[0]?.dateSigned}</p>}
                      {actionModal.req.stages[0]?.reason && <p className="mt-0.5 text-xs text-red-600">Reason: {actionModal.req.stages[0]?.reason}</p>}
                    </div>
                  </div>
                  {actionModal.req.overallStatus === "Cancelled" ? <HexagonBadge color={leaveStatusColor("Cancelled")}>Cancelled</HexagonBadge> : <StageStatusBadge status={actionModal.req.stages[0]?.status ?? "Pending"} />}
                </div>
              </div>

              {(actionModal.mode === "approve" || actionModal.mode === "disapprove") && (
                <div className="space-y-1.5">
                  <Label htmlFor="reason">{actionModal.mode === "approve" ? "Remarks for employee (optional)" : "Reason for disapproval"}</Label>
                  <Textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={actionModal.mode === "approve" ? "Optional remarks that the employee can also see..." : "Provide a reason for disapproval. The employee will also see this."} rows={3} />
                  {actionModal.mode === "disapprove" && <p className="text-xs text-muted-foreground">This reason will be shown in the employee leave details.</p>}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 px-6 pb-6 sm:justify-end">
            <Button variant="outline" className="w-full sm:min-w-[112px] sm:w-auto" onClick={() => { setActionModal(null); setReason(""); }} disabled={updateMutation.isPending}>Close</Button>
            {actionModal?.req.overallStatus === "Pending" && actionModal?.mode === "view" && (
              <>
                <Button onClick={() => openModal(actionModal.req, "approve")} disabled={updateMutation.isPending} className="w-full bg-green-600 hover:bg-green-700 sm:min-w-[112px] sm:w-auto">
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button onClick={() => openModal(actionModal.req, "disapprove")} disabled={updateMutation.isPending} className="w-full bg-red-600 hover:bg-red-700 sm:min-w-[112px] sm:w-auto">
                  <X className="mr-2 h-4 w-4" /> Disapprove
                </Button>
              </>
            )}
            {(actionModal?.mode === "approve" || actionModal?.mode === "disapprove") && (
              <Button onClick={submitAction} disabled={updateMutation.isPending || (actionModal.mode === "disapprove" && !reason.trim())} className={actionModal.mode === "approve" ? "w-full bg-green-600 hover:bg-green-700 sm:min-w-[112px] sm:w-auto" : "w-full bg-red-600 hover:bg-red-700 sm:min-w-[112px] sm:w-auto"}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {actionModal.mode === "approve" ? "Approve" : "Disapprove"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageStatusIcon({ status }: { status: LeaveStageStatus }) {
  if (status === "Approved") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "Disapproved") return <X className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-amber-600" />;
}

function StageStatusBadge({ status }: { status: LeaveStageStatus }) {
  if (status === "Approved") return <HexagonBadge color="#16a34a">Approved</HexagonBadge>;
  if (status === "Disapproved") return <HexagonBadge color="#dc2626">Disapproved</HexagonBadge>;
  return <HexagonBadge color="#ca8a04">Pending</HexagonBadge>;
}








