// The finishing pass: paper tooth, grain, vignette and a small grade, added by ffmpeg after the clean render.
// Nothing here runs inside a frame, so it costs the renderer nothing and the clean master stays untouched.
// Usage: node tools/finish.mjs <still.png | clip.mp4> --look A|B|C [--out name]
// Writes out/final/<name>.png or .mp4.
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { OUT, ensureDir, ffmpeg, root } from "./lib/env.mjs";

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--look" && args[args.indexOf(a) - 1] !== "--out");
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
if (!src) throw new Error("usage: node tools/finish.mjs <still.png|clip.mp4> --look A|B|C [--out name]");
const look = opt("look", "A");
const still = /\.(png|jpe?g)$/i.test(src);
const name = opt("out", basename(src).replace(/\.[^.]+$/, ""));

export const FINISH = {
  A: { tex: "paper_fine.png", texOpacity: 1, grain: 5, vignette: 0.45, eq: "contrast=1.03:saturation=1.05" },
  B: { tex: "paper_fine.png", texOpacity: 0.7, grain: 3, vignette: 0.22, eq: "contrast=1.02:saturation=1.07" },
  C: { tex: "paper_kraft.png", texOpacity: 1, grain: 5, vignette: 0.34, eq: "contrast=1.02:saturation=0.98" },
};
const F = FINISH[look];
if (!F) throw new Error(`unknown look ${look}`);
const tex = join(root, "public/tex", F.tex);
if (!existsSync(tex)) throw new Error(`missing ${tex}: run python tools/bake_textures.py`);

const chain = [
  `[1:v]format=gbrp[t]`,
  `[0:v]format=gbrp[b]`,
  `[b][t]blend=all_mode=softlight:all_opacity=${F.texOpacity}:shortest=1[x]`,
  `[x]noise=alls=${F.grain}:allf=${still ? "u" : "t+u"}:all_seed=7,vignette=a=${F.vignette},eq=${F.eq},format=${still ? "rgb24" : "yuv420p"}[out]`,
].join(";");
const dir = ensureDir(join(OUT, "final"));
const out = join(dir, `${name}.${still ? "png" : "mp4"}`);
ffmpeg([
  "-i",
  src,
  "-loop",
  "1",
  "-i",
  tex,
  "-filter_complex",
  chain,
  "-map",
  "[out]",
  ...(still
    ? ["-frames:v", "1", "-update", "1"]
    : ["-map", "0:a?", "-c:a", "copy", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"]),
  out,
]);
console.log(out);
