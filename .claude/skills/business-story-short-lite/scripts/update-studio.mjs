#!/usr/bin/env node
// Brings an existing studio up to date with this copy of the skill, without touching its films.
//
//   node update-studio.mjs "<studio>" [--dry] [--take-library]
//
// Replaced from the skill's template: src/engine, src/sheets, src/Root.tsx, src/index.ts, tools (not tools/bin),
// the two example films (src/films/md, src/films/ggsp), public/fonts, public/tex, docs (the reference pages).
// The library (src/assets) is the studio's own as much as the skill's, so it is handled file by file:
//   - a file the studio does not have is added;
//   - a file the studio has not changed since the skill delivered it takes the skill's newer version;
//   - a file the studio HAS changed (a new character in cast.ts, a restyled set) is kept and listed.
// The studio's record of what the skill delivered is .skill.json. A studio without one (set up by an older copy of
// the skill) cannot tell the two cases apart, so every differing library file is kept and listed.
// Never touched: every other film, src/films/index.ts, node_modules, out, public/audio, public/sfx.
//   --dry           list what would change and write nothing
//   --take-library  take the skill's version of every differing library file as well; the studio's copies are
//                   saved under _replaced/<date>/ first. Use it when the studio has not changed them itself.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashOf, key, readRecord, walk, writeRecord } from "./lib.mjs";

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = join(skill, "template");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const takeLibrary = args.includes("--take-library");
const dest = resolve(args.find((a) => !a.startsWith("--")) ?? "");
if (!existsSync(join(dest, "src", "engine")) || !existsSync(join(dest, "tools"))) {
  console.log('usage: node update-studio.mjs "<studio>" [--dry] [--take-library]   (the folder must be a studio: it has src/engine and tools)');
  process.exit(2);
}

const same = (a, b) => existsSync(b) && statSync(a).size === statSync(b).size && readFileSync(a).equals(readFileSync(b));
let replaced = 0;
let added = 0;
const kept = [];
const put = (from, to) => {
  if (dry) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
};

// ---- replaced outright: the engine, the tools, the examples, the docs
const replace = [
  ["src/engine", "src/engine"],
  ["src/sheets", "src/sheets"],
  ["src/Root.tsx", "src/Root.tsx"],
  ["src/index.ts", "src/index.ts"],
  ["src/films/md", "src/films/md"],
  ["src/films/ggsp", "src/films/ggsp"],
  ["tools", "tools"],
  ["public/fonts", "public/fonts"],
  ["public/tex", "public/tex"],
  ["package.json", "package.json"],
  ["tsconfig.json", "tsconfig.json"],
  ["README.md", "README.md"],
];
for (const [a, b] of replace) {
  const from = join(template, a);
  if (!existsSync(from)) continue;
  const files = statSync(from).isDirectory() ? walk(from) : [from];
  for (const f of files) {
    const to = join(dest, b, statSync(from).isDirectory() ? relative(from, f) : "");
    if (same(f, to)) continue;
    const had = existsSync(to);
    console.log(`  ${had ? "update" : "add   "} ${relative(dest, to)}`);
    put(f, to);
    if (had) replaced++;
    else added++;
  }
}
for (const f of walk(join(skill, "references"))) {
  const to = join(dest, "docs", relative(join(skill, "references"), f));
  if (same(f, to)) continue;
  const had = existsSync(to);
  console.log(`  ${had ? "update" : "add   "} ${relative(dest, to)}`);
  put(f, to);
  if (had) replaced++;
  else added++;
}

// ---- the library, file by file
const record = readRecord(dest);
const library = { ...(record?.library ?? {}) };
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
for (const f of walk(join(template, "src", "assets"))) {
  const rel = join("src", "assets", relative(join(template, "src", "assets"), f));
  const to = join(dest, rel);
  const k = key(rel);
  if (!existsSync(to)) {
    console.log(`  add    ${rel}`);
    put(f, to);
    added++;
    library[k] = hashOf(f);
  } else if (same(f, to)) {
    library[k] = hashOf(f);
  } else if (library[k] && hashOf(to) === library[k]) {
    // untouched by the studio since the skill delivered it: the skill's copy is simply newer
    console.log(`  update ${rel}`);
    put(f, to);
    replaced++;
    library[k] = hashOf(f);
  } else if (takeLibrary) {
    console.log(`  update ${rel}   (the studio's copy is saved in _replaced/${stamp}/)`);
    put(to, join(dest, "_replaced", stamp, rel));
    put(f, to);
    replaced++;
    library[k] = hashOf(f);
  } else kept.push(rel);
}
if (!dry) writeRecord(dest, library);

console.log(`${dry ? "would change" : "changed"}: ${replaced} file(s) updated, ${added} added`);
if (kept.length) {
  console.log(
    record
      ? "kept, because the studio has changed them since the skill delivered them (merge by hand what you want of the skill's version, which is in the skill's template/ folder):"
      : "kept, because this studio has no record of what the skill delivered, so a file that differs may be the studio's own work.\nIf nobody has changed these in the studio, run again with --take-library (the studio's copies are saved under _replaced/ first):",
  );
  for (const k of kept) console.log(`  ${k}`);
}
const pin = JSON.parse(readFileSync(join(template, "package.json"), "utf8")).dependencies.remotion;
const have = existsSync(join(dest, "node_modules", "remotion", "package.json")) ? JSON.parse(readFileSync(join(dest, "node_modules", "remotion", "package.json"), "utf8")).version : null;
if (have && have !== pin) console.log(`note: the studio has Remotion ${have} installed and the skill now pins ${pin}: run npm install there (a download: ask the user first)`);
console.log(dry ? "nothing was written (--dry)" : "next: node tools/doctor.mjs   (the type check there will show any film that needs a change)");
