// Renders review stills. One bundle, one browser, stills one after another.
// Usage: node tools/stills.mjs <Comp>[:seconds][@scale][=name] ...
//   node tools/stills.mjs TypeSpecimen@0.6 StyleMD-A:2.4 StyleMD-A:2.4@2=hands
// Writes out/stills/<Comp>_<seconds>.png (or <name>.png).
import { renderStill, selectComposition } from "@remotion/renderer";
import { join } from "node:path";
import { OUT, ensureDir, retry } from "./lib/env.mjs";
import { makeBundle, shellOpts, withBrowser } from "./lib/browser.mjs";

const jobs = process.argv.slice(2).map((a) => {
  const m = /^([^:@=]+)(?::([0-9.]+))?(?:@([0-9.]+))?(?:=(.+))?$/.exec(a);
  if (!m) throw new Error(`bad still spec: ${a}`);
  return { id: m[1], sec: m[2] ? Number(m[2]) : 0, scale: m[3] ? Number(m[3]) : 1, name: m[4] };
});
if (!jobs.length) throw new Error("nothing to render");

const dir = ensureDir(join(OUT, "stills"));
const t0 = Date.now();
const serveUrl = await makeBundle();
await withBrowser({}, async (browser) => {
  const base = shellOpts(browser);
  const comps = new Map();
  for (const j of jobs) {
    if (!comps.has(j.id)) comps.set(j.id, await retry(() => selectComposition({ serveUrl, id: j.id, ...base }), 4, "composition"));
    const composition = comps.get(j.id);
    const frame = Math.min(composition.durationInFrames - 1, Math.round(j.sec * composition.fps));
    const output = join(dir, `${j.name ?? `${j.id}_${j.sec}`}.png`);
    await retry(() => renderStill({ ...base, serveUrl, composition, frame, scale: j.scale, output, overwrite: true }), 7, "still");
    console.log(output);
  }
});
console.log(`${jobs.length} still(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
