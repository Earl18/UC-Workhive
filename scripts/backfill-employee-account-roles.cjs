/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function inferAccountRoleFromDepartment(department) {
  const normalized = (department ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return "employee";
  return /(^|\s)(hr|hrd)(\s|$)|human resource/.test(normalized) ? "hr" : "employee";
}

function buildUserMeta(name, role) {
  return JSON.stringify({
    email_verified: true,
    name,
    role,
  });
}

async function main() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      employeeDefaultPassword: true,
      hrDefaultPassword: true,
      employeePasswordVersion: true,
      hrPasswordVersion: true,
    },
  });

  const employees = await prisma.employeeRecord.findMany({
    select: { id: true, department: true, email: true, firstName: true, middleName: true, lastName: true },
  });

  let updated = 0;

  for (const employee of employees) {
    const role = inferAccountRoleFromDepartment(employee.department);
    const password = role === "hr"
      ? (settings?.hrDefaultPassword ?? "HR@123")
      : (settings?.employeeDefaultPassword ?? "Employee@123");
    const passwordVersion = role === "hr"
      ? (settings?.hrPasswordVersion ?? 1)
      : (settings?.employeePasswordVersion ?? 1);
    const fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ") || employee.email;

    await prisma.employeeRecord.update({
      where: { id: employee.id },
      data: { accountRole: role },
    });

    await prisma.user.updateMany({
      where: {
        OR: [
          { employeeId: employee.id },
          { email: employee.email },
        ],
      },
      data: {
        role,
        passwordRole: role,
        passwordVersion,
      },
    });

    await prisma.$executeRaw`
      UPDATE auth.users
      SET
        "email" = ${employee.email},
        "encrypted_password" = crypt(${password}, gen_salt('bf')),
        "email_confirmed_at" = COALESCE("email_confirmed_at", NOW()),
        "raw_user_meta_data" = ${buildUserMeta(fullName, role)}::jsonb,
        "email_change" = '',
        "confirmation_token" = COALESCE("confirmation_token", ''),
        "recovery_token" = COALESCE("recovery_token", ''),
        "email_change_token_new" = COALESCE("email_change_token_new", ''),
        "email_change_token_current" = COALESCE("email_change_token_current", ''),
        "reauthentication_token" = COALESCE("reauthentication_token", ''),
        "phone_change_token" = COALESCE("phone_change_token", ''),
        "updated_at" = NOW(),
        "deleted_at" = NULL
      WHERE lower("email") = lower(${employee.email})
    `;

    updated += 1;
  }

  console.log(`Backfilled accountRole, normalized auth fields, and reset default passwords for ${updated} employee records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


