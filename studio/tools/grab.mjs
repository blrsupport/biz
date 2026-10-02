// Cuts single full-size frames out of a finished clip, to look at exactly what was rendered or delivered.
// Usage: node tools/grab.mjs <clip.mp4> <seconds> [<seconds> ...] [--name <prefix>]
// Writes out/stills/<prefix>_<seconds>.png (the prefix defaults to the clip's file name). No browser is started.
import "./lib/fail.mjs";
import { basename, extname, join, resolve } from "node:path";
import { OUT, ensureDir, ffmpeg, need, root } from "./lib/env.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const plain = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [clipArg, ...times] = plain;
if (!clipArg || !times.length) throw new Error("usage: node tools/grab.mjs <clip.mp4> <seconds> [<seconds> ...] [--name <prefix>]");
const clip = need(resolve(root, clipArg), "give the path of a rendered clip");
const prefix = opt("name", basename(clip, extname(clip)));
const dir = ensureDir(join(OUT, "stills"));
for (const t of times) {
  const s = Number(t);
  if (!Number.isFinite(s) || s < 0) throw new Error(`"${t}" is not a time in seconds`);
  const dst = join(dir, `${prefix}_${s.toFixed(2)}.png`);
  // -ss after -i: slower, but the frame is the one shown at that time, not the nearest key frame
  ffmpeg(["-v", "error", "-i", clip, "-ss", s.toFixed(3), "-frames:v", "1", dst]);
  console.log(dst);
}
