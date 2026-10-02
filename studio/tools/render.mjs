// Renders a composition to an H.264 file (picture only; sound is added by the mix step).
// Usage: node tools/render.mjs <Comp> [--out name] [--scale 0.5] [--from seconds] [--to seconds] [--chunk seconds] [--fresh] [--workers n] [--crf 16]
// Writes out/video/<name>.mp4. One browser, a few workers, frames in JPEG at quality 95.
//   --chunk 20  renders in stretches of 20 s (out/video/<name>.part00.mp4 ...) and joins them without re-encoding.
//               A stretch that is already on disk is kept, so a long render that was interrupted picks up where it
//               stopped. --fresh renders every stretch again. Use it for anything over about a minute.
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { OUT, ensureDir, ffmpeg, moveInto, retry } from "./lib/env.mjs";
import { makeBundle, pickWorkers, shellOpts, withBrowser } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
if (!id) throw new Error("usage: node tools/render.mjs <Comp> [--out name] [--scale s] [--from s] [--to s] [--chunk s] [--fresh] [--workers n] [--crf n]");
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const scale = Number(opt("scale", 1));
const crf = Number(opt("crf", 16));
const name = opt("out", scale === 1 ? id : `${id}@${scale}`);
const dir = ensureDir(join(OUT, "video"));
const output = join(dir, `${name}.mp4`);
const fresh = args.includes("--fresh");

const t0 = Date.now();
const serveUrl = await makeBundle();
const tBundle = (Date.now() - t0) / 1000;
await withBrowser({}, async (browser) => {
  const base = shellOpts(browser);
  const composition = await retry(() => selectComposition({ serveUrl, id, ...base }), 4, "composition");
  const fps = composition.fps;
  const first = Math.max(0, Math.round(Number(opt("from", 0)) * fps));
  const last = Math.min(composition.durationInFrames - 1, opt("to") !== undefined ? Math.round(Number(opt("to")) * fps) - 1 : composition.durationInFrames - 1);
  const workers = opt("workers") !== undefined ? Math.max(1, Math.min(4, Number(opt("workers")))) : pickWorkers();
  const total = os.totalmem();
  let minFree = os.freemem();

  // the stretches to render: one, or several of `--chunk` seconds each
  const step = opt("chunk") !== undefined ? Math.max(1, Math.round(Number(opt("chunk")) * fps)) : last - first + 1;
  const parts = [];
  for (let a = first; a <= last; a += step) parts.push([a, Math.min(last, a + step - 1)]);
  const many = parts.length > 1;
  const file = (k) => (many ? join(dir, `${name}.part${String(k).padStart(2, "0")}.mp4`) : output);

  console.log(`${id}: frames ${first}-${last} (${last - first + 1}) at scale ${scale}, ${workers} workers${many ? `, in ${parts.length} stretches` : ""}, RAM in use ${(100 - (minFree / total) * 100).toFixed(0)} %`);
  const tR = Date.now();
  let done = 0;
  for (const [k, [a, b]] of parts.entries()) {
    const out = file(k);
    if (many && !fresh && existsSync(out) && statSync(out).size > 2000) {
      console.log(`  stretch ${k} (frames ${a}-${b}) is already on disk: kept`);
      continue;
    }
    let lastPrint = 0;
    // rendered under a name of its own and moved into place afterwards: a locked or half-written file of the same
    // name (an earlier run, a player) can then never cost the render
    const making = join(dir, `${name}.making-${process.pid}-${k}.mp4`);
    await renderMedia({
      ...base,
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: making,
      concurrency: workers,
      imageFormat: "jpeg",
      jpegQuality: 95,
      crf,
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      scale,
      frameRange: [a, b],
      muted: true,
      overwrite: true,
      onProgress: ({ renderedFrames, encodedFrames }) => {
        minFree = Math.min(minFree, os.freemem());
        const now = Date.now();
        if (now - lastPrint > 10000) {
          lastPrint = now;
          console.log(`  ${many ? `stretch ${k}: ` : ""}${renderedFrames} rendered, ${encodedFrames} encoded, ${((now - tR) / 1000).toFixed(0)} s`);
        }
      },
    });
    await moveInto(making, out);
    done += b - a + 1;
  }
  if (many) {
    // joined without re-encoding: every stretch was encoded with the same settings
    const list = join(dir, `${name}.parts.txt`);
    writeFileSync(list, parts.map((_, k) => `file '${file(k).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
    const joined = join(dir, `${name}.making-${process.pid}-all.mp4`);
    ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", joined]);
    await moveInto(joined, output);
  }
  const sec = (Date.now() - tR) / 1000;
  console.log(`${output}`);
  console.log(`${done} frames in ${sec.toFixed(1)} s${done ? ` = ${(sec / done).toFixed(3)} s a frame` : ""} (bundle ${tBundle.toFixed(1)} s); peak RAM in use ${(100 - (minFree / total) * 100).toFixed(0)} %`);
});
