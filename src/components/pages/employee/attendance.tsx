"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AttendanceRecord, Employee } from "@/lib/types";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { HexagonAvatar } from "@/components/shared/hexagon";
import { formatDateShort, formatTime12Hour } from "@/components/shared/helpers";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type AttendanceHistoryResponse = {
  employee?: Pick<Employee, "id" | "idNumber" | "firstName" | "lastName" | "position" | "avatarColor">;
  records?: Array<AttendanceRecord & {
    approvedOvertimeHrs: number;
    requiresValidation: boolean;
  }>;
  error?: string;
};

async function readAttendanceHistory(response: Response) {
  const payload = (await response.json()) as AttendanceHistoryResponse;
  if (!response.ok || !payload.employee) {
    throw new Error(payload.error ?? "Unable to load attendance history.");
  }
  return {
    employee: payload.employee,
    records: payload.records ?? [],
  };
}

function getAttendanceFilterRemark(record: AttendanceRecord) {
  if (getAttendanceCategoryFromRemarks(record) === "Holiday") {
    return "Holiday";
  }

  if (getAttendanceCategoryFromRemarks(record) === "Weekend") {
    return "Weekend";
  }

  if (getAttendanceCategoryFromRemarks(record) === "Absent") {
    return "Absent";
  }

  if (record.overtimeHrs > 0 && record.overtimeStatus === "Pending") {
    return "OT Pending";
  }

  if ((record.approvedOvertimeHrs && record.approvedOvertimeHrs > 0) || (record.overtimeHrs > 0 && record.overtimeStatus === "Approved")) {
    return "OT Approved";
  }

  if (record.lateMin > 0) {
    return "Late";
  }

  return "Present";
}

export function AttendancePage() {
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const [remarksFilter, setRemarksFilter] = useState("all");

  const attendanceQuery = useQuery({
    queryKey: ["employee-attendance-history"],
    queryFn: async () => {
      const response = await fetch("/api/employee/attendance", { cache: "no-store" });
      return readAttendanceHistory(response);
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const employee = attendanceQuery.data?.employee ?? null;
  const records = attendanceQuery.data?.records ?? [];

  const remarksOptions = useMemo(() => {
    return Array.from(new Set(records.map((record) => getAttendanceFilterRemark(record))));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const attendanceRemark = getAttendanceFilterRemark(record);

      if (dateFilter && record.date !== dateFilter) {
        return false;
      }

      if (dayFilter !== "all" && record.day !== dayFilter) {
        return false;
      }

      if (remarksFilter !== "all" && attendanceRemark !== remarksFilter) {
        return false;
      }

      return true;
    });
  }, [records, dateFilter, dayFilter, remarksFilter]);

  if (attendanceQuery.isLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your attendance history...
      </div>
    );
  }

  if (attendanceQuery.error) {
    return (
      <div className="p-6 text-muted-foreground">
        {attendanceQuery.error instanceof Error ? attendanceQuery.error.message : "No employee record found."}
      </div>
    );
  }

  if (!employee) {
    return <div className="p-6 text-muted-foreground">No employee record found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HexagonAvatar
          name={`${employee.firstName} ${employee.lastName}`}
          color={employee.avatarColor ?? "#1e3a8a"}
          size={40}
        />
        <div>
          <h2 className="text-lg font-bold">{employee.firstName} {employee.lastName}</h2>
          <p className="text-xs text-muted-foreground">
            {employee.position} - {employee.idNumber?.trim() || "No ID Number"}
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" /> Attendance History
              </CardTitle>
              <CardDescription>
                View all attendance records saved under your employee account.
              </CardDescription>
            </div>
            <div className="hidden flex-wrap items-center gap-3 text-[10px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/40" />
                Holiday
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm bg-blue-100 dark:bg-blue-950/40" />
                Weekend
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm bg-red-100 dark:bg-red-950/40" />
                Late
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <AttendanceHistoryDateField label="Date" value={dateFilter} onChange={setDateFilter} />
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Day</Label>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger
                  size="lg"
                  className="w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Remarks</Label>
              <Select value={remarksFilter} onValueChange={setRemarksFilter}>
                <SelectTrigger
                  size="lg"
                  className="w-full justify-between rounded-md border-input bg-background px-3 text-left font-normal shadow-xs hover:bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Remarks</SelectItem>
                  {remarksOptions.map((remark) => (
                    <SelectItem key={remark} value={remark}>{remark}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">No attendance history found for the selected filters.</p>
            </div>
          ) : (
            <div className="max-h-[38rem] overflow-y-auto scroll-thin rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>AM In</TableHead>
                    <TableHead>AM Out</TableHead>
                    <TableHead>PM In</TableHead>
                    <TableHead>PM Out</TableHead>
                    <TableHead className="text-center">Late (min)</TableHead>
                    <TableHead className="text-center">Undertime</TableHead>
                    <TableHead className="text-center">OT (hrs)</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const attendanceCategory = getAttendanceCategoryFromRemarks(record);
                    const isHoliday = attendanceCategory === "Holiday";
                    const isWeekend = attendanceCategory === "Weekend";
                    const isLate = record.lateMin > 0;

                    return (
                      <TableRow
                        key={record.id}
                        className={cn(
                          isHoliday && "bg-amber-50 dark:bg-amber-950/20",
                          isWeekend && !isHoliday && "bg-blue-50 dark:bg-blue-950/20",
                          isLate && !isHoliday && !isWeekend && "bg-red-50 dark:bg-red-950/20",
                        )}
                      >
                        <TableCell className="font-medium">{formatDateShort(record.date)}</TableCell>
                        <TableCell className="text-muted-foreground">{record.day}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{formatTime12Hour(record.morningIn)}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{formatTime12Hour(record.morningOut)}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{formatTime12Hour(record.afternoonIn)}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{formatTime12Hour(record.afternoonOut)}</TableCell>
                        <TableCell className="text-center">
                          {record.lateMin > 0 ? (
                            <span className="font-medium text-red-600 dark:text-red-400">{record.lateMin}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.undertimeMin > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">{record.undertimeMin}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.approvedOvertimeHrs && record.approvedOvertimeHrs > 0 ? (
                            <span className="text-primary">{record.approvedOvertimeHrs.toFixed(1)}</span>
                          ) : record.overtimeHrs > 0 ? (
                            <span className="text-primary">{record.overtimeHrs.toFixed(1)}</span>
                          ) : (
                            <span className="text-muted-foreground">0.0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <RemarksBadge record={record} isHoliday={isHoliday} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceHistoryDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  const isValidDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime());

  return (
    <div className="min-w-0 space-y-1.5">
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
            <span>{isValidDate && parsedDate ? format(parsedDate, "MMMM d, yyyy") : `Select ${label.toLowerCase()}`}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="mt-2 w-auto overflow-hidden rounded-xl border border-primary/10 p-0 shadow-lg" align="start" side="bottom" sideOffset={6} avoidCollisions={false}>
          <Calendar
            mode="single"
            selected={isValidDate ? parsedDate : undefined}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                return;
              }
              onChange(format(selectedDate, "yyyy-MM-dd"));
            }}
            className="flex justify-center px-4 pb-4 pt-4"
            classNames={{
              root: "mx-auto w-fit",
              months: "w-fit",
              month: "w-fit gap-3",
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

function RemarksBadge({
  record,
  isHoliday,
}: {
  record: AttendanceRecord;
  isHoliday: boolean;
}) {
  if (isHoliday) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        Holiday
      </Badge>
    );
  }

  if (getAttendanceCategoryFromRemarks(record) === "Weekend") {
    return (
      <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
        Weekend
      </Badge>
    );
  }

  if (getAttendanceCategoryFromRemarks(record) === "Absent") {
    return (
      <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
        Absent
      </Badge>
    );
  }

  if (record.overtimeHrs > 0 && record.overtimeStatus === "Pending") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        OT Pending
      </Badge>
    );
  }

  if ((record.approvedOvertimeHrs && record.approvedOvertimeHrs > 0) || (record.overtimeHrs > 0 && record.overtimeStatus === "Approved")) {
    return (
      <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
        OT Approved
      </Badge>
    );
  }

  if (record.lateMin > 0) {
    return (
      <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
        Late
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" /> Present
    </Badge>
  );
}

