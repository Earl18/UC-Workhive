import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { Role, SystemUser } from "@/lib/types";

export const AUTH_SESSION_COOKIE = "workhive_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12;
const REMEMBER_ME_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthenticatedPortalUser = Pick<
  SystemUser,
  "id" | "name" | "email" | "role" | "employeeId" | "active" | "lastLogin"
>;

type SessionPayload = AuthenticatedPortalUser & {
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET is missing or too short.");
  }
  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function formatLastLogin(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

async function buildPortalDisplayName(input: {
  fallbackName?: string | null;
  fallbackEmail: string;
  employeeId?: string | null;
}) {
  if (input.employeeId) {
    const employee = await db.employeeRecord.findUnique({
      where: { id: input.employeeId },
      select: { firstName: true, lastName: true },
    }).catch(() => null);

    const employeeName = [employee?.firstName?.trim(), employee?.lastName?.trim()]
      .filter(Boolean)
      .join(" ");

    if (employeeName) {
      return employeeName;
    }
  }

  return input.fallbackName?.trim() || input.fallbackEmail;
}

function toPortalRole(role: string): Role {
  if (role === "admin" || role === "hr") {
    return role;
  }
  return "employee";
}

export function getAllowedEmailDomains() {
  return (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? "uc.edu.ph")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedEmails() {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  if (getAllowedEmails().includes(normalized)) {
    return true;
  }

  return EMAIL_PATTERN.test(normalized);
}

export async function resolvePortalUserByEmail(
  email: string,
): Promise<AuthenticatedPortalUser | null> {
  const normalized = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeId: true,
      active: true,
      lastLogin: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  const displayName = await buildPortalDisplayName({
    fallbackName: user.name,
    fallbackEmail: normalized,
    employeeId: user.employeeId,
  });

  return {
    id: user.id,
    name: displayName,
    email: user.email,
    role: toPortalRole(user.role),
    employeeId: user.employeeId ?? undefined,
    active: user.active,
    lastLogin: formatLastLogin(user.lastLogin),
  };
}

export async function updateUserLastLogin(id: string) {
  const user = await db.user.update({
    where: { id },
    data: { lastLogin: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeId: true,
      active: true,
      lastLogin: true,
    },
  });

  const displayName = await buildPortalDisplayName({
    fallbackName: user.name,
    fallbackEmail: user.email,
    employeeId: user.employeeId,
  });

  return {
    id: user.id,
    name: displayName,
    email: user.email,
    role: toPortalRole(user.role),
    employeeId: user.employeeId ?? undefined,
    active: user.active,
    lastLogin: formatLastLogin(user.lastLogin),
  } satisfies AuthenticatedPortalUser;
}

export function createSessionToken(user: AuthenticatedPortalUser, remember: boolean) {
  const maxAge = remember ? REMEMBER_ME_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS;
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): AuthenticatedPortalUser | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
      active: payload.active,
      lastLogin: payload.lastLogin,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? REMEMBER_ME_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS,
  };
}

export function getSessionCookieDeletionOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
