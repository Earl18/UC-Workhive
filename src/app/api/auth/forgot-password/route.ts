import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import { prepareTemplatedEmail, sendTemplatedEmail } from "@/lib/brevo-email";

function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase admin auth environment variables are not configured.");
  }

  return { url, key };
}

export async function POST(request: NextRequest) {
  let deliveryKey: string | null = null;
  let requestId: string | null = null;
  let delivered = false;
  const startedAt = performance.now();
  let lookupMs = 0;
  let claimMs = 0;
  let prepareMs = 0;
  let sendMs = 0;
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");

    if (!email || !isAllowedEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ error: "Password reset is unavailable because the database connection is not configured. Please contact the administrator." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, active: true } });
    lookupMs = performance.now() - startedAt;
    if (!user?.active) {
      return NextResponse.json({ error: "We couldn't find an active account with this email address. Please check the address and try again." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    deliveryKey = `reset:${user.id}:${Math.floor(Date.now() / 60_000)}`;
    const candidateId = randomBytes(24).toString("base64url");
    const claimed = await db.$queryRaw<Array<{ messageId: string }>>`
        INSERT INTO "EmailDeliveryRecord" ("key", "status", "attempts", "messageId", "updatedAt")
        VALUES (${deliveryKey}, 'sending', 1, ${candidateId}, NOW())
        ON CONFLICT ("key") DO UPDATE SET
          "status" = 'sending', "attempts" = "EmailDeliveryRecord"."attempts" + 1,
          "messageId" = ${candidateId}, "sentAt" = NULL, "updatedAt" = NOW()
        WHERE "EmailDeliveryRecord"."status" IN ('failed', 'completed')
        RETURNING "messageId"
    `;
    if (!claimed.length) {
      const existing = await db.$queryRaw<Array<{ messageId: string | null }>>`
        SELECT "messageId" FROM "EmailDeliveryRecord" WHERE "key" = ${deliveryKey}
      `;
      return NextResponse.json({ ok: true, requestId: existing[0]?.messageId ?? null }, { headers: { "Cache-Control": "no-store" } });
    }
    // For reset emails, messageId is the opaque request ID shared with the email link and waiting page.
    requestId = claimed[0].messageId;
    claimMs = performance.now() - startedAt - lookupMs;
    const { url, key } = getSupabaseAuthConfig();
    const publicOrigin = process.env.WORKHIVE_PUBLIC_URL?.trim() || request.nextUrl.origin;
    const redirectTo = new URL("/reset-password", publicOrigin).toString();
    const linkPlaceholder = `WORKHIVE_RESET_LINK_${requestId}`;
    const linkPromise = fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "recovery",
        email,
        redirect_to: redirectTo,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const draftPromise = prepareTemplatedEmail("Password Reset", { userId: user.id, event: { resetLink: linkPlaceholder } });
    const [linkResponse, draft] = await Promise.all([linkPromise, draftPromise]);
    if (!linkResponse.ok) throw new Error(`Supabase recovery link generation failed (HTTP ${linkResponse.status}).`);
    const link = await linkResponse.json() as { action_link?: string; hashed_token?: string };
    if (!link.action_link) throw new Error("Supabase did not return a recovery link.");
    const tokenHash = new URL(link.action_link).searchParams.get("token") || link.hashed_token;
    if (!tokenHash) throw new Error("Supabase did not return a recovery token.");
    const resetLink = new URL("/reset-password", publicOrigin);
    resetLink.hash = new URLSearchParams({ type: "recovery", token_hash: tokenHash, request_id: requestId }).toString();
    const finalLink = resetLink.toString();
    prepareMs = performance.now() - startedAt - lookupMs - claimMs;
    await sendTemplatedEmail({
      type: "Password Reset", to: email, recipientName: user.name ?? undefined,
      context: { userId: user.id, event: { resetLink: finalLink } },
      prepared: {
        ...draft,
        rendered: {
          ...draft.rendered,
          subject: draft.rendered.subject.replaceAll(linkPlaceholder, finalLink),
          body: draft.rendered.body.replaceAll(linkPlaceholder, finalLink),
        },
      },
    });
    delivered = true;
    sendMs = performance.now() - startedAt - lookupMs - claimMs - prepareMs;
    await db.$executeRaw`
      UPDATE "EmailDeliveryRecord" SET "status" = 'sent', "sentAt" = NOW(), "updatedAt" = NOW()
      WHERE "key" = ${deliveryKey} AND "messageId" = ${requestId} AND "status" = 'sending'
    `;
    console.info("Password recovery email timing (ms)", {
      lookup: Math.round(lookupMs), claim: Math.round(claimMs),
      linkAndTemplate: Math.round(prepareMs), brevo: Math.round(sendMs),
      total: Math.round(performance.now() - startedAt),
    });

    return NextResponse.json(
      { ok: true, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (delivered) {
      console.error("Recovery email sent but delivery status update failed", error);
      return NextResponse.json({ ok: true, requestId }, { headers: { "Cache-Control": "no-store" } });
    }
    if (deliveryKey && !delivered) {
      try { await db.$executeRaw`UPDATE "EmailDeliveryRecord" SET "status" = 'failed', "updatedAt" = NOW() WHERE "key" = ${deliveryKey}`; } catch { /* Keep the original failure. */ }
    }
    console.error("Password recovery email failed", { error, elapsedMs: Math.round(performance.now() - startedAt) });
    return NextResponse.json({ error: "Password recovery is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
