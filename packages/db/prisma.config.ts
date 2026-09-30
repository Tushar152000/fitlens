import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// One .env at the repo root serves every app; a local packages/db/.env still wins if present.
config({ path: ".env" });
config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
