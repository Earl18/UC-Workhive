import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const APPLICANT_TEMPLATE_KEY = "uc-application-form" as const;
export const APPLICANT_TEMPLATE_LABEL = "UC Application Form";

export type ApplicantTemplateRecord = {
  key: typeof APPLICANT_TEMPLATE_KEY;
  label: string;
  fileName?: string;
  storageBucket?: string;
  storagePath?: string;
  updatedAt?: string;
};

type ApplicantTemplateRow = {
  key: string;
  label: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  updatedAt: Date;
};

const APPLICANT_TEMPLATE_TABLE = "ApplicantTemplateSetting";
let applicantTemplateTableCache: { checkedAt: number; available: boolean } | null = null;
const TABLE_CACHE_TTL_MS = 30_000;

export function buildDefaultApplicantTemplate(): ApplicantTemplateRecord {
  return {
    key: APPLICANT_TEMPLATE_KEY,
    label: APPLICANT_TEMPLATE_LABEL,
    fileName: "",
    storageBucket: "",
    storagePath: "",
  };
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

async function hasApplicantTemplateTable() {
  if (applicantTemplateTableCache && Date.now() - applicantTemplateTableCache.checkedAt < TABLE_CACHE_TTL_MS) {
    return applicantTemplateTableCache.available;
  }

  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS present`,
      APPLICANT_TEMPLATE_TABLE,
    )) as Array<{ present: boolean }>;

    const available = Boolean(rows[0]?.present);
    applicantTemplateTableCache = { checkedAt: Date.now(), available };
    return available;
  } catch {
    applicantTemplateTableCache = { checkedAt: Date.now(), available: false };
    return false;
  }
}

function mapRow(row: ApplicantTemplateRow | null | undefined): ApplicantTemplateRecord {
  if (!row) {
    return buildDefaultApplicantTemplate();
  }

  return {
    key: APPLICANT_TEMPLATE_KEY,
    label: row.label?.trim() || APPLICANT_TEMPLATE_LABEL,
    fileName: row.fileName?.trim() || "",
    storageBucket: row.storageBucket?.trim() || "",
    storagePath: row.storagePath?.trim() || "",
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export async function getApplicantTemplateSetting(): Promise<ApplicantTemplateRecord> {
  if (!(await hasApplicantTemplateTable())) {
    return buildDefaultApplicantTemplate();
  }

  try {
    const rows = await db.$queryRaw<ApplicantTemplateRow[]>`
      SELECT "key", "label", "fileName", "storageBucket", "storagePath", "updatedAt"
      FROM "ApplicantTemplateSetting"
      WHERE "key" = ${APPLICANT_TEMPLATE_KEY}
      LIMIT 1
    `;

    return mapRow(rows[0]);
  } catch (error) {
    if (isMissingTableError(error)) {
      applicantTemplateTableCache = { checkedAt: Date.now(), available: false };
      return buildDefaultApplicantTemplate();
    }

    throw error;
  }
}

export async function saveApplicantTemplateSetting(input: {
  fileName: string;
  storageBucket: string;
  storagePath: string;
}) {
  if (!(await hasApplicantTemplateTable())) {
    throw new Error("Applicant template settings table is not available yet. Run the latest Prisma migration first.");
  }

  const rows = await db.$queryRaw<ApplicantTemplateRow[]>`
    INSERT INTO "ApplicantTemplateSetting" (
      "key",
      "label",
      "fileName",
      "storageBucket",
      "storagePath",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${APPLICANT_TEMPLATE_KEY},
      ${APPLICANT_TEMPLATE_LABEL},
      ${input.fileName.trim()},
      ${input.storageBucket.trim()},
      ${input.storagePath.trim()},
      NOW(),
      NOW()
    )
    ON CONFLICT ("key")
    DO UPDATE SET
      "label" = EXCLUDED."label",
      "fileName" = EXCLUDED."fileName",
      "storageBucket" = EXCLUDED."storageBucket",
      "storagePath" = EXCLUDED."storagePath",
      "updatedAt" = NOW()
    RETURNING "key", "label", "fileName", "storageBucket", "storagePath", "updatedAt"
  `;

  applicantTemplateTableCache = { checkedAt: Date.now(), available: true };
  return mapRow(rows[0]);
}
