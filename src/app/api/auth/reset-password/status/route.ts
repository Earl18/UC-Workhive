import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PASSWORD_RESET_REQUEST_ID_PATTERN } from "@/lib/password-reset-completion";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!PASSWORD_RESET_REQUEST_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400, headers: noStore });
  }
  try {
    const resetRequests = await db.$queryRaw<Array<{ status: string; sentAt: Date | null; updatedAt: Date }>>`
      SELECT "status", "sentAt", "updatedAt" FROM "EmailDeliveryRecord"
      WHERE "messageId" = ${id} AND "key" LIKE 'reset:%'
    `;
    const resetRequest = resetRequests[0];
    if (!resetRequest) return NextResponse.json({ error: "Reset request unavailable." }, { status: 404, headers: noStore });
    return NextResponse.json({
      completed: resetRequest.status === "completed",
      expired: resetRequest.status !== "completed" && (resetRequest.sentAt ?? resetRequest.updatedAt).getTime() < Date.now() - 60 * 60 * 1000,
    }, { headers: noStore });
  } catch (error) {
    console.error("Password reset status lookup failed", error);
    return NextResponse.json({ error: "Reset status is unavailable." }, { status: 503, headers: noStore });
  }
}
