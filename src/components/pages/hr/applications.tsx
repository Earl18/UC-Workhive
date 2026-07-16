"use client";

import { useMemo, useState } from "react";
import { useWorkHive } from "@/lib/store";
import { ApplicantStage, Applicant } from "@/lib/types";
import { HexagonAvatar, HexagonBadge } from "@/components/shared/hexagon";
import { applicantStageColor, formatDateShort } from "@/components/shared/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Video,
  MapPin,
  CheckCircle2,
} from "lucide-react";

const COLUMNS: { stage: ApplicantStage; color: string }[] = [
  { stage: "New", color: "#0e7490" },
  { stage: "Screening", color: "#7c3aed" },
  { stage: "Interview", color: "#1d4ed8" },
  { stage: "Offer", color: "#ca8a04" },
  { stage: "Hired", color: "#16a34a" },
  { stage: "Rejected", color: "#dc2626" },
];

const ORDER: ApplicantStage[] = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"];

export function ApplicationsPage() {
  const { jobPostings, applicants, moveApplicantStage } = useWorkHive();
  const { toast } = useToast();

  const [jobFilter, setJobFilter] = useState<string>("all");

  const scoped = useMemo(() => {
    return jobFilter === "all" ? applicants : applicants.filter((a) => a.jobId === jobFilter);
  }, [applicants, jobFilter]);

  function move(a: Applicant, dir: -1 | 1) {
    const curIdx = ORDER.indexOf(a.stage);
    const nextIdx = curIdx + dir;
    if (nextIdx < 0 || nextIdx >= ORDER.length) return;
    const next = ORDER[nextIdx];
    moveApplicantStage(a.id, next);
    toast({ title: "Stage Updated", description: `${a.name} → ${next}` });
  }

  function jumpTo(a: Applicant, stage: ApplicantStage) {
    moveApplicantStage(a.id, stage);
    toast({ title: "Stage Updated", description: `${a.name} → ${stage}` });
  }

  function jobTitle(jobId: string) {
    return jobPostings.find((j) => j.id === jobId)?.title ?? "Unknown";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Applications Pipeline</h1>
          <p className="text-sm text-muted-foreground">Recruitment Kanban · UC South Campus</p>
        </div>
        <div className="w-full sm:w-72">
          <Label className="text-xs text-muted-foreground">Filter by Job Posting</Label>
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Postings ({applicants.length} applicants)</SelectItem>
              {jobPostings.map((j) => {
                const cnt = applicants.filter((a) => a.jobId === j.id).length;
                return <SelectItem key={j.id} value={j.id}>{j.title} ({cnt})</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map((col) => {
            const cards = scoped.filter((a) => a.stage === col.stage);
            return (
              <div key={col.stage} className="w-72 shrink-0">
                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="hexagon inline-block" style={{ width: 10, height: 11.5, backgroundColor: col.color }} />
                      <h3 className="text-sm font-semibold text-foreground">{col.stage}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                  </div>
                  <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto scroll-thin">
                    {cards.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">No applicants</p>
                    )}
                    {cards.map((a) => {
                      const total = a.requirements.length;
                      const submitted = a.requirements.filter((r) => r.submitted).length;
                      const allDone = submitted === total;
                      return (
                        <div
                          key={a.id}
                          className="rounded-lg border border-border bg-muted/30 p-3 hover:shadow-sm transition"
                        >
                          <div className="flex items-start gap-2">
                            <HexagonAvatar name={a.name} size={28} color={col.color} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{a.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{jobTitle(a.jobId)}</p>
                              <p className="text-[10px] text-muted-foreground">Applied {formatDateShort(a.appliedDate)}</p>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <Badge
                              variant={allDone ? "default" : "secondary"}
                              className={`text-[10px] ${allDone ? "bg-green-500/15 text-green-600 hover:bg-green-500/15" : ""}`}
                            >
                              {allDone && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                              {submitted}/{total} docs
                            </Badge>
                            {a.schedule && (
                              <HexagonBadge color={a.schedule.platform === "Video Conferencing" ? "#1d4ed8" : "#0e7490"}>
                                {a.schedule.platform === "Video Conferencing" ? <Video className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                                {formatDateShort(a.schedule.date)} {a.schedule.time}
                              </HexagonBadge>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <Select value={a.stage} onValueChange={(v) => jumpTo(a, v as ApplicantStage)}>
                              <SelectTrigger className="h-7 text-xs flex-1 mr-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-0.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={ORDER.indexOf(a.stage) === 0}
                                onClick={() => move(a, -1)}
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={ORDER.indexOf(a.stage) === ORDER.length - 1}
                                onClick={() => move(a, 1)}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Use the dropdown or arrows on each applicant card to move them between stages. Stages: New → Screening → Interview → Offer → Hired (or Rejected).
      </p>
    </div>
  );
}
