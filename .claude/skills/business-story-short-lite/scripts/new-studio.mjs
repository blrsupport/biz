#!/usr/bin/env node
// Sets up a studio: one project folder that holds the engine, the asset library and every film made with it.
// Do this once per machine; after that, each new film is `node tools/new-film.mjs` inside the studio.
//
//   node new-studio.mjs "<dest>" [--deps-from "<project>"] [--install] [--ffmpeg "<path to a full ffmpeg>"]
//
//   --deps-from  copy node_modules (and ffmpeg, if it has one) from an existing studio or another Remotion project
//                with the same Remotion version. No network; a minute or two.
//   --install    run `npm install` and fetch Remotion's headless browser instead. This DOWNLOADS about 500 MB:
//                tell the user what will be fetched and get a yes first.
//   --ffmpeg     a full ffmpeg build to copy into tools/bin (Remotion's own is cut down and will not do).
//
// Nothing is downloaded unless --install is given.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashOf, key, walk, writeRecord } from "./lib.mjs";

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = join(skill, "template");
const args = process.argv.slice(2);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const destArg = args.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--deps-from", "--ffmpeg"].includes(args[i - 1])));
if (!destArg) {
  console.log('usage: node new-studio.mjs "<dest>" [--deps-from "<project>"] [--install] [--ffmpeg "<path>"]');
  process.exit(2);
}
const dest = resolve(destArg);
if (existsSync(dest) && readdirSync(dest).length) throw new Error(`${dest} exists and is not empty. A studio is made once; start films inside it with node tools/new-film.mjs`);
if (dest.length > 90) console.log(`note: "${dest}" is a long path; the headless browser inside node_modules can run past Windows' 260-character limit. A shorter path is safer.`);
const exe = process.platform === "win32" ? ".exe" : "";

// ---- the template, and the reference pages as the studio's docs (workers read them there)
console.log(`studio: ${dest}`);
cpSync(template, dest, { recursive: true });
cpSync(join(skill, "references"), join(dest, "docs"), { recursive: true });
for (const d of ["out", "public/audio", "public/sfx", "tools/bin"]) mkdirSync(join(dest, d), { recursive: true });
// what the library was when the skill delivered it, so that a later update can tell the studio's own changes apart
writeRecord(dest, Object.fromEntries(walk(join(template, "src", "assets")).map((f) => [key(relative(template, f)), hashOf(f)])));
console.log("  copied the engine, the asset library, the tools, the two example films and the docs");

// ---- packages and the headless browser
const pin = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")).dependencies.remotion;
const from = opt("deps-from") ? resolve(opt("deps-from")) : null;
if (from) {
  const nm = join(from, "node_modules");
  const rp = join(nm, "remotion", "package.json");
  if (!existsSync(rp)) throw new Error(`${nm} has no Remotion in it`);
  const have = JSON.parse(readFileSync(rp, "utf8")).version;
  if (have !== pin) throw new Error(`${from} has Remotion ${have}; this studio is pinned to ${pin}. Use a project with ${pin}, or --install.`);
  console.log("  copying node_modules (a minute or two) ...");
  cpSync(nm, join(dest, "node_modules"), { recursive: true, verbatimSymlinks: true });
  console.log(`  node_modules copied (Remotion ${have})`);
} else if (args.includes("--install")) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  console.log("  npm install (downloads) ...");
  if (spawnSync(npm, ["install"], { cwd: dest, stdio: "inherit", shell: process.platform === "win32" }).status !== 0) throw new Error("npm install failed");
  console.log("  fetching Remotion's headless browser ...");
  spawnSync(npx, ["remotion", "browser", "ensure"], { cwd: dest, stdio: "inherit", shell: process.platform === "win32" });
} else {
  console.log("  no packages yet: run this again with --deps-from <a studio>, or with --install (a download: ask the user first)");
}

// ---- a full ffmpeg
const candidates = [
  opt("ffmpeg") && resolve(opt("ffmpeg")),
  from && join(from, "tools", "bin", `ffmpeg${exe}`),
  from && join(from, "node_modules", "ffmpeg-static", `ffmpeg${exe}`),
  join(dest, "node_modules", "ffmpeg-static", `ffmpeg${exe}`),
].filter(Boolean);
const ff = candidates.find((p) => existsSync(p));
if (ff) {
  copyFileSync(ff, join(dest, "tools", "bin", `ffmpeg${exe}`));
  console.log(`  ffmpeg copied from ${ff}`);
} else {
  console.log(`  no ffmpeg found: copy a full build to ${join(dest, "tools", "bin", `ffmpeg${exe}`)} (the npm package ffmpeg-static has one), or pass --ffmpeg <path>`);
}

// ---- is it ready?
console.log("");
const r = spawnSync(process.execPath, ["tools/doctor.mjs"], { cwd: dest, stdio: "inherit" });
console.log(
  r.status === 0
    ? `\nnext, inside ${dest}:\n  node tools/doctor.mjs --render                       one small still, to prove the browser\n  node tools/new-film.mjs <id> --vo <voice> --srt <words.srt> --title "<title>"`
    : "\nfix what is missing above, then run: node tools/doctor.mjs",
);
process.exitCode = r.status ?? 1;
