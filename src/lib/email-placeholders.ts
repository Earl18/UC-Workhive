import { db } from "@/lib/db";
import { getSubmittedApplicantById } from "@/lib/application-data";
import { PLACEHOLDER_FIELDS, type EmailPlaceholder, type PlaceholderSource } from "@/lib/email-placeholder-fields";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getEmailTemplates } from "@/lib/admin-data";
import { formatInterviewTime } from "@/lib/email-time";

const DEFAULTS: Array<[string, PlaceholderSource, string]> = [
  ["Employee Name", "employee", "fullName"], ["Applicant Name", "applicant", "fullName"],
  ["User", "user", "name"], ["Position", "applicant", "positionApplied"],
  ["Date From", "leave", "dateFrom"], ["Date To", "leave", "dateTo"],
  ["Date", "event", "date"], ["Time", "event", "time"],
  ["Leave Type", "leave", "leaveType"], ["Hours", "event", "hours"],
  ["Reason", "event", "reason"], ["Platform", "event", "platform"],
  ["Location/Link", "event", "locationLink"], ["Reset Link", "event", "resetLink"],
  ["Holiday Name", "holiday", "name"], ["Holiday Type", "holiday", "type"],
  ["New Date", "event", "newDate"], ["New Time", "event", "newTime"],
];

export function validPlaceholderField(source: string, field: string): source is PlaceholderSource {
  return source in PLACEHOLDER_FIELDS && (PLACEHOLDER_FIELDS[source as PlaceholderSource] as readonly string[]).includes(field);
}

export function validPlaceholderLabel(label: string) {
  return label.length > 0 && label.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N} /_-]*$/u.test(label);
}

type PlaceholderRow = { label: string; source: string; field: string };

export async function findEmailPlaceholder(label: string) {
  const rows = await db.$queryRaw<PlaceholderRow[]>`SELECT "label", "source", "field" FROM "EmailPlaceholderRecord" WHERE lower("label") = lower(${label}) LIMIT 1`;
  return rows[0] ?? null;
}

export async function createEmailPlaceholder(label: string, source: PlaceholderSource, field: string) {
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "EmailPlaceholderRecord" ("id", "label", "source", "field") VALUES (${id}, ${label}, ${source}, ${field})`;
  return { label, token: `[${label}]`, source, field };
}

export async function getEmailPlaceholders(): Promise<EmailPlaceholder[]> {
  // Existing deployments can read templates before the new migration is applied.
  try {
    const defaults = Prisma.join(DEFAULTS.map(([label, source, field]) => Prisma.sql`(${randomUUID()}, ${label}, ${source}, ${field})`));
    await db.$executeRaw`INSERT INTO "EmailPlaceholderRecord" ("id", "label", "source", "field") VALUES ${defaults} ON CONFLICT ("label") DO NOTHING`;
    const rows = await db.$queryRaw<PlaceholderRow[]>`SELECT "label", "source", "field" FROM "EmailPlaceholderRecord" ORDER BY "createdAt" ASC`;
    return rows.filter((row) => validPlaceholderField(row.source, row.field)).map((row) => ({
      label: row.label, token: `[${row.label}]`, source: row.source as PlaceholderSource, field: row.field,
    }));
  } catch (error) {
    const known = error as { code?: string; meta?: { code?: string } };
    if (known?.code === "P2021" || (known?.code === "P2010" && known.meta?.code === "42P01")) {
      return DEFAULTS.map(([label, source, field]) => ({ label, token: `[${label}]`, source, field }));
    }
    throw error;
  }
}

export type EmailRenderContext = {
  employeeId?: string;
  userId?: string;
  applicantId?: string;
  leaveId?: string;
  holidayId?: string;
  event?: Partial<Record<(typeof PLACEHOLDER_FIELDS.event)[number], string | number>>;
};

function asText(value: unknown): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

export async function renderEmailTemplate(type: string, context: EmailRenderContext) {
  const [templates, definitions, employee, user, applicant, leave, holiday, settings] = await Promise.all([
    getEmailTemplates(),
    getEmailPlaceholders(),
    context.employeeId ? db.employeeRecord.findUnique({ where: { id: context.employeeId } }) : null,
    context.userId ? db.user.findUnique({ where: { id: context.userId } }) : null,
    context.applicantId ? getSubmittedApplicantById(context.applicantId) : null,
    context.leaveId ? db.leaveRequestRecord.findUnique({ where: { id: context.leaveId } }) : null,
    context.holidayId ? db.holidayRecord.findUnique({ where: { id: context.holidayId } }) : null,
    db.systemSettings.findUnique({ where: { id: "default" } }),
  ]);
  const template = templates.find((entry) => entry.type === type);
  if (!template) throw new Error(`Email template "${type}" was not found.`);
  const eventValues: Record<string, string | number | undefined> = {
    date: holiday?.date ?? applicant?.schedule?.date ?? leave?.dateFrom,
    time: applicant?.schedule?.time,
    reason: leave?.reason,
    platform: applicant?.schedule?.mode,
    locationLink: applicant?.schedule?.venueOrLink,
    newDate: applicant?.schedule?.date,
    newTime: applicant?.schedule?.time,
    ...context.event,
  };
  eventValues.time = formatInterviewTime(eventValues.time);
  eventValues.newTime = formatInterviewTime(eventValues.newTime);
  const data: Record<PlaceholderSource, Record<string, unknown>> = {
    employee: employee ? { ...employee, fullName: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ") } : { fullName: user?.name },
    user: user ? { ...user } : {},
    applicant: applicant ? {
      ...applicant, interviewDate: applicant.schedule?.date, interviewTime: formatInterviewTime(applicant.schedule?.time),
      interviewMode: applicant.schedule?.mode, interviewLocation: applicant.schedule?.venueOrLink,
    } : {},
    leave: leave ? { ...leave } : {}, holiday: holiday ? { ...holiday } : {}, settings: settings ? { ...settings } : {}, event: eventValues,
  };
  const values = new Map(definitions.map(({ token, source, field }) => [token, asText(data[source][field])]));
  const missing = new Set<string>();
  const replace = (input: string) => input.replace(/\[[^\[\]\n]+\]/g, (token) => {
    const value = values.get(token);
    if (value === undefined) { missing.add(token); return token; }
    return value;
  });
  const subject = replace(template.subject);
  const body = replace(template.body);
  return { subject, body, unresolved: [...missing] };
}
