import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// A single shared PrismaClient instance.
// In development Next.js hot-reloads modules, which would otherwise create a
// new client (and a new connection pool) on every reload — so we cache it on
// globalThis. Prisma 7 connects through a driver adapter; we use the pooled
// DATABASE_URL (PgBouncer) for the runtime connection.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
