/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT
      u."email" as email,
      u."employeeId" as "employeeId",
      u."authUserId" as "authUserId",
      u."role" as role,
      au."id"::text as "authId",
      au."email" as "authEmail",
      au."email_confirmed_at" as "emailConfirmedAt",
      au."deleted_at" as "deletedAt",
      ai."id"::text as "identityId"
    FROM "User" u
    LEFT JOIN auth.users au ON au."id"::text = u."authUserId"
    LEFT JOIN auth.identities ai ON ai."user_id" = au."id" AND ai."provider" = 'email'
    WHERE u."employeeId" IS NOT NULL
    ORDER BY u."createdAt" DESC
    LIMIT 20
  `;
  console.log(JSON.stringify(rows, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
