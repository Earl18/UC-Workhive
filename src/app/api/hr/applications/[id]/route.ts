import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById, updateSubmittedApplicantSchedule, updateSubmittedApplicantStage } from "@/lib/application-data";
import { createInterviewRoomName, getHiveConnectConfig, interviewGuestUrl, roomFromGuestUrl } from "@/lib/hiveconnect";
import type { ApplicantStage, InterviewSchedule } from "@/lib/types";
import { emailDeliveryErrorMessage } from "@/lib/brevo-email";
import { sendInterviewEmail } from "@/lib/interview-email";

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
      if (!schedule.date || !schedule.startTime || !schedule.endTime || !schedule.mode || (schedule.mode === "Onsite" && !schedule.venueOrLink)) {
        return NextResponse.json({ error: "Complete interview schedule details are required." }, { status: 400 });
      }

      const existing = await getSubmittedApplicantById(id);
      if (!existing) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
      if (existing.schedule?.status === "Done" || existing.interviewEvaluation) {
        return NextResponse.json({ error: "This interview has an evaluation and can no longer be rescheduled." }, { status: 409 });
      }
      if (existing.schedule?.moderatorUserId && existing.schedule.moderatorUserId !== auth.user.id) {
        return NextResponse.json({ error: "Only the interviewer who scheduled this interview can reschedule it." }, { status: 403 });
      }
      if (existing.schedule?.createdBy && !existing.schedule.moderatorUserId && existing.schedule.createdBy !== auth.user.name) {
        return NextResponse.json({ error: "Only the interviewer who scheduled this interview can reschedule it." }, { status: 403 });
      }
      let venueOrLink = schedule.venueOrLink;
      if (schedule.mode === "Online") {
        const config = await getHiveConnectConfig();
        const previousRoom = existing.schedule?.mode === "Online" && (existing.schedule.moderatorUserId === auth.user.id || (!existing.schedule.moderatorUserId && existing.schedule.createdBy === auth.user.name))
          ? roomFromGuestUrl(config, existing.schedule.venueOrLink)
          : null;
        venueOrLink = interviewGuestUrl(config, previousRoom && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(previousRoom) ? previousRoom : createInterviewRoomName());
      }

      const applicant = await updateSubmittedApplicantSchedule({
        applicantId: id,
        schedule: {
          ...schedule,
          venueOrLink,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          panel: [auth.user.name],
          createdBy: auth.user.name,
          moderatorUserId: auth.user.id,
        },
      });

      try {
        await sendInterviewEmail(applicant, existing.schedule ? "Interview Rescheduled" : "Interview Invitation");
        return NextResponse.json({ applicant, emailSent: true });
      } catch (emailError) {
        console.error("Interview email delivery failed", { applicantId: id, error: emailError });
        return NextResponse.json({ applicant, emailSent: false, emailError: emailDeliveryErrorMessage(emailError) });
      }
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
