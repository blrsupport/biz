// Is this studio ready to make a film? Checks the tools, the fonts and the two example films, and says how to
// get whatever is missing. Run it after setting a studio up, and whenever a tool fails for no clear reason.
//   node tools/doctor.mjs [--render]
// --render also starts the headless browser once and renders one small still (about 20 s): the real proof.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { FFMPEG, SHELL, root } from "./lib/env.mjs";

let bad = 0;
const ok = (name, detail = "") => console.log(`  ok    ${name}${detail ? `: ${detail}` : ""}`);
const no = (name, how) => {
  bad++;
  console.log(`  MISSING  ${name}\n           ${how}`);
};
const run = (cmd, a, o = {}) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26, ...o });
const py = process.platform === "win32" ? "python" : "python3";

console.log(`studio: ${root}`);
console.log(`machine: ${os.cpus().length} threads, ${(os.totalmem() / 2 ** 30).toFixed(0)} GB RAM (${((1 - os.freemem() / os.totalmem()) * 100).toFixed(0)} % in use now), ${process.platform}`);

// ---- Node: the tools are TypeScript files that Node runs directly
{
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj > 22 || (maj === 22 && min >= 18)) ok("Node", process.versions.node);
  else no(`Node ${process.versions.node} is too old`, "the tools need Node 22.18 or newer (it runs .ts files directly): install a current Node");
}

// ---- packages
{
  const pin = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies.remotion;
  const p = join(root, "node_modules", "remotion", "package.json");
  if (!existsSync(p)) no("node_modules", "copy node_modules from another studio (scripts/new-studio.mjs --deps-from <studio>), or run npm install here (a download of about 250 MB: ask the user first)");
  else {
    const have = JSON.parse(readFileSync(p, "utf8")).version;
    if (have === pin) ok("Remotion", have);
    else no(`Remotion ${have} is installed but ${pin} is pinned`, "run npm install (a download: ask the user first)");
  }
}

// ---- the headless browser
if (existsSync(SHELL)) ok("headless browser", SHELL.replace(root, "."));
else no("Remotion's headless browser", "copy node_modules/.remotion from another studio, or run: npx remotion browser ensure (a download of about 100 MB: ask the user first). Never point the tools at the system Chrome.");

// ---- ffmpeg, a full build
{
  const r = existsSync(FFMPEG) ? run(FFMPEG, ["-hide_banner", "-filters"]) : null;
  if (!r) no("ffmpeg at tools/bin", "copy a full ffmpeg build to tools/bin/ (from another studio's tools/bin, or from the npm package ffmpeg-static), or set STUDIO_FFMPEG to its path");
  else {
    const need = ["ebur128", "alimiter", "tile", "loudnorm", "vignette", "blend"];
    const lack = need.filter((f) => !new RegExp(`\\b${f}\\b`).test(r.stdout));
    if (lack.length) no(`ffmpeg lacks ${lack.join(", ")}`, "this is a cut-down build (Remotion's own is one): use a full build, for example the one in the npm package ffmpeg-static");
    else ok("ffmpeg", "full build");
  }
}

// ---- Python and its libraries
{
  const r = run(py, ["-c", "import sys, numpy, PIL; print(sys.version.split()[0], numpy.__version__, PIL.__version__)"]);
  if (r.status === 0) ok("Python with numpy and Pillow", r.stdout.trim());
  else no("Python with numpy and Pillow", `install Python 3.10 or newer, then: ${py} -m pip install numpy pillow (a download: ask the user first)`);
}

// ---- fonts and the paper texture
{
  const fonts = existsSync(join(root, "public/fonts")) ? readdirSync(join(root, "public/fonts")).filter((f) => f.endsWith(".ttf")) : [];
  if (fonts.length >= 8) ok("fonts", `${fonts.length} faces`);
  else no("fonts in public/fonts", "copy public/fonts from the skill's template");
  if (existsSync(join(root, "public/tex/paper_fine.png"))) ok("paper texture");
  else no("public/tex/paper_fine.png", `copy it from the skill's template, or run ${py} tools/bake_textures.py (needs scipy)`);
}

// ---- the project itself: types, and the two example films through the dry run
if (existsSync(join(root, "node_modules", "typescript"))) {
  const r = run(process.execPath, [join("node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
  if (r.status === 0) ok("type check");
  else no("type check fails", `${(r.stdout || r.stderr).trim().split("\n").slice(0, 4).join("\n           ")}`);
  for (const film of ["md", "ggsp"]) {
    if (!existsSync(join(root, "src", "films", film))) continue;
    const c = run(process.execPath, ["tools/check.ts", film]);
    const last = c.stdout.trim().split("\n").filter((l) => /^(PASSED|FAILED)/.test(l)).pop();
    if (c.status === 0) ok(`example film ${film}`, last ?? "");
    else no(`example film ${film} does not pass its dry run`, `run node tools/check.ts ${film} and read the lines that start with !!`);
  }
}

// ---- the engine's own self-tests, and one preview (Node, Python and Pillow working together, no browser)
if (existsSync(join(root, "node_modules", "typescript")) && !bad) {
  const tests = existsSync(join(root, "tools", "selftest")) ? readdirSync(join(root, "tools", "selftest")).filter((f) => f.endsWith(".ts")) : [];
  const failed = tests.filter((f) => run(process.execPath, [join("tools", "selftest", f)]).status !== 0);
  if (failed.length) no(`self-tests fail: ${failed.join(", ")}`, "run each with node tools/selftest/<name> and read the lines that start with BAD");
  else if (tests.length) ok("self-tests", `${tests.length} passed`);
  if (existsSync(join(root, "src", "films", "md"))) {
    const p = run(process.execPath, ["tools/preview.ts", "md:3.9=doctor_preview"]);
    if (p.status === 0 && existsSync(join(root, "out/preview/doctor_preview.png"))) ok("preview without a browser", "out/preview/doctor_preview.png");
    else no("the preview did not draw", `${(p.stderr || p.stdout).trim().split("\n").slice(-2).join(" | ")}`);
  }
}

// ---- the real proof: one still through the browser
if (process.argv.includes("--render") && !bad) {
  const t0 = Date.now();
  const r = run(process.execPath, ["tools/stills.mjs", "md:3.9@0.25=doctor"]);
  if (r.status === 0 && existsSync(join(root, "out/stills/doctor.png"))) ok("render", `one still in ${((Date.now() - t0) / 1000).toFixed(0)} s (out/stills/doctor.png)`);
  else no("the test still did not render", `${(r.stderr || r.stdout).trim().split("\n").slice(-4).join("\n           ")}\n           a line that says only "Node.js v..." is a passing fault on Windows: run it again`);
}

console.log(bad ? `\nNOT READY: ${bad} thing(s) missing` : `\nREADY${process.argv.includes("--render") ? "" : " (add --render to prove the browser with one small still)"}`);
process.exitCode = bad ? 1 : 0;
