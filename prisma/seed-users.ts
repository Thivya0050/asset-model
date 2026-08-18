/**
 * Seed login users only — does NOT wipe Categories / Asset Models.
 * Run: npx tsx prisma/seed-users.ts
 */
import "dotenv/config";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const SHARED_PASSWORD = "Password123!";

const USERS = [
  {
    name: "Admin User",
    email: "admin@example.com",
    role: "Admin" as const,
  },
  {
    name: "Manager User",
    email: "manager@example.com",
    role: "Manager" as const,
  },
  {
    name: "Staff User",
    email: "staff@example.com",
    role: "Staff" as const,
  },
  {
    name: "Viewer User",
    email: "viewer@example.com",
    role: "Viewer" as const,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(SHARED_PASSWORD, 10);

  console.log("Seeding users…\n");

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        isActive: true,
      },
      update: {
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
      },
    });
  }

  console.log("Seeded credentials (shared password for all):");
  console.log("─────────────────────────────────────────────");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(8)}  ${u.email}  /  ${SHARED_PASSWORD}`);
  }
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
