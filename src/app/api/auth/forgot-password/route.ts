import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/brevo-email";

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
  let delivered = false;
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");

    if (email && isAllowedEmail(email)) {
      const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, active: true } });
      if (!user?.active) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      deliveryKey = `reset:${user.id}:${Math.floor(Date.now() / 600_000)}`;
      const claimed = await db.$queryRaw<Array<{ key: string }>>`
        INSERT INTO "EmailDeliveryRecord" ("key", "status", "attempts", "updatedAt")
        VALUES (${deliveryKey}, 'sending', 1, NOW())
        ON CONFLICT ("key") DO UPDATE SET "status" = 'sending', "attempts" = "EmailDeliveryRecord"."attempts" + 1, "updatedAt" = NOW()
        WHERE "EmailDeliveryRecord"."status" = 'failed'
        RETURNING "key"
      `;
      if (!claimed.length) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      const { url, key } = getSupabaseAuthConfig();
      const linkResponse = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "recovery",
          email,
          redirect_to: `${request.nextUrl.origin}/reset-password`,
        }),
        cache: "no-store",
      });
      if (!linkResponse.ok) throw new Error(`Supabase recovery link generation failed (HTTP ${linkResponse.status}).`);
      const link = await linkResponse.json() as { action_link?: string };
      if (!link.action_link) throw new Error("Supabase did not return a recovery link.");
      await sendTemplatedEmail({
        type: "Password Reset", to: email, recipientName: user.name ?? undefined,
        context: { userId: user.id, event: { resetLink: link.action_link } },
      });
      delivered = true;
      await db.$executeRaw`UPDATE "EmailDeliveryRecord" SET "status" = 'sent', "sentAt" = NOW(), "updatedAt" = NOW() WHERE "key" = ${deliveryKey}`;
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (delivered) {
      console.error("Recovery email sent but delivery status update failed", error);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (deliveryKey && !delivered) {
      try { await db.$executeRaw`UPDATE "EmailDeliveryRecord" SET "status" = 'failed', "updatedAt" = NOW() WHERE "key" = ${deliveryKey}`; } catch { /* Keep the original failure. */ }
    }
    console.error("Password recovery email failed", error);
    return NextResponse.json({ error: "Password recovery is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
