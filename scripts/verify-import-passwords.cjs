/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      employeeDefaultPassword: true,
      hrDefaultPassword: true,
    },
  });

  const rows = await prisma.$queryRaw`
    SELECT
      u."email" as email,
      u."role" as role,
      u."employeeId" as "employeeId",
      au."encrypted_password" as "encryptedPassword"
    FROM "User" u
    JOIN auth.users au ON au."id"::text = u."authUserId"
    WHERE u."employeeId" IS NOT NULL
  `;

  let employeeMatches = 0;
  let employeeMismatches = 0;
  let hrMatches = 0;
  let hrMismatches = 0;

  for (const row of rows) {
    const password = row.role === "hr" ? settings.hrDefaultPassword : settings.employeeDefaultPassword;
    const result = await prisma.$queryRaw`
      SELECT crypt(${password}, ${row.encryptedPassword}) = ${row.encryptedPassword} AS matches
    `;
    const matches = Boolean(result[0]?.matches);
    if (row.role === "hr") {
      if (matches) hrMatches += 1; else hrMismatches += 1;
    } else {
      if (matches) employeeMatches += 1; else employeeMismatches += 1;
    }
  }

  console.log(JSON.stringify({
    total: rows.length,
    employeeMatches,
    employeeMismatches,
    hrMatches,
    hrMismatches,
  }, null, 2));
}

main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
