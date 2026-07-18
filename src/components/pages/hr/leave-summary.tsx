"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, formatLeaveDayCount } from "@/components/shared/helpers";
import { isLeaveTypeApplicableToEmployee } from "@/lib/types";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableFilterSelect } from "@/components/shared/filter-controls";

type LeaveSummaryRow = {
  employeeId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  department: string;
  position: string;
  employmentStatus: string;
  dateHired?: string;
  gender: "Male" | "Female";
  avatarColor?: string;
  vacationLeave: number;
  sickLeave: number;
  incentiveLeave: number;
  soloParent: number;
  paternity: number;
  maternity: number;
};

type LeaveSummaryResponse = {
  departments?: string[];
  rows?: LeaveSummaryRow[];
  error?: string;
};

const CREDIT_COLS: Array<{ key: keyof Pick<LeaveSummaryRow, "vacationLeave" | "sickLeave" | "incentiveLeave" | "soloParent" | "paternity" | "maternity">; label: string }> = [
  { key: "vacationLeave", label: "Vacation Leave" },
  { key: "sickLeave", label: "Sick Leave" },
  { key: "incentiveLeave", label: "Summer Incentive Leave" },
  { key: "soloParent", label: "Solo Parent" },
  { key: "paternity", label: "Paternity" },
  { key: "maternity", label: "Maternity" },
];

async function fetchLeaveSummary(department: string) {
  const params = new URLSearchParams();
  if (department !== "All") {
    params.set("department", department);
  }

  const response = await fetch(`/api/hr/leave-summary${params.size ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as LeaveSummaryResponse;

  if (!response.ok || !payload.rows || !payload.departments) {
    throw new Error(payload.error ?? "Unable to load leave summary.");
  }

  return {
    departments: payload.departments,
    rows: payload.rows,
  };
}

function readDownloadFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallback;
}

export function LeaveSummaryPage() {
  const { toast } = useToast();
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["hr-leave-summary", deptFilter],
    queryFn: () => fetchLeaveSummary(deptFilter),
    placeholderData: (previous) => previous,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const departments = useMemo(() => summaryQuery.data?.departments ?? [], [summaryQuery.data]);
  const sourceRows = useMemo(() => summaryQuery.data?.rows ?? [], [summaryQuery.data]);
  const employeeOptions = useMemo(() => sourceRows.map((row) => ({ value: row.employeeId, label: `${row.lastName}, ${row.firstName}` })), [sourceRows]);
  const positionOptions = useMemo(() => Array.from(new Set(sourceRows.map((row) => row.position.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [sourceRows]);
  const statusOptions = useMemo(() => Array.from(new Set(sourceRows.map((row) => row.employmentStatus.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [sourceRows]);
  const effectiveEmployeeFilter = employeeFilter === "all" || employeeOptions.some((employee) => employee.value === employeeFilter)
    ? employeeFilter
    : "all";
  const effectivePositionFilter = positionFilter === "all" || positionOptions.includes(positionFilter)
    ? positionFilter
    : "all";
  const effectiveStatusFilter = statusFilter === "all" || statusOptions.includes(statusFilter)
    ? statusFilter
    : "all";
  const rows = useMemo(() => sourceRows.filter((row) => (effectiveEmployeeFilter === "all" || row.employeeId === effectiveEmployeeFilter) && (effectivePositionFilter === "all" || row.position === effectivePositionFilter) && (effectiveStatusFilter === "all" || row.employmentStatus === effectiveStatusFilter)), [effectiveEmployeeFilter, effectivePositionFilter, effectiveStatusFilter, sourceRows]);

  async function exportSheet() {
    if (isExporting || typeof window === "undefined") {
      return;
    }

    setIsExporting(true);
    try {
      const timeframeLabel = `Leave Credits From January - December ${new Date().getFullYear()}`;
      const filters = [
        `Employee: ${effectiveEmployeeFilter === "all" ? "All Employees" : employeeOptions.find((employee) => employee.value === effectiveEmployeeFilter)?.label ?? "All Employees"}`,
        `Department: ${deptFilter === "All" ? "All Departments" : deptFilter}`,
        `Position: ${effectivePositionFilter === "all" ? "All Positions" : effectivePositionFilter}`,
        `E-Status: ${effectiveStatusFilter === "all" ? "All E-Status" : effectiveStatusFilter}`,
      ].join(" | ");

      const response = await fetch("/api/hr/leave-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeframeLabel,
          filtersLabel: filters,
          rows: rows.map((row) => ({
            lastName: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName,
            position: row.position,
            employmentStatus: row.employmentStatus,
            dateHired: row.dateHired ?? "",
            vacationLeave: formatLeaveDayCount(row.vacationLeave),
            sickLeave: formatLeaveDayCount(row.sickLeave),
            incentiveLeave: isLeaveTypeApplicableToEmployee("Incentive Leave", { department: row.department, gender: row.gender }) ? formatLeaveDayCount(row.incentiveLeave) : "-",
            soloParent: formatLeaveDayCount(row.soloParent),
            paternity: isLeaveTypeApplicableToEmployee("Paternity Leave", { department: row.department, gender: row.gender }) ? formatLeaveDayCount(row.paternity) : "-",
            maternity: isLeaveTypeApplicableToEmployee("Maternity Leave", { department: row.department, gender: row.gender }) ? formatLeaveDayCount(row.maternity) : "-",
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error || "Unable to export leave summary.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = readDownloadFilename(response, `leave-summary-remaining-${new Date().toISOString().slice(0, 10)}.xlsx`);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Export completed",
        description: "Leave summary remaining credits workbook is ready.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export leave summary.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const isLeaveSummaryLoading = summaryQuery.isLoading;

  if (summaryQuery.error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Unable to load leave summary."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Leave Summary (Remaining Credits)</h1>
          <p className="text-sm text-muted-foreground">
            Remaining leave credits automatically computed from approved leave requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportSheet} className="bg-primary" disabled={isExporting || rows.length === 0}>
            {isExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</> : <><Download className="mr-2 h-4 w-4" /> Export</>}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-0">
          <div className="grid gap-3 xl:grid-cols-5">
            <SearchableFilterSelect
              label="Employee"
              value={effectiveEmployeeFilter}
              onValueChange={setEmployeeFilter}
              options={[
                { value: "all", label: "All Employees" },
                ...employeeOptions,
              ]}
              searchPlaceholder="Search employee..."
              emptyLabel="No employee found."
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
            />
            <SearchableFilterSelect
              label="Department"
              value={deptFilter}
              onValueChange={setDeptFilter}
              options={[
                { value: "All", label: "All Departments" },
                ...departments.map((department) => ({
                  value: department,
                  label: department,
                })),
              ]}
              searchPlaceholder="Search department..."
              emptyLabel="No department found."
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
            />
            <SearchableFilterSelect
              label="Position"
              value={effectivePositionFilter}
              onValueChange={setPositionFilter}
              options={[
                { value: "all", label: "All Positions" },
                ...positionOptions.map((position) => ({
                  value: position,
                  label: position,
                })),
              ]}
              searchPlaceholder="Search position..."
              emptyLabel="No position found."
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
            />
            <SearchableFilterSelect
              label="E-Status"
              value={effectiveStatusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "all", label: "All E-Status" },
                ...statusOptions.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
              searchPlaceholder="Search employment status..."
              emptyLabel="No employment status found."
              triggerClassName="h-11 rounded-md border-input bg-background text-left shadow-xs hover:bg-background"
              labelClassName="text-sm font-medium text-foreground"
            />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                {isLeaveSummaryLoading ? 0 : rows.length} of {sourceRows.length} employee{sourceRows.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">Leave Credits per Employee</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[34rem] overflow-auto scroll-thin rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Department</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Position</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">E-Status</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">Date Hired</TableHead>
                  {CREDIT_COLS.map((column) => (
                    <TableHead key={column.key} className="whitespace-nowrap text-center text-xs">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLeaveSummaryLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading leave summary records...
                    </TableCell>
                  </TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <HexagonAvatar
                          name={`${row.firstName} ${row.lastName}`}
                          color={row.avatarColor || "#1e3a8a"}
                          size={26}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{row.lastName}, {row.firstName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle text-sm text-muted-foreground">
                      <span className="inline-flex max-w-full items-center px-2 py-1">
                        {row.department}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle text-sm text-muted-foreground">
                      <span className="inline-flex max-w-full items-center px-2 py-1">
                        {row.position}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle text-sm text-muted-foreground">
                      <span className="inline-flex max-w-full items-center px-2 py-1">
                        {row.employmentStatus}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle text-sm text-muted-foreground">
                      <span className="inline-flex max-w-full items-center px-2 py-1 whitespace-nowrap">
                        {row.dateHired ? formatDate(row.dateHired) : "-"}
                      </span>
                    </TableCell>
                    {CREDIT_COLS.map((column) => {
                      const rawValue = row[column.key];
                      const leaveType =
                        column.key === "vacationLeave"
                          ? "Vacation Leave"
                          : column.key === "sickLeave"
                            ? "Sick Leave"
                            : column.key === "incentiveLeave"
                              ? "Incentive Leave"
                              : column.key === "soloParent"
                                ? "Solo Parent Leave"
                                : column.key === "paternity"
                                  ? "Paternity Leave"
                                  : "Maternity Leave";
                      const value = isLeaveTypeApplicableToEmployee(leaveType, { department: row.department, gender: row.gender })
                        ? formatLeaveDayCount(rawValue)
                        : "-";

                      return (
                        <TableCell key={column.key} className="text-center align-middle text-sm font-medium text-foreground">
                          <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1">
                            {value}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5 + CREDIT_COLS.length} className="py-8 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Remaining balances are read-only and are automatically calculated from each employee&apos;s approved leave records, including half-day requests as 0.5.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


