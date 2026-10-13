import { config } from "dotenv";
import { isDeployed, resolveAppEnv } from "./env.js";

/**
 * Local and test runs read the repo-root .env (apps/api/.env wins if present); variables already set
 * in the shell win over both. Deployments (APP_ENV=staging|production) get real env vars from the
 * platform and never read files.
 */
export function loadDotenv() {
  if (isDeployed({ APP_ENV: resolveAppEnv(process.env) })) return;
  config({ path: ".env", quiet: true });
  config({ path: "../../.env", quiet: true });
}
