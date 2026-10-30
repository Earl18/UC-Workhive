"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkHive } from "@/lib/store";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import { HexStatCard, HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { formatDate, formatDateShort, leaveStatusColor } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  XCircle,
  CalendarDays,
  Users,
  Briefcase,
  Clock,
  Plane,
  Bell,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHrApplications } from "@/hooks/use-applications";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { useStaffHolidayRecords } from "@/hooks/use-holidays";
import type { Applicant, AttendanceRecord, Employee, LeaveRequest } from "@/lib/types";

type AttendanceDashboardResponse = {
  records: Array<
    AttendanceRecord & {
      employeeName: string;
      department: string;
      position: string;
      approvedOvertimeHrs: number;
      requiresValidation: boolean;
    }
  >;
  error?: string;
};

type StaffLeaveDashboardResponse = {
  employees?: Array<Employee & { birthDate?: string }>;
  requests?: LeaveRequest[];
  error?: string;
};

const TODAY = "2026-07-18";
const CURRENT_MONTH = TODAY.slice(0, 7);
const CURRENT_MONTH_LABEL = new Date(`${CURRENT_MONTH}-01T00:00:00`).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }
  return payload;
}

function applicantDisplayName(applicant: Applicant) {
  return applicant.fullName ?? applicant.name ?? "Applicant";
}

export function DashboardPage() {
  const { setView, setSelectedEmployeeId, setSelectedInterviewApplicantId } = useWorkHive();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todayAttendanceQuery = useQuery({
    queryKey: ["hr-dashboard-attendance", "today", TODAY],
    queryFn: async () => {
      const response = await fetch(`/api/hr/attendance?date=${TODAY}&pageSize=5000`, { cache: "no-store" });
      return readJson<AttendanceDashboardResponse>(response, "Unable to load today's attendance records.");
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const monthlyAttendanceQuery = useQuery({
    queryKey: ["hr-dashboard-attendance", "month", CURRENT_MONTH],
    queryFn: async () => {
      const response = await fetch(`/api/hr/attendance?month=${CURRENT_MONTH}&pageSize=5000`, { cache: "no-store" });
      return readJson<AttendanceDashboardResponse>(response, "Unable to load monthly attendance records.");
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const leaveDashboardQuery = useQuery({
    queryKey: ["hr-dashboard-leave"],
    queryFn: async () => {
      const response = await fetch("/api/hr/leave", { cache: "no-store" });
      const payload = await readJson<StaffLeaveDashboardResponse>(response, "Unable to load leave requests.");
      return {
        employees: payload.employees ?? [],
        requests: payload.requests ?? [],
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const jobPostingsQuery = useStaffJobPostings();
  const applicationsQuery = useHrApplications();
  const holidaysQuery = useStaffHolidayRecords();

  const overtimeMutation = useMutation({
    mutationFn: async ({ attendanceId, approve }: { attendanceId: string; approve: boolean }) => {
      const response = await fetch("/api/hr/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "overtime", id: attendanceId, approve }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update overtime decision.");
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["hr-dashboard-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast({
        title: variables.approve ? "Overtime Approved" : "Overtime Rejected",
        description: `Attendance record ${variables.attendanceId} was updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update overtime",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const employees = leaveDashboardQuery.data?.employees ?? [];
  const leaveRequests = leaveDashboardQuery.data?.requests ?? [];
  const todayAttendance = todayAttendanceQuery.data?.records ?? [];
  const monthlyAttendance = monthlyAttendanceQuery.data?.records ?? [];
  const jobPostings = jobPostingsQuery.data?.jobPostings ?? [];
  const applicants = applicationsQuery.data ?? [];
  const holidays = holidaysQuery.data?.holidays ?? [];

  const loading =
    todayAttendanceQuery.isLoading ||
    monthlyAttendanceQuery.isLoading ||
    leaveDashboardQuery.isLoading ||
    jobPostingsQuery.isLoading ||
    applicationsQuery.isLoading ||
    holidaysQuery.isLoading;

  const todaySnapshot = useMemo(() => {
    const presentIds = new Set(
      todayAttendance
        .filter((record) => getAttendanceCategoryFromRemarks(record) === "Present")
        .map((record) => record.employeeId),
    );
    const absentIds = new Set(
      todayAttendance
        .filter((record) => getAttendanceCategoryFromRemarks(record) === "Absent")
        .map((record) => record.employeeId),
    );
    const leaveToday = leaveRequests.filter(
      (request) => request.overallStatus !== "Disapproved" && request.overallStatus !== "Cancelled" && request.dateFrom <= TODAY && request.dateTo >= TODAY,
    );
    const leaveIds = new Set(leaveToday.map((request) => request.employeeId));
    const lateCount = todayAttendance.filter((record) => record.lateMin > 0).length;

    return {
      present: presentIds.size,
      absent: absentIds.size,
      onLeave: leaveIds.size,
      late: lateCount,
      total: employees.length,
    };
  }, [todayAttendance, leaveRequests, employees.length]);

  const tardinessRanking = useMemo(() => {
    const byEmployee = new Map<
      string,
      { total: number; count: number; employeeName: string; department: string }
    >();

    monthlyAttendance.forEach((record) => {
      if (record.lateMin <= 0 || !record.employeeId) {
        return;
      }

      const current = byEmployee.get(record.employeeId) ?? {
        total: 0,
        count: 0,
        employeeName: record.employeeName,
        department: record.department,
      };

      current.total += record.lateMin;
      current.count += 1;
      byEmployee.set(record.employeeId, current);
    });

    return [...byEmployee.entries()]
      .map(([employeeId, value]) => {
        const employee = employees.find((entry) => entry.id === employeeId);
        return employee
          ? {
              employee,
              total: value.total,
              count: value.count,
            }
          : null;
      })
      .filter((entry): entry is { employee: Employee; total: number; count: number } => Boolean(entry))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
  }, [monthlyAttendance, employees]);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((request) => request.overallStatus === "Pending"),
    [leaveRequests],
  );

  const pendingOT = useMemo(
    () => monthlyAttendance.filter((record) => record.overtimeStatus === "Pending"),
    [monthlyAttendance],
  );

  const activeJobs = useMemo(
    () => jobPostings.filter((jobPosting) => jobPosting.active === true || jobPosting.status === "Active"),
    [jobPostings],
  );

  const newApplicants = useMemo(
    () =>
      [...applicants]
        .sort((left, right) =>
          (right.appliedDate ?? right.submittedAt ?? "").localeCompare(left.appliedDate ?? left.submittedAt ?? ""),
        )
        .slice(0, 5),
    [applicants],
  );

  const upcomingInterviews = useMemo(
    () =>
      applicants
        .filter((applicant) => applicant.schedule && applicant.schedule.date >= TODAY)
        .sort((left, right) => {
          const leftKey = `${left.schedule?.date ?? ""} ${left.schedule?.time ?? ""}`;
          const rightKey = `${right.schedule?.date ?? ""} ${right.schedule?.time ?? ""}`;
          return leftKey.localeCompare(rightKey);
        })
        .slice(0, 5),
    [applicants],
  );

  const nextHoliday = useMemo(
    () => holidays.filter((holiday) => holiday.date > TODAY).sort((left, right) => left.date.localeCompare(right.date))[0],
    [holidays],
  );

  function openEmployee(id: string) {
    setSelectedEmployeeId(id);
    setView("hr:employee-details");
  }

  function openScheduledInterview(applicantId: string) {
    setSelectedInterviewApplicantId(applicantId);
    setView("hr:interview-scheduling");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">HR Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          University of Cebu - South Campus - WorkHive HRMS - {formatDate(TODAY)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HexStatCard
          label="Present Today"
          value={loading ? "-" : todaySnapshot.present}
          sublabel={`of ${todaySnapshot.total} employees`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <HexStatCard
          label="On Leave Today"
          value={loading ? "-" : todaySnapshot.onLeave}
          sublabel="approved / pending leaves"
          icon={<Plane className="h-5 w-5" />}
        />
        <HexStatCard
          label="Late Today"
          value={loading ? "-" : todaySnapshot.late}
          sublabel="clocked in past grace period"
          icon={<Clock className="h-5 w-5" />}
        />
        <HexStatCard
          label="Absent Today"
          value={loading ? "-" : todaySnapshot.absent}
          sublabel="no time-in recorded"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              Tardiness Highlights - {CURRENT_MONTH_LABEL}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("hr:tardiness")}
              className="text-primary"
            >
              <TrendingUp className="mr-1 h-4 w-4" /> View All
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {monthlyAttendanceQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tardiness highlights...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Times Late</TableHead>
                    <TableHead className="text-right">Total Min</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tardinessRanking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        No tardiness records for this period.
                      </TableCell>
                    </TableRow>
                  )}
                  {tardinessRanking.map((record) => (
                    <TableRow
                      key={record.employee.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEmployee(record.employee.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HexagonAvatar
                            name={`${record.employee.firstName} ${record.employee.lastName}`}
                            color={record.employee.avatarColor || "#1e3a8a"}
                            size={28}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {record.employee.lastName}, {record.employee.firstName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {record.employee.department}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{record.count}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{record.total}</TableCell>
                      <TableCell className="text-center">
                        {record.count >= 5 ? (
                          <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/15">Habitual</Badge>
                        ) : (
                          <Badge variant="secondary">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              Pending Leave Approvals ({pendingLeaves.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("hr:leave-management")}
              className="text-primary"
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-72 space-y-2 overflow-y-auto scroll-thin">
              {leaveDashboardQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leave approvals...
                </div>
              ) : pendingLeaves.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No pending leave requests.</p>
              ) : (
                pendingLeaves.map((leaveRequest) => {
                  const employee = employees.find((entry) => entry.id === leaveRequest.employeeId);
                  return (
                    <div
                      key={leaveRequest.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <HexagonAvatar
                          name={employee ? `${employee.firstName} ${employee.lastName}` : leaveRequest.employeeId}
                          color={employee?.avatarColor || "#1e3a8a"}
                          size={26}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {employee ? `${employee.lastName}, ${employee.firstName}` : leaveRequest.employeeId}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {leaveRequest.leaveType} - {formatDateShort(leaveRequest.dateFrom)} - {formatDateShort(leaveRequest.dateTo)} - {leaveRequest.days}d
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HexagonBadge color={leaveStatusColor(leaveRequest.overallStatus)}>
                          {leaveRequest.stages[leaveRequest.currentStageIndex]?.stage ?? "Pending"}
                        </HexagonBadge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setView("hr:leave-management")}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">Pending Overtime Approvals</CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {pendingOT.length}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-64 space-y-2 overflow-y-auto scroll-thin">
              {monthlyAttendanceQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading overtime approvals...
                </div>
              ) : pendingOT.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No pending overtime requests.</p>
              ) : (
                pendingOT.slice(0, 8).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{record.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(record.date)} - {record.overtimeHrs}h OT
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-7 bg-green-600 text-white hover:bg-green-700"
                        disabled={overtimeMutation.isPending}
                        onClick={() => overtimeMutation.mutate({ attendanceId: record.id, approve: true })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-red-300 text-red-600 hover:bg-red-50"
                        disabled={overtimeMutation.isPending}
                        onClick={() => overtimeMutation.mutate({ attendanceId: record.id, approve: false })}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              <Briefcase className="mr-1 inline h-4 w-4" /> Active Job Postings
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("hr:job-postings")}
              className="text-primary"
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {jobPostingsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading job postings...
                </div>
              ) : activeJobs.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No active postings.</p>
              ) : (
                activeJobs.slice(0, 4).map((jobPosting) => (
                  <div
                    key={jobPosting.id}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium">{jobPosting.title}</p>
                      <span className="shrink-0 text-sm font-medium text-primary">
                        {applicants.filter((applicant) => applicant.jobId === jobPosting.id).length} applicants
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{jobPosting.department}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              <Users className="mr-1 inline h-4 w-4" /> New Applicants
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("hr:applications")}
              className="text-primary"
            >
              Pipeline
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {applicationsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading applicants...
                </div>
              ) : newApplicants.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No applicants yet.</p>
              ) : (
                newApplicants.map((applicant) => {
                  const jobPosting = jobPostings.find((entry) => entry.id === applicant.jobId);
                  return (
                    <div
                      key={applicant.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <HexagonAvatar name={applicantDisplayName(applicant)} size={26} color="#0e7490" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{applicantDisplayName(applicant)}</p>
                          <p className="truncate text-xs text-muted-foreground">{jobPosting?.title ?? "-"}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {applicant.stage}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              <CalendarDays className="mr-1 inline h-4 w-4" /> Upcoming Interviews
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("hr:interview-scheduling")}
              className="text-primary"
            >
              Schedule
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {applicationsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading upcoming interviews...
                </div>
              ) : upcomingInterviews.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No scheduled interviews.</p>
              ) : (
                upcomingInterviews.map((applicant) => {
                  const jobPosting = jobPostings.find((entry) => entry.id === applicant.jobId);
                  return (
                    <div
                      key={applicant.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="flex h-10 w-12 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground">
                          <span className="text-[10px] uppercase">
                            {new Date(`${applicant.schedule!.date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-sm font-bold leading-none">
                            {new Date(`${applicant.schedule!.date}T00:00:00`).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{applicantDisplayName(applicant)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {applicant.schedule!.time} - {applicant.schedule!.panel?.[0] ?? "TBD"} - {applicant.schedule!.mode}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{jobPosting?.title ?? "-"}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openScheduledInterview(applicant.id)}
                      >
                        View Schedule
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gold/40">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              <Bell className="mr-1 inline h-4 w-4 text-gold" /> Holiday Reminder
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {holidaysQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading holidays...
              </div>
            ) : nextHoliday ? (
              <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{nextHoliday.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(nextHoliday.date)} - {nextHoliday.type}
                    </p>
                  </div>
                  <HexagonBadge color="#ca8a04">{nextHoliday.type}</HexagonBadge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setView("hr:holidays")}
                  >
                    View Calendar
                  </Button>
                  <span className="text-xs text-muted-foreground">Automated email reminder scheduled 3 days prior.</span>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-muted-foreground">No upcoming holidays.</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-muted-foreground">Total Employees</p>
                <p className="text-base font-bold text-primary">{employees.length}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-muted-foreground">Regular Status</p>
                <p className="text-base font-bold text-primary">
                  {employees.filter((employee) => employee.employmentStatus === "Regular").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
