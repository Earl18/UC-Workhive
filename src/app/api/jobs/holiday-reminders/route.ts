import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/admin-data";
import { getHolidayRecords } from "@/lib/holiday-data";
import { isEmailTransportConfigured, sendTemplatedEmail } from "@/lib/brevo-email";

export const maxDuration = 300;

function authorized(request: NextRequest) {
  const configured = process.env.EMAIL_JOBS_SECRET;
  const supplied = request.headers.get("x-email-jobs-secret") ?? "";
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isEmailTransportConfigured()) return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });

  const [settings, holidays, employees] = await Promise.all([
    getSystemSettings(), getHolidayRecords(),
    db.employeeRecord.findMany({ where: { employmentStatus: { in: ["Regular", "Probationary"] } }, select: { id: true, email: true, firstName: true, lastName: true } }),
  ]);
  const today = manilaToday();
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + Math.max(0, settings.holidayReminderLead))).toISOString().slice(0, 10);
  const due = holidays.filter((holiday) => holiday.date === target && holiday.type !== "Special Working Holiday");
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const holiday of due) {
    for (let index = 0; index < employees.length; index += 5) {
      await Promise.all(employees.slice(index, index + 5).map(async (employee) => {
        const key = `holiday:${holiday.id}:${holiday.date}:${employee.id}`;
        const claimed = await db.$queryRaw<Array<{ key: string }>>`
          INSERT INTO "EmailDeliveryRecord" ("key", "status", "attempts", "updatedAt")
          VALUES (${key}, 'sending', 1, NOW())
          ON CONFLICT ("key") DO UPDATE SET
            "status" = 'sending', "attempts" = "EmailDeliveryRecord"."attempts" + 1, "updatedAt" = NOW()
          WHERE "EmailDeliveryRecord"."status" = 'failed'
          RETURNING "key"
        `;
        if (!claimed.length) { skipped++; return; }
        let acceptedByProvider = false;
        try {
          const messageId = await sendTemplatedEmail({
            type: "Upcoming Holiday Reminder", to: employee.email,
            recipientName: `${employee.firstName} ${employee.lastName}`,
            context: { employeeId: employee.id, holidayId: holiday.id }, eventKey: key,
          });
          acceptedByProvider = true;
          await db.$executeRaw`UPDATE "EmailDeliveryRecord" SET "status" = 'sent', "messageId" = ${messageId}, "sentAt" = NOW(), "updatedAt" = NOW() WHERE "key" = ${key}`;
          sent++;
        } catch (error) {
          if (!acceptedByProvider) await db.$executeRaw`UPDATE "EmailDeliveryRecord" SET "status" = 'failed', "updatedAt" = NOW() WHERE "key" = ${key}`;
          console.error("Holiday email failed", { key, error });
          failed++;
        }
      }));
    }
  }
  return NextResponse.json({ today, target, holidays: due.length, sent, failed, skipped });
}
