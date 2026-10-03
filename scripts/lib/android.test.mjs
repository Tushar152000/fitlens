import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { findSdk, newestSystemImage, parseAdbDevices } from "./android.mjs";

function fakeSdk(root, { emulator = true } = {}) {
  mkdirSync(join(root, "platform-tools"), { recursive: true });
  writeFileSync(join(root, "platform-tools/adb"), "");
  if (emulator) {
    mkdirSync(join(root, "emulator"), { recursive: true });
    writeFileSync(join(root, "emulator/emulator"), "");
  }
  return root;
}

describe("findSdk", () => {
  it("skips an SDK without an emulator in favour of ~/Android/Sdk", () => {
    const base = mkdtempSync(join(tmpdir(), "sdk-"));
    const legacy = fakeSdk(join(base, "opt"), { emulator: false });
    const home = join(base, "home");
    const modern = fakeSdk(join(home, "Android/Sdk"));
    assert.equal(findSdk({ ANDROID_HOME: legacy }, home), modern);
  });

  it("uses ANDROID_HOME when it works, and returns null when nothing does", () => {
    const base = mkdtempSync(join(tmpdir(), "sdk-"));
    const good = fakeSdk(join(base, "custom"));
    assert.equal(findSdk({ ANDROID_HOME: good }, join(base, "nohome")), good);
    assert.equal(findSdk({}, join(base, "nohome")), null);
  });
});

describe("newestSystemImage", () => {
  it("picks the highest API level, preferring Google APIs images", () => {
    const sdk = mkdtempSync(join(tmpdir(), "sdk-"));
    for (const p of [
      "android-34/google_apis/x86_64",
      "android-36/default/x86_64",
      "android-36/google_apis/x86_64",
      "android-37/google_apis/arm64-v8a",
    ]) {
      mkdirSync(join(sdk, "system-images", p), { recursive: true });
    }
    assert.equal(newestSystemImage(sdk, "x86_64"), "system-images;android-36;google_apis;x86_64");
    assert.equal(
      newestSystemImage(sdk, "arm64-v8a"),
      "system-images;android-37;google_apis;arm64-v8a",
    );
    assert.equal(newestSystemImage(mkdtempSync(join(tmpdir(), "empty-"))), null);
  });
});

describe("parseAdbDevices", () => {
  it("lists attached emulators only", () => {
    const out = [
      "List of devices attached",
      "emulator-5554\tdevice",
      "emulator-5556\toffline",
      "R58M12ABCDE\tdevice",
      "",
    ].join("\n");
    assert.deepEqual(parseAdbDevices(out), ["emulator-5554"]);
  });
});
