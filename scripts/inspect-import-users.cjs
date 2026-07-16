/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["employee", "hr"] } },
    select: { id: true, email: true, authUserId: true, role: true, employeeId: true, department: true, passwordRole: true, passwordVersion: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(users, null, 2));
}
main().finally(() => prisma.$disconnect());
