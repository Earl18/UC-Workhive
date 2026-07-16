"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { DEPARTMENTS } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import {
  recommendationColor,
  formatDate,
  formatDateShort,
} from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowUpDown, Video, Trophy, UserCheck } from "lucide-react";

type SortKey = "totalScore" | "name" | "department" | "date";

export function InterviewsPage() {
  const { applicants, jobPostings, setSelectedInterviewApplicantId, setView } = useWorkHive();

  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("totalScore");
  const [sortAsc, setSortAsc] = useState(false);

  // Applicants with interviewScore
  const scored = useMemo(() => {
    return applicants
      .filter((a) => a.interviewScore)
      .map((a) => {
        const job = jobPostings.find((j) => j.id === a.jobId);
        return {
          applicant: a,
          score: a.interviewScore!,
          department: job?.department ?? "—",
          position: job?.title ?? "—",
        };
      })
      .filter((r) => deptFilter === "All" || r.department === deptFilter)
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "totalScore") cmp = a.score.totalScore - b.score.totalScore;
        else if (sortKey === "name") cmp = a.applicant.name.localeCompare(b.applicant.name);
        else if (sortKey === "department") cmp = a.department.localeCompare(b.department);
        else cmp = a.score.date.localeCompare(b.score.date);
        return sortAsc ? cmp : -cmp;
      });
  }, [applicants, jobPostings, deptFilter, sortKey, sortAsc]);

  // Applicants with schedule but not yet scored — available to conduct
  const toConduct = useMemo(() => {
    return applicants
      .filter((a) => a.schedule && !a.interviewScore && a.stage === "Interview")
      .map((a) => ({
        applicant: a,
        job: jobPostings.find((j) => j.id === a.jobId),
      }))
      .sort((a, b) => (a.applicant.schedule!.date).localeCompare(b.applicant.schedule!.date));
  }, [applicants, jobPostings]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(false); }
  }

  function conduct(applicantId: string) {
    setSelectedInterviewApplicantId(applicantId);
    setView("hr:video-conferencing");
  }

  const topScored = scored[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary">Interview Evaluation Results & Ranking</h1>
        <p className="text-sm text-muted-foreground">
          Applicant ranking by total interview score · UC South Campus
        </p>
      </div>

      {/* Top highlight + to-conduct */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-gold/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Top Ranked
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topScored ? (
              <div className="flex items-center gap-3">
                <HexagonAvatar name={topScored.applicant.name} size={48} color="#1e3a8a" />
                <div className="flex-1">
                  <p className="font-semibold">{topScored.applicant.name}</p>
                  <p className="text-xs text-muted-foreground">{topScored.position}</p>
                  <p className="text-xs text-muted-foreground">{topScored.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{topScored.score.totalScore}</p>
                  <HexagonBadge color={recommendationColor(topScored.score.recommendation)}>
                    {topScored.score.recommendation}
                  </HexagonBadge>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No scored applicants yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <Video className="h-4 w-4" /> Scheduled — Awaiting Evaluation ({toConduct.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-40 overflow-y-auto scroll-thin space-y-2">
              {toConduct.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No pending interviews.</p>
              )}
              {toConduct.map(({ applicant, job }) => (
                <div key={applicant.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <HexagonAvatar name={applicant.name} size={26} color="#1d4ed8" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{applicant.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDateShort(applicant.schedule!.date)} · {applicant.schedule!.time}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 bg-primary"
                    onClick={() => conduct(applicant.id)}
                  >
                    <UserCheck className="h-3 w-3 mr-1" /> Conduct
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Departments</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="border-primary/40 text-primary h-9 px-3 flex items-center">
                {scored.length} scored applicants
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">Ranking by Total Score</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[34rem] overflow-auto scroll-thin rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <SortableHead label="Applicant" k="name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <SortableHead label="Department" k="department" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <TableHead>Position</TableHead>
                  <SortableHead label="Interview Date" k="date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <SortableHead label="Total Score" k="totalScore" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Interviewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scored.map((r, idx) => (
                  <TableRow key={r.applicant.id} className={idx === 0 ? "bg-gold/5" : ""}>
                    <TableCell>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0 ? "bg-gold text-gold-foreground" :
                        idx === 1 ? "bg-muted text-foreground" :
                        idx === 2 ? "bg-orange-500/15 text-orange-600" :
                        "text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HexagonAvatar name={r.applicant.name} size={26} color="#1e3a8a" />
                        <span className="text-sm font-medium">{r.applicant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.department}</TableCell>
                    <TableCell className="text-xs">{r.position}</TableCell>
                    <TableCell className="text-xs">{formatDate(r.score.date)}</TableCell>
                    <TableCell>
                      <span className="text-base font-bold text-primary">{r.score.totalScore}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </TableCell>
                    <TableCell>
                      <HexagonBadge color={recommendationColor(r.score.recommendation)}>
                        {r.score.recommendation}
                      </HexagonBadge>
                    </TableCell>
                    <TableCell className="text-xs">{r.score.interviewer}</TableCell>
                  </TableRow>
                ))}
                {scored.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No scored interviews yet. Conduct an interview from the panel above.
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

function SortableHead({
  label,
  k,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-primary ${active ? "text-primary" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </TableHead>
  );
}
