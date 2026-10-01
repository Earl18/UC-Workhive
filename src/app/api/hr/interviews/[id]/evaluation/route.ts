import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById, saveSubmittedApplicantInterviewEvaluation } from "@/lib/application-data";
import { INTERVIEW_SCORING_CRITERIA, recommendationForScore } from "@/lib/interview-scoring";
import type { InterviewEvaluation } from "@/lib/types";

type CriterionInput = { score?: unknown; remarks?: unknown };

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const applicant = await getSubmittedApplicantById(id);
    if (!applicant?.schedule) {
      return NextResponse.json({ error: "This applicant has no scheduled interview." }, { status: 404 });
    }

    const schedule = applicant.schedule;
    const isInterviewer = schedule.moderatorUserId
      ? schedule.moderatorUserId === auth.user.id
      : schedule.createdBy === auth.user.name || schedule.panel?.[0] === auth.user.name;
    if (!isInterviewer) {
      return NextResponse.json({ error: "Only the scheduled interviewer can rate this applicant." }, { status: 403 });
    }

    const body = await request.json() as { status?: unknown; criteria?: unknown; overallRemarks?: unknown };
    if (body.status !== "draft" && body.status !== "submitted") {
      return NextResponse.json({ error: "Choose Save draft or Submit evaluation." }, { status: 400 });
    }
    if (body.status === "draft" && applicant.interviewEvaluation?.status === "submitted") {
      return NextResponse.json({ error: "This interview is already done. Submit the updated evaluation to save changes." }, { status: 400 });
    }
    if (!body.criteria || typeof body.criteria !== "object" || Array.isArray(body.criteria)) {
      return NextResponse.json({ error: "Interview ratings are required." }, { status: 400 });
    }
    if (typeof body.overallRemarks !== "string" || body.overallRemarks.length > 3000) {
      return NextResponse.json({ error: "Overall remarks must be 3,000 characters or fewer." }, { status: 400 });
    }

    const incoming = body.criteria as Record<string, CriterionInput>;
    const criteria: InterviewEvaluation["criteria"] = {};
    for (const criterion of INTERVIEW_SCORING_CRITERIA) {
      const value = incoming[criterion.key];
      const score = value?.score == null ? null : value.score;
      if (score !== null && (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5)) {
        return NextResponse.json({ error: `Choose a rating from 1 to 5 for ${criterion.label}.` }, { status: 400 });
      }
      if (value?.remarks != null && (typeof value.remarks !== "string" || value.remarks.length > 1000)) {
        return NextResponse.json({ error: `Remarks for ${criterion.label} must be 1,000 characters or fewer.` }, { status: 400 });
      }
      criteria[criterion.key] = { score, remarks: String(value?.remarks ?? "").trim() };
    }

    const complete = INTERVIEW_SCORING_CRITERIA.every((criterion) => criteria[criterion.key].score !== null);
    if (body.status === "submitted" && !complete) {
      return NextResponse.json({ error: "Rate all 10 qualifications before submitting the evaluation." }, { status: 400 });
    }
    const totalScore = complete
      ? INTERVIEW_SCORING_CRITERIA.reduce((total, criterion) => total + (criteria[criterion.key].score ?? 0), 0) * 2
      : null;
    const evaluation: InterviewEvaluation = {
      interviewerId: auth.user.id,
      interviewerName: auth.user.name,
      date: schedule.date,
      criteria,
      overallRemarks: body.overallRemarks.trim(),
      status: body.status,
      totalScore,
      recommendation: totalScore === null ? null : recommendationForScore(totalScore),
      updatedAt: new Date().toISOString(),
    };

    const updated = await saveSubmittedApplicantInterviewEvaluation({ applicantId: id, evaluation });
    return NextResponse.json({ applicant: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save interview evaluation." }, { status: 400 });
  }
}
