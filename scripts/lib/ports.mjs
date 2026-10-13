// Fixed dev-server ports, and freeing them from stale processes before a start.
import { execFileSync } from "node:child_process";
import { connect } from "node:net";

/**
 * One port per dev server. Web and API are fixed (PUBLIC_URL, API_INTERNAL_URL and the Google
 * redirect URI depend on them). Metro defaults to 8081; `pnpm bootstrap` moves it to the first port
 * not held by another user or the system, and saves it as METRO_PORT in .env.
 */
export const WEB_PORT = 3000;
export const API_PORT = 4000;
export const DEFAULT_METRO_PORT = 8081;

/** True when something accepts TCP connections on 127.0.0.1:port. */
export const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });

/** `lsof -Fpc` output: lines `p<pid>` then `c<command>`. */
export function parseLsof(out) {
  const procs = [];
  let current = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("p")) {
      current = { pid: Number(line.slice(1)), command: "?" };
      procs.push(current);
    } else if (line.startsWith("c") && current) {
      current.command = line.slice(1);
    }
  }
  return dedupe(procs.filter((p) => Number.isInteger(p.pid) && p.pid > 0));
}

/** `ss -ltnpH` output: `users:(("node",pid=123,fd=21),("node",pid=124,fd=21))`. */
export function parseSs(out) {
  const procs = [];
  for (const m of out.matchAll(/\("([^"]+)",pid=(\d+)/g)) {
    procs.push({ pid: Number(m[2]), command: m[1] });
  }
  return dedupe(procs);
}

const dedupe = (procs) => [...new Map(procs.map((p) => [p.pid, p])).values()];

/**
 * Processes listening on a port that this user can see, which is to say its own (without root,
 * neither tool shows other users' processes). An empty list for a busy port means "not ours".
 */
export function listeners(port) {
  const run = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (err) {
      // lsof exits 1 when nothing matches; that's an answer, not a failure.
      return typeof err?.stdout === "string" ? err.stdout : null;
    }
  };
  const lsof = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"]);
  if (lsof !== null) return parseLsof(lsof);
  const ss = run("ss", ["-ltnpH", `sport = :${port}`]);
  if (ss !== null) return parseSs(ss);
  return [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFree(port, ms) {
  for (let waited = 0; waited < ms; waited += 100) {
    if (!(await portInUse(port))) return true;
    await sleep(100);
  }
  return !(await portInUse(port));
}

/**
 * Frees a dev port: stops this user's processes listening on it (SIGTERM, then SIGKILL after 3 s).
 * Throws with a clear reason when the holder belongs to another user or the system, which we never
 * touch. Returns the processes it stopped.
 */
export async function freePort(port, label) {
  if (!(await portInUse(port))) return [];
  const procs = listeners(port).filter((p) => p.pid !== process.pid);
  if (!procs.length) {
    throw new Error(
      `Port ${port} (${label}) is held by another user or a system service, so it won't be stopped. ` +
        `Free it, or pick another port${label === "Metro" ? " with METRO_PORT in .env" : ""}.`,
    );
  }
  for (const p of procs) {
    try {
      process.kill(p.pid, "SIGTERM");
    } catch (err) {
      if (err.code !== "ESRCH")
        throw new Error(`Can't stop ${p.command} (pid ${p.pid}) on port ${port}: ${err.message}`);
    }
  }
  if (!(await waitFree(port, 3000))) {
    for (const p of procs) {
      try {
        process.kill(p.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    if (!(await waitFree(port, 2000)))
      throw new Error(`Port ${port} (${label}) is still busy after stopping its process.`);
  }
  return procs;
}

/** First port from `start` that's free or held by this user (so it can be freed at start). */
export async function firstUsablePort(start, attempts = 20) {
  for (let port = start; port < start + attempts; port++) {
    if (!(await portInUse(port)) || listeners(port).length) return port;
  }
  throw new Error(`No usable port in ${start}–${start + attempts - 1}.`);
}
