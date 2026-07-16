/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const imported = await prisma.$queryRaw`
    SELECT au."id"::text as id, au."email", au."aud", au."role", au."instance_id"::text as "instanceId", au."raw_app_meta_data", au."raw_user_meta_data",
           ai."provider_id", ai."provider", ai."identity_data"
    FROM "User" u
    JOIN auth.users au ON au."id"::text = u."authUserId"
    LEFT JOIN auth.identities ai ON ai."user_id" = au."id" AND ai."provider" = 'email'
    WHERE u."employeeId" IS NOT NULL
    ORDER BY u."createdAt" DESC
    LIMIT 1
  `;

  const working = await prisma.$queryRaw`
    SELECT au."id"::text as id, au."email", au."aud", au."role", au."instance_id"::text as "instanceId", au."raw_app_meta_data", au."raw_user_meta_data",
           ai."provider_id", ai."provider", ai."identity_data"
    FROM "User" u
    JOIN auth.users au ON au."id"::text = u."authUserId"
    LEFT JOIN auth.identities ai ON ai."user_id" = au."id" AND ai."provider" = 'email'
    WHERE u."employeeId" IS NULL AND u."role" IN ('employee','hr','admin')
    ORDER BY u."createdAt" DESC
    LIMIT 1
  `;

  console.log(JSON.stringify({ imported: imported[0], working: working[0] }, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
