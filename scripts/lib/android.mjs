// Android emulator for local development: find a usable SDK, create the project's AVD once, boot it.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AVD_NAME = "fitlens";

/**
 * The first SDK that can run an emulator. Order: ANDROID_HOME, ANDROID_SDK_ROOT, then the default
 * Android Studio locations — an old system SDK (e.g. /opt/android-sdk with only the legacy `tools/`)
 * in ANDROID_HOME doesn't hide a working one in ~/Android/Sdk.
 */
export function findSdk(env = process.env, home = homedir()) {
  const candidates = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    join(home, "Android/Sdk"),
    join(home, "Library/Android/sdk"),
  ].filter(Boolean);
  return candidates.find((dir) => isUsableSdk(dir)) ?? null;
}

export const isUsableSdk = (dir) =>
  existsSync(join(dir, "emulator/emulator")) && existsSync(join(dir, "platform-tools/adb"));

const tool = (sdk, rel) => join(sdk, rel);
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

/** Newest installed x86_64/arm64 system image, as an sdkmanager package id. */
export function newestSystemImage(sdk, arch = process.arch === "arm64" ? "arm64-v8a" : "x86_64") {
  const root = join(sdk, "system-images");
  if (!existsSync(root)) return null;
  const images = [];
  for (const api of readdirSync(root)) {
    const level = Number(api.replace("android-", ""));
    if (!Number.isFinite(level)) continue;
    for (const tag of readdirSync(join(root, api))) {
      if (existsSync(join(root, api, tag, arch)))
        images.push({ level, id: `system-images;${api};${tag};${arch}`, tag });
    }
  }
  // Prefer the highest API level; at equal levels prefer Google APIs images.
  images.sort(
    (a, b) =>
      b.level - a.level || Number(b.tag.startsWith("google")) - Number(a.tag.startsWith("google")),
  );
  return images[0]?.id ?? null;
}

export function avdExists(name = AVD_NAME, home = homedir()) {
  return existsSync(join(home, ".android/avd", `${name}.ini`));
}

/** Creates the project's AVD (Pixel 8 profile) with settings that make it pleasant for development. */
export function createAvd(sdk, image, name = AVD_NAME, home = homedir()) {
  const avdmanager = tool(sdk, "cmdline-tools/latest/bin/avdmanager");
  if (!existsSync(avdmanager))
    throw new Error(`avdmanager not found in ${sdk}/cmdline-tools/latest`);
  run(
    avdmanager,
    ["create", "avd", "--name", name, "--package", image, "--device", "pixel_8", "--force"],
    {
      input: "no\n", // "Do you wish to create a custom hardware profile?"
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
    },
  );
  const config = join(home, ".android/avd", `${name}.avd`, "config.ini");
  const settings = {
    "hw.keyboard": "yes", // type with the laptop keyboard
    "hw.ramSize": "4096",
    "disk.dataPartition.size": "6G",
    "hw.gpu.enabled": "yes",
    "hw.gpu.mode": "auto",
    showDeviceFrame: "no",
  };
  let text = readFileSync(config, "utf8");
  for (const [key, value] of Object.entries(settings)) {
    const line = `${key}=${value}`;
    text = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m").test(text)
      ? text.replace(new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m"), line)
      : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(config, text);
}

/** `adb devices` output → serials of running emulators that are fully attached. */
export function parseAdbDevices(out) {
  return out
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter(([serial, state]) => serial?.startsWith("emulator-") && state === "device")
    .map(([serial]) => serial);
}

/** Serial of the running emulator for this AVD, if any. */
export function runningEmulator(sdk, name = AVD_NAME) {
  const adb = tool(sdk, "platform-tools/adb");
  let out = "";
  try {
    out = run(adb, ["devices"]);
  } catch {
    return null;
  }
  for (const serial of parseAdbDevices(out)) {
    try {
      const avd = run(adb, ["-s", serial, "emu", "avd", "name"]).split("\n")[0].trim();
      if (avd === name) return serial;
    } catch {
      // device went away
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Boots the AVD in the background (it outlives this script) and waits until Android has finished
 * booting. Logs go to ~/.android/<name>-emulator.log.
 */
export async function bootEmulator(
  sdk,
  name = AVD_NAME,
  { timeoutMs = 240_000, home = homedir() } = {},
) {
  const log = join(home, ".android", `${name}-emulator.log`);
  const out = openSync(log, "a");
  const child = spawn(
    tool(sdk, "emulator/emulator"),
    ["-avd", name, "-netdelay", "none", "-netspeed", "full"],
    {
      detached: true,
      stdio: ["ignore", out, out],
      env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
    },
  );
  child.unref();
  let exited = null;
  child.once("exit", (code) => (exited = code));

  const adb = tool(sdk, "platform-tools/adb");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited !== null) throw new Error(`The emulator exited (code ${exited}). See ${log}`);
    const serial = runningEmulator(sdk, name);
    if (serial) {
      try {
        if (run(adb, ["-s", serial, "shell", "getprop", "sys.boot_completed"]).trim() === "1")
          return serial;
      } catch {
        // still starting
      }
    }
    await sleep(2000);
  }
  throw new Error(`The emulator didn't finish booting in ${timeoutMs / 1000}s. See ${log}`);
}

/** PIDs of this AVD's emulator processes (the launcher execs qemu with the same `-avd` argument). */
export function emulatorPids(name = AVD_NAME) {
  let out = "";
  try {
    out = run("ps", ["-eo", "pid=,args="]);
  } catch {
    return [];
  }
  return out
    .split("\n")
    .filter((line) => /(emulator|qemu-system)/.test(line) && line.includes(`-avd ${name}`))
    .map((line) => Number(line.trim().split(/\s+/)[0]))
    .filter((pid) => Number.isInteger(pid) && pid !== process.pid);
}

/** Shuts the AVD down: asks politely over adb, then stops its processes if it's still up after 10 s. */
export async function stopEmulator(sdk, name = AVD_NAME) {
  const serial = sdk ? runningEmulator(sdk, name) : null;
  if (serial) {
    try {
      run(tool(sdk, "platform-tools/adb"), ["-s", serial, "emu", "kill"]);
    } catch {
      // fall through to signals
    }
  }
  for (let waited = 0; waited < 10_000 && emulatorPids(name).length; waited += 500)
    await sleep(500);
  const left = emulatorPids(name);
  for (const pid of left) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  return Boolean(serial || left.length);
}
