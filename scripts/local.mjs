#!/usr/bin/env node
// Local environment bootstrap. Dependency-free so it runs before `pnpm install` has finished anything.
//
//   pnpm bootstrap     first run (and any time): .env, ports, Docker services, migrations, seed, app .env
//   pnpm dev           `preflight web api`: the same steps, frees :3000 and :4000, then starts the apps
//   pnpm dev:mobile    `mobile`: frees the Metro port (METRO_PORT) and starts Expo on it
//   pnpm emulator      `emulator`: creates the "fitlens" Android emulator once, boots it if needed
//   pnpm dev:android   `mobile --android`: boots the emulator, then starts Expo and opens the app on it
//   pnpm start:all     `all`: everything above in one terminal — services, API + web, emulator, app
//   pnpm stop:all      `stop`: stops your dev servers, Expo, the emulator and the Docker services
//
// Ports are fixed: web 3000, API 4000 (PORT), Metro METRO_PORT (8081 unless taken by another user).
// A stale dev server of yours on one of them is stopped before starting; another user's or the
// system's process never is.
// Safe to re-run: it never overwrites a value you set, only fills what's missing or broken.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateSecret,
  isLocalUrl,
  parseEnv,
  setEnv,
  unsetEnv,
  withLocalPort,
} from "./lib/env-file.mjs";
import {
  AVD_NAME,
  avdExists,
  bootEmulator,
  createAvd,
  findSdk,
  newestSystemImage,
  runningEmulator,
  stopEmulator,
} from "./lib/android.mjs";
import {
  API_PORT,
  DEFAULT_METRO_PORT,
  WEB_PORT,
  firstUsablePort,
  freePort,
  portInUse,
} from "./lib/ports.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const MOBILE_ENV = join(ROOT, "apps/mobile/.env");

/** Docker services and the .env URLs that point at each. Compose reads the *_PORT values from .env. */
const SERVICES = [
  {
    service: "postgres",
    portVar: "POSTGRES_PORT",
    port: 5432,
    container: 5432,
    urls: ["DATABASE_URL", "TEST_DATABASE_URL"],
  },
  { service: "redis", portVar: "REDIS_PORT", port: 6379, container: 6379, urls: ["REDIS_URL"] },
  { service: "minio", portVar: "MINIO_PORT", port: 9000, container: 9000, urls: ["S3_ENDPOINT"] },
  { service: "minio", portVar: "MINIO_CONSOLE_PORT", port: 9001, container: 9001, urls: [] },
];

const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color(32);
const yellow = color(33);
const red = color(31);
const dim = color(2);
const step = (msg) => console.log(`${green("✓")} ${msg}`);
const note = (msg) => console.log(`${yellow("!")} ${msg}`);

class SetupError extends Error {}
const fail = (msg) => {
  throw new SetupError(msg);
};

// ── Checks ────────────────────────────────────────────────────────────────

function checkNode() {
  const want = readFileSync(join(ROOT, ".nvmrc"), "utf8").trim().replace(/^v/, "").split(".")[0];
  const have = process.versions.node.split(".")[0];
  if (have !== want) {
    fail(`Node ${want} is required (you have ${process.versions.node}). Run: nvm use`);
  }
}

function checkDocker() {
  const res = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  if (res.status !== 0) fail("Docker with Compose is required for Postgres, Redis and MinIO.");
  const info = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (info.status !== 0) fail("Docker is installed but not running. Start Docker, then retry.");
}

// ── .env ──────────────────────────────────────────────────────────────────

/** Creates .env from the example, then repairs what would stop the API from booting. */
function ensureEnvFile() {
  if (!existsSync(ENV_FILE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    step("Created .env from .env.example");
  }
  let text = readFileSync(ENV_FILE, "utf8");
  const env = parseEnv(text);

  if ((env.get("AUTH_SECRET") ?? "").length < 32) {
    text = setEnv(text, "AUTH_SECRET", generateSecret());
    step("Generated AUTH_SECRET");
  }
  // Renamed from the Auth.js days.
  if (env.has("AUTH_URL")) {
    if (!env.get("PUBLIC_URL")) text = setEnv(text, "PUBLIC_URL", env.get("AUTH_URL"));
    text = unsetEnv(text, "AUTH_URL");
    step("Renamed AUTH_URL → PUBLIC_URL");
  }
  const appEnv = env.get("APP_ENV");
  if (appEnv && appEnv !== "local") {
    fail(`.env has APP_ENV="${appEnv}". The local stack needs APP_ENV="local" (or unset).`);
  }
  writeFileSync(ENV_FILE, text);
}

const readEnv = () => parseEnv(readFileSync(ENV_FILE, "utf8"));

// ── Ports ─────────────────────────────────────────────────────────────────

/** Host port our own (running) container publishes, if it's up. */
function publishedPort(service, containerPort) {
  try {
    const out = execFileSync("docker", ["compose", "port", service, String(containerPort)], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const port = Number(out.split(":").pop());
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Picks a host port per service: the one our container already uses, else the configured one if
 * free, else the next free one (e.g. a system Redis on 6379 → 6380). Writes the choice and every
 * URL that depends on it back to .env.
 */
async function planPorts() {
  let text = readFileSync(ENV_FILE, "utf8");
  const env = parseEnv(text);
  const taken = new Set();
  for (const s of SERVICES) {
    const configured = Number(env.get(s.portVar)) || s.port;
    let port = publishedPort(s.service, s.container);
    if (!port) {
      port = configured;
      while (taken.has(port) || (await portInUse(port))) port++;
      if (port !== configured) {
        note(`Port ${configured} is busy; ${s.service} will use ${port}`);
      }
    }
    taken.add(port);
    if (port !== s.port || env.has(s.portVar)) text = setEnv(text, s.portVar, port);
    for (const key of s.urls) {
      const url = env.get(key);
      if (url && isLocalUrl(url)) {
        const next = withLocalPort(url, port);
        if (next !== url) text = setEnv(text, key, next);
      }
    }
  }
  writeFileSync(ENV_FILE, text);
}

/**
 * Metro's port, chosen once per machine: METRO_PORT if set, else the first port from 8081 that is
 * free or held by this user (a stale Metro we can stop). Saved to .env, and allowed in CORS so the
 * Expo web preview can call the API.
 */
async function planMetroPort() {
  let text = readFileSync(ENV_FILE, "utf8");
  const env = parseEnv(text);
  let port = Number(env.get("METRO_PORT"));
  if (!port) {
    port = await firstUsablePort(DEFAULT_METRO_PORT);
    if (port !== DEFAULT_METRO_PORT) {
      note(
        `Port ${DEFAULT_METRO_PORT} belongs to another user or the system; Metro will use ${port}`,
      );
      text = setEnv(text, "METRO_PORT", port);
    }
  }
  const origins = (env.get("CORS_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const metroOrigin = `http://localhost:${port}`;
  if (!origins.includes(metroOrigin)) {
    // Replace the previous Metro origin rather than piling them up.
    const kept = origins.filter((o) => !/^http:\/\/localhost:80\d\d$/.test(o));
    text = setEnv(text, "CORS_ORIGINS", [...kept, metroOrigin].join(","));
  }
  writeFileSync(ENV_FILE, text);
  return port;
}

const apiPort = () => Number(readEnv().get("PORT")) || API_PORT;

/** Stops this user's stale dev servers on the given ports (never anyone else's). */
async function freePorts(targets) {
  for (const { port, label } of targets) {
    try {
      const stopped = await freePort(port, label);
      for (const p of stopped)
        note(`Stopped ${p.command} (pid ${p.pid}) that was holding :${port}`);
    } catch (err) {
      fail(err.message);
    }
  }
}

// ── Services and database ─────────────────────────────────────────────────

function startServices() {
  const res = spawnSync("docker", ["compose", "up", "-d", "--wait", "postgres", "redis", "minio"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8",
  });
  if (res.status !== 0) fail(`Docker services didn't start:\n${res.stderr}`);
  step("Postgres, Redis and MinIO are running");
}

/** Runs pnpm the way this script was launched (no global pnpm needed). */
function pnpm(args, opts = {}) {
  const execPath = process.env.npm_execpath;
  const [cmd, argv] =
    execPath && /\.(c?js|mjs)$/.test(execPath)
      ? [process.execPath, [execPath, ...args]]
      : [execPath || "pnpm", args];
  return spawnSync(cmd, argv, { cwd: ROOT, encoding: "utf8", ...opts });
}

function migrate() {
  const res = pnpm(["--filter", "@fitlens/db", "exec", "prisma", "migrate", "deploy"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.status !== 0) fail(`Database migrations failed:\n${res.stdout}\n${res.stderr}`);
  const applied = /(\d+) migrations? found/.exec(res.stdout)?.[1];
  step(
    /No pending migrations/.test(res.stdout)
      ? "Database is up to date"
      : `Database migrated${applied ? ` (${applied} migrations)` : ""}`,
  );
}

/** Seeds an empty catalogue (fresh volume). `pnpm db:seed` re-runs it on demand; it's idempotent. */
function seedIfEmpty() {
  const count = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "fitlens",
      "-d",
      "fitlens",
      "-tAc",
      "select count(*) from foods",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (count.status === 0 && Number(count.stdout.trim()) > 0) return;
  const res = pnpm(["--filter", "@fitlens/db", "exec", "prisma", "db", "seed"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.status !== 0) fail(`Seeding failed:\n${res.stdout}\n${res.stderr}`);
  step("Seeded foods and the exercise library");
}

// ── Mobile ────────────────────────────────────────────────────────────────

function lanAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) return a.address;
    }
  }
  return null;
}

const MOBILE_ENV_MARKER = "# Where the app reaches the API in development";

/**
 * Points the Expo app at this machine, so a phone on the same Wi-Fi reaches the local stack.
 * Keeps it current when the laptop's IP changes (new network). A file you edited yourself (no
 * marker line, or a non-LAN URL such as a tunnel) is left alone.
 */
function ensureMobileEnv() {
  const ip = lanAddress();
  const url = ip ? `http://${ip}:${WEB_PORT}` : null;
  if (!existsSync(MOBILE_ENV)) {
    if (!url)
      return note("No LAN address found; set EXPO_PUBLIC_API_URL in apps/mobile/.env yourself");
    writeFileSync(
      MOBILE_ENV,
      `${MOBILE_ENV_MARKER} (this machine on your Wi-Fi). Builds use eas.json.\nEXPO_PUBLIC_API_URL="${url}"\n`,
    );
    return step(`Created apps/mobile/.env → ${url}`);
  }
  const text = readFileSync(MOBILE_ENV, "utf8");
  const current = parseEnv(text).get("EXPO_PUBLIC_API_URL");
  const generated =
    text.includes(MOBILE_ENV_MARKER) && /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(current ?? "");
  if (url && generated && current !== url) {
    writeFileSync(MOBILE_ENV, setEnv(text, "EXPO_PUBLIC_API_URL", url));
    step(`Your IP changed: apps/mobile/.env → ${url}`);
  }
}

// ── Android emulator ──────────────────────────────────────────────────────

/** The SDK to use, or a clear way to get one. */
function requireSdk() {
  const sdk = findSdk();
  if (!sdk) {
    fail(
      "No Android SDK with an emulator found (checked ANDROID_HOME, ANDROID_SDK_ROOT, ~/Android/Sdk). " +
        "See README → Android emulator.",
    );
  }
  return sdk;
}

/** Ensures the project's AVD exists and is running. Returns its adb serial. */
async function ensureEmulator() {
  const sdk = requireSdk();
  if (!avdExists()) {
    const image = newestSystemImage(sdk);
    if (!image) {
      fail(
        `No system image installed in ${sdk}. Install one: ` +
          `${sdk}/cmdline-tools/latest/bin/sdkmanager "system-images;android-36;google_apis;x86_64"`,
      );
    }
    createAvd(sdk, image);
    step(`Created the "${AVD_NAME}" emulator (${image.split(";").slice(1, 3).join(", ")})`);
  }
  let serial = runningEmulator(sdk);
  if (serial) {
    step(`Emulator already running (${serial})`);
    return serial;
  }
  console.log(dim(`Booting the "${AVD_NAME}" emulator (first boot takes a minute or two)…`));
  try {
    serial = await bootEmulator(sdk);
  } catch (err) {
    fail(err.message);
  }
  step(`Emulator ready (${serial})`);
  return serial;
}

/** Child-process env that points Expo at the same SDK (and adb) as ensureEmulator. */
function androidEnv() {
  const sdk = findSdk();
  if (!sdk) return process.env;
  return {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    PATH: `${join(sdk, "platform-tools")}:${join(sdk, "emulator")}:${process.env.PATH}`,
  };
}

/** Builds the shared contracts, frees Metro's port and runs Expo in the foreground. */
async function startMobile(extraArgs) {
  if (extraArgs.includes("--android")) await ensureEmulator();
  const portArg = extraArgs.indexOf("--port");
  const port = portArg >= 0 ? Number(extraArgs[portArg + 1]) : await planMetroPort();
  if (!Number.isInteger(port) || port <= 0) fail("--port needs a number");
  ensureMobileEnv();
  await freePorts([{ port, label: "Metro" }]);
  if (!(await portInUse(WEB_PORT))) {
    note(
      `Nothing on :${WEB_PORT} yet. Start \`pnpm dev\` in another terminal so the app can reach the API.`,
    );
  }
  const build = pnpm(
    ["turbo", "run", "build", "--filter=@fitlens/contracts", "--output-logs=errors-only"],
    {
      stdio: "inherit",
    },
  );
  if (build.status !== 0) fail("Building @fitlens/contracts failed");
  const args = portArg >= 0 ? extraArgs : ["--port", String(port), ...extraArgs];
  step(`Starting Expo on :${port}`);
  const execPath = process.env.npm_execpath;
  const [cmd, argv] =
    execPath && /\.(c?js|mjs)$/.test(execPath)
      ? [
          process.execPath,
          [execPath, "--filter", "@fitlens/mobile", "exec", "expo", "start", ...args],
        ]
      : [execPath || "pnpm", ["--filter", "@fitlens/mobile", "exec", "expo", "start", ...args]];
  const child = spawn(cmd, argv, { cwd: ROOT, stdio: "inherit", env: androidEnv() });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 130 : 0)));
}

// ── Main ──────────────────────────────────────────────────────────────────

function summary() {
  const env = readEnv();
  const google = env.get("AUTH_GOOGLE_ID") && env.get("AUTH_GOOGLE_SECRET");
  const ai = env.get("AI_PROVIDER") === "anthropic" ? "Claude" : "mock (no API key needed)";
  console.log(`
${green("Local environment ready.")} ${dim("(APP_ENV=local)")}

  pnpm dev           API http://localhost:${apiPort()} · web http://localhost:${WEB_PORT}
  pnpm dev:mobile    Expo on :${env.get("METRO_PORT") || DEFAULT_METRO_PORT} → scan the QR code with Expo Go

  Sign-in   ${env.get("AUTH_DEV_LOGIN") === "false" ? "Google only (AUTH_DEV_LOGIN=false)" : `"Sign in with email (dev)" on web and app${google ? ", plus Google" : ""}`}
  AI        ${ai}
  MinIO     http://localhost:${env.get("MINIO_CONSOLE_PORT") || 9001} ${dim("(fitlens / fitlens-secret)")}
`);
}

const PORT_TARGETS = {
  web: () => ({ port: WEB_PORT, label: "web" }),
  api: () => ({ port: apiPort(), label: "API" }),
};

/** Everything a dev server needs before it starts: .env, Docker services, migrations, seed, ports. */
async function prepare(targets) {
  const env = readEnv();
  // A remote database (e.g. a shared dev DB) means no local Docker services to manage.
  const localInfra = isLocalUrl(env.get("DATABASE_URL") ?? "");
  if (localInfra) {
    checkDocker();
    await planPorts();
    startServices();
  } else {
    note("DATABASE_URL isn't local; skipping Docker services");
  }
  migrate();
  if (localInfra) seedIfEmpty();
  await planMetroPort();
  ensureMobileEnv();
  await freePorts(targets);
}

// ── Everything at once ────────────────────────────────────────────────────

const SERVER_LOG = join(ROOT, ".dev/servers.log");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polls until the API answers its liveness probe and the web server accepts connections. */
async function waitForServers(server, timeoutMs = 180_000) {
  const api = `http://127.0.0.1:${apiPort()}/api/health/live`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) fail(`API/web stopped while starting. See ${SERVER_LOG}`);
    const apiUp = await fetch(api, { signal: AbortSignal.timeout(1000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (apiUp && (await portInUse(WEB_PORT))) return;
    await sleep(1000);
  }
  fail(`API/web didn't come up in ${timeoutMs / 1000}s. See ${SERVER_LOG}`);
}

/**
 * One terminal for the whole stack: services → API + web (logs in .dev/servers.log, errors echoed)
 * → emulator → Expo in the foreground on the emulator. Ctrl+C stops the servers and Expo; the
 * emulator window stays open for next time.
 */
async function startAll(extraArgs) {
  await prepare([PORT_TARGETS.web(), PORT_TARGETS.api()]);

  mkdirSync(dirname(SERVER_LOG), { recursive: true });
  const log = createWriteStream(SERVER_LOG, { flags: "w" });
  const execPath = process.env.npm_execpath;
  const turboArgs = [
    "turbo",
    "run",
    "dev",
    "--filter=@fitlens/api",
    "--filter=@fitlens/web",
    "--ui=stream",
  ];
  const [cmd, argv] =
    execPath && /\.(c?js|mjs)$/.test(execPath)
      ? [process.execPath, [execPath, ...turboArgs]]
      : [execPath || "pnpm", turboArgs];
  // Own process group, so one signal stops turbo and every dev server under it.
  const server = spawn(cmd, argv, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const stopServers = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already stopped
    }
  };
  process.on("exit", stopServers);
  for (const sig of ["SIGINT", "SIGTERM"]) process.once(sig, () => process.exit(130));

  // Full logs to the file; only problems to the terminal, so Expo's QR code and menu stay readable.
  const PROBLEM = /\b(error|warn|exception|failed|EADDRINUSE)\b/i;
  for (const stream of [server.stdout, server.stderr]) {
    let buffer = "";
    stream.on("data", (chunk) => {
      log.write(chunk);
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines)
        if (PROBLEM.test(line)) console.log(`${yellow("[server]")} ${line.trim()}`);
    });
  }
  console.log(dim(`API + web starting (full logs: tail -f .dev/servers.log)…`));

  await Promise.all([waitForServers(server), ensureEmulator()]);
  step(`API http://localhost:${apiPort()} · web http://localhost:${WEB_PORT}`);
  await startMobile(["--android", ...extraArgs]);
}

/** Stops everything start:all started. Other users' and system processes are never touched. */
async function stopAll() {
  const env = existsSync(ENV_FILE) ? readEnv() : new Map();
  const metro = Number(env.get("METRO_PORT")) || DEFAULT_METRO_PORT;
  for (const { port, label } of [
    { port: WEB_PORT, label: "web" },
    { port: Number(env.get("PORT")) || API_PORT, label: "API" },
    { port: metro, label: "Metro" },
  ]) {
    try {
      const stopped = await freePort(port, label);
      step(stopped.length ? `Stopped ${label} (:${port})` : `${label} wasn't running`);
    } catch (err) {
      note(err.message);
    }
  }
  step(
    (await stopEmulator(findSdk()))
      ? `Stopped the "${AVD_NAME}" emulator`
      : "Emulator wasn't running",
  );
  const docker = spawnSync("docker", ["compose", "stop"], { cwd: ROOT, stdio: "ignore" });
  step(
    docker.status === 0
      ? "Stopped Postgres, Redis and MinIO (data kept)"
      : "Docker services weren't running",
  );
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const commands = ["bootstrap", "preflight", "free", "mobile", "emulator", "all", "stop"];
  if (!commands.includes(command)) {
    console.error(
      "Usage: node scripts/local.mjs bootstrap | preflight [web] [api] | free <web|api>... | mobile [expo args] | emulator | all | stop",
    );
    process.exit(2);
  }
  if (command === "stop") return stopAll(); // works on any Node: nothing to build
  checkNode();
  if (command === "emulator") return void (await ensureEmulator());
  ensureEnvFile();
  if (command === "mobile") return startMobile(rest);
  if (command === "all") return startAll(rest);
  const targets = rest.map((name) => {
    if (!PORT_TARGETS[name]) fail(`Unknown port "${name}" (use web or api)`);
    return PORT_TARGETS[name]();
  });
  if (command === "free") return freePorts(targets);
  await prepare(targets);
  if (command === "bootstrap") summary();
}

main().catch((err) => {
  if (err instanceof SetupError) {
    console.error(`${red("✗")} ${err.message}`);
    process.exit(1);
  }
  throw err;
});
