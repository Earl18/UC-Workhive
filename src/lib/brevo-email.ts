import { renderEmailTemplate, type EmailRenderContext } from "@/lib/email-placeholders";
import { getSystemSettings } from "@/lib/admin-data";
import { renderWorkHiveEmailHtml } from "@/lib/email-layout";
import { headers } from "next/headers";

const WORKHIVE_SENDER_EMAIL = "ucworkhive@gmail.com";

export function isEmailTransportConfigured() {
  return Boolean(process.env.BREVO_API_KEY);
}

async function getWebsiteLogoUrl() {
  const configuredUrl = process.env.WORKHIVE_PUBLIC_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "https:") return new URL("/workhive-logo.png", url).toString();
    } catch { /* Fall back to the current website host. */ }
  }
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ?? requestHeaders.get("host");
    if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host) && !/^(localhost|127\.0\.0\.1)(:|$)/i.test(host)) {
      return `https://${host}/workhive-logo.png`;
    }
  } catch { /* Email delivery can also run outside a request. */ }
  return undefined;
}

export async function sendTemplatedEmail(input: {
  type: string;
  to: string;
  recipientName?: string;
  context: EmailRenderContext;
  eventKey?: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo is not configured. Set BREVO_API_KEY.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw new Error("Recipient email is invalid.");

  const [rendered, settings] = await Promise.all([renderEmailTemplate(input.type, input.context), getSystemSettings()]);
  const contactEmail = settings.hrEmail?.trim();
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("System Settings HR email is not valid for replies.");
  if (rendered.unresolved.length) {
    throw new Error(`${input.type} has unresolved placeholders: ${rendered.unresolved.join(", ")}`);
  }
  const logoUrl = await getWebsiteLogoUrl();
  const senderName = process.env.BREVO_SENDER_NAME || "WorkHive HRMS";
  const html = renderWorkHiveEmailHtml({
    type: input.type,
    subject: rendered.subject,
    body: rendered.body,
    settings,
    logoUrl,
    senderName,
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "accept": "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: WORKHIVE_SENDER_EMAIL, name: senderName },
      replyTo: { email: contactEmail, name: "UC South Campus HR" },
      to: [{ email: input.to, ...(input.recipientName ? { name: input.recipientName } : {}) }],
      subject: rendered.subject,
      htmlContent: html,
      ...(input.eventKey ? { headers: { "Idempotency-Key": input.eventKey } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Brevo rejected ${input.type} email (HTTP ${response.status}).`);
  }
  const result = await response.json() as { messageId?: string };
  return result.messageId ?? "accepted";
}

/** A notification failure must not reverse a completed HR or applicant action. */
export async function sendTemplatedEmailSafely(input: Parameters<typeof sendTemplatedEmail>[0]) {
  try {
    return await sendTemplatedEmail(input);
  } catch (error) {
    console.error("WorkHive email delivery failed", { type: input.type, eventKey: input.eventKey, error });
    return null;
  }
}

/** Keep database and provider diagnostics out of API responses, while giving staff an actionable reason. */
export function emailDeliveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("unresolved placeholders")) return message;
  if (message.startsWith("Brevo rejected")) return message;
  if (message.startsWith("Brevo is not configured")) return message;
  if (message.startsWith("System Settings HR email")) return message;
  if (message.startsWith("Recipient email is invalid")) return message;
  if (message.startsWith("Email template") && message.endsWith("was not found.")) return message;
  return "Email delivery failed. Check the server logs for details.";
}
