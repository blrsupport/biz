// Puts pictures side by side (or stacked) with a caption each, for comparing looks.
// Usage: node tools/board.mjs --out name [--dir h|v] [--size px] [--labels "a|b|c"] [--bg hex] <img>[#w:h:x:y] ...
//   --size: common height (dir h) or common width (dir v). `#w:h:x:y` crops an input first.
// Writes out/boards/<name>.png (or .jpg when --jpg is given).
import { join } from "node:path";
import { OUT, ensureDir, ffmpeg } from "./lib/env.mjs";

const args = process.argv.slice(2);
const flags = new Set(["out", "dir", "size", "labels", "bg", "pad"]);
const opt = {};
const inputs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--jpg") opt.jpg = true;
  else if (a.startsWith("--") && flags.has(a.slice(2))) opt[a.slice(2)] = args[++i];
  else inputs.push(a);
}
if (!inputs.length || !opt.out) throw new Error("usage: node tools/board.mjs --out name [--dir h|v] [--size px] [--labels a|b|c] <img>[#crop] ...");
const dir = opt.dir ?? "h";
const size = Number(opt.size ?? 1200);
const labels = opt.labels ? opt.labels.split("|") : [];
const bg = opt.bg ?? "f3ead8";
const pad = Number(opt.pad ?? 16);
const bar = labels.length ? 64 : 0;
const font = "public/fonts/InterBold.ttf";
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/,/g, "\\,");

const chain = [];
const tags = [];
inputs.forEach((spec, i) => {
  const [, crop] = spec.split("#");
  const steps = [];
  if (crop) steps.push(`crop=${crop}`);
  steps.push(dir === "h" ? `scale=-2:${size}:flags=lanczos` : `scale=${size}:-2:flags=lanczos`);
  steps.push(`pad=iw+${pad * 2}:ih+${pad * 2 + bar}:${pad}:${pad + bar}:color=0x${bg}`);
  if (labels[i]) steps.push(`drawtext=fontfile=${font}:text='${esc(labels[i])}':x=${pad}:y=${pad + 8}:fontsize=38:fontcolor=0x2a2320`);
  chain.push(`[${i}:v]${steps.join(",")}[v${i}]`);
  tags.push(`[v${i}]`);
});
if (inputs.length > 1) chain.push(`${tags.join("")}${dir === "h" ? "hstack" : "vstack"}=inputs=${inputs.length}[out]`);
const out = join(ensureDir(join(OUT, "boards")), `${opt.out}.${opt.jpg ? "jpg" : "png"}`);
const run = () =>
  ffmpeg([
    ...inputs.flatMap((s) => ["-i", s.split("#")[0]]),
    "-filter_complex",
    chain.join(";"),
    "-map",
    inputs.length > 1 ? "[out]" : "[v0]",
    "-frames:v",
    "1",
    "-update",
    "1",
    ...(opt.jpg ? ["-q:v", "2"] : []),
    out,
  ]);
// Windows sometimes holds a freshly written file for a moment (virus scanner): try again before giving up
for (let k = 1; ; k++) {
  try {
    run();
    break;
  } catch (e) {
    if (k >= 4) throw e;
    await new Promise((r) => setTimeout(r, 700 * k));
  }
}
console.log(out);
