import { execSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { TEST_DATABASE_URL } from "./env.js";

const DB_PACKAGE = resolve(import.meta.dirname, "../../../../packages/db");

/** Once per run: create the test database, apply migrations, seed foods and exercises. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = new pg.Client({
    connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).href,
  });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync("npx prisma migrate deploy", { cwd: DB_PACKAGE, env, stdio: "pipe" });
  execSync("npx prisma db seed", { cwd: DB_PACKAGE, env, stdio: "pipe" });
}
