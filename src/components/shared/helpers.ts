"use client";

import {
  EmploymentStatus,
  LeaveRequest,
  Applicant,
  HolidayType,
} from "@/lib/types";

export function employmentStatusColor(s: EmploymentStatus): string {
  switch (s) {
    case "Regular":
      return "#16a34a"; // green
    case "Probationary":
      return "#ca8a04"; // amber
    case "Retired":
      return "#6b7280"; // gray
    case "Resigned":
      return "#dc2626"; // red
  }
}

export function leaveStatusColor(s: LeaveRequest["overallStatus"]): string {
  switch (s) {
    case "Approved":
      return "#16a34a";
    case "Pending":
      return "#ca8a04";
    case "Disapproved":
      return "#dc2626";
    case "Cancelled":
      return "#6b7280";
  }
}

export function applicantStageColor(s: Applicant["stage"]): string {
  switch (s) {
    case "New":
      return "#0e7490";
    case "Screening":
      return "#7c3aed";
    case "Interview":
      return "#1d4ed8";
    case "Offer":
      return "#ca8a04";
    case "Hired":
      return "#16a34a";
    case "Rejected":
      return "#dc2626";
  }
}

export function holidayColor(t: HolidayType): string {
  switch (t) {
    case "Regular Holiday":
      return "#dc2626";
    case "Special Non-Working Day":
      return "#ea580c";
    case "Special Working Holiday":
      return "#ca8a04";
    case "Institution Holiday":
      return "#1d4ed8";
  }
}

export function recommendationColor(r: InterviewScoreRecommendation): string {
  switch (r) {
    case "Highly Recommended":
      return "#16a34a";
    case "Recommended":
      return "#1d4ed8";
    case "Recommended with Reservation":
      return "#ca8a04";
    case "Not Recommended":
      return "#dc2626";
  }
}

const parsedDateCache = new Map<string, Date | null>();
const ageCache = new Map<string, number | null>();

function buildLocalDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

export type InterviewScoreRecommendation =
  | "Highly Recommended"
  | "Recommended"
  | "Recommended with Reservation"
  | "Not Recommended";

export function calcRecommendation(total: number): InterviewScoreRecommendation {
  if (total >= 81) return "Highly Recommended";
  if (total >= 61) return "Recommended";
  if (total >= 41) return "Recommended with Reservation";
  return "Not Recommended";
}

export function parseSupportedDate(value: string): Date | null {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const cached = parsedDateCache.get(text);
  if (cached !== undefined) {
    return cached ? new Date(cached.getFullYear(), cached.getMonth(), cached.getDate()) : null;
  }

  let result: Date | null = null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    result = buildLocalDate(Number(year), Number(month), Number(day));
  }

  if (!result) {
    const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      const [, month, day, rawYear] = usMatch;
      const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      result = buildLocalDate(year, Number(month), Number(day));
    }
  }

  if (!result) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      result = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  parsedDateCache.set(text, result);
  return result ? new Date(result.getFullYear(), result.getMonth(), result.getDate()) : null;
}

export function formatDate(iso: string): string {
  const parsed = parseSupportedDate(iso);
  if (!parsed) {
    return iso || "-";
  }
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateShort(iso: string): string {
  const parsed = parseSupportedDate(iso);
  if (!parsed) {
    return iso || "-";
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function calculateAgeFromBirthDate(birthDate?: string): number | null {
  if (!birthDate) {
    return null;
  }

  const key = birthDate.trim();
  if (!key) {
    return null;
  }

  const cached = ageCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const parsed = parseSupportedDate(key);
  if (!parsed) {
    ageCache.set(key, null);
    return null;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const birthYear = parsed.getFullYear();
  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();

  let age = currentYear - birthYear;
  if (birthYear > currentYear || (birthYear == currentYear && (birthMonth > currentMonth || (birthMonth == currentMonth && birthDay > currentDay)))) {
    ageCache.set(key, null);
    return null;
  }

  if (currentMonth < birthMonth || (currentMonth == birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  const result = age < 0 ? null : age;
  ageCache.set(key, result);
  return result;
}

export function lengthOfService(dateHired: string): string {
  const hired = new Date(`${dateHired}T00:00:00`);
  if (Number.isNaN(hired.getTime())) {
    return "-";
  }

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (hired > current) {
    return "0 yrs 0 mo 0 days";
  }

  let years = current.getFullYear() - hired.getFullYear();
  let months = current.getMonth() - hired.getMonth();
  let days = current.getDate() - hired.getDate();

  if (days < 0) {
    const previousMonth = new Date(current.getFullYear(), current.getMonth(), 0);
    days += previousMonth.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  if (years < 0) {
    return "0 yrs 0 mo 0 days";
  }

  return `${years} yr${years !== 1 ? "s" : ""} ${months} mo ${days} day${days !== 1 ? "s" : ""}`;
}

export function formatLeaveDayCount(value: number): string {
  if (!Number.isFinite(value)) {
    return "Unlimited";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function formatLeaveDayLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return "Unlimited";
  }

  const formatted = formatLeaveDayCount(value);
  return `${formatted} day${value === 1 ? "" : "s"}`;
}

export function formatAttachmentDisplayName(fileName?: string, fallbackLabel = "Leave Attachment"): string {
  const normalized = (fileName ?? "").trim();
  if (!normalized) {
    return fallbackLabel;
  }

  const extensionMatch = normalized.match(/(\.[a-zA-Z0-9]+)$/);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";
  const baseName = extension ? normalized.slice(0, -extension.length) : normalized;
  const compactBase = baseName.replace(/[_\s-]+/g, "");
  const looksGenerated = /^\d{16,}$/.test(compactBase) || /^[a-f0-9]{24,}$/i.test(compactBase);

  if (looksGenerated) {
    return `${fallbackLabel}${extension}`;
  }

  return normalized;
}

export function formatTime12Hour(value?: string | null): string {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return '-';
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    const seconds = twentyFourHourMatch[3] ? Number(twentyFourHourMatch[3]) : 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      const parsed = new Date(2000, 0, 1, hours, minutes, seconds);
      return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }

  const twelveHourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const seconds = twelveHourMatch[3] ? Number(twelveHourMatch[3]) : 0;
    const meridiem = twelveHourMatch[4].toUpperCase();

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      const normalizedHours = meridiem === 'PM' && hours !== 12
        ? hours + 12
        : meridiem === 'AM' && hours === 12
          ? 0
          : hours;
      const parsed = new Date(2000, 0, 1, normalizedHours, minutes, seconds);
      return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }

  return normalized;
}
