import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const tables = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'User',
        'Session',
        'GitHubInstallation',
        'UserInstallation',
        'Repository',
        'WebhookEvent',
        'AutomationRule',
        'ActionAttempt'
      )
  `;

  const deliveryConstraints = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'WebhookEvent'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%deliveryId%'
  `;

  const tableCount = Number(tables[0]?.count ?? 0);
  const uniqueConstraintCount = Number(deliveryConstraints[0]?.count ?? 0);

  if (tableCount !== 8) {
    throw new Error(`Expected 8 persistence tables, found ${tableCount}`);
  }

  if (uniqueConstraintCount !== 1) {
    throw new Error("Webhook delivery ID unique constraint is missing");
  }

  console.log("Database connection and persistence schema verified.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
