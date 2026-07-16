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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env config');

  const users = await prisma.user.findMany({
    where: { employeeId: { not: null } },
    select: { email: true, role: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const results = [];
  for (const user of users) {
    const password = user.role === 'hr' ? settings.hrDefaultPassword : settings.employeeDefaultPassword;
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    });
    results.push({ email: user.email, role: user.role, ok: res.ok, status: res.status });
  }

  console.log(JSON.stringify(results, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
