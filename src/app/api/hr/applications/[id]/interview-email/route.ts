import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById } from "@/lib/application-data";
import { emailDeliveryErrorMessage } from "@/lib/brevo-email";
import { sendInterviewEmail, type InterviewEmailType } from "@/lib/interview-email";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const applicant = await getSubmittedApplicantById(id);
  if (!applicant?.schedule) return NextResponse.json({ error: "No scheduled interview was found." }, { status: 404 });
  const schedule = applicant.schedule;
  if ((schedule.moderatorUserId && schedule.moderatorUserId !== auth.user.id)
    || (!schedule.moderatorUserId && schedule.createdBy && schedule.createdBy !== auth.user.name)) {
    return NextResponse.json({ error: "Only the interviewer who scheduled this interview can resend its email." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { type?: InterviewEmailType };
  if (body.type !== "Interview Invitation" && body.type !== "Interview Rescheduled") {
    return NextResponse.json({ error: "Choose an interview email type to resend." }, { status: 400 });
  }
  try {
    await sendInterviewEmail(applicant, body.type);
    return NextResponse.json({ emailSent: true });
  } catch (error) {
    console.error("Interview email retry failed", { applicantId: id, error });
    return NextResponse.json({ error: emailDeliveryErrorMessage(error) }, { status: 502 });
  }
}
