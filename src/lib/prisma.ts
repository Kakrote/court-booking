import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function poolFromDatabaseUrl(databaseUrl: string | undefined) {
  const connectionString = databaseUrl;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  let ssl: false | { rejectUnauthorized: boolean } = false;
  try {
    const u = new URL(connectionString);
    const sslmode = u.searchParams.get("sslmode");
    const sslParam = u.searchParams.get("ssl");
    if (sslmode === "require" || sslParam === "true") {
      // Most managed Postgres endpoints require TLS. For local/dev managed endpoints,
      // CA chains may not be present in the runtime, so we disable strict verification.
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    // If DATABASE_URL isn't parseable as a URL, fall back to default Pool behavior.
  }

  return new Pool({ connectionString, ssl });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const pgPool =
  globalForPrisma.pgPool ??
  poolFromDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pgPool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pgPool = pgPool;
  globalForPrisma.prisma = prisma;
}
