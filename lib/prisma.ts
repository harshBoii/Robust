import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Add connect_timeout for Neon serverless (wakes up from sleep)
  const url = new URL(connectionString);
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "45");
  }
  const adapter = new PrismaPg(url.toString());
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 20000,
      timeout: 20000,
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
