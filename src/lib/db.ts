import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: ["query"],
  });
}

function hasAdminModels(client: PrismaClient | undefined) {
  return Boolean(client && "systemSettings" in (client as PrismaClient & Record<string, unknown>));
}

export const db = hasAdminModels(globalForPrisma.prisma)
  ? globalForPrisma.prisma!
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
