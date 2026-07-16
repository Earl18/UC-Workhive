"use client";

import { useMemo } from "react";
import { useWorkHive } from "@/lib/store";
import { getAttendanceCategoryFromRemarks } from "@/lib/attendance-remarks";
import { HexagonBadge } from "@/components/shared/hexagon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileText,
  Users,
  CalendarClock,
  TrendingUp,
  Briefcase,
  Trophy,
  Plane,
} from "lucide-react";
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

const CHART_COLORS = ["#1d4ed8", "#f59e0b", "#16a34a", "#dc2626", "#7c3aed", "#0e7490", "#ea580c", "#5b21b6"];

export function ReportsPage() {
  const { employees, attendance, leaveRequests, applicants, jobPostings, holidays, setView } = useWorkHive();
  const { toast } = useToast();

  // Attendance trend (last 15 days of April)
  const attendanceTrend = useMemo(() => {
    const days: { date: string; present: number; absent: number; late: number }[] = [];
    for (let d = 1; d <= 15; d++) {
      const dateStr = `2025-04-${String(d).padStart(2, "0")}`;
      const recs = attendance.filter((a) => a.date === dateStr);
      days.push({
        date: dateStr.slice(5),
        present: recs.filter((r) => getAttendanceCategoryFromRemarks(r) === "Present").length,
        absent: recs.filter((r) => getAttendanceCategoryFromRemarks(r) === "Absent").length,
        late: recs.filter((r) => r.lateMin > 0).length,
      });
    }
    return days;
  }, [attendance]);

  // Leave distribution pie
  const leaveDist = useMemo(() => {
    const map = new Map<string, number>();
    leaveRequests.forEach((r) => {
      map.set(r.leaveType, (map.get(r.leaveType) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [leaveRequests]);

  // Department headcount bar
  const deptHeadcount = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => {
      const k = e.department.replace("College of ", "C. ").replace("Department", "Dept");
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [employees]);

  // Applicant stage funnel
  const applicantFunnel = useMemo(() => {
    const stages = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"];
    return stages.map((s) => ({
      stage: s,
      count: applicants.filter((a) => a.stage === s).length,
    }));
  }, [applicants]);

  function exportReport(name: string) {
    toast({
      title: "Report Exported",
      description: `${name} exported to Excel (.xlsx).`,
    });
  }

  const reportCards = [
    {
      title: "Attendance Summary",
      description: "Per-employee attendance totals (absent, late, undertime, OT) for the selected period.",
      icon: <CalendarClock className="h-5 w-5" />,
      view: "hr:attendance-summary" as const,
    },
    {
      title: "Leave Summary",
      description: "Remaining leave credits per employee across all leave types.",
      icon: <Plane className="h-5 w-5" />,
      view: "hr:leave-summary" as const,
    },
    {
      title: "Tardiness Report",
      description: "Cumulative lateness ranking and habitual offender flagging.",
      icon: <TrendingUp className="h-5 w-5" />,
      view: "hr:tardiness" as const,
    },
    {
      title: "Employee Master List",
      description: "Full employee directory with employment status and length of service.",
      icon: <Users className="h-5 w-5" />,
      view: "hr:master-list" as const,
    },
    {
      title: "Recruitment Funnel",
      description: "Applicant pipeline counts by stage per job posting.",
      icon: <Briefcase className="h-5 w-5" />,
      view: "hr:applications" as const,
    },
    {
      title: "Interview Ranking",
      description: "Applicant ranking by total interview score with recommendations.",
      icon: <Trophy className="h-5 w-5" />,
      view: "hr:interviews" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Reports Hub</h1>
        <p className="text-sm text-muted-foreground">
          Generate & export reports · UC South Campus HR
        </p>
      </div>

      {/* Report cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((r, idx) => (
          <Card key={r.title} className={idx === 0 ? "border-gold/40" : ""}>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${idx === 0 ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"}`}>
                  {r.icon}
                </div>
                <CardTitle className="text-sm">{r.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs mb-3 min-h-[2.5rem]">
                {r.description}
              </CardDescription>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setView(r.view)}>
                  <FileText className="mr-1 h-3 w-3" /> View
                </Button>
                <Button size="sm" className="bg-primary" onClick={() => exportReport(r.title)}>
                  <Download className="mr-1 h-3 w-3" /> Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Attendance Trend — April 1–15</CardTitle>
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
                    {leaveDist.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
                    {applicantFunnel.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats footer */}
      <Card>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Employees</p>
              <p className="text-xl font-bold text-primary">{employees.length}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Active Postings</p>
              <p className="text-xl font-bold text-primary">{jobPostings.filter((j) => j.status === "Active").length}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Pending Leaves</p>
              <p className="text-xl font-bold text-amber-600">
                {leaveRequests.filter((r) => r.overallStatus === "Pending").length}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">2025 Holidays</p>
              <p className="text-xl font-bold text-primary">
                {holidays.filter((h) => h.date.startsWith("2025")).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
