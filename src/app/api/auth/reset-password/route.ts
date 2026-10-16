import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePasswordRequirements } from "@/lib/role-default-passwords";
import { getResetUser, getSupabaseResetConfig } from "@/lib/password-reset";
import { PASSWORD_RESET_REQUEST_ID_PATTERN } from "@/lib/password-reset-completion";

export async function POST(request: NextRequest) {
  const { accessToken, password, requestId } = await request.json() as { accessToken?: string; password?: string; requestId?: string };
  if (!accessToken || !password || !validatePasswordRequirements(password) || (requestId && !PASSWORD_RESET_REQUEST_ID_PATTERN.test(requestId))) {
    return NextResponse.json({ error: PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }
  try {
    const user = await getResetUser(accessToken);
    if (!user?.active) return NextResponse.json({ error: "The reset link expired or is invalid. Request a new one." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    if (requestId) {
      const deliveryKeyPattern = `reset:${user.id}:%`;
      const resetRequests = await db.$queryRaw<Array<{ key: string }>>`
        SELECT "key" FROM "EmailDeliveryRecord"
        WHERE "messageId" = ${requestId} AND "key" LIKE ${deliveryKeyPattern}
          AND "status" IN ('sending', 'sent')
          AND COALESCE("sentAt", "updatedAt") > NOW() - INTERVAL '60 minutes'
      `;
      if (!resetRequests.length) return NextResponse.json({ error: "The reset link expired or is invalid. Request a new one." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const { url, key } = getSupabaseResetConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "The reset link expired or is invalid. Request a new one." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
      await db.user.update({ where: { id: user.id }, data: {
        passwordSource: "custom", passwordRole: null, passwordVersion: null,
      } });
    } catch (error) { console.error("Password changed but local password status update failed", error); }
    if (requestId) {
      try {
        const deliveryKeyPattern = `reset:${user.id}:%`;
        await db.$executeRaw`
          UPDATE "EmailDeliveryRecord" SET "status" = 'completed', "updatedAt" = NOW()
          WHERE "messageId" = ${requestId} AND "key" LIKE ${deliveryKeyPattern} AND "status" IN ('sending', 'sent')
        `;
      } catch (error) { console.error("Password changed but reset request completion update failed", error); }
    }
    return NextResponse.json({ ok: true, email: user.email }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Unable to reset the password right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
