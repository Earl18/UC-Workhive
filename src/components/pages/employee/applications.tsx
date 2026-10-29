"use client";

import { useMemo } from "react";
import { useWorkHive } from "@/lib/store";
import { Applicant, ApplicantStage } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  applicantStageColor,
  formatDate,
  recommendationColor,
} from "@/components/shared/helpers";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Mail,
  Phone,
  CalendarClock,
  MapPin,
  Video,
  FileText,
  Award,
  Building2,
  Info,
} from "lucide-react";

const STAGES: ApplicantStage[] = [
  "New",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
];

export function ApplicationsPage() {
  const { currentUser, applicants, jobPostings, setView } = useWorkHive();
  const { toast } = useToast();

  const myApplications = useMemo(
    () =>
      applicants.filter(
        (a) =>
          a.email.toLowerCase() === (currentUser?.email ?? "").toLowerCase()
      ),
    [applicants, currentUser]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">My Applications</h2>
        <p className="text-xs text-muted-foreground">
          Job applications you submitted via the public Careers page.
        </p>
      </div>

      {myApplications.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Briefcase className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No applications yet
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Applications you submit via the public Careers page will appear
              here with their current stage, interview schedule, and interview
              score (if applicable).
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                Tip: log out and visit Careers as a guest to apply — your UC
                email will link applications to this account.
              </span>
            </div>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => {
                toast({
                  title: "Browse Careers",
                  description:
                    "Log out and visit the public Careers page to apply.",
                });
                setView("public:landing");
              }}
            >
              <Briefcase className="h-4 w-4" /> Browse Careers
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myApplications.map((app) => (
            <ApplicationCard key={app.id} app={app} jobTitle={jobPostings.find((j) => j.id === app.jobId)?.title ?? "Unknown Position"} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  jobTitle,
}: {
  app: Applicant;
  jobTitle: string;
}) {
  const stage = app.stage;
  const isRejected = stage === "Rejected";
  const isHired = stage === "Hired";
  const stageColor = applicantStageColor(stage);
  const recommendation = app.interviewScore?.recommendation ?? app.interviewEvaluation?.recommendation;

  // Progress is calculated up to the current stage (excluding Rejected)
  const stageIndex = isRejected
    ? 2 // visually停在 Interview 位置
    : STAGES.indexOf(stage);
  const progressPct = isRejected
    ? 100
    : Math.round(((stageIndex + 1) / STAGES.length) * 100);

  return (
    <Card className="overflow-hidden border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              {jobTitle}
            </CardTitle>
            <CardDescription>
              Applied on {formatDate(app.appliedDate ?? app.submittedAt ?? "")} · Ref #{app.id.toUpperCase()}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="shrink-0"
            style={{ color: stageColor, borderColor: stageColor }}
          >
            <span
              className="mr-1 h-2 w-2 rounded-full"
              style={{ backgroundColor: stageColor }}
            />
            {stage}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Contact info */}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 text-primary" /> {app.email}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 text-primary" /> {app.phone}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary" />{" "}
            {(app.requirements ?? []).filter((r) => r.submitted).length}/
            {app.requirements?.length ?? 0} requirements submitted
          </div>
        </div>

        {/* Stage tracker */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Application Stage
          </p>
          {isRejected ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              Your application was not progressed. Thank you for your interest
              in University of Cebu – South Campus — we encourage you to apply
              for other openings.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                {STAGES.map((s, idx) => {
                  const done = idx < stageIndex;
                  const current = idx === stageIndex;
                  const c = done || current ? "#16a34a" : "var(--muted-foreground)";
                  return (
                    <div
                      key={s}
                      className="flex flex-1 flex-col items-center text-center"
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold"
                        style={{
                          borderColor: c,
                          color: c,
                          backgroundColor: done ? c : "transparent",
                        }}
                      >
                        {done ? "✓" : idx + 1}
                      </div>
                      <span
                        className="mt-1 text-[10px] font-medium"
                        style={{ color: c }}
                      >
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Progress value={progressPct} className="mt-2 h-1.5" />
            </>
          )}
        </div>

        {/* Interview schedule */}
        {app.schedule && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CalendarClock className="h-4 w-4" /> Interview Scheduled
            </p>
            <div className="mt-2 grid gap-2 text-xs text-foreground sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                {formatDate(app.schedule.date)} at {app.schedule.time}
              </div>
              <div>
                <span className="text-muted-foreground">Interviewer:</span>{" "}
                {app.schedule.interviewer ?? app.schedule.panel.join(", ")}
              </div>
              <div className="flex items-center gap-1.5">
                {app.schedule.mode === "Online" ? (
                  <Video className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{app.schedule.platform ?? app.schedule.mode}</span>
                {(app.schedule.location ?? app.schedule.venueOrLink) && (
                  <span className="text-muted-foreground">
                    · {app.schedule.location ?? app.schedule.venueOrLink}
                  </span>
                )}
              </div>
              {app.schedule.rescheduled && (
                <div className="text-amber-600 dark:text-amber-400">
                  Rescheduled from {app.schedule.previousDate}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interview score */}
        {app.interviewScore && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Award className="h-4 w-4 text-gold" /> Interview Result
              </p>
              {recommendation && <Badge
                variant="outline"
                style={{
                  color: recommendationColor(recommendation),
                  borderColor: recommendationColor(recommendation),
                }}
              >
                {recommendation}
              </Badge>}
            </div>
            <Separator className="my-3" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total Score
                </p>
                <p className="font-mono text-2xl font-bold text-primary">
                  {app.interviewScore.totalScore ?? app.interviewEvaluation?.totalScore ?? "—"}
                  <span className="text-sm text-muted-foreground">/100</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Interviewer
                </p>
                <p className="text-sm font-medium text-foreground">
                  {app.interviewScore.interviewer ?? app.interviewScore.evaluator}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Date Interviewed
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(app.interviewScore.date ?? app.interviewEvaluation?.date ?? "")}
                </p>
              </div>
            </div>

            {isHired && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                <Award className="h-4 w-4" />
                <span>
                  Congratulations — you've been hired! Welcome to the UC South
                  Campus family.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
