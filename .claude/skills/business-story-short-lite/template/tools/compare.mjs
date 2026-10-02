// Puts an old clip and a new one side by side, each under its label, with the new clip's sound.
// Usage: node tools/compare.mjs "<old.mp4>|<from s>|<to s>" <new.mp4> --out name [--labels "Before|After"] [--h 960]
// Writes out/<name>.mp4 (or the path given, if it ends in .mp4). The shorter side holds its last frame.
import { join } from "node:path";
import { OUT, ffmpeg } from "./lib/env.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flags = new Set(["out", "labels", "h"]);
const files = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && flags.has(args[i - 1].slice(2))));
if (files.length < 2) throw new Error('usage: node tools/compare.mjs "<old.mp4>|<from>|<to>" <new.mp4> --out name');
const [oldPath, from = "0", to] = files[0].split("|");
const newPath = files[1];
const h = Number(opt("h", 960));
const w = Math.round((h * 9) / 16 / 2) * 2;
const labels = opt("labels", "Before|After").split("|");
const name = opt("out", "compare");
const out = name.endsWith(".mp4") ? name : join(OUT, `${name}.mp4`);
const font = "public/fonts/InterBold.ttf";
const bar = 64;
const side = (i, label) =>
  `[${i}:v]fps=30,scale=${w}:${h}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=4,pad=${w + 16}:${h + bar + 16}:8:${bar + 8}:color=0xf3ead8,drawtext=fontfile=${font}:text='${label}':x=16:y=18:fontsize=34:fontcolor=0x2a2320[v${i}]`;
ffmpeg([
  "-ss",
  from,
  ...(to ? ["-to", to] : []),
  "-i",
  oldPath,
  "-i",
  newPath,
  "-filter_complex",
  `${side(0, labels[0])};${side(1, labels[1])};[v0][v1]hstack=inputs=2[v]`,
  "-map",
  "[v]",
  "-map",
  "1:a?",
  "-shortest",
  "-c:v",
  "libx264",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  out,
]);
console.log(out);
