import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateSecret,
  isLocalUrl,
  parseEnv,
  setEnv,
  unsetEnv,
  withLocalPort,
} from "./env-file.mjs";

describe("parseEnv", () => {
  it("reads quoted, unquoted and commented values", () => {
    const env = parseEnv(
      ["# comment", 'A="x y"', "B='z'", "C=plain # note", "export D=1", "", "E=", "bad line"].join(
        "\n",
      ),
    );
    assert.deepEqual(Object.fromEntries(env), { A: "x y", B: "z", C: "plain", D: "1", E: "" });
  });
});

describe("setEnv", () => {
  it("replaces in place, keeping comments and order", () => {
    const text = '# top\nA="1"\n# keep\nB="2"\n';
    assert.equal(setEnv(text, "A", "9"), '# top\nA="9"\n# keep\nB="2"\n');
  });

  it("appends a missing key and drops duplicates", () => {
    assert.equal(setEnv('A="1"', "B", "2"), 'A="1"\nB="2"\n');
    assert.equal(setEnv("", "B", "2"), 'B="2"\n');
    assert.equal(setEnv('A="1"\nA="2"\n', "A", "3"), 'A="3"\n');
  });

  it("escapes quotes", () => {
    assert.equal(parseEnv(setEnv("", "A", 'say "hi"')).get("A"), 'say \\"hi\\"');
  });
});

describe("unsetEnv", () => {
  it("removes every line for the key", () => {
    assert.equal(unsetEnv('A="1"\nB="2"\nA="3"', "A"), 'B="2"');
  });
});

describe("withLocalPort / isLocalUrl", () => {
  it("rewrites local ports only", () => {
    assert.equal(
      withLocalPort("postgresql://u:p@localhost:5432/db?schema=public", 5433),
      "postgresql://u:p@localhost:5433/db?schema=public",
    );
    assert.equal(withLocalPort("redis://localhost:6379", 6380), "redis://localhost:6380");
    assert.equal(withLocalPort("http://localhost:9000", 9002), "http://localhost:9002");
    assert.equal(withLocalPort("postgres://u@db.neon.tech/db", 1), "postgres://u@db.neon.tech/db");
    assert.equal(withLocalPort("not a url", 1), "not a url");
    assert.equal(isLocalUrl("redis://127.0.0.1:6379"), true);
    assert.equal(isLocalUrl("https://fitlens.app"), false);
  });
});

describe("generateSecret", () => {
  it("is long enough for AUTH_SECRET and random", () => {
    const a = generateSecret();
    assert.ok(a.length >= 32);
    assert.notEqual(a, generateSecret());
  });
});
