export type EmailLayoutSettings = {
  organizationName: string;
  campusAddress: string;
  contactNumber: string;
  hrEmail: string;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderWorkHiveEmailHtml(input: {
  type: string;
  subject: string;
  body: string;
  settings: EmailLayoutSettings;
  logoUrl?: string;
  senderName?: string;
}) {
  const { type, subject, body, settings } = input;
  const paragraphs = body.split(/\n\s*\n/).map((paragraph) => {
    const content = paragraph.split(/(https?:\/\/[^\s<>]+)/g).map((part) => part.startsWith("https://") || part.startsWith("http://")
      ? `<a href="${escapeEmailHtml(part)}" style="color:#284c9a">${escapeEmailHtml(part)}</a>`
      : escapeEmailHtml(part)).join("").replace(/\n/g, "<br>");
    return `<p style="margin:0 0 16px;line-height:1.65">${content}</p>`;
  }).join("");
  const logo = input.logoUrl ? `<img src="${escapeEmailHtml(input.logoUrl)}" width="42" height="42" alt="WorkHive logo" style="display:block;width:42px;height:42px;object-fit:contain;border:0">` : "";
  const senderName = escapeEmailHtml(input.senderName || "WorkHive HRMS");
  const organization = escapeEmailHtml(settings.organizationName);
  const address = escapeEmailHtml(settings.campusAddress);
  const phone = escapeEmailHtml(settings.contactNumber);
  const replyAddress = escapeEmailHtml(settings.hrEmail.trim());
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#14213d">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fb"><tr><td align="center" style="padding:30px 12px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dbe3ee;border-radius:9px;overflow:hidden;box-shadow:0 2px 6px rgba(20,33,61,.08)">
    <tr><td bgcolor="#3159a5" style="padding:18px 24px;background:#3159a5;background:linear-gradient(110deg,#60a5fa,#1e3a8a)">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        ${logo ? `<td width="48" valign="middle">${logo}</td>` : ""}
        <td valign="middle"><div style="font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1.1"><span style="color:#ffffff">Work</span><span style="color:#fbbf24">Hive</span></div><div style="margin-top:3px;color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase">UC South Campus - HRMS</div></td>
        <td valign="middle" align="right" style="color:#ffffff;font-size:11px;line-height:1.5">Human Resource Department<br>${organization}</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="#f8fafc" style="padding:14px 24px;border-bottom:1px solid #dbe3ee;background:#f8fafc">
      <div style="color:#334155;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Subject</div>
      <div style="margin-top:3px;color:#14213d;font-size:15px;font-weight:700;line-height:1.4">${escapeEmailHtml(subject)}</div>
      <div style="margin-top:6px;color:#334155;font-size:12px;line-height:1.5">From: ${senderName} &lt;<a href="mailto:ucworkhive@gmail.com" style="color:#163c86;text-decoration:underline">ucworkhive@gmail.com</a>&gt; &nbsp;·&nbsp; Reply to: <a href="mailto:${replyAddress}" style="color:#163c86;text-decoration:underline">${replyAddress}</a></div>
    </td></tr>
    <tr><td style="padding:24px;color:#14213d;font-size:14px;line-height:1.65">
      <div style="margin-bottom:16px;color:#284c9a;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase">✉ &nbsp; ${escapeEmailHtml(type)}</div>
      ${paragraphs}
    </td></tr>
    <tr><td bgcolor="#f8fafc" style="padding:16px 24px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.5">
      <div style="border-top:1px solid #dbe3ee;padding-top:14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td valign="top" style="color:#334155;font-size:12px;line-height:1.5"><strong style="color:#14213d">${organization} - HR Department</strong><br>${address}<br><a href="mailto:${replyAddress}" style="color:#163c86;text-decoration:underline">${replyAddress}</a> ${phone}</td>
        <td valign="top" align="right" style="color:#334155;font-size:12px;line-height:1.5">This is an automated message.<br>Questions? Reply to this email.<br><strong style="color:#163c86">WorkHive HRMS</strong></td>
      </tr></table></div>
    </td></tr>
    <tr><td align="center" bgcolor="#3159a5" style="padding:9px 16px;background:#3159a5;background:linear-gradient(110deg,#60a5fa,#1e3a8a);color:#ffffff;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">✉ &nbsp; Sent from WorkHive HRMS</td></tr>
  </table></td></tr></table></body></html>`;
}
