#!/usr/bin/env node
// FITR8 repo knowledge base: keeps .claude/context/*.md in step with the code.
//
// Each section (sections.json) owns some path prefixes and one markdown file. `.index.json` stores a
// content hash of every file a section owned when its markdown was last synced. A section is stale
// when any of its files was added, removed or changed since then — whether by Claude, a teammate's
// commit, or a hand edit. No dependencies: plain Node (>=18), run from anywhere.
//
//   node .claude/context/ctx.mjs status [--json]      which sections are stale, and which files
//   node .claude/context/ctx.mjs sync <name...|--all>  record current state after updating the .md
//   node .claude/context/ctx.mjs hook <session-start|post-edit|stop>   (Claude Code hooks, JSON on stdin)

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SECTIONS_FILE = join(HERE, "sections.json");
const INDEX_FILE = join(HERE, ".index.json");
const SESSION_DIR = join(HERE, ".session");
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|icns|ttf|otf|woff2?|mp4|mov|zip|pdf|lock)$/i;
const SKIP_PATH = /(^|\/)(node_modules|dist|\.next|\.turbo|generated|coverage)\//;

const sections = () => JSON.parse(readFileSync(SECTIONS_FILE, "utf8")).sections;
const loadIndex = () =>
  existsSync(INDEX_FILE) ? JSON.parse(readFileSync(INDEX_FILE, "utf8")) : {};
const saveIndex = (idx) => writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 1) + "\n");

function owns(section, rel) {
  return section.paths.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
}

function repoFiles() {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    },
  ).toString();
  return out
    .split("\0")
    .filter(
      (f) => f && !SKIP_EXT.test(f) && !SKIP_PATH.test(f) && !f.startsWith(".claude/context/"),
    )
    .filter((f) => existsSync(join(ROOT, f)));
}

function hashFile(rel) {
  return createHash("sha1")
    .update(readFileSync(join(ROOT, rel)))
    .digest("hex")
    .slice(0, 12);
}

/** Current {file: hash} for one section. */
function snapshot(section, files) {
  const snap = {};
  for (const f of files) if (owns(section, f)) snap[f] = hashFile(f);
  return snap;
}

/** [{name, file, changed, added, removed}] for every stale section. */
function staleSections() {
  const idx = loadIndex();
  const files = repoFiles();
  const result = [];
  for (const s of sections()) {
    if (!s.paths.length) continue; // hand-maintained (risks, decisions)
    const before = idx[s.name]?.files;
    const now = snapshot(s, files);
    if (!before) {
      result.push({
        name: s.name,
        file: s.file,
        neverSynced: true,
        changed: [],
        added: [],
        removed: [],
      });
      continue;
    }
    const changed = [],
      added = [],
      removed = [];
    for (const [f, h] of Object.entries(now)) {
      if (!(f in before)) added.push(f);
      else if (before[f] !== h) changed.push(f);
    }
    for (const f of Object.keys(before)) if (!(f in now)) removed.push(f);
    if (changed.length + added.length + removed.length)
      result.push({ name: s.name, file: s.file, changed, added, removed });
  }
  return result;
}

function describe(stale, limit = 12) {
  return stale
    .map((s) => {
      if (s.neverSynced) return `- ${s.name} (.claude/context/${s.file}): never synced`;
      const parts = [
        ...s.changed.map((f) => `~ ${f}`),
        ...s.added.map((f) => `+ ${f}`),
        ...s.removed.map((f) => `- ${f}`),
      ];
      const more = parts.length > limit ? `\n    … and ${parts.length - limit} more` : "";
      return `- ${s.name} (.claude/context/${s.file}):\n    ${parts.slice(0, limit).join("\n    ")}${more}`;
    })
    .join("\n");
}

function sync(names) {
  const all = sections().filter((s) => s.paths.length);
  const targets = names.includes("--all") ? all : all.filter((s) => names.includes(s.name));
  const unknown = names.filter((n) => n !== "--all" && !all.some((s) => s.name === n));
  if (unknown.length)
    throw new Error(
      `Unknown section(s): ${unknown.join(", ")}. Known: ${all.map((s) => s.name).join(", ")}`,
    );
  if (!targets.length) throw new Error("Name the section(s) to sync, or --all.");
  const idx = loadIndex();
  const files = repoFiles();
  const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT })
    .toString()
    .trim();
  for (const s of targets)
    idx[s.name] = { syncedAt: new Date().toISOString(), head, files: snapshot(s, files) };
  saveIndex(idx);
  // Synced sections no longer need a refresh in any open session.
  return targets.map((s) => s.name);
}

// ---------- hooks ----------

function readStdin() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const sessionFile = (id) =>
  join(SESSION_DIR, `${String(id || "default").replace(/[^\w-]/g, "_")}.json`);

function sessionEdits(id) {
  const f = sessionFile(id);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
}

function pruneOldSessions() {
  if (!existsSync(SESSION_DIR)) return;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  for (const f of readdirSync(SESSION_DIR)) {
    const p = join(SESSION_DIR, f);
    if (statSync(p).mtimeMs < weekAgo) unlinkSync(p);
  }
}

function hookSessionStart(input) {
  pruneOldSessions();
  const list = sections()
    .map((s) => `- ${s.name}: .claude/context/${s.file} — ${s.summary}`)
    .join("\n");
  const stale = staleSections();
  const staleText = stale.length
    ? `\nSTALE sections (code changed since their notes were written; trust the code, and refresh the notes before relying on them):\n${describe(stale, 6)}`
    : "\nAll code-backed sections are in sync with the code.";
  const context = `FITR8 knowledge base (.claude/context/, read README.md for the protocol). Read the relevant section before exploring code; it holds verified facts with file:line refs.\n${list}${staleText}`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    }),
  );
}

function hookPostEdit(input) {
  const p =
    input?.tool_input?.file_path ??
    input?.tool_input?.notebook_path ??
    input?.tool_response?.filePath;
  if (!p) return;
  const abs = isAbsolute(p) ? p : resolve(input.cwd || ROOT, p);
  const rel = relative(ROOT, abs);
  if (rel.startsWith("..") || rel.startsWith(".claude/context/")) return;
  if (!sections().some((s) => owns(s, rel))) return;
  mkdirSync(SESSION_DIR, { recursive: true });
  const edits = new Set(sessionEdits(input.session_id));
  edits.add(rel);
  writeFileSync(sessionFile(input.session_id), JSON.stringify([...edits]));
}

function hookStop(input) {
  if (input?.stop_hook_active) return; // already asked once this turn: never loop
  const edits = new Set(sessionEdits(input.session_id));
  if (!edits.size) return;
  const stale = staleSections().filter(
    (s) => s.neverSynced || [...s.changed, ...s.added, ...s.removed].some((f) => edits.has(f)),
  );
  if (!stale.length) {
    unlinkSync(sessionFile(input.session_id));
    return;
  }
  const names = stale.map((s) => s.name).join(" ");
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `Knowledge base out of date for code you changed this session:\n${describe(stale)}\n\n` +
        `Update those .claude/context/*.md files so they describe the code as it is now (facts with file:line refs; ` +
        `move fixed items out of "Known issues"; add new risks to risks.md), then run:\n` +
        `node .claude/context/ctx.mjs sync ${names}\n` +
        `If the change doesn't alter any documented fact, just run the sync command.`,
    }),
  );
}

// ---------- cli ----------

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === "status") {
    const stale = staleSections();
    if (args.includes("--json")) console.log(JSON.stringify(stale, null, 2));
    else console.log(stale.length ? `Stale:\n${describe(stale, 50)}` : "All sections in sync.");
  } else if (cmd === "sync") {
    console.log(`Synced: ${sync(args).join(", ")}`);
  } else if (cmd === "hook") {
    const input = readStdin();
    if (args[0] === "session-start") hookSessionStart(input);
    else if (args[0] === "post-edit") hookPostEdit(input);
    else if (args[0] === "stop") hookStop(input);
    else throw new Error(`Unknown hook: ${args[0]}`);
  } else {
    console.log(
      "Usage: ctx.mjs status [--json] | sync <section...|--all> | hook <session-start|post-edit|stop>",
    );
    process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  // Hooks must never break a session: report and exit 0 (a non-2 code only shows a notice).
  console.error(`ctx.mjs: ${err.message}`);
  process.exit(cmd === "hook" ? 0 : 1);
}
