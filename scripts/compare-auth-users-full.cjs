/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function sanitize(row) {
  if (!row) return row;
  const copy = { ...row };
  delete copy.encrypted_password;
  delete copy.recovery_token;
  delete copy.email_change_token_new;
  delete copy.email_change_token_current;
  delete copy.reauthentication_token;
  delete copy.confirmation_token;
  return copy;
}

async function main() {
  const imported = await prisma.$queryRawUnsafe(`
    SELECT to_jsonb(au) AS user_json
    FROM "User" u
    JOIN auth.users au ON au."id"::text = u."authUserId"
    WHERE u."employeeId" IS NOT NULL
    ORDER BY u."createdAt" DESC
    LIMIT 1
  `);

  const working = await prisma.$queryRawUnsafe(`
    SELECT to_jsonb(au) AS user_json
    FROM "User" u
    JOIN auth.users au ON au."id"::text = u."authUserId"
    WHERE u."employeeId" IS NULL
    ORDER BY u."createdAt" DESC
    LIMIT 1
  `);

  console.log(JSON.stringify({ imported: sanitize(imported[0]?.user_json), working: sanitize(working[0]?.user_json) }, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
