"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  UserCircle,
  Users,
} from "lucide-react";

type StaffCategoryView = "Teaching" | "Non-Teaching";
type SummaryPeriod = "whole-month" | "first-half" | "second-half";

type AttendanceSummaryResponse = {
  month: string;
  monthLabel: string;
  period: SummaryPeriod;
  periodLabel: string;
  rangeLabel: string;
  dateFrom: string;
  dateTo: string;
  staffCategory: StaffCategoryView;
  rows: Array<{
    employeeId: string;
    lastName: string;
    firstName: string;
    middleName: string;
    department: string;
    position: string;
    absent: number;
    leaveDays: number;
    lateMinutes: number;
    undertimeMinutes: number;
    approvedOvertimeHours: number;
    remarks: string;
  }>;
  summary: {
    employeesCount: number;
    totalEmployeesCount?: number;
    totalAbsences: number;
    totalLeaveDays: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalApprovedOvertimeHours: number;
  };
};

const PERIOD_OPTIONS: Array<{ value: SummaryPeriod; label: string }> = [
  { value: "whole-month", label: "Whole Month" },
  { value: "first-half", label: "1st 15 Days" },
  { value: "second-half", label: "2nd 15 Days" },
];

const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MIN_PICKER_YEAR = 2000;

async function parseJsonSafely<T>(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(response.ok ? "Empty server response." : "Request failed.");
  }

  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    throw new Error(response.ok ? "Invalid server response." : raw);
  }
}

function displayCount(value: number) {
  return value > 0 ? value.toLocaleString() : "-";
}

function displayHours(value: number) {
  return value > 0 ? value.toFixed(1) : "-";
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

export function AttendanceSummaryPage() {
  const { toast } = useToast();
  const now = useMemo(() => new Date(), []);
  const defaultMonth = format(now, "yyyy-MM");

  const [staffCategory, setStaffCategory] = useState<StaffCategoryView>("Non-Teaching");
  const [month, setMonth] = useState(defaultMonth);
  const [period, setPeriod] = useState<SummaryPeriod>("whole-month");
  const [isExporting, setIsExporting] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["hr-attendance-summary", staffCategory, month, period],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        staffCategory,
        month,
        period,
      });
      const response = await fetch(`/api/hr/attendance-summary?${query.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = await parseJsonSafely<AttendanceSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load attendance summary.");
      }
      return payload;
    },
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  async function exportSheet() {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch("/api/hr/attendance-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffCategory,
          month,
          period,
        }),
      });

      if (!response.ok) {
        const payload = await parseJsonSafely<{ error?: string }>(response);
        throw new Error(payload.error || "Unable to export attendance summary.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = readDownloadFilename(response, `attendance-summary-${month}.xlsx`);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Export completed",
        description: `${staffCategory} attendance summary for ${summaryQuery.data?.monthLabel ?? month} is ready.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export attendance summary.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  if (summaryQuery.isLoading && !summaryQuery.data) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading attendance summary...
      </div>
    );
  }

  if (summaryQuery.error || !summaryQuery.data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Unable to load attendance summary."}
      </div>
    );
  }

  const data = summaryQuery.data;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Attendance Summary</h1>
          <p className="text-sm text-muted-foreground">
            {data.rangeLabel} - UC South Campus - {data.staffCategory} personnel
          </p>
          {summaryQuery.isFetching ? (
            <p className="mt-1 text-xs text-muted-foreground">Refreshing attendance summary...</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportSheet} className="bg-primary" disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Export
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex w-full max-w-[448px] items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${staffCategory === "Teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setStaffCategory("Teaching")}
          type="button"
        >
          <Users className={`h-4 w-4 ${staffCategory === "Teaching" ? "text-primary" : ""}`} /> Teaching
        </button>
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${staffCategory === "Non-Teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setStaffCategory("Non-Teaching")}
          type="button"
        >
          <UserCircle className={`h-4 w-4 ${staffCategory === "Non-Teaching" ? "text-primary" : ""}`} /> Non-Teaching
        </button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <AttendanceSummaryMonthField label="Month" value={month} onChange={setMonth} />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Counter</Label>
              <Select value={period} onValueChange={(value) => setPeriod(value as SummaryPeriod)}>
                <SelectTrigger className="h-[44px] w-full data-[size=default]:h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                {data.summary.employeesCount} of {data.summary.totalEmployeesCount ?? data.summary.employeesCount} employees
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric label="Absences" value={displayCount(data.summary.totalAbsences)} color="text-red-600" />
            <SummaryMetric label="Late (min)" value={displayCount(data.summary.totalLateMinutes)} color="text-amber-600" />
            <SummaryMetric label="Undertime (min)" value={displayCount(data.summary.totalUndertimeMinutes)} color="text-orange-600" />
            <SummaryMetric label="Approved OT (hrs)" value={displayHours(data.summary.totalApprovedOvertimeHours)} color="text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{data.staffCategory} Attendance Summary</CardTitle>
          <CardDescription>
            {data.periodLabel} totals computed from validated attendance records, missing workdays, and approved leave between {data.dateFrom} and {data.dateTo}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[36rem] overflow-auto rounded-lg border border-border">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead className="w-[14rem]">Last Name</TableHead>
                  <TableHead className="w-[12rem]">First Name</TableHead>
                  <TableHead className="w-28 text-center">Absent</TableHead>
                  <TableHead className="w-28 text-center">Leave Days</TableHead>
                  <TableHead className="w-32 text-center">Late (min)</TableHead>
                  <TableHead className="w-40 text-center">Undertime (min)</TableHead>
                  <TableHead className="w-32 text-center">OT Reg (hrs)</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No {data.staffCategory.toLowerCase()} employees were available for this selected cutoff.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row, index) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="text-center text-xs text-muted-foreground align-middle">{index + 1}</TableCell>
                      <TableCell className="truncate text-sm font-medium align-middle">{row.lastName}</TableCell>
                      <TableCell className="truncate text-sm align-middle">{row.firstName}</TableCell>
                      <TableCell className={`text-center text-xs align-middle ${row.absent > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                        {displayCount(row.absent)}
                      </TableCell>
                      <TableCell className={`text-center text-xs align-middle ${row.leaveDays > 0 ? "font-semibold text-blue-600" : "text-muted-foreground"}`}>
                        {displayCount(row.leaveDays)}
                      </TableCell>
                      <TableCell className={`text-center text-xs align-middle ${row.lateMinutes > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                        {displayCount(row.lateMinutes)}
                      </TableCell>
                      <TableCell className={`text-center text-xs align-middle ${row.undertimeMinutes > 0 ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>
                        {displayCount(row.undertimeMinutes)}
                      </TableCell>
                      <TableCell className={`text-center text-xs align-middle ${row.approvedOvertimeHours > 0 ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                        {displayHours(row.approvedOvertimeHours)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-middle">{row.remarks || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceSummaryMonthField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsedDate = value ? new Date(`${value}-01T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());
  const calendarMonth = isValidDate && parsedDate ? new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1) : new Date();
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - MIN_PICKER_YEAR + 2 }, (_, index) => currentYear + 1 - index);
  }, []);

  const activeMonthLabel = MONTH_OPTIONS[calendarMonth.getMonth()];
  const activeYear = calendarMonth.getFullYear();

  function commitMonth(date: Date) {
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    onChange(format(nextMonth, "yyyy-MM"));
  }

  function moveMonth(direction: -1 | 1) {
    commitMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1));
  }

  function selectMonth(monthIndex: number) {
    commitMonth(new Date(calendarMonth.getFullYear(), monthIndex, 1));
    setMonthOpen(false);
  }

  function selectYear(year: number) {
    commitMonth(new Date(year, calendarMonth.getMonth(), 1));
    setYearOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background",
              !isValidDate && "text-muted-foreground",
            )}
          >
            <span>{isValidDate && parsedDate ? format(parsedDate, "MMMM yyyy") : `Select ${label.toLowerCase()}`}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <div className="border-b border-border/60 px-3 pb-3 pt-4">
            <div className="relative flex items-center justify-center px-8">
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 size-8 rounded-lg" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center gap-2.5">
                <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[6.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeMonthLabel}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid gap-1">
                        {MONTH_OPTIONS.map((monthName, index) => (
                          <Button key={monthName} type="button" variant={index === calendarMonth.getMonth() ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectMonth(index)}>
                            {monthName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 min-w-[5.75rem] justify-between rounded-lg border-input bg-background px-3 font-medium">
                      <span>{activeYear}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-72 w-28 overflow-y-auto p-1" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
                    <div className="grid gap-1">
                      {years.map((year) => (
                        <Button key={year} type="button" variant={year === activeYear ? "secondary" : "ghost"} className="h-9 justify-start rounded-md px-3" onClick={() => selectYear(year)}>
                          {year}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 size-8 rounded-lg" onClick={() => moveMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={commitMonth}
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              commitMonth(selectedDate);
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
              week: "grid grid-cols-7 mt-2",
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

function SummaryMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
