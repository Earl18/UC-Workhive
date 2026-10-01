"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import type { Applicant, InterviewEvaluation } from "@/lib/types";
import { INTERVIEW_RATING_LABELS, INTERVIEW_SCORING_CRITERIA, recommendationForScore } from "@/lib/interview-scoring";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Rating = { score: number | null; remarks: string };
type Ratings = Record<string, Rating>;
export type InterviewScoringPanelHandle = { saveBeforeClose: () => Promise<boolean> };

function ratingsFrom(evaluation?: InterviewEvaluation): Ratings {
  return Object.fromEntries(INTERVIEW_SCORING_CRITERIA.map((criterion) => [
    criterion.key,
    { score: evaluation?.criteria?.[criterion.key]?.score ?? null, remarks: evaluation?.criteria?.[criterion.key]?.remarks ?? "" },
  ]));
}

export const InterviewScoringPanel = forwardRef<InterviewScoringPanelHandle, {
  applicant: Applicant;
  position: string;
  department: string;
  interviewer: string;
  onDirtyChange: (dirty: boolean) => void;
  onSubmitted?: () => void;
  context?: "meeting" | "result";
  readOnly?: boolean;
}>(function InterviewScoringPanel({ applicant, position, department, interviewer, onDirtyChange, onSubmitted, context = "meeting", readOnly = false }, ref) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Ratings>(() => ratingsFrom(applicant.interviewEvaluation));
  const [overallRemarks, setOverallRemarks] = useState(applicant.interviewEvaluation?.overallRemarks ?? "");
  const [savedStatus, setSavedStatus] = useState<InterviewEvaluation["status"] | null>(applicant.interviewEvaluation?.status ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const pendingSaveRef = useRef<Promise<boolean> | null>(null);

  const ratedCount = INTERVIEW_SCORING_CRITERIA.filter((criterion) => ratings[criterion.key]?.score != null).length;
  const totalScore = useMemo(() => ratedCount === INTERVIEW_SCORING_CRITERIA.length
    ? INTERVIEW_SCORING_CRITERIA.reduce((total, criterion) => total + (ratings[criterion.key]?.score ?? 0), 0) * 2
    : null, [ratedCount, ratings]);

  function updateRating(key: string, patch: Partial<Rating>) {
    setRatings((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setDirty(true);
    onDirtyChange(true);
  }

  async function performSave(status: InterviewEvaluation["status"]): Promise<boolean> {
    setSaving(true);
    try {
      const response = await fetch(`/api/hr/interviews/${encodeURIComponent(applicant.id)}/evaluation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, criteria: ratings, overallRemarks }),
      });
      const payload = await response.json() as { applicant?: Applicant; error?: string };
      if (!response.ok || !payload.applicant) throw new Error(payload.error ?? "Unable to save the evaluation.");

      queryClient.setQueryData<Applicant[]>(["hr-applications"], (current) =>
        current?.map((item) => item.id === applicant.id ? payload.applicant! : item));
      setSavedStatus(status);
      setDirty(false);
      onDirtyChange(false);
      toast({
        title: status === "draft" ? "Evaluation draft saved" : context === "result" ? "Interview report updated" : "Evaluation submitted",
        description: status === "draft" ? "You can continue rating during the interview." : context === "result" ? "The updated result is saved for review." : "The interview is marked done and the applicant's report is saved.",
      });
      return true;
    } catch (error) {
      toast({ title: "Unable to save evaluation", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function save(status: InterviewEvaluation["status"]): Promise<boolean> {
    if (pendingSaveRef.current) return pendingSaveRef.current;
    const pending = performSave(status);
    pendingSaveRef.current = pending;
    void pending.finally(() => {
      if (pendingSaveRef.current === pending) pendingSaveRef.current = null;
    });
    return pending;
  }

  useImperativeHandle(ref, () => ({
    saveBeforeClose: async () => {
      if (pendingSaveRef.current) return pendingSaveRef.current;
      if (!dirty) return true;
      return save(savedStatus === "submitted" ? "submitted" : "draft");
    },
  }));

  async function submitConfirmed() {
    const submitted = await save("submitted");
    if (!submitted) return;
    setConfirmSubmitOpen(false);
    onSubmitted?.();
  }

  return <><Card className="flex h-full min-h-0 flex-col overflow-hidden border-border">
    <CardHeader className="shrink-0 space-y-2 border-b px-5 pb-3 pt-4">
      <CardTitle className="flex items-center gap-2 text-xl"><ClipboardList className="h-5 w-5 text-primary" /> Interview report</CardTitle>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] leading-5 text-foreground">
        <p className="col-span-2"><span className="font-semibold">Applicant:</span> {applicant.fullName ?? applicant.name ?? "Applicant"}</p>
        <p className="col-span-2"><span className="font-semibold">Position:</span> {position}</p>
        <p className="col-span-2"><span className="font-semibold">Department:</span> {department}</p>
        <p className="col-span-2"><span className="font-semibold">Interviewer:</span> {interviewer}</p>
      </div>
      <p className="text-sm font-medium leading-5 text-foreground/80">{readOnly ? "Review the qualification ratings and remarks below." : "Rate each qualification from 1 (Poor) to 5 (Excellent)."}</p>
      {context === "result" && !applicant.interviewEvaluation ? <p className="text-sm font-medium text-amber-700">No report has been saved for this interview yet.</p> : null}
    </CardHeader>

    <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
      {INTERVIEW_SCORING_CRITERIA.map((criterion, index) => <fieldset key={criterion.key} className="rounded-lg border p-4">
        <legend className="px-1 text-base font-bold">{index + 1}. {criterion.label}</legend>
        <p className="mb-3 text-sm font-medium leading-5 text-foreground/80">{criterion.description}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {INTERVIEW_RATING_LABELS.map((label, ratingIndex) => {
            const value = ratingIndex + 1;
            return <label key={label} className="cursor-pointer text-center">
              <input
                type="radio"
                name={`${applicant.id}-${criterion.key}`}
                value={value}
                checked={ratings[criterion.key]?.score === value}
                disabled={saving || readOnly}
                onChange={() => updateRating(criterion.key, { score: value })}
                className="peer sr-only"
                aria-label={`${value} - ${label}`}
              />
              <span className="flex min-h-16 flex-col items-center rounded-md border px-1 pt-2 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                <strong className="shrink-0 text-lg leading-6">{value}</strong>
                <span className="flex min-h-8 items-center justify-center text-center leading-4">{label}</span>
              </span>
            </label>;
          })}
        </div>
        <Textarea
          aria-label={`Remarks for ${criterion.label}`}
          placeholder="Remarks (optional)"
          value={ratings[criterion.key]?.remarks ?? ""}
          maxLength={1000}
          disabled={saving || readOnly}
          onChange={(event) => updateRating(criterion.key, { remarks: event.target.value })}
          className="mt-3 min-h-14 resize-y text-base"
        />
      </fieldset>)}
      <div className="space-y-1.5">
        <Label htmlFor={`overall-remarks-${applicant.id}`} className="text-base font-semibold">Overall remarks</Label>
        <Textarea
          id={`overall-remarks-${applicant.id}`}
          placeholder="Summarize strengths, concerns, and next steps."
          value={overallRemarks}
          maxLength={3000}
          disabled={saving || readOnly}
          onChange={(event) => { setOverallRemarks(event.target.value); setDirty(true); onDirtyChange(true); }}
          className="min-h-24 text-base"
        />
      </div>
    </CardContent>

    <div className="shrink-0 space-y-2 border-t bg-card px-5 py-3">
      <div className="flex items-start justify-between gap-3 text-base">
        <div><span className="font-semibold">Total:</span> {totalScore === null ? "—" : totalScore}/100 <span className="text-sm text-foreground/75">({ratedCount}/10 rated)</span></div>
        {savedStatus === "submitted" && !dirty ? <span className="flex items-center gap-1 text-sm font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Submitted</span> : null}
      </div>
      <p className="text-sm"><span className="font-semibold">Recommendation:</span> {totalScore === null ? "Pending ratings" : recommendationForScore(totalScore)}</p>
      {!readOnly ? context === "result" ? (
        <Button disabled={saving || !dirty} onClick={() => void save(savedStatus === "submitted" ? "submitted" : "draft")} className="h-11 w-full text-base">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} {savedStatus === "submitted" ? "Save changes" : "Save draft"}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving || savedStatus === "submitted"} onClick={() => void save("draft")} className="h-11 flex-1 text-base">Save draft</Button>
          <Button disabled={saving || totalScore === null} onClick={() => setConfirmSubmitOpen(true)} className="h-11 flex-1 text-base">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Submit evaluation
          </Button>
        </div>
      ) : null}
      {dirty ? <p className="text-center text-sm font-medium text-amber-700">Unsaved changes</p> : savedStatus === "draft" ? <p className="text-center text-sm text-foreground/75">Draft saved</p> : null}
    </div>
  </Card>
    <AlertDialog open={confirmSubmitOpen} onOpenChange={(open) => { if (!saving) setConfirmSubmitOpen(open); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit interview evaluation?</AlertDialogTitle>
          <AlertDialogDescription>
            Submitting will end the call, close the interview room, and mark this interview as Done. Please check your ratings before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void submitConfirmed(); }}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Submit evaluation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
});
