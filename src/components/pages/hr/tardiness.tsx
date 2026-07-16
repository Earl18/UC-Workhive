"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";

type StaffCategoryView = "Teaching" | "Non-Teaching";
type SummaryPeriod = "whole-month" | "first-half" | "second-half";
type SortKey = "timesLate" | "totalLateMinutes" | "avgLateMinutes";
type SortDir = "asc" | "desc";

type TardinessResponse = {
  month: string;
  monthLabel: string;
  period: SummaryPeriod;
  periodLabel: string;
  rangeLabel: string;
  dateFrom: string;
  dateTo: string;
  staffCategory: StaffCategoryView;
  threshold: number;
  sortKey: SortKey;
  sortDir: SortDir;
  departments: string[];
  employmentStatuses: string[];
  rows: Array<{
    employeeId: string;
    lastName: string;
    firstName: string;
    middleName: string;
    department: string;
    position: string;
    employmentStatus: string;
    avatarColor: string | null;
    timesLate: number;
    totalLateMinutes: number;
    avgLateMinutes: number;
    tardinessStatus: "Habitual" | "Normal";
    trend: Array<{
      date: string;
      lateMinutes: number;
    }>;
  }>;
  summary: {
    habitualOffenders: number;
    totalLateMinutes: number;
    employeesWithTardiness: number;
    recordsCount: number;
    scopedTotalRecords: number;
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

export function TardinessPage() {
  const now = useMemo(() => new Date(), []);
  const defaultMonth = format(now, "yyyy-MM");

  const [staffCategory, setStaffCategory] = useState<StaffCategoryView>("Non-Teaching");
  const [month, setMonth] = useState(defaultMonth);
  const [period, setPeriod] = useState<SummaryPeriod>("whole-month");
  const [department, setDepartment] = useState("all");
  const [employmentStatus, setEmploymentStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("totalLateMinutes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tardinessQuery = useQuery({
    queryKey: ["hr-tardiness-monitoring", staffCategory, month, period, department, employmentStatus, sortKey, sortDir],
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        staffCategory,
        month,
        period,
        department,
        employmentStatus,
        sortKey,
        sortDir,
      });
      const response = await fetch(`/api/hr/tardiness?${query.toString()}`, {
        cache: "no-store",
        signal,
      });
      const payload = await parseJsonSafely<TardinessResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load tardiness monitoring.");
      }
      return payload;
    },
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("desc");
  }

  if (tardinessQuery.isLoading && !tardinessQuery.data) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tardiness monitoring...
      </div>
    );
  }

  if (tardinessQuery.error || !tardinessQuery.data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {tardinessQuery.error instanceof Error ? tardinessQuery.error.message : "Unable to load tardiness monitoring."}
      </div>
    );
  }

  const data = tardinessQuery.data;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tardiness Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            {data.rangeLabel} - UC South Campus - {data.staffCategory} personnel
          </p>
          {tardinessQuery.isFetching ? (
            <p className="mt-1 text-xs text-muted-foreground">Refreshing tardiness records...</p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full max-w-[448px] items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${staffCategory === "Teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setStaffCategory("Teaching"); setDepartment("all"); setEmploymentStatus("all"); setExpandedId(null); }}
          type="button"
        >
          <Users className={`h-4 w-4 ${staffCategory === "Teaching" ? "text-primary" : ""}`} /> Teaching
        </button>
        <button
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors ${staffCategory === "Non-Teaching" ? "border border-primary/15 bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setStaffCategory("Non-Teaching"); setDepartment("all"); setEmploymentStatus("all"); setExpandedId(null); }}
          type="button"
        >
          <UserCircle className={`h-4 w-4 ${staffCategory === "Non-Teaching" ? "text-primary" : ""}`} /> Non-Teaching
        </button>
      </div>

      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-3 xl:grid-cols-5">
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
              <Label className="text-sm font-medium text-foreground">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-[44px] w-full data-[size=default]:h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {data.departments.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Employment Status</Label>
              <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                <SelectTrigger className="h-[44px] w-full data-[size=default]:h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {data.employmentStatuses.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Records</Label>
              <div className="flex h-[44px] w-full items-center justify-center rounded-xl border border-primary/40 px-4 text-sm font-semibold text-primary">
                {data.summary.recordsCount} of {data.summary.scopedTotalRecords} employees
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SummaryMetric label="Habitual Offenders" value={displayCount(data.summary.habitualOffenders)} color="text-red-600" icon="alert" />
        <SummaryMetric label="Total Late Minutes" value={displayCount(data.summary.totalLateMinutes)} color="text-amber-600" icon="trend" />
        <SummaryMetric label="Employees with Tardiness" value={displayCount(data.summary.employeesWithTardiness)} color="text-primary" icon="trend" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{data.staffCategory} Tardiness Records</CardTitle>
          <CardDescription>
            {data.periodLabel} validated tardiness records between {data.dateFrom} and {data.dateTo}. Habitual threshold uses the Admin Setting value of {data.threshold} late incidents.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Employee</TableHead>
                  <SortableMetricHead label="Times Late" active={sortKey === "timesLate"} direction={sortDir} onClick={() => handleSort("timesLate")} />
                  <SortableMetricHead label="Total Min" active={sortKey === "totalLateMinutes"} direction={sortDir} onClick={() => handleSort("totalLateMinutes")} />
                  <SortableMetricHead label="Avg Min" active={sortKey === "avgLateMinutes"} direction={sortDir} onClick={() => handleSort("avgLateMinutes")} />
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <CollapsibleRow
                    key={row.employeeId}
                    row={row}
                    expanded={expandedId === row.employeeId}
                    onToggle={() => setExpandedId(expandedId === row.employeeId ? null : row.employeeId)}
                  />
                ))}
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No tardiness records for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CollapsibleRow({
  row,
  expanded,
  onToggle,
}: {
  row: TardinessResponse["rows"][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <HexagonAvatar
              name={`${row.firstName} ${row.lastName}`}
              color={row.avatarColor || "#1e3a8a"}
              size={28}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.lastName}, {row.firstName}</p>
              <p className="truncate text-xs text-muted-foreground">{row.department} - {row.employmentStatus}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right text-sm font-semibold">{row.timesLate}</TableCell>
        <TableCell className="text-right text-sm font-bold text-amber-600">{row.totalLateMinutes}</TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">{row.avgLateMinutes}</TableCell>
        <TableCell className="text-center">
          {row.tardinessStatus === "Habitual" ? (
            <HexagonBadge color="#dc2626">Habitual</HexagonBadge>
          ) : (
            <Badge variant="secondary">Normal</Badge>
          )}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={6} className="py-3">
            <div className="ml-12">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Late Minutes Trend - {row.trend.length} incidents
              </p>
              {row.trend.length > 0 ? (
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={row.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.05 264 / 0.2)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: "1px solid oklch(0.5 0.05 264 / 0.2)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lateMinutes"
                        stroke="#1d4ed8"
                        strokeWidth={2}
                        dot={{ fill: "#1d4ed8", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No trend data.</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function SortableMetricHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
}) {
  return (
    <TableHead className="text-right">
      <button type="button" onClick={onClick} className="inline-flex w-full items-center justify-end gap-1 text-right">
        <span>{label}</span>
        {active ? (
          direction === "desc" ? <ArrowDown className="h-3.5 w-3.5 text-primary" /> : <ArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </TableHead>
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
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: "alert" | "trend";
}) {
  return (
    <Card className={icon === "alert" ? "border-gold/40" : undefined}>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${icon === "alert" ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"}`}>
            {icon === "alert" ? <AlertTriangle className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
