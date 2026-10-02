// Puts the tightened voice on a draft picture, so that nothing shown to the user is ever silent.
// Usage: node tools/rough.mjs <film> <picture.mp4> [--from seconds] [--out name]
//   --from: where in the film the picture starts, when it is a stretch rendered with `render.mjs --from`
// Writes out/<film>/<name>.mp4 (default name: the picture's name + "_rough").
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { OUT, ensureDir, ffmpeg, root } from "./lib/env.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const plain = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--from", "--out"].includes(args[i - 1])));
const [film, picture] = plain;
if (!film || !picture) throw new Error("usage: node tools/rough.mjs <film> <picture.mp4> [--from s] [--out name]");
const vo = join(root, "public", "audio", film, "vo-tight.wav");
if (!existsSync(vo)) throw new Error(`missing ${vo}: run python tools/words.py ${film}`);
const from = Number(opt("from", 0));
const out = join(ensureDir(join(OUT, film)), `${opt("out", basename(picture).replace(/\.[^.]+$/, "") + "_rough")}.mp4`);
ffmpeg(["-i", picture, "-ss", String(from), "-i", vo, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
console.log(out);
