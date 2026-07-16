import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { invalidateAttendanceMetadataCache } from "@/lib/attendance-data";
import type { AuthenticatedPortalUser } from "@/lib/auth";
import { normalizeEmail, isAllowedEmail } from "@/lib/auth";
import { createAuthUsersWithPassword, ensureAuthUserWithPassword, findAuthUsersByEmails, syncAuthUserProfile } from "@/lib/auth-admin";
import { getDefaultPasswordForRole, validatePasswordRequirements } from "@/lib/role-default-passwords";
import type { DocumentRecord, EducationTier, Employee, EmploymentStatus, Gender, Role, StaffCategory } from "@/lib/types";
import type { ImportedEmployeeDraft } from "@/lib/hr-import";

const POSITION_FILTER_INPUT = [
  "Life Coach",
  "Psychometrician",
  "OIC-Dean",
  "Utility Staff",
  "Record's in Charge",
  "POD Officer",
  "Payroll Officer (eff. Nov 2020)",
  "OIC-Guidancce Head (eff. Jan 23, 2024)",
  "Dean",
  "Utility Staff",
  "JHS Coordinator",
  "HR Associate",
  "Principal",
  "MIS Staff",
  "Dean",
  "MIS Staff",
  "HR Assistant",
  "Quality Assurance Officer",
  "SHS Coordinator",
  "Maintenance Staff",
  "Executive Secretary",
  "Campus Chapalin",
  "Assistant Registrar",
  "Skills Laboratory In-Charge",
  "Textbook in charge",
  "Inventory Staff",
  "Cashier",
  "Secretary",
  "OIC-Chief Accountant",
  "Campus Head Librarian",
  "Utility Staff",
  "Librarian for Basic Education",
  "Utility Staff",
  "Registrar in Charge",
  "HR Assistant",
  "Campus Registrar",
  "Scholarship Officer / NSTP Coordinator",
  "Library Staff",
  "SAO Director and Scholarship (Eff. August 2020)",
  "Student Accounting Staff",
  "OIC-Campus Director",
  "EDP/MIS In Charge",
  "School Nurse",
  "Campus Physician",
  "Program Chairperson (eff. Sept 18, 2023)",
  "Student Accounting Staff",
  "BMO Staff",
  "Cashier",
  "Library Staff",
  "IT Support/Laboratory In charge",
  "Payable In Charge (eff. Nov 2020)",
  "Bookkeeper",
  "Utility Staff",
  "Property Custodian and Building Admin ( January 1,2024)",
  "School Nurse",
  "OIC Dean ( Oct. 5, 2023)",
  "Dentist",
] as const;

export type EmployeeRecordRow = {
  id: string;
  idNumber: string | null;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  department: string;
  position: string;
  accountRole: Role | null;
  staffCategory: string | null;
  dateHired: string;
  birthDate: string | null;
  employmentStatus: string;
  email: string;
  address: string;
  contactNumber: string;
  avatarColor: string | null;
  education: Prisma.JsonValue;
  documents: Prisma.JsonValue;
};

function stripParenthetical(value: string) {
  return value.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function toDisplayNameCase(value: string | null | undefined) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "";
  }

  return text
    .toLowerCase()
    .split(" ")
    .map((part) => part.split("-").map((segment) => segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "").join("-"))
    .join(" ");
}

function normalizeStoredEmployeeName(value: string | null | undefined) {
  return toDisplayNameCase(value);
}

export const MASTER_LIST_POSITION_OPTIONS = Array.from(
  new Set(POSITION_FILTER_INPUT.map(stripParenthetical).filter(Boolean)),
).sort((a, b) => a.localeCompare(b));

const EMPLOYEE_MASTER_METADATA_CACHE_TTL_MS = 60_000;

let employeeMasterDepartmentsCache: { checkedAt: number; value: string[] } | null = null;
let employeeMasterPositionsCache: { checkedAt: number; value: string[] } | null = null;

function clearEmployeeMasterCache() {
  employeeMasterDepartmentsCache = null;
  employeeMasterPositionsCache = null;
  invalidateAttendanceMetadataCache();
}

function toJsonValue<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  return value as T;
}

function colorFromEmail(email: string) {
  const palette = ["#1e3a8a", "#1d4ed8", "#0e7490", "#0f766e", "#b45309", "#5b21b6", "#be123c"];
  let hash = 0;
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

function inferAccountRoleFromDepartment(department: string | null | undefined): Extract<Role, "employee" | "hr"> {
  const normalized = (department ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) {
    return "employee";
  }

  return /(^|\s)(hr|hrd)(\s|$)|human resource/.test(normalized) ? "hr" : "employee";
}


function normalizeEmployeeIdNumber(value: string | null | undefined) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text || null;
}

async function ensureEmployeeRecordIdNumbers(_client: Prisma.TransactionClient | typeof db) {
  return;
}

function toEmployeeRecord(record: EmployeeRecordRow): Employee & { birthDate?: string } {
  return {
    id: record.id,
    idNumber: normalizeEmployeeIdNumber(record.idNumber) ?? undefined,
    lastName: normalizeStoredEmployeeName(record.lastName),
    firstName: normalizeStoredEmployeeName(record.firstName),
    middleName: normalizeStoredEmployeeName(record.middleName),
    gender: (record.gender === "Male" ? "Male" : "Female") as Gender,
    department: record.department,
    position: record.position,
    accountRole: record.accountRole === "hr" ? "hr" : "employee",
    staffCategory: (record.staffCategory as StaffCategory | null) ?? undefined,
    dateHired: record.dateHired,
    employmentStatus: (record.employmentStatus as EmploymentStatus) ?? "Regular",
    email: record.email,
    address: record.address,
    contactNumber: record.contactNumber,
    avatarColor: record.avatarColor ?? undefined,
    education: toJsonValue<EducationTier[]>(record.education, []),
    documents: toJsonValue<DocumentRecord[]>(record.documents, []),
    birthDate: record.birthDate ?? undefined,
  };
}

async function fetchEmployeeRows() {
  return (await db.$queryRawUnsafe(
    `SELECT
      "id",
      "idNumber",
      "lastName",
      "firstName",
      "middleName",
      "gender",
      "department",
      "position",
      "accountRole",
      "staffCategory",
      "dateHired",
      "birthDate",
      "employmentStatus",
      "email",
      "address",
      "contactNumber",
      "avatarColor",
      "education",
      "documents"
     FROM "EmployeeRecord"
     ORDER BY "lastName" ASC, "firstName" ASC, "middleName" ASC`,
  )) as EmployeeRecordRow[];
}

export async function getEmployeeMasterList() {
  
  const records = await fetchEmployeeRows();
  const employees = records.map(toEmployeeRecord);
  const departments = Array.from(new Set(records.map((record) => record.department).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  const dbPositions = Array.from(new Set(records.map((record) => stripParenthetical(record.position)).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
  const positions = Array.from(new Set([...MASTER_LIST_POSITION_OPTIONS, ...dbPositions]));

  return {
    employees,
    departments,
    positions,
  };
}

export type EmployeeMasterListPageFilters = {
  search?: string;
  status?: string;
  department?: string;
  position?: string;
  gender?: string;
  age?: "all" | "under-25" | "25-34" | "35-44" | "45-54" | "55-plus";
  educationLevel?: "all" | "Bachelor" | "Master" | "Doctoral";
  sortKey?: "idNumber" | "lastName" | "firstName" | "department" | "position" | "dateHired" | "employmentStatus" | "age";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function normalizeMasterListPage(page?: number) {
  return Number.isFinite(page) && Number(page) > 0 ? Math.floor(Number(page)) : 1;
}

function normalizeMasterListPageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize)) {
    return 50;
  }

  return Math.min(200, Math.max(25, Math.floor(Number(pageSize))));
}

function combineEmployeeConditions(conditions: Prisma.Sql[]) {
  if (conditions.length === 0) {
    return Prisma.sql`TRUE`;
  }

  let combined = conditions[0];
  for (let index = 1; index < conditions.length; index += 1) {
    combined = Prisma.sql`${combined} AND ${conditions[index]}`;
  }
  return combined;
}

function buildEmployeeMasterWhere(filters: EmployeeMasterListPageFilters) {
  const conditions = [];
  const search = (filters.search ?? "").trim();

  if (search) {
    const like = `%${search}%`;
    conditions.push(Prisma.sql`concat_ws(' ', COALESCE("idNumber", ''), "lastName", "firstName", "middleName", "department", "position", "email") ILIKE ${like}`);
  }

  if (filters.status && filters.status !== "All") {
    conditions.push(Prisma.sql`"employmentStatus" = ${filters.status}`);
  }
  if (filters.department && filters.department !== "All") {
    conditions.push(Prisma.sql`"department" = ${filters.department}`);
  }
  if (filters.position && filters.position !== "All") {
    conditions.push(Prisma.sql`regexp_replace("position", '\\s*\\([^)]*\\)', '', 'g') = ${filters.position}`);
  }
  if (filters.gender && filters.gender !== "All") {
    conditions.push(Prisma.sql`"gender" = ${filters.gender}`);
  }
  if (filters.educationLevel && filters.educationLevel !== "all") {
    conditions.push(Prisma.sql`COALESCE((
      SELECT MAX(
        CASE education_item.value ->> 'level'
          WHEN 'Bachelor' THEN 1
          WHEN 'Master' THEN 2
          WHEN 'Doctoral' THEN 3
          ELSE 0
        END
      )
      FROM jsonb_array_elements(COALESCE("education", '[]'::jsonb)) AS education_item(value)
      WHERE COALESCE(NULLIF(BTRIM(education_item.value ->> 'degree'), ''), NULL) IS NOT NULL
    ), 0) = ${filters.educationLevel === "Bachelor" ? 1 : filters.educationLevel === "Master" ? 2 : 3}`);
  }

  switch (filters.age ?? "all") {
    case "under-25":
      conditions.push(Prisma.sql`"birthDate" IS NOT NULL AND "birthDate"::date > (CURRENT_DATE - INTERVAL '25 years')`);
      break;
    case "25-34":
      conditions.push(Prisma.sql`"birthDate" IS NOT NULL AND "birthDate"::date <= (CURRENT_DATE - INTERVAL '25 years') AND "birthDate"::date > (CURRENT_DATE - INTERVAL '35 years')`);
      break;
    case "35-44":
      conditions.push(Prisma.sql`"birthDate" IS NOT NULL AND "birthDate"::date <= (CURRENT_DATE - INTERVAL '35 years') AND "birthDate"::date > (CURRENT_DATE - INTERVAL '45 years')`);
      break;
    case "45-54":
      conditions.push(Prisma.sql`"birthDate" IS NOT NULL AND "birthDate"::date <= (CURRENT_DATE - INTERVAL '45 years') AND "birthDate"::date > (CURRENT_DATE - INTERVAL '55 years')`);
      break;
    case "55-plus":
      conditions.push(Prisma.sql`"birthDate" IS NOT NULL AND "birthDate"::date <= (CURRENT_DATE - INTERVAL '55 years')`);
      break;
    default:
      break;
  }

  return combineEmployeeConditions(conditions);
}

function buildEmployeeMasterOrder(sortKey: EmployeeMasterListPageFilters["sortKey"], sortDir: EmployeeMasterListPageFilters["sortDir"]) {
  const direction = sortDir === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  switch (sortKey) {
    case "lastName":
      return Prisma.sql`"lastName" ${direction}, "firstName" ASC`;
    case "firstName":
      return Prisma.sql`"firstName" ${direction}, "lastName" ASC`;
    case "department":
      return Prisma.sql`"department" ${direction}, "lastName" ASC, "firstName" ASC`;
    case "position":
      return Prisma.sql`"position" ${direction}, "lastName" ASC, "firstName" ASC`;
    case "dateHired":
      return Prisma.sql`"dateHired" ${direction}, "idNumber" ASC NULLS LAST`;
    case "employmentStatus":
      return Prisma.sql`"employmentStatus" ${direction}, "lastName" ASC, "firstName" ASC`;
    case "age":
      return Prisma.sql`DATE_PART('year', AGE(CURRENT_DATE, "birthDate"::date)) ${direction} NULLS LAST, "lastName" ASC, "firstName" ASC`;
    case "idNumber":
    default:
      return Prisma.sql`"idNumber" ${direction} NULLS LAST, "lastName" ASC, "firstName" ASC`;
  }
}

type EmployeeRecordPageRow = EmployeeRecordRow & {
  filteredCount: bigint | number;
};

async function fetchEmployeeMasterPageRows(filters: EmployeeMasterListPageFilters) {
  const page = normalizeMasterListPage(filters.page);
  const pageSize = normalizeMasterListPageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;
  const whereClause = buildEmployeeMasterWhere(filters);
  const orderClause = buildEmployeeMasterOrder(filters.sortKey, filters.sortDir);

  const rows = await db.$queryRaw<EmployeeRecordPageRow[]>(Prisma.sql`
    SELECT
      filtered."id",
      filtered."idNumber",
      filtered."lastName",
      filtered."firstName",
      filtered."middleName",
      filtered."gender",
      filtered."department",
      filtered."position",
      filtered."accountRole",
      filtered."staffCategory",
      filtered."dateHired",
      filtered."birthDate",
      filtered."employmentStatus",
      filtered."email",
      filtered."address",
      filtered."contactNumber",
      filtered."avatarColor",
      filtered."education",
      filtered."documents",
      filtered."filteredCount"
    FROM (
      SELECT
        "id",
        "idNumber",
        "lastName",
        "firstName",
        "middleName",
        "gender",
        "department",
        "position",
        "accountRole",
        "staffCategory",
        "dateHired",
        "birthDate",
        "employmentStatus",
        "email",
        "address",
        "contactNumber",
        "avatarColor",
        "education",
        "documents",
        COUNT(*) OVER()::bigint AS "filteredCount"
      FROM "EmployeeRecord"
      WHERE ${whereClause}
    ) AS filtered
    ORDER BY ${orderClause}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  if (rows.length > 0) {
    return {
      rows,
      filteredCount: Number(rows[0]?.filteredCount ?? 0),
    };
  }

  const countRows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "EmployeeRecord"
    WHERE ${whereClause}
  `);

  return {
    rows,
    filteredCount: Number(countRows[0]?.count ?? 0),
  };
}

async function countEmployeeMasterTotal() {
  const rows = await db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "EmployeeRecord"
  `);
  return Number(rows[0]?.count ?? 0);
}

async function fetchEmployeeMasterDepartments() {
  if (employeeMasterDepartmentsCache && Date.now() - employeeMasterDepartmentsCache.checkedAt < EMPLOYEE_MASTER_METADATA_CACHE_TTL_MS) {
    return employeeMasterDepartmentsCache.value;
  }

  const rows = await db.$queryRaw<Array<{ department: string }>>(Prisma.sql`
    SELECT DISTINCT "department" AS "department"
    FROM "EmployeeRecord"
    WHERE "department" IS NOT NULL AND "department" <> ''
    ORDER BY "department" ASC
  `);
  const value = rows.map((row) => row.department);
  employeeMasterDepartmentsCache = { checkedAt: Date.now(), value };
  return value;
}

async function fetchEmployeeMasterPositions() {
  if (employeeMasterPositionsCache && Date.now() - employeeMasterPositionsCache.checkedAt < EMPLOYEE_MASTER_METADATA_CACHE_TTL_MS) {
    return employeeMasterPositionsCache.value;
  }

  const rows = await db.$queryRaw<Array<{ position: string }>>(Prisma.sql`
    SELECT DISTINCT regexp_replace("position", '\\s*\\([^)]*\\)', '', 'g') AS "position"
    FROM "EmployeeRecord"
    WHERE "position" IS NOT NULL AND "position" <> ''
    ORDER BY "position" ASC
  `);
  const dbPositions = rows.map((row) => row.position).filter(Boolean);
  const value = Array.from(new Set([...MASTER_LIST_POSITION_OPTIONS, ...dbPositions]));
  employeeMasterPositionsCache = { checkedAt: Date.now(), value };
  return value;
}

export async function getEmployeeMasterListPage(filters: EmployeeMasterListPageFilters = {}) {
  
  const page = normalizeMasterListPage(filters.page);
  const pageSize = normalizeMasterListPageSize(filters.pageSize);

  const [pageData, totalRecords, departments, positions] = await Promise.all([
    fetchEmployeeMasterPageRows({ ...filters, page, pageSize }),
    countEmployeeMasterTotal(),
    fetchEmployeeMasterDepartments(),
    fetchEmployeeMasterPositions(),
  ]);

  return {
    employees: pageData.rows.map(toEmployeeRecord),
    departments,
    positions,
    pagination: {
      page,
      pageSize,
      filteredRecords: pageData.filteredCount,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(pageData.filteredCount / pageSize)),
    },
  };
}

async function fetchEmployeeMasterExportRows(filters: EmployeeMasterListPageFilters) {
  const whereClause = buildEmployeeMasterWhere(filters);
  const orderClause = buildEmployeeMasterOrder(filters.sortKey, filters.sortDir);

  return await db.$queryRaw<EmployeeRecordRow[]>(Prisma.sql`
    SELECT
      "id",
      "idNumber",
      "lastName",
      "firstName",
      "middleName",
      "gender",
      "department",
      "position",
      "accountRole",
      "staffCategory",
      "dateHired",
      "birthDate",
      "employmentStatus",
      "email",
      "address",
      "contactNumber",
      "avatarColor",
      "education",
      "documents"
    FROM "EmployeeRecord"
    WHERE ${whereClause}
    ORDER BY ${orderClause}
  `);
}

export async function getEmployeeMasterListForExport(filters: EmployeeMasterListPageFilters = {}) {
  
  const records = await fetchEmployeeMasterExportRows(filters);
  return records.map(toEmployeeRecord);
}

export type CreateEmployeeMasterRecordInput = Omit<Employee, "id"> & {
  birthDate?: string;
  accountRole?: "employee" | "hr";
  createAccount?: boolean;
};

export async function getEmployeeMasterRecord(id: string) {
  
  const rows = (await db.$queryRawUnsafe(
    `SELECT
      "id",
      "idNumber",
      "lastName",
      "firstName",
      "middleName",
      "gender",
      "department",
      "position",
      "accountRole",
      "staffCategory",
      "dateHired",
      "birthDate",
      "employmentStatus",
      "email",
      "address",
      "contactNumber",
      "avatarColor",
      "education",
      "documents"
     FROM "EmployeeRecord"
     WHERE "id" = $1
     LIMIT 1`,
    id,
  )) as EmployeeRecordRow[];

  return rows[0] ? toEmployeeRecord(rows[0]) : null;
}


export async function getEmployeeMasterRecordForUser(user: Pick<AuthenticatedPortalUser, "employeeId" | "email">) {
  if (user.employeeId) {
    const byId = await getEmployeeMasterRecord(user.employeeId);
    if (byId) {
      return byId;
    }
  }

  const email = normalizeEmail(user.email);
  const matched = await db.employeeRecord.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!matched) {
    return null;
  }

  return getEmployeeMasterRecord(matched.id);
}

export async function createEmployeeMasterRecord(input: CreateEmployeeMasterRecordInput) {
  const lastName = normalizeStoredEmployeeName(input.lastName);
  const firstName = normalizeStoredEmployeeName(input.firstName);
  const middleName = normalizeStoredEmployeeName(input.middleName);
  const department = input.department.trim();
  const position = stripParenthetical(input.position);
  const dateHired = input.dateHired.trim();
  const email = normalizeEmail(input.email ?? "");
  const address = input.address.trim();
  const contactNumber = input.contactNumber.trim();
  const birthDate = input.birthDate?.trim() || null;
  const education = input.education ?? [];
  const documents = input.documents ?? [];
  const accountRole = input.accountRole === "hr" ? "hr" : input.accountRole === "employee" ? "employee" : inferAccountRoleFromDepartment(department);
  const createAccount = input.createAccount !== false;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || email;

  if (!lastName || !firstName || !department || !position || !dateHired || !email) {
    throw new Error("Last name, first name, department, position, date hired, and email are required.");
  }

  if (createAccount && !isAllowedEmail(email)) {
    throw new Error("Use a valid email address for account creation.");
  }

  const existingEmail = await db.employeeRecord.findUnique({
    where: { email },
    select: { id: true },
  }).catch(() => null);
  if (existingEmail) {
    throw new Error("An employee with that email already exists.");
  }

  const createdId = randomUUID();

  const idNumber = normalizeEmployeeIdNumber(input.idNumber);

  if (idNumber) {
    const existingIdNumber = await db.employeeRecord.findFirst({
      where: { idNumber },
      select: { id: true },
    }).catch(() => null);
    if (existingIdNumber) {
      throw new Error("An employee with that ID number already exists.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.employeeRecord.create({
      data: {
        id: createdId,
        idNumber,
        lastName,
        firstName,
        middleName,
        gender: input.gender,
        department,
        position,
        accountRole,
        staffCategory: input.staffCategory ?? "Non-Teaching",
        dateHired,
        birthDate,
        employmentStatus: input.employmentStatus,
        email,
        address,
        contactNumber,
        avatarColor: input.avatarColor ?? colorFromEmail(email),
        education: education as Prisma.InputJsonValue,
        documents: documents as Prisma.InputJsonValue,
      },
    });

    if (!createAccount) {
      return;
    }

    const settings = await tx.systemSettings.findUnique({
      where: { id: "default" },
      select: {
        employeeDefaultPassword: true,
        hrDefaultPassword: true,
        adminDefaultPassword: true,
        employeePasswordVersion: true,
        hrPasswordVersion: true,
      },
    });

    const defaultPassword = getDefaultPasswordForRole(
      {
        employeeDefaultPassword: settings?.employeeDefaultPassword ?? "Employee@123",
        hrDefaultPassword: settings?.hrDefaultPassword ?? "HR@123",
        adminDefaultPassword: settings?.adminDefaultPassword ?? "Admin@123",
      },
      accountRole,
    );

    if (!validatePasswordRequirements(defaultPassword)) {
      throw new Error("The default password for this account role is invalid in System Settings.");
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error("A website account with that email already exists.");
    }

    const authUser = await ensureAuthUserWithPassword(tx, {
      email,
      password: defaultPassword,
      name: fullName,
      role: accountRole,
    });

    await tx.user.create({
      data: {
        authUserId: authUser.id,
        name: fullName,
        email,
        role: accountRole,
        employeeId: createdId,
        department,
        active: true,
        passwordSource: "role_default",
        passwordRole: accountRole,
        passwordVersion: accountRole === "hr" ? settings?.hrPasswordVersion ?? 1 : settings?.employeePasswordVersion ?? 1,
      },
    });
  });

  clearEmployeeMasterCache();
  const createdEmployee = await getEmployeeMasterRecord(createdId);
  if (!createdEmployee) {
    throw new Error("Employee record was created, but it could not be loaded afterward.");
  }
  return createdEmployee;
}

export async function updateEmployeeMasterRecord(
  id: string,
  input: Partial<Employee & { birthDate?: string }>,
) {
  const existing = await getEmployeeMasterRecord(id);
  if (!existing) {
    throw new Error("Employee not found.");
  }

  const nextIdNumber = input.idNumber !== undefined ? normalizeEmployeeIdNumber(input.idNumber) : normalizeEmployeeIdNumber(existing.idNumber);
  const nextLastName = input.lastName != null ? normalizeStoredEmployeeName(input.lastName) : existing.lastName;
  const nextFirstName = input.firstName != null ? normalizeStoredEmployeeName(input.firstName) : existing.firstName;
  const nextMiddleName = input.middleName != null ? normalizeStoredEmployeeName(input.middleName) : existing.middleName;
  const nextGender = input.gender ?? existing.gender;
  const nextDepartment = input.department ?? existing.department;
  const nextPosition = stripParenthetical(input.position ?? existing.position);
  const nextStaffCategory = input.staffCategory ?? existing.staffCategory ?? null;
  const nextDateHired = input.dateHired ?? existing.dateHired;
  const nextBirthDate = input.birthDate ?? existing.birthDate ?? null;
  const nextEmploymentStatus = input.employmentStatus ?? existing.employmentStatus;
  const nextEmail = input.email ?? existing.email;
  const nextAddress = input.address ?? existing.address;
  const nextContactNumber = input.contactNumber ?? existing.contactNumber;
  const nextAvatarColor = input.avatarColor ?? existing.avatarColor ?? null;
  const nextEducation = input.education ?? existing.education;
  const nextDocuments = input.documents ?? existing.documents;
  const nextFullName = [nextFirstName, nextMiddleName, nextLastName].filter(Boolean).join(" ");

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "EmployeeRecord"
       SET
        "idNumber" = $2,
        "lastName" = $3,
        "firstName" = $4,
        "middleName" = $5,
        "gender" = $6,
        "department" = $7,
        "position" = $8,
        "staffCategory" = $9,
        "dateHired" = $10,
        "birthDate" = $11,
        "employmentStatus" = $12,
        "email" = $13,
        "address" = $14,
        "contactNumber" = $15,
        "avatarColor" = $16,
        "education" = $17::jsonb,
        "documents" = $18::jsonb,
        "updatedAt" = NOW()
       WHERE "id" = $1`,
      id,
      nextIdNumber,
      nextLastName,
      nextFirstName,
      nextMiddleName,
      nextGender,
      nextDepartment,
      nextPosition,
      nextStaffCategory,
      nextDateHired,
      nextBirthDate,
      nextEmploymentStatus,
      nextEmail,
      nextAddress,
      nextContactNumber,
      nextAvatarColor,
      JSON.stringify(nextEducation),
      JSON.stringify(nextDocuments),
    );

    const linkedUser = await tx.user.findFirst({
      where: { employeeId: id },
      select: { id: true, authUserId: true, role: true },
    });

    if (linkedUser) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: {
          name: nextFullName || null,
          email: nextEmail,
          department: nextDepartment,
        },
      });

      await syncAuthUserProfile(tx, {
        authUserId: linkedUser.authUserId ?? undefined,
        email: nextEmail,
        name: nextFullName || nextEmail,
        role: linkedUser.role,
      });
    }
  });

  clearEmployeeMasterCache();
  return getEmployeeMasterRecord(id);
}

const EMPLOYEE_IMPORT_CHUNK_SIZE = 500;
const EMPLOYEE_ACCOUNT_PROVISION_CHUNK_SIZE = 250;

function chunkRecords<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type NormalizedImportedEmployeeRecord = ImportedEmployeeDraft & {
  email: string;
  position: string;
  avatarColor: string;
  education: EducationTier[];
  documents: DocumentRecord[];
  fullNameKey: string;
  firstLastNameKey: string;
  fullNameLabel: string;
  comparisonKey: string;
};

type ExistingEmployeeImportMatch = {
  id: string;
  idNumber: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  department: string;
  position: string;
  accountRole: Role | null;
  staffCategory: string | null;
  dateHired: string;
  birthDate: string | null;
  employmentStatus: string;
  address: string;
  contactNumber: string;
  avatarColor: string | null;
  education: EducationTier[];
  documents: DocumentRecord[];
  fullNameKey: string;
  fullNameLabel: string;
  comparisonKey: string;
};

type DuplicateConflictLabel = "ID Number Already Used" | "Employee Already Has Different ID Number";

type DuplicateMatchRow = {
  imported: {
    idNumber: string;
    fullName: string;
    email: string;
    department: string;
    position: string;
    accountRole: Role | null;
    dateHired: string;
    employmentStatus: string;
  };
  existing: {
    id: string;
    idNumber: string | null;
    fullName: string;
    email: string;
    department: string;
    position: string;
    dateHired: string;
    employmentStatus: string;
  };
  matchedBy: "ID Number" | "Email" | "Full Name" | "First + Last Name" | "ID Number + Name" | "Email + Full Name" | "ID Number Conflict";
  conflictLabel?: DuplicateConflictLabel;
};

type DuplicateSummary = {
  duplicateFileIdNumbers: string[];
  duplicateFileEmails: string[];
  duplicateFileFullNames: string[];
  existingDbIdNumbers: string[];
  existingDbEmails: string[];
  existingDbFullNames: string[];
  existingDbIdNumberConflicts: string[];
  existingDbEmployeeIdConflicts: string[];
  uniqueRecordCount: number;
  matchedDbRecordCount: number;
  matchRows: DuplicateMatchRow[];
};

function normalizeNamePart(value: string | null | undefined) {
  const text = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return text;
}

function firstLastNameKeyFromParts(lastName: string | null | undefined, firstName: string | null | undefined) {
  return [normalizeNamePart(lastName), normalizeNamePart(firstName)].join("|");
}

function fullNameKeyFromParts(lastName: string | null | undefined, firstName: string | null | undefined, middleName: string | null | undefined) {
  return [normalizeNamePart(lastName), normalizeNamePart(firstName), normalizeNamePart(middleName)].join("|");
}

function fullNameLabelFromParts(lastName: string | null | undefined, firstName: string | null | undefined, middleName: string | null | undefined) {
  const name = [firstName?.trim(), middleName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  return name || "Unnamed employee";
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeComparableDate(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) {
    return "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeComparablePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

function importedEmployeeIdentityKey(record: Pick<ImportedEmployeeDraft, "idNumber" | "email" | "lastName" | "firstName" | "middleName">, fallbackIndex: number) {
  const idNumber = normalizeEmployeeIdNumber(record.idNumber);
  if (idNumber) {
    return `id:${idNumber.toLowerCase()}`;
  }

  const email = record.email.trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const fullNameKey = fullNameKeyFromParts(record.lastName, record.firstName, record.middleName);
  if (fullNameKey.replace(/\|/g, "").trim()) {
    return `name:${fullNameKey}`;
  }

  return `row:${fallbackIndex}`;
}

function buildEmployeeImportComparisonKey(input: {
  idNumber: string | null | undefined;
  lastName: string | null | undefined;
  firstName: string | null | undefined;
  middleName: string | null | undefined;
  gender: string | null | undefined;
  department: string | null | undefined;
  position: string | null | undefined;
  accountRole: string | null | undefined;
  staffCategory: string | null | undefined;
  dateHired: string | null | undefined;
  birthDate: string | null | undefined;
  employmentStatus: string | null | undefined;
  email: string | null | undefined;
  address: string | null | undefined;
  contactNumber: string | null | undefined;
  avatarColor: string | null | undefined;
  education: EducationTier[] | null | undefined;
  documents: DocumentRecord[] | null | undefined;
}) {
  return [
    normalizeComparableText(input.idNumber),
    normalizeComparableText(input.lastName),
    normalizeComparableText(input.firstName),
    normalizeComparableText(input.middleName),
    normalizeComparableText(input.gender),
    normalizeComparableText(input.department),
    normalizeComparableText(input.position),
    normalizeComparableText(input.accountRole),
    normalizeComparableText(input.staffCategory),
    normalizeComparableDate(input.dateHired),
    normalizeComparableDate(input.birthDate),
    normalizeComparableText(input.employmentStatus),
    (input.email ?? '').trim().toLowerCase(),
    normalizeComparableText(input.address),
    normalizeComparablePhone(input.contactNumber),
    normalizeComparableText(input.avatarColor),
    JSON.stringify(input.education ?? []),
    JSON.stringify(input.documents ?? []),
  ].join('||');
}

function hasImportedEmployeeChanges(record: NormalizedImportedEmployeeRecord, existing: ExistingEmployeeImportMatch) {
  return record.comparisonKey !== existing.comparisonKey;
}

function normalizeImportedEmployeeRecords(records: ImportedEmployeeDraft[]) {
  const deduped = new Map<string, NormalizedImportedEmployeeRecord>();

  records.forEach((record, index) => {
    const email = record.email.trim().toLowerCase();
    const idNumber = normalizeEmployeeIdNumber(record.idNumber) ?? "";
    const lastName = normalizeStoredEmployeeName(record.lastName);
    const firstName = normalizeStoredEmployeeName(record.firstName);
    const middleName = normalizeStoredEmployeeName(record.middleName);
    const fullNameKey = fullNameKeyFromParts(lastName, firstName, middleName);
    const fullNameLabel = fullNameLabelFromParts(lastName, firstName, middleName);

    const normalizedRecord = {
      ...record,
      importRowNumber: record.importRowNumber ?? index + 1,
      idNumber,
      lastName,
      firstName,
      middleName,
      email,
      department: record.department.trim(),
      position: stripParenthetical(record.position),
      accountRole: inferAccountRoleFromDepartment(record.department),
      avatarColor: record.avatarColor ?? colorFromEmail(email || `${fullNameKey}|${index}`),
      education: record.education ?? [],
      documents: record.documents ?? [],
      fullNameKey,
      firstLastNameKey: firstLastNameKeyFromParts(lastName, firstName),
      fullNameLabel,
      comparisonKey: "",
    } satisfies NormalizedImportedEmployeeRecord;

    normalizedRecord.comparisonKey = buildEmployeeImportComparisonKey(normalizedRecord);
    deduped.set(importedEmployeeIdentityKey(record, index + 1), normalizedRecord);
  });

  return Array.from(deduped.values());
}

async function fetchExistingEmployeeImportMatches(records: NormalizedImportedEmployeeRecord[]) {
  const idNumbers = Array.from(new Set(records.map((record) => normalizeEmployeeIdNumber(record.idNumber)).filter(Boolean))) as string[];
  const emails = Array.from(new Set(records.map((record) => record.email).filter(Boolean)));
  const hasNameKeys = records.some((record) => Boolean(record.fullNameKey.replace(/\|/g, "").trim()) || Boolean(record.firstLastNameKey.replace(/\|/g, "").trim()));

  if (idNumbers.length === 0 && emails.length === 0 && !hasNameKeys) {
    return [] as ExistingEmployeeImportMatch[];
  }

  const idNumberCondition = idNumbers.length > 0 ? Prisma.sql`"idNumber" IN (${Prisma.join(idNumbers)})` : Prisma.sql`FALSE`;
  const emailCondition = emails.length > 0 ? Prisma.sql`"email" IN (${Prisma.join(emails)})` : Prisma.sql`FALSE`;
  const whereCondition = hasNameKeys
    ? Prisma.sql`TRUE`
    : Prisma.sql`${idNumberCondition} OR ${emailCondition}`;

  const rows = await db.$queryRaw<Array<{
    id: string;
    idNumber: string | null;
    email: string;
    lastName: string;
    firstName: string;
    middleName: string;
    gender: string;
    department: string;
    position: string;
    accountRole: Role | null;
    staffCategory: string | null;
    dateHired: string;
    birthDate: string | null;
    employmentStatus: string;
    address: string;
    contactNumber: string;
    avatarColor: string | null;
    education: Prisma.JsonValue;
    documents: Prisma.JsonValue;
  }>>(Prisma.sql`
    SELECT "id", "idNumber", "email", "lastName", "firstName", "middleName", "gender", "department", "position", "accountRole", "staffCategory", "dateHired", "birthDate", "employmentStatus", "address", "contactNumber", "avatarColor", "education", "documents"
    FROM "EmployeeRecord"
    WHERE ${whereCondition}
  `);

  return rows.map((row) => {
    const match = {
      ...row,
      idNumber: normalizeEmployeeIdNumber(row.idNumber),
      education: toJsonValue<EducationTier[]>(row.education, []),
      documents: toJsonValue<DocumentRecord[]>(row.documents, []),
      fullNameKey: fullNameKeyFromParts(row.lastName, row.firstName, row.middleName),
      firstLastNameKey: firstLastNameKeyFromParts(row.lastName, row.firstName),
      fullNameLabel: fullNameLabelFromParts(row.lastName, row.firstName, row.middleName),
      comparisonKey: '',
    } satisfies ExistingEmployeeImportMatch;

    match.comparisonKey = buildEmployeeImportComparisonKey(match);
    return match;
  });
}

function getUniqueFirstLastMatch(existingByFirstLastName: Map<string, ExistingEmployeeImportMatch[]>, key: string) {
  const matches = existingByFirstLastName.get(key) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}

function collectDuplicateValues<T>(items: T[], keySelector: (item: T) => string, labelSelector: (item: T) => string) {
  const counts = new Map<string, { count: number; label: string }>();

  for (const item of items) {
    const key = keySelector(item);
    if (!key) {
      continue;
    }
    const current = counts.get(key);
    counts.set(key, {
      count: (current?.count ?? 0) + 1,
      label: current?.label ?? labelSelector(item),
    });
  }

  return Array.from(counts.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.label)
    .sort((a, b) => a.localeCompare(b));
}

export async function getEmployeeImportDuplicateSummary(records: ImportedEmployeeDraft[], workbookType: "employee-information" | "id-number" = "employee-information"): Promise<DuplicateSummary> {
  const normalizedRecords = normalizeImportedEmployeeRecords(records);
  const duplicateFileIdNumbers = collectDuplicateValues(records, (record) => normalizeEmployeeIdNumber(record.idNumber) ?? "", (record) => normalizeEmployeeIdNumber(record.idNumber) ?? "");
  const duplicateFileEmails = collectDuplicateValues(records, (record) => record.email.trim().toLowerCase(), (record) => record.email.trim().toLowerCase());
  const duplicateFileFullNames = collectDuplicateValues(
    records,
    (record) => fullNameKeyFromParts(record.lastName, record.firstName, record.middleName),
    (record) => fullNameLabelFromParts(record.lastName, record.firstName, record.middleName),
  );

  if (normalizedRecords.length === 0) {
    return {
      duplicateFileIdNumbers,
      duplicateFileEmails: workbookType === "id-number" ? [] : duplicateFileEmails,
      duplicateFileFullNames: workbookType === "id-number" ? [] : duplicateFileFullNames,
      existingDbIdNumbers: [],
      existingDbEmails: [],
      existingDbFullNames: [],
      existingDbIdNumberConflicts: [],
      existingDbEmployeeIdConflicts: [],
      uniqueRecordCount: 0,
      matchedDbRecordCount: 0,
      matchRows: [],
    };
  }

  const existingMatches = await fetchExistingEmployeeImportMatches(normalizedRecords);
  const existingByIdNumber = new Map(existingMatches.filter((match) => match.idNumber).map((match) => [match.idNumber!.toLowerCase(), match]));
  const existingByEmail = new Map(existingMatches.filter((match) => match.email).map((match) => [match.email.toLowerCase(), match]));
  const existingByFullName = new Map(existingMatches.map((match) => [match.fullNameKey, match]));
  const existingByFirstLastName = new Map<string, ExistingEmployeeImportMatch[]>();
  for (const match of existingMatches) {
    const current = existingByFirstLastName.get(match.firstLastNameKey) ?? [];
    current.push(match);
    existingByFirstLastName.set(match.firstLastNameKey, current);
  }

  if (workbookType === "id-number") {
    const existingDbIdNumberConflicts = new Set<string>();
    const existingDbEmployeeIdConflicts = new Set<string>();

    const matchRows = normalizedRecords.flatMap((record) => {
      const importedIdNumber = normalizeEmployeeIdNumber(record.idNumber);
      if (!importedIdNumber) {
        return [];
      }

      const targetMatch = existingByFullName.get(record.fullNameKey)
        ?? getUniqueFirstLastMatch(existingByFirstLastName, record.firstLastNameKey);

      if (!targetMatch) {
        return [];
      }

      const importedIdOwner = existingByIdNumber.get(importedIdNumber.toLowerCase());
      if (importedIdOwner && importedIdOwner.id !== targetMatch.id) {
        existingDbIdNumberConflicts.add(importedIdNumber);
        return [{
          imported: {
            idNumber: importedIdNumber,
            fullName: record.fullNameLabel,
            email: record.email,
            department: record.department,
            position: record.position,
            accountRole: record.accountRole,
            dateHired: record.dateHired,
            employmentStatus: record.employmentStatus,
          },
          existing: {
            id: importedIdOwner.id,
            idNumber: importedIdOwner.idNumber,
            fullName: importedIdOwner.fullNameLabel,
            email: importedIdOwner.email,
            department: importedIdOwner.department,
            position: importedIdOwner.position,
            dateHired: importedIdOwner.dateHired,
            employmentStatus: importedIdOwner.employmentStatus,
          },
          matchedBy: "ID Number Conflict",
          conflictLabel: "ID Number Already Used",
        } satisfies DuplicateMatchRow];
      }

      if (targetMatch.idNumber && targetMatch.idNumber.toLowerCase() != importedIdNumber.toLowerCase()) {
        existingDbEmployeeIdConflicts.add(targetMatch.fullNameLabel);
        return [{
          imported: {
            idNumber: importedIdNumber,
            fullName: record.fullNameLabel,
            email: record.email,
            department: record.department,
            position: record.position,
            accountRole: record.accountRole,
            dateHired: record.dateHired,
            employmentStatus: record.employmentStatus,
          },
          existing: {
            id: targetMatch.id,
            idNumber: targetMatch.idNumber,
            fullName: targetMatch.fullNameLabel,
            email: targetMatch.email,
            department: targetMatch.department,
            position: targetMatch.position,
            dateHired: targetMatch.dateHired,
            employmentStatus: targetMatch.employmentStatus,
          },
          matchedBy: "ID Number Conflict",
          conflictLabel: "Employee Already Has Different ID Number",
        } satisfies DuplicateMatchRow];
      }

      return [];
    }).sort((left, right) => left.imported.fullName.localeCompare(right.imported.fullName));

    return {
      duplicateFileIdNumbers,
      duplicateFileEmails: [],
      duplicateFileFullNames: [],
      existingDbIdNumbers: Array.from(existingDbIdNumberConflicts).sort((a, b) => a.localeCompare(b)),
      existingDbEmails: [],
      existingDbFullNames: [],
      existingDbIdNumberConflicts: Array.from(existingDbIdNumberConflicts).sort((a, b) => a.localeCompare(b)),
      existingDbEmployeeIdConflicts: Array.from(existingDbEmployeeIdConflicts).sort((a, b) => a.localeCompare(b)),
      uniqueRecordCount: normalizedRecords.length,
      matchedDbRecordCount: new Set(matchRows.map((match) => match.existing.id)).size,
      matchRows,
    };
  }

  const idNumberSet = new Set(normalizedRecords.map((record) => record.idNumber).filter(Boolean));
  const emailSet = new Set(normalizedRecords.map((record) => record.email).filter(Boolean));
  const fullNameSet = new Set(normalizedRecords.map((record) => record.fullNameKey));

  const existingDbIdNumbers = Array.from(new Set(existingMatches.filter((match) => match.idNumber && idNumberSet.has(match.idNumber)).map((match) => match.idNumber!))).sort((a, b) => a.localeCompare(b));
  const existingDbEmails = Array.from(new Set(existingMatches.filter((match) => emailSet.has(match.email.toLowerCase())).map((match) => match.email.toLowerCase()))).sort((a, b) => a.localeCompare(b));
  const existingDbFullNames = Array.from(new Set(existingMatches.filter((match) => fullNameSet.has(match.fullNameKey)).map((match) => match.fullNameLabel))).sort((a, b) => a.localeCompare(b));

  const matchRows = normalizedRecords.flatMap((record) => {
    const idNumberMatch = record.idNumber ? existingByIdNumber.get(record.idNumber.toLowerCase()) : undefined;
    const emailMatch = record.email ? existingByEmail.get(record.email) : undefined;
    const fullNameMatch = existingByFullName.get(record.fullNameKey);
    const firstLastMatch = getUniqueFirstLastMatch(existingByFirstLastName, record.firstLastNameKey);
    const existingMatch = idNumberMatch ?? emailMatch ?? fullNameMatch ?? firstLastMatch;

    if (!existingMatch) {
      return [];
    }

    let matchedBy: DuplicateMatchRow["matchedBy"] = "Full Name";
    if (idNumberMatch && fullNameMatch && idNumberMatch.id === fullNameMatch.id) {
      matchedBy = "ID Number + Name";
    } else if (idNumberMatch) {
      matchedBy = "ID Number";
    } else if (emailMatch && fullNameMatch && emailMatch.id === fullNameMatch.id) {
      matchedBy = "Email + Full Name";
    } else if (emailMatch) {
      matchedBy = "Email";
    } else if (firstLastMatch) {
      matchedBy = "First + Last Name";
    }

    return [{
      imported: {
        idNumber: record.idNumber,
        fullName: record.fullNameLabel,
        email: record.email,
        department: record.department,
        position: record.position,
        accountRole: record.accountRole,
        dateHired: record.dateHired,
        employmentStatus: record.employmentStatus,
      },
      existing: {
        id: existingMatch.id,
        idNumber: existingMatch.idNumber,
        fullName: existingMatch.fullNameLabel,
        email: existingMatch.email,
        department: existingMatch.department,
        position: existingMatch.position,
        dateHired: existingMatch.dateHired,
        employmentStatus: existingMatch.employmentStatus,
      },
      matchedBy,
    } satisfies DuplicateMatchRow];
  }).sort((left, right) => left.imported.fullName.localeCompare(right.imported.fullName));

  return {
    duplicateFileIdNumbers,
    duplicateFileEmails,
    duplicateFileFullNames,
    existingDbIdNumbers,
    existingDbEmails,
    existingDbFullNames,
    existingDbIdNumberConflicts: [],
    existingDbEmployeeIdConflicts: [],
    uniqueRecordCount: normalizedRecords.length,
    matchedDbRecordCount: new Set(existingMatches.map((match) => match.id)).size,
    matchRows,
  };
}

type EmployeeImportOptions = {
  overwriteExisting: boolean;
  workbookType?: "employee-information" | "id-number";
};

type UpdateImportedEmployeeRecord = NormalizedImportedEmployeeRecord & {
  targetId: string;
};

type InsertImportedEmployeeRecord = NormalizedImportedEmployeeRecord & {
  targetId: string;
};

type IdNumberImportUpdate = {
  targetId: string;
  idNumber: string;
};

async function updateEmployeeImportChunk(chunk: UpdateImportedEmployeeRecord[]) {
  if (chunk.length === 0) {
    return;
  }

  const values = chunk.map((record) => Prisma.sql`(
    ${record.targetId},
    ${normalizeEmployeeIdNumber(record.idNumber)},
    ${record.lastName},
    ${record.firstName},
    ${record.middleName},
    ${record.gender},
    ${record.department},
    ${record.position},
    ${record.staffCategory},
    ${record.dateHired},
    ${record.birthDate ?? null},
    ${record.employmentStatus},
    ${record.email || null},
    ${record.address},
    ${record.contactNumber},
    ${record.avatarColor},
    CAST(${JSON.stringify(record.education)} AS jsonb),
    CAST(${JSON.stringify(record.documents)} AS jsonb)
  )`);

  await db.$executeRaw(Prisma.sql`
    UPDATE "EmployeeRecord" AS target
    SET
      "idNumber" = incoming."idNumber",
      "lastName" = incoming."lastName",
      "firstName" = incoming."firstName",
      "middleName" = incoming."middleName",
      "gender" = incoming."gender",
      "department" = incoming."department",
      "position" = incoming."position",
      "staffCategory" = incoming."staffCategory",
      "dateHired" = incoming."dateHired",
      "birthDate" = incoming."birthDate",
      "employmentStatus" = incoming."employmentStatus",
      "email" = COALESCE(incoming."email", target."email"),
      "address" = incoming."address",
      "contactNumber" = incoming."contactNumber",
      "avatarColor" = incoming."avatarColor",
      "education" = incoming."education",
      "documents" = incoming."documents",
      "updatedAt" = NOW()
    FROM (
      VALUES ${Prisma.join(values)}
    ) AS incoming(
      "targetId", "idNumber", "lastName", "firstName", "middleName", "gender", "department", "position", "staffCategory", "dateHired",
      "birthDate", "employmentStatus", "email", "address", "contactNumber", "avatarColor", "education", "documents"
    )
    WHERE target."id" = incoming."targetId"
  `);
}

async function updateEmployeeIdNumberImportChunk(chunk: IdNumberImportUpdate[]) {
  if (chunk.length === 0) {
    return;
  }

  const values = chunk.map((record) => Prisma.sql`(
    ${record.targetId},
    ${record.idNumber}
  )`);

  await db.$executeRaw(Prisma.sql`
    UPDATE "EmployeeRecord" AS target
    SET
      "idNumber" = incoming."idNumber",
      "updatedAt" = NOW()
    FROM (
      VALUES ${Prisma.join(values)}
    ) AS incoming("targetId", "idNumber")
    WHERE target."id" = incoming."targetId"
  `);
}

export async function importEmployeeMasterRecords(records: ImportedEmployeeDraft[], options: EmployeeImportOptions = { overwriteExisting: false, workbookType: "employee-information" }) {
  const normalizedRecords = normalizeImportedEmployeeRecords(records);
  if (normalizedRecords.length === 0) {
    return { created: 0, updated: 0, skipped: 0, total: 0, accountsCreated: 0, accountsSkipped: 0 };
  }

  const workbookType = options.workbookType ?? "employee-information";
  const existingMatches = await fetchExistingEmployeeImportMatches(normalizedRecords);
  const existingByIdNumber = new Map(existingMatches.filter((match) => match.idNumber).map((match) => [match.idNumber!.toLowerCase(), match]));
  const existingByEmail = new Map(existingMatches.filter((match) => match.email).map((match) => [match.email.toLowerCase(), match]));
  const existingByFullName = new Map(existingMatches.map((match) => [match.fullNameKey, match]));
  const existingByFirstLastName = new Map<string, ExistingEmployeeImportMatch[]>();
  for (const match of existingMatches) {
    const current = existingByFirstLastName.get(match.firstLastNameKey) ?? [];
    current.push(match);
    existingByFirstLastName.set(match.firstLastNameKey, current);
  }

  if (workbookType === "id-number") {
    const idCounts = new Map<string, number>();
    for (const record of normalizedRecords) {
      const nextIdNumber = normalizeEmployeeIdNumber(record.idNumber);
      if (!nextIdNumber) {
        continue;
      }
      const key = nextIdNumber.toLowerCase();
      idCounts.set(key, (idCounts.get(key) ?? 0) + 1);
    }

    const duplicateImportedIdNumbers = new Set(Array.from(idCounts.entries()).filter(([, count]) => count > 1).map(([idNumber]) => idNumber));
    const updatesByTargetId = new Map<string, IdNumberImportUpdate>();
    let skipped = 0;

    for (const record of normalizedRecords) {
      const nextIdNumber = normalizeEmployeeIdNumber(record.idNumber);
      if (!nextIdNumber) {
        skipped += 1;
        continue;
      }

      if (duplicateImportedIdNumbers.has(nextIdNumber.toLowerCase())) {
        skipped += 1;
        continue;
      }

      const targetMatch = existingByFullName.get(record.fullNameKey)
        ?? getUniqueFirstLastMatch(existingByFirstLastName, record.firstLastNameKey);

      if (!targetMatch) {
        skipped += 1;
        continue;
      }

      const importedIdOwner = existingByIdNumber.get(nextIdNumber.toLowerCase());
      if (importedIdOwner && importedIdOwner.id !== targetMatch.id) {
        skipped += 1;
        continue;
      }

      const currentIdNumber = normalizeEmployeeIdNumber(targetMatch.idNumber);
      if (currentIdNumber && currentIdNumber.toLowerCase() !== nextIdNumber.toLowerCase() && !options.overwriteExisting) {
        skipped += 1;
        continue;
      }

      if (currentIdNumber && currentIdNumber.toLowerCase() === nextIdNumber.toLowerCase()) {
        skipped += 1;
        continue;
      }

      updatesByTargetId.set(targetMatch.id, {
        targetId: targetMatch.id,
        idNumber: nextIdNumber,
      });
    }

    const updates = Array.from(updatesByTargetId.values());
    await db.$transaction(async () => {
      for (const chunk of chunkRecords(updates, EMPLOYEE_IMPORT_CHUNK_SIZE)) {
        await updateEmployeeIdNumberImportChunk(chunk);
      }
    });

    clearEmployeeMasterCache();
    return {
      created: 0,
      updated: updates.length,
      skipped,
      total: normalizedRecords.length,
      accountsCreated: 0,
      accountsSkipped: 0,
    };
  }

  const inserts: InsertImportedEmployeeRecord[] = [];
  const updatesByTargetId = new Map<string, UpdateImportedEmployeeRecord>();
  let skipped = 0;

  for (const record of normalizedRecords) {
    const existingMatch = (record.idNumber ? existingByIdNumber.get(record.idNumber.toLowerCase()) : undefined)
      ?? (record.email ? existingByEmail.get(record.email) : undefined)
      ?? existingByFullName.get(record.fullNameKey)
      ?? getUniqueFirstLastMatch(existingByFirstLastName, record.firstLastNameKey);

    if (!existingMatch) {
      if (!record.email || !record.lastName || !record.firstName || !record.department || !record.position || !record.dateHired) {
        skipped += 1;
        continue;
      }

      inserts.push({
        ...record,
        targetId: randomUUID(),
      });
      continue;
    }

    if (!options.overwriteExisting) {
      skipped += 1;
      continue;
    }

    if (!hasImportedEmployeeChanges(record, existingMatch)) {
      skipped += 1;
      continue;
    }

    updatesByTargetId.set(existingMatch.id, {
      ...record,
      email: record.email || existingMatch.email,
      department: record.department || existingMatch.department,
      position: record.position || existingMatch.position,
      dateHired: record.dateHired || existingMatch.dateHired,
      employmentStatus: record.employmentStatus || existingMatch.employmentStatus,
      address: record.address || existingMatch.address,
      contactNumber: record.contactNumber || existingMatch.contactNumber,
      targetId: existingMatch.id,
    });
  }

  const updates = Array.from(updatesByTargetId.values());
  let accountsCreated = 0;
  let accountsSkipped = 0;

  const passwordSettings = inserts.length > 0
    ? await db.systemSettings.findUnique({
        where: { id: "default" },
        select: {
          employeeDefaultPassword: true,
          hrDefaultPassword: true,
          adminDefaultPassword: true,
          employeePasswordVersion: true,
          hrPasswordVersion: true,
        },
      })
    : null;

  const rolePasswordSettings = {
    employeeDefaultPassword: passwordSettings?.employeeDefaultPassword ?? "Employee@123",
    hrDefaultPassword: passwordSettings?.hrDefaultPassword ?? "HR@123",
    adminDefaultPassword: passwordSettings?.adminDefaultPassword ?? "Admin@123",
  };

  const employeeDefaultPassword = inserts.length > 0
    ? getDefaultPasswordForRole(rolePasswordSettings, "employee")
    : null;
  const hrDefaultPassword = inserts.length > 0
    ? getDefaultPasswordForRole(rolePasswordSettings, "hr")
    : null;

  if (employeeDefaultPassword && !validatePasswordRequirements(employeeDefaultPassword)) {
    throw new Error("Employee default password is invalid. Update System Settings before importing accounts.");
  }

  if (hrDefaultPassword && !validatePasswordRequirements(hrDefaultPassword)) {
    throw new Error("HR default password is invalid. Update System Settings before importing accounts.");
  }

  const employeePasswordVersion = passwordSettings?.employeePasswordVersion ?? 1;
  const hrPasswordVersion = passwordSettings?.hrPasswordVersion ?? 1;

  await db.$transaction(async (tx) => {
    for (const chunk of chunkRecords(inserts, EMPLOYEE_IMPORT_CHUNK_SIZE)) {
      const values = chunk.map((record) => Prisma.sql`(
        ${record.targetId},
        ${normalizeEmployeeIdNumber(record.idNumber)},
        ${record.lastName},
        ${record.firstName},
        ${record.middleName},
        ${record.gender},
        ${record.department},
        ${record.position},
        CAST(${record.accountRole} AS "Role"),
        ${record.staffCategory},
        ${record.dateHired},
        ${record.birthDate ?? null},
        ${record.employmentStatus},
        ${record.email},
        ${record.address},
        ${record.contactNumber},
        ${record.avatarColor},
        CAST(${JSON.stringify(record.education)} AS jsonb),
        CAST(${JSON.stringify(record.documents)} AS jsonb),
        NOW(),
        NOW()
      )`);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "EmployeeRecord" (
          "id", "idNumber", "lastName", "firstName", "middleName", "gender", "department", "position", "accountRole", "staffCategory", "dateHired",
          "birthDate", "employmentStatus", "email", "address", "contactNumber", "avatarColor", "education", "documents", "createdAt", "updatedAt"
        )
        VALUES ${Prisma.join(values)}
      `);
    }

    for (const chunk of chunkRecords(updates, EMPLOYEE_IMPORT_CHUNK_SIZE)) {
      await updateEmployeeImportChunk(chunk);
    }
  });

  if (inserts.length > 0 && employeeDefaultPassword && hrDefaultPassword) {
    const eligibleRecords = inserts
      .map((record) => ({ record, email: normalizeEmail(record.email) }))
      .filter(({ email }) => {
        if (!isAllowedEmail(email)) {
          accountsSkipped += 1;
          return false;
        }
        return true;
      });

    const eligibleEmails = Array.from(new Set(eligibleRecords.map(({ email }) => email)));
    const [existingUsers, existingAuthUsers] = await Promise.all([
      db.user.findMany({
        where: { email: { in: eligibleEmails } },
        select: { email: true },
      }),
      findAuthUsersByEmails(db, eligibleEmails),
    ]);

    const existingUserEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));
    const authUserByEmail = new Map(existingAuthUsers.map((user) => [user.email.toLowerCase(), user]));
    const authUsersToCreate: Array<{ authUserId: string; email: string; password: string; name: string; role: "employee" | "hr" }> = [];
    const authUsersToEnsure: Array<{ authUserId: string; email: string; password: string; name: string; role: "employee" | "hr" }> = [];
    const appUsersToCreate: Array<{
      authUserId: string;
      name: string;
      email: string;
      employeeId: string;
      department: string;
      role: "employee" | "hr";
      passwordVersion: number;
    }> = [];

    for (const { record, email } of eligibleRecords) {
      const role = record.accountRole === "hr" ? "hr" : "employee";
      const password = role === "hr" ? hrDefaultPassword : employeeDefaultPassword;
      const passwordVersion = role === "hr" ? hrPasswordVersion : employeePasswordVersion;

      if (existingUserEmails.has(email)) {
        accountsSkipped += 1;
        continue;
      }

      const existingAuthUser = authUserByEmail.get(email);
      if (existingAuthUser) {
        authUsersToEnsure.push({
          authUserId: existingAuthUser.id,
          email,
          password,
          name: record.fullNameLabel,
          role,
        });
        appUsersToCreate.push({
          authUserId: existingAuthUser.id,
          name: record.fullNameLabel,
          email,
          employeeId: record.targetId,
          department: record.department,
          role,
          passwordVersion,
        });
        continue;
      }

      const authUserId = randomUUID();
      authUsersToCreate.push({
        authUserId,
        email,
        password,
        name: record.fullNameLabel,
        role,
      });
      appUsersToCreate.push({
        authUserId,
        name: record.fullNameLabel,
        email,
        employeeId: record.targetId,
        department: record.department,
        role,
        passwordVersion,
      });
      authUserByEmail.set(email, { id: authUserId, email });
    }

    for (const chunk of chunkRecords(authUsersToCreate, EMPLOYEE_ACCOUNT_PROVISION_CHUNK_SIZE)) {
      await createAuthUsersWithPassword(db, chunk);
    }

    for (const authUser of authUsersToEnsure) {
      await ensureAuthUserWithPassword(db, authUser);
    }

    for (const chunk of chunkRecords(appUsersToCreate, EMPLOYEE_ACCOUNT_PROVISION_CHUNK_SIZE)) {
      const result = await db.user.createMany({
        data: chunk.map((user) => ({
          authUserId: user.authUserId,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          department: user.department,
          active: true,
          passwordSource: "role_default",
          passwordRole: user.role,
          passwordVersion: user.passwordVersion,
        })),
        skipDuplicates: true,
      });

      accountsCreated += result.count;
      accountsSkipped += chunk.length - result.count;
    }
  }

  clearEmployeeMasterCache();
  return {
    created: inserts.length,
    updated: updates.length,
    skipped,
    total: normalizedRecords.length,
    accountsCreated,
    accountsSkipped,
  };
}

export function invalidateEmployeeMasterCache() {
  clearEmployeeMasterCache();
}

















