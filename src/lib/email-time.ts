/** Format stored 24-hour interview times for applicants. */
export function formatInterviewTime(value: string | number | undefined) {
  if (value === undefined) return undefined;
  const raw = String(value).trim();
  const formatPart = (part: string) => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(part.trim());
    if (!match) return part.trim();
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
  };
  return raw.split(/\s+[-–]\s+/).map(formatPart).join(" – ");
}
