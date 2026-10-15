import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getSubmittedApplicantById } from "@/lib/application-data";
import { getHiveConnectConfig, mintInterviewModeratorToken, roomFromGuestUrl } from "@/lib/hiveconnect";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const applicant = await getSubmittedApplicantById(id);
    const schedule = applicant?.schedule;
    if (!schedule || schedule.mode !== "Online") {
      return NextResponse.json({ error: "This applicant has no online interview." }, { status: 404 });
    }
    if (schedule.status === "Done" || applicant.interviewEvaluation?.status === "submitted") {
      return NextResponse.json({ error: "This interview is already done." }, { status: 409 });
    }
    if (schedule.moderatorUserId ? schedule.moderatorUserId !== auth.user.id : schedule.createdBy !== auth.user.name) {
      return NextResponse.json({ error: "Only the scheduled interviewer can moderate this room." }, { status: 403 });
    }
    const config = await getHiveConnectConfig();
    const room = roomFromGuestUrl(config, schedule.venueOrLink);
    if (!room) return NextResponse.json({ error: "The saved HiveConnect room is invalid." }, { status: 400 });
    const token = config.demoMode ? undefined : mintInterviewModeratorToken(config, room, auth.user);
    return NextResponse.json({ baseUrl: config.jitsiBaseUrl, room, token, demoMode: Boolean(config.demoMode) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open HiveConnect." }, { status: 500 });
  }
}
