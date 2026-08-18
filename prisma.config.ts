import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // ASSUMPTION: local SQLite file under prisma/ for easy discovery
    url: process.env["DATABASE_URL"] ?? "file:./prisma/dev.db",
  },
});
