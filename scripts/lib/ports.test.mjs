import assert from "node:assert/strict";
import { createServer } from "node:net";
import { describe, it } from "node:test";
import { firstUsablePort, freePort, parseLsof, parseSs, portInUse } from "./ports.mjs";

describe("parseLsof", () => {
  it("reads pid/command pairs and drops duplicates", () => {
    assert.deepEqual(parseLsof("p123\ncnode\np456\ncnext-server\np123\ncnode\n"), [
      { pid: 123, command: "node" },
      { pid: 456, command: "next-server" },
    ]);
    assert.deepEqual(parseLsof(""), []);
  });
});

describe("parseSs", () => {
  it("reads every process on the line", () => {
    const line =
      'LISTEN 0 511 *:3000 *:* users:(("next-server (v1",pid=4242,fd=21),("node",pid=4243,fd=21))';
    assert.deepEqual(parseSs(line), [
      { pid: 4242, command: "next-server (v1" },
      { pid: 4243, command: "node" },
    ]);
  });

  it("finds nothing when the owner is hidden (another user)", () => {
    assert.deepEqual(parseSs("LISTEN 0 5 127.0.0.1:8081 0.0.0.0:*"), []);
  });
});

describe("freePort", () => {
  it("is a no-op on a free port", async () => {
    const server = createServer().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const { port } = server.address();
    await new Promise((r) => server.close(r));
    assert.deepEqual(await freePort(port, "test"), []);
  });

  it("never kills this process, and explains why it stops", async () => {
    const server = createServer().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const { port } = server.address();
    try {
      assert.equal(await portInUse(port), true);
      // The only listener is the test runner itself, so it must refuse rather than kill it.
      await assert.rejects(freePort(port, "test"), /held by another user or a system service/);
      assert.equal(await portInUse(port), true);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe("firstUsablePort", () => {
  it("returns the start port when it's free", async () => {
    const server = createServer().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const { port } = server.address();
    await new Promise((r) => server.close(r));
    assert.equal(await firstUsablePort(port, 1), port);
  });
});
