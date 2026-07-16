"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import { HexStatCard, HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import {
  employmentStatusColor,
  leaveStatusColor,
  formatDate,
  formatDateShort,
} from "@/components/shared/helpers";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DashboardPage() {
  const {
    employees,
    attendance,
    leaveRequests,
    jobPostings,
    applicants,
    holidays,
    approveOvertime,
    setView,
    setSelectedEmployeeId,
    setSelectedApplicantId,
    setSelectedInterviewApplicantId,
  } = useWorkHive();
  const { toast } = useToast();

  const today = "2025-04-15";

  const todaySnapshot = useMemo(() => {
    const todayRecords = attendance.filter((a) => a.date === today);
    const presentIds = new Set(
      todayRecords.filter((a) => getAttendanceCategoryFromRemarks(a) === "Present").map((a) => a.employeeId)
    );
    const absentIds = new Set(
      todayRecords.filter((a) => getAttendanceCategoryFromRemarks(a) === "Absent").map((a) => a.employeeId)
    );
    const leaveToday = leaveRequests.filter(
      (r) =>
        r.overallStatus !== "Disapproved" &&
        r.dateFrom <= today &&
        r.dateTo >= today
    );
    const leaveIds = new Set(leaveToday.map((r) => r.employeeId));
    const lateCount = todayRecords.filter((a) => a.lateMin > 0).length;
    return {
      present: presentIds.size,
      absent: absentIds.size,
      onLeave: leaveIds.size,
      late: lateCount,
      total: employees.length,
    };
  }, [attendance, employees, leaveRequests, today]);

  const tardinessRanking = useMemo(() => {
    const startOfMonth = "2025-04-01";
    const endOfMonth = "2025-04-30";
    const range = attendance.filter(
      (a) => a.date >= startOfMonth && a.date <= endOfMonth
    );
    const byEmp = new Map<string, { total: number; count: number }>();
    range.forEach((r) => {
      if (r.lateMin > 0) {
        const cur = byEmp.get(r.employeeId) ?? { total: 0, count: 0 };
        cur.total += r.lateMin;
        cur.count += 1;
        byEmp.set(r.employeeId, cur);
      }
    });
    return [...byEmp.entries()]
      .map(([empId, v]) => ({
        employee: employees.find((e) => e.id === empId),
        ...v,
      }))
      .filter((x) => x.employee)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [attendance, employees]);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((r) => r.overallStatus === "Pending"),
    [leaveRequests]
  );

  const pendingOT = useMemo(
    () => attendance.filter((a) => a.overtimeStatus === "Pending"),
    [attendance]
  );

  const activeJobs = useMemo(
    () => jobPostings.filter((j) => j.status === "Active"),
    [jobPostings]
  );

  const newApplicants = useMemo(
    () =>
      [...applicants]
        .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate))
        .slice(0, 5),
    [applicants]
  );

  const upcomingInterviews = useMemo(() => {
    return applicants
      .filter((a) => a.schedule && a.schedule.date >= today)
      .sort((a, b) => (a.schedule!.date).localeCompare(b.schedule!.date))
      .slice(0, 5);
  }, [applicants, today]);

  const nextHoliday = useMemo(() => {
    return holidays
      .filter((h) => h.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [holidays, today]);

  function handleApproveOT(attId: string, approve: boolean) {
    approveOvertime(attId, approve);
    toast({
      title: approve ? "Overtime Approved" : "Overtime Rejected",
      description: `Record ${attId} ${approve ? "approved" : "rejected"}.`,
    });
  }

  function empName(id: string) {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.lastName}, ${e.firstName}` : id;
  }

  function openEmployee(id: string) {
    setSelectedEmployeeId(id);
    setView("hr:employee-details");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">HR Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          University of Cebu â€“ South Campus Â· WorkHive HRMS Â· {formatDate(today)}
        </p>
      </div>

      {/* Today snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HexStatCard
          label="Present Today"
          value={todaySnapshot.present}
          sublabel={`of ${todaySnapshot.total} employees`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <HexStatCard
          label="On Leave Today"
          value={todaySnapshot.onLeave}
          sublabel="approved / pending leaves"
          icon={<Plane className="h-5 w-5" />}
        />
        <HexStatCard
          label="Late Today"
          value={todaySnapshot.late}
          sublabel="clocked in past grace period"
          icon={<Clock className="h-5 w-5" />}
          accent
        />
        <HexStatCard
          label="Absent Today"
          value={todaySnapshot.absent}
          sublabel="no time-in recorded"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      {/* Two-column: Tardiness + Pending Leaves */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              Tardiness Highlights â€” April 2025
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
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No tardiness records for this period.
                    </TableCell>
                  </TableRow>
                )}
                {tardinessRanking.map((r) => (
                  <TableRow
                    key={r.employee!.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEmployee(r.employee!.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HexagonAvatar
                          name={`${r.employee!.firstName} ${r.employee!.lastName}`}
                          color={r.employee!.avatarColor || "#1e3a8a"}
                          size={28}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.employee!.lastName}, {r.employee!.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.employee!.department}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{r.total}</TableCell>
                    <TableCell className="text-center">
                      {r.count >= 5 ? (
                        <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/15">Habitual</Badge>
                      ) : (
                        <Badge variant="secondary">Normal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <div className="max-h-72 overflow-y-auto scroll-thin space-y-2">
              {pendingLeaves.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  No pending leave requests.
                </p>
              )}
              {pendingLeaves.map((lv) => {
                const e = employees.find((x) => x.id === lv.employeeId);
                return (
                  <div
                    key={lv.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HexagonAvatar
                        name={e ? `${e.firstName} ${e.lastName}` : "?"}
                        color={e?.avatarColor || "#1e3a8a"}
                        size={26}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e ? `${e.lastName}, ${e.firstName}` : lv.employeeId}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lv.leaveType} Â· {formatDateShort(lv.dateFrom)} â€“ {formatDateShort(lv.dateTo)} Â· {lv.days}d
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HexagonBadge color={leaveStatusColor(lv.overallStatus)}>
                        {lv.stages[lv.currentStageIndex]?.stage}
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
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending OT + Active jobs + new applicants */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-primary">
              Pending Overtime Approvals
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {pendingOT.length}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-64 overflow-y-auto scroll-thin space-y-2">
              {pendingOT.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  No pending overtime requests.
                </p>
              )}
              {pendingOT.slice(0, 8).map((ot) => (
                <div
                  key={ot.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {empName(ot.employeeId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(ot.date)} Â· {ot.overtimeHrs}h OT
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="h-7 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApproveOT(ot.id, true)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleApproveOT(ot.id, false)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
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
              {activeJobs.slice(0, 4).map((j) => (
                <div
                  key={j.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <p className="text-sm font-medium truncate">{j.title}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                    <span>{j.department}</span>
                    <span className="font-medium text-primary">
                      {applicants.filter((a) => a.jobId === j.id).length} applicants
                    </span>
                  </div>
                </div>
              ))}
              {activeJobs.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  No active postings.
                </p>
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
              {newApplicants.map((a) => {
                const job = jobPostings.find((j) => j.id === a.jobId);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <HexagonAvatar name={a.name} size={26} color="#0e7490" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job?.title ?? "â€”"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {a.stage}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming interviews + holiday reminder */}
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
              {upcomingInterviews.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  No scheduled interviews.
                </p>
              )}
              {upcomingInterviews.map((a) => {
                const job = jobPostings.find((j) => j.id === a.jobId);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-12 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <span className="text-[10px] uppercase">
                          {new Date(a.schedule!.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-sm font-bold leading-none">
                          {new Date(a.schedule!.date + "T00:00:00").getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.schedule!.time} Â· {a.schedule!.interviewer} Â· {a.schedule!.platform}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job?.title}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedInterviewApplicantId(a.id);
                        setView("hr:video-conferencing");
                      }}
                    >
                      Join
                    </Button>
                  </div>
                );
              })}
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
            {nextHoliday ? (
              <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {nextHoliday.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(nextHoliday.date)} Â· {nextHoliday.type}
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
                  <span className="text-xs text-muted-foreground">
                    Automated email reminder scheduled 3 days prior.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                No upcoming holidays.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-muted-foreground">Total Employees</p>
                <p className="text-base font-bold text-primary">{employees.length}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-muted-foreground">Regular Status</p>
                <p className="text-base font-bold text-primary">
                  {employees.filter((e) => e.employmentStatus === "Regular").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
