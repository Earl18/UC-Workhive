/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { employeeDefaultPassword: true },
  });
  const user = await prisma.user.findFirst({
    where: { employeeId: { not: null }, role: 'employee' },
    select: { email: true },
    orderBy: { createdAt: 'desc' },
  });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: settings.employeeDefaultPassword }),
  });
  const text = await res.text();
  console.log(JSON.stringify({ status: res.status, body: text }, null, 2));
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
