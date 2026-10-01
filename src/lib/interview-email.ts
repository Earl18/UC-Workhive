import type { Applicant } from "@/lib/types";
import { sendTemplatedEmail } from "@/lib/brevo-email";

export type InterviewEmailType = "Interview Invitation" | "Interview Rescheduled";

export function sendInterviewEmail(applicant: Applicant, type: InterviewEmailType) {
  if (!applicant.schedule) throw new Error("The applicant has no saved interview schedule.");
  return sendTemplatedEmail({
    type,
    to: applicant.email,
    recipientName: applicant.fullName ?? applicant.name,
    context: { applicantId: applicant.id, event: {
      date: applicant.schedule.date,
      time: applicant.schedule.time,
      newDate: applicant.schedule.date,
      newTime: applicant.schedule.time,
      platform: applicant.schedule.mode,
      locationLink: applicant.schedule.venueOrLink,
    } },
    eventKey: `interview:${applicant.id}:${applicant.schedule.date}:${applicant.schedule.time}:${type}`,
  });
}
