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
  });

  const summary = { total: users.length, ok200: 0, invalid401: 0, server500: 0, other: 0 };
  const samples = [];

  for (const user of users) {
    const password = user.role === 'hr' ? settings.hrDefaultPassword : settings.employeeDefaultPassword;
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    });

    if (res.status === 200) summary.ok200 += 1;
    else if (res.status === 401) summary.invalid401 += 1;
    else if (res.status === 500) summary.server500 += 1;
    else summary.other += 1;

    if (samples.length < 12) {
      samples.push({ email: user.email, role: user.role, status: res.status });
    }
  }

  console.log(JSON.stringify({ summary, samples }, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
