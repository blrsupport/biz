// Lays frames of a rendered clip out as one picture, so motion can be read frame by frame.
// Usage: node tools/strip.mjs <clip.mp4> [--from s] [--to s] [--every n] [--cols n] [--w px] [--out name] [--crop w:h:x:y]
// Writes out/strips/<name>.png. `every 1` shows every frame (use it on the fast part of an action).
import { basename, join } from "node:path";
import { OUT, ensureDir, ffmpeg } from "./lib/env.mjs";

const args = process.argv.slice(2);
const clip = args.find((a) => !a.startsWith("--"));
if (!clip) throw new Error("usage: node tools/strip.mjs <clip.mp4> [--from s] [--to s] [--every n] [--cols n] [--w px] [--out name]");
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const from = Number(opt("from", 0));
const to = opt("to");
const every = Number(opt("every", 2));
const cols = Number(opt("cols", 10));
const w = Number(opt("w", 216));
const crop = opt("crop");
const rows = Number(opt("rows", 4));
const name = opt("out", basename(clip).replace(/\.[^.]+$/, "") + `_${from}`);
const out = join(ensureDir(join(OUT, "strips")), `${name}.png`);
const vf = [`select='not(mod(n\\,${every}))'`, crop ? `crop=${crop}` : null, `scale=${w}:-1`, `tile=${cols}x${rows}:padding=4:color=white`].filter(Boolean).join(",");
const run = () => ffmpeg(["-ss", String(from), ...(to ? ["-to", String(to)] : []), "-i", clip, "-vf", vf, "-frames:v", "1", "-fps_mode", "passthrough", "-update", "1", out]);
let done = false;
for (let k = 1; k <= 4 && !done; k++) {
  try {
    run();
    done = true;
  } catch (e) {
    // a freshly written PNG is sometimes held for a moment by the virus scanner
    const tail = String(e.stderr ?? e.message).trim().split(/\r?\n/).slice(-3).join(" | ");
    if (k === 4) {
      console.error(`strip failed: ${tail}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 400 * k));
  }
}
console.log(out);
