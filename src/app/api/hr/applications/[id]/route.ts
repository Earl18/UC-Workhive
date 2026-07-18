import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { updateSubmittedApplicantSchedule, updateSubmittedApplicantStage } from "@/lib/application-data";
import type { ApplicantStage, InterviewSchedule } from "@/lib/types";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json() as { stage?: ApplicantStage; schedule?: InterviewSchedule };

    if (!body.stage && !body.schedule) {
      return NextResponse.json({ error: "Applicant stage or schedule is required." }, { status: 400 });
    }

    if (body.schedule) {
      const schedule = body.schedule;
      if (!schedule.date || !schedule.startTime || !schedule.endTime || !schedule.mode || !schedule.venueOrLink) {
        return NextResponse.json({ error: "Complete interview schedule details are required." }, { status: 400 });
      }

      const applicant = await updateSubmittedApplicantSchedule({
        applicantId: id,
        schedule: {
          ...schedule,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          panel: [auth.user.name],
          createdBy: auth.user.name,
        },
      });

      return NextResponse.json({ applicant });
    }

    const applicant = await updateSubmittedApplicantStage({
      applicantId: id,
      stage: body.stage!,
      movedBy: auth.user.name,
    });

    return NextResponse.json({ applicant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update applicant." },
      { status: 400 },
    );
  }
}
