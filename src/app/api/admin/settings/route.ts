import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getSystemSettings, getSystemSettingsHealth, logAuditEvent } from "@/lib/admin-data";
import { ensureAuthUserWithPassword } from "@/lib/auth-admin";
import {
  getPasswordVersionFieldForRole,
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePasswordRequirements,
} from "@/lib/role-default-passwords";
import { normalizeAcademicYear } from "@/lib/system-settings";
import type { Role } from "@/lib/types";

function toInt(value: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

type SystemSettingsRow = {
  organizationName: string;
  campusAddress: string;
  campusLandmark: string | null;
  campusPlaceId: string | null;
  contactNumber: string;
  hrEmail: string;
  academicYear: string;
  currentSemester: string;
  gracePeriod: number;
  tardinessThreshold: number;
  holidayReminderLead: number;
  vacationLeaveDays: number;
  sickLeaveDays: number;
  incentiveLeaveDays: number;
  soloParentLeaveDays: number;
  paternityLeaveDays: number;
  maternityLeaveDays: number;
  leaveWithoutPayDays: number;
  employeeDefaultPassword: string;
  hrDefaultPassword: string;
  adminDefaultPassword: string;
  employeePasswordVersion: number;
  hrPasswordVersion: number;
  adminPasswordVersion: number;
  updatedAt: Date;
};

function isMissingColumnError(error: unknown, columnName?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2010") {
    return false;
  }

  const meta = error.meta as { code?: string; message?: string } | undefined;
  return meta?.code === "42703" && (!columnName || String(meta.message ?? "").includes(columnName));
}

function toSettingsResponse(row: SystemSettingsRow) {
  return {
    organizationName: row.organizationName,
    campusAddress: row.campusAddress,
    campusLandmark: row.campusLandmark ?? "",
    campusPlaceId: row.campusPlaceId ?? "",
    contactNumber: row.contactNumber,
    hrEmail: row.hrEmail,
    academicYear: row.academicYear,
    currentSemester: row.currentSemester,
    gracePeriod: row.gracePeriod,
    tardinessThreshold: row.tardinessThreshold,
    holidayReminderLead: row.holidayReminderLead,
    vacationLeaveDays: row.vacationLeaveDays,
    sickLeaveDays: row.sickLeaveDays,
    incentiveLeaveDays: row.incentiveLeaveDays,
    soloParentLeaveDays: row.soloParentLeaveDays,
    paternityLeaveDays: row.paternityLeaveDays,
    maternityLeaveDays: row.maternityLeaveDays,
    leaveWithoutPayDays: row.leaveWithoutPayDays,
    employeeDefaultPassword: row.employeeDefaultPassword,
    hrDefaultPassword: row.hrDefaultPassword,
    adminDefaultPassword: row.adminDefaultPassword,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getNextVersion(current: number, changed: boolean) {
  return changed ? current + 1 : current;
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const [settings, health] = await Promise.all([getSystemSettings(), getSystemSettingsHealth()]);

  return NextResponse.json(
    { settings, health },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as {
    organizationName: string;
    campusAddress: string;
    campusLandmark?: string;
    campusPlaceId?: string;
    contactNumber: string;
    hrEmail: string;
    academicYear: string;
    currentSemester: string;
    gracePeriod: number;
    tardinessThreshold: number;
    holidayReminderLead: number;
    vacationLeaveDays: number;
    sickLeaveDays: number;
    incentiveLeaveDays: number;
    soloParentLeaveDays: number;
    paternityLeaveDays: number;
    maternityLeaveDays: number;
    leaveWithoutPayDays: number;
    employeeDefaultPassword?: string;
    hrDefaultPassword?: string;
    adminDefaultPassword?: string;
  };

  let current: SystemSettingsRow;

  try {
    const rows = await db.$queryRaw<SystemSettingsRow[]>`
      SELECT
        "organizationName",
        "campusAddress",
        "campusLandmark",
        "campusPlaceId",
        "contactNumber",
        "hrEmail",
        "academicYear",
        "currentSemester",
        "gracePeriod",
        "tardinessThreshold",
        "holidayReminderLead",
        "vacationLeaveDays",
        "sickLeaveDays",
        "incentiveLeaveDays",
        "soloParentLeaveDays",
        "paternityLeaveDays",
        "maternityLeaveDays",
        "leaveWithoutPayDays",
        "employeeDefaultPassword",
        "hrDefaultPassword",
        "adminDefaultPassword",
        "employeePasswordVersion",
        "hrPasswordVersion",
        "adminPasswordVersion",
        "updatedAt"
      FROM "SystemSettings"
      WHERE "id" = 'default'
      LIMIT 1
    `;

    if (!rows[0]) {
      throw new Error("Unable to load current settings.");
    }

    current = rows[0];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        { error: "System settings table is not available yet. Run the Prisma migration first." },
        { status: 503 },
      );
    }

    throw error;
  }

  const nextEmployeePassword = body.employeeDefaultPassword?.trim() || current.employeeDefaultPassword;
  const nextHrPassword = body.hrDefaultPassword?.trim() || current.hrDefaultPassword;
  const nextAdminPassword = body.adminDefaultPassword?.trim() || current.adminDefaultPassword;

  if (!nextEmployeePassword || !nextHrPassword || !nextAdminPassword) {
    return NextResponse.json(
      { error: "Each role must have a default password." },
      { status: 400 },
    );
  }

  const invalidRole = ([
    { role: "employee", password: nextEmployeePassword },
    { role: "hr", password: nextHrPassword },
    { role: "admin", password: nextAdminPassword },
  ] as const).find((entry) => !validatePasswordRequirements(entry.password));

  if (invalidRole) {
    return NextResponse.json(
      { error: `${invalidRole.role.toUpperCase()} default password is invalid. ${PASSWORD_REQUIREMENTS_MESSAGE}` },
      { status: 400 },
    );
  }

  const changedRoles = ([
    { role: "employee", changed: nextEmployeePassword !== current.employeeDefaultPassword, nextPassword: nextEmployeePassword, previousVersion: current.employeePasswordVersion },
    { role: "hr", changed: nextHrPassword !== current.hrDefaultPassword, nextPassword: nextHrPassword, previousVersion: current.hrPasswordVersion },
    { role: "admin", changed: nextAdminPassword !== current.adminDefaultPassword, nextPassword: nextAdminPassword, previousVersion: current.adminPasswordVersion },
  ] as const).filter((entry) => entry.changed);

  let updated: SystemSettingsRow;

  try {
    updated = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SystemSettingsRow[]>`
        UPDATE "SystemSettings"
        SET
          "organizationName" = ${body.organizationName.trim()},
          "campusAddress" = ${body.campusAddress.trim()},
          "campusLandmark" = ${body.campusLandmark?.trim() ?? ""},
          "campusPlaceId" = ${body.campusPlaceId?.trim() ?? ""},
          "contactNumber" = ${body.contactNumber.trim()},
          "hrEmail" = ${body.hrEmail.trim()},
          "academicYear" = ${normalizeAcademicYear(body.academicYear)},
          "currentSemester" = ${body.currentSemester.trim()},
          "gracePeriod" = ${toInt(body.gracePeriod, 10)},
          "tardinessThreshold" = ${toInt(body.tardinessThreshold, 5)},
          "holidayReminderLead" = ${toInt(body.holidayReminderLead, 7)},
          "vacationLeaveDays" = ${toInt(body.vacationLeaveDays, 10)},
          "sickLeaveDays" = ${toInt(body.sickLeaveDays, 8)},
          "incentiveLeaveDays" = ${toInt(body.incentiveLeaveDays, 3)},
          "soloParentLeaveDays" = ${toInt(body.soloParentLeaveDays, 7)},
          "paternityLeaveDays" = ${toInt(body.paternityLeaveDays, 0)},
          "maternityLeaveDays" = ${toInt(body.maternityLeaveDays, 60)},
          "leaveWithoutPayDays" = ${toInt(body.leaveWithoutPayDays, 0)},
          "employeeDefaultPassword" = ${nextEmployeePassword},
          "hrDefaultPassword" = ${nextHrPassword},
          "adminDefaultPassword" = ${nextAdminPassword},
          "employeePasswordVersion" = ${getNextVersion(current.employeePasswordVersion, nextEmployeePassword !== current.employeeDefaultPassword)},
          "hrPasswordVersion" = ${getNextVersion(current.hrPasswordVersion, nextHrPassword !== current.hrDefaultPassword)},
          "adminPasswordVersion" = ${getNextVersion(current.adminPasswordVersion, nextAdminPassword !== current.adminDefaultPassword)},
          "updatedAt" = NOW()
        WHERE "id" = 'default'
        RETURNING
          "organizationName",
          "campusAddress",
          "campusLandmark",
          "campusPlaceId",
          "contactNumber",
          "hrEmail",
          "academicYear",
          "currentSemester",
          "gracePeriod",
          "tardinessThreshold",
          "holidayReminderLead",
          "vacationLeaveDays",
          "sickLeaveDays",
          "incentiveLeaveDays",
          "soloParentLeaveDays",
          "paternityLeaveDays",
          "maternityLeaveDays",
          "leaveWithoutPayDays",
          "employeeDefaultPassword",
          "hrDefaultPassword",
          "adminDefaultPassword",
          "employeePasswordVersion",
          "hrPasswordVersion",
          "adminPasswordVersion",
          "updatedAt"
      `;

      if (!rows[0]) {
        throw new Error("Unable to save settings.");
      }

      for (const change of changedRoles) {
        const nextVersion = rows[0][getPasswordVersionFieldForRole(change.role)] as number;
        const managedUsers = await tx.user.findMany({
          where: {
            passwordSource: "role_default",
            passwordRole: change.role,
            passwordVersion: change.previousVersion,
          },
          select: {
            id: true,
            authUserId: true,
            email: true,
            name: true,
            role: true,
          },
        });

        for (const user of managedUsers) {
          const authUser = await ensureAuthUserWithPassword(tx, {
            authUserId: user.authUserId,
            email: user.email,
            password: change.nextPassword,
            name: user.name ?? user.email,
            role: user.role as Role,
          });

          await tx.user.update({
            where: { id: user.id },
            data: {
              authUserId: authUser.id,
              passwordSource: "role_default",
              passwordRole: change.role,
              passwordVersion: nextVersion,
            },
          });
        }
      }

      return rows[0];
    });
  } catch (error) {
    if (isMissingColumnError(error, "employeeDefaultPassword")) {
      return NextResponse.json(
        { error: "Password defaults are not available yet. Run the Prisma migration first." },
        { status: 503 },
      );
    }

    throw error;
  }

  await logAuditEvent({
    user: auth.user.name,
    action: "Update Settings",
    category: "System",
    detail: changedRoles.length > 0
      ? `System settings updated and rotated default passwords for ${changedRoles.map((entry) => entry.role).join(", ")}`
      : "System settings were updated",
  });

  return NextResponse.json({
    settings: toSettingsResponse(updated),
    health: await getSystemSettingsHealth(),
  });
}
