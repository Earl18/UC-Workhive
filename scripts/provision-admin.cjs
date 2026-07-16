const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "earljustinesierra@uc.edu.ph";
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Earl Justine Sierra",
      role: "admin",
      active: true,
      employeeId: null,
    },
    create: {
      email,
      name: "Earl Justine Sierra",
      role: "admin",
      active: true,
    },
  });

  console.log(JSON.stringify({ id: user.id, email: user.email, role: user.role, active: user.active }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
