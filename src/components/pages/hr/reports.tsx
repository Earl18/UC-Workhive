"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHrMasterList } from "@/hooks/use-hr-master-list";
import { useStaffJobPostings } from "@/hooks/use-job-postings";
import { useStaffHolidayRecords } from "@/hooks/use-holidays";
import { useHrApplications } from "@/hooks/use-applications";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import type { AttendanceRecord, LeaveRequest } from "@/lib/types";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type AttendanceReportResponse = {
  records: Array<AttendanceRecord>;
};

type LeaveDashboardResponse = {
  requests?: LeaveRequest[];
  error?: string;
};

const CHART_COLORS = ["#1d4ed8", "#f59e0b", "#16a34a", "#dc2626", "#7c3aed", "#0e7490", "#ea580c", "#5b21b6"];
const CURRENT_DATE = new Date("2026-07-18T00:00:00+08:00");
const CURRENT_MONTH_KEY = `${CURRENT_DATE.getFullYear()}-${String(CURRENT_DATE.getMonth() + 1).padStart(2, "0")}`;
const CURRENT_YEAR = String(CURRENT_DATE.getFullYear());

async function fetchAttendanceReport(month: string) {
  const params = new URLSearchParams({ month, pageSize: "5000" });
  const response = await fetch(`/api/hr/attendance?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json()) as AttendanceReportResponse & { error?: string };

  if (!response.ok || !payload.records) {
    throw new Error(payload.error ?? "Unable to load attendance report.");
  }

  return payload;
}

async function fetchLeaveDashboard() {
  const response = await fetch("/api/hr/leave", { cache: "no-store" });
  const payload = (await response.json()) as LeaveDashboardResponse;

  if (!response.ok || !payload.requests) {
    throw new Error(payload.error ?? "Unable to load leave requests.");
  }

  return payload;
}

export function ReportsPage() {
  const employeesQuery = useHrMasterList({ page: 1, pageSize: 5000, sortKey: "lastName", sortDir: "asc" });
  const jobPostingsQuery = useStaffJobPostings();
  const holidaysQuery = useStaffHolidayRecords();
  const applicantsQuery = useHrApplications();
  const attendanceQuery = useQuery({
    queryKey: ["hr-reports-attendance", CURRENT_MONTH_KEY],
    queryFn: () => fetchAttendanceReport(CURRENT_MONTH_KEY),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const leaveQuery = useQuery({
    queryKey: ["hr-reports-leave"],
    queryFn: fetchLeaveDashboard,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const employees = employeesQuery.data?.employees ?? [];
  const employeesCount = employeesQuery.data?.pagination.totalRecords ?? employees.length;
  const jobPostings = jobPostingsQuery.data?.jobPostings ?? [];
  const holidays = holidaysQuery.data?.holidays ?? [];
  const applicants = applicantsQuery.data ?? [];
  const attendanceRecords = attendanceQuery.data?.records ?? [];
  const leaveRequests = leaveQuery.data?.requests ?? [];

  const attendanceTrend = useMemo(() => {
    const grouped = new Map<string, { date: string; present: number; absent: number; late: number }>();

    attendanceRecords.forEach((record) => {
      const entry = grouped.get(record.date) ?? { date: record.date.slice(5), present: 0, absent: 0, late: 0 };
      const category = getAttendanceCategoryFromRemarks(record);

      if (category === "Present") {
        entry.present += 1;
      }
      if (category === "Absent") {
        entry.absent += 1;
      }
      if ((record.lateMin ?? 0) > 0) {
        entry.late += 1;
      }

      grouped.set(record.date, entry);
    });

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-15)
      .map(([, value]) => value);
  }, [attendanceRecords]);

  const leaveDist = useMemo(() => {
    const map = new Map<string, number>();
    leaveRequests.forEach((request) => {
      map.set(request.leaveType, (map.get(request.leaveType) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [leaveRequests]);

  const deptHeadcount = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((employee) => {
      const normalizedDepartment = employee.department.replace("College of ", "C. ").replace("Department", "Dept");
      map.set(normalizedDepartment, (map.get(normalizedDepartment) ?? 0) + 1);
    });

    return [...map.entries()]
      .map(([dept, count]) => ({ dept, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);
  }, [employees]);

  const applicantFunnel = useMemo(() => {
    const stages = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"];
    return stages.map((stage) => ({
      stage,
      count: applicants.filter((applicant) => applicant.stage === stage).length,
    }));
  }, [applicants]);

  const activePostingsCount = useMemo(
    () => jobPostings.filter((jobPosting) => jobPosting.status === "Active" || jobPosting.active).length,
    [jobPostings],
  );

  const pendingLeavesCount = useMemo(
    () => leaveRequests.filter((request) => request.overallStatus === "Pending").length,
    [leaveRequests],
  );

  const currentYearHolidayCount = useMemo(
    () => holidays.filter((holiday) => holiday.date.startsWith(CURRENT_YEAR)).length,
    [holidays],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Reports Hub</h1>
        <p className="text-sm text-muted-foreground">Live HR report insights from the database.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Employees</p>
              <p className="text-xl font-bold text-primary">{employeesCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Active Postings</p>
              <p className="text-xl font-bold text-primary">{activePostingsCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Pending Leaves</p>
              <p className="text-xl font-bold text-amber-600">{pendingLeavesCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{CURRENT_YEAR} Holidays</p>
              <p className="text-xl font-bold text-primary">{currentYearHolidayCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Attendance Trend ({CURRENT_MONTH_KEY})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.05 264 / 0.15)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="present" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="absent" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="late" stroke="#ca8a04" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Leave Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={(entry) => `${entry.value}`}
                    labelLine={false}
                  >
                    {leaveDist.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Department Headcount (Top 8)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptHeadcount} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.05 264 / 0.15)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                  <YAxis type="category" dataKey="dept" tick={{ fontSize: 9 }} stroke="oklch(0.5 0.05 264 / 0.5)" width={110} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Applicant Stage Funnel</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={applicantFunnel} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.05 264 / 0.15)" />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.5 0.05 264 / 0.5)" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {applicantFunnel.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
