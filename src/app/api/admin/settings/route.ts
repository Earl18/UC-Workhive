import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getSystemSettings, getSystemSettingsHealth, logAuditEvent } from "@/lib/admin-data";
import { normalizeAcademicYear } from "@/lib/system-settings";

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
  updatedAt: Date;
};

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
    updatedAt: row.updatedAt.toISOString(),
  };
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
  };

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
        "updatedAt"
      FROM "SystemSettings"
      WHERE "id" = 'default'
      LIMIT 1
    `;

    if (!rows[0]) {
      throw new Error("Unable to load current settings.");
    }

  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json(
        { error: "System settings table is not available yet. Run the Prisma migration first." },
        { status: 503 },
      );
    }

    throw error;
  }

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
          "updatedAt"
      `;

      if (!rows[0]) {
        throw new Error("Unable to save settings.");
      }

      return rows[0];
    });
  } catch (error) {
    throw error;
  }

  await logAuditEvent({
    user: auth.user.name,
    action: "Update Settings",
    category: "System",
    detail: "System settings were updated",
  });

  return NextResponse.json({
    settings: toSettingsResponse(updated),
    health: await getSystemSettingsHealth(),
  });
}
