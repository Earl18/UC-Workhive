/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { employeeId: { not: null } },
    select: { authUserId: true, email: true, role: true },
    orderBy: { createdAt: 'desc' },
  });

  await prisma.$executeRaw`
    UPDATE auth.users
    SET
      "email_change" = COALESCE("email_change", ''),
      "confirmation_token" = COALESCE("confirmation_token", ''),
      "recovery_token" = COALESCE("recovery_token", ''),
      "email_change_token_new" = COALESCE("email_change_token_new", ''),
      "email_change_token_current" = COALESCE("email_change_token_current", ''),
      "reauthentication_token" = COALESCE("reauthentication_token", ''),
      "phone_change_token" = COALESCE("phone_change_token", ''),
      "updated_at" = NOW()
    WHERE "id" = ${user.authUserId}::uuid
  `;

  console.log(JSON.stringify({ email: user.email, authUserId: user.authUserId }, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
