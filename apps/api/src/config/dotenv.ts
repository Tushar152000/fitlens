import { config } from "dotenv";

/** Local dev reads the repo-root .env (apps/api/.env wins if present). Real deployments inject env vars. */
export function loadDotenv() {
  if (process.env.NODE_ENV === "production") return;
  config({ path: ".env", quiet: true });
  config({ path: "../../.env", quiet: true });
}
