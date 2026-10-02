// The dry run of a film, in Node, with no browser: every frame of every sequence is built exactly as it will be
// drawn and checked (shapes, palette, joints, pinned hands, planted feet, type against the safe zone, heads, the
// narration and its words, pops and jumps, the path budget), then the film's source is checked against the house rules.
//
//   node tools/check.ts <film> [--seq <id>] [--cam] [--pops] [--cues out/<film>/cues.json] [--out out/<film>/check.txt]
//
// --cam   prints where the camera is and where each actor is on screen, twice a second
// --pops  lists every appearance, disappearance and jump (not only the first few)
// --cues  also writes the cue list for the sound mix (what the takes call out, plus every footfall)
// --out   also writes everything printed to a file. Use this, not a shell redirect: a redirect to a file that Windows
//         has locked fails before the dry run starts, and the old file's PASSED is then read as this run's
// Exit code 1 when anything fails. A line that starts with "!!" is a failure; "?" is a thing to look at.
import "./lib/fail.mjs";
import fs from "node:fs";
import path from "node:path";
import { ORDER_WARNINGS, RANGE_WARNINGS } from "../src/engine/motion/track.ts";
import { checkSequence, cueList } from "../src/engine/qa/check.ts";
import { anchoredWords } from "../src/engine/time/clock.ts";
import { FILMS, filmById } from "../src/films/index.ts";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--") && !["--seq", "--cues", "--out"].includes(args[args.indexOf(a) - 1]));
if (!id) {
  console.log(`usage: node tools/check.ts <film> [--seq <id>] [--cam] [--pops] [--cues <file>] [--out <file>]\nfilms: ${FILMS.map((f) => `${f.id} (${f.sequences.map((s) => s.id).join(", ")})`).join("; ")}`);
  process.exit(2);
}
const opt = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const film = filmById(id);
const only = opt("seq");
const outFile = opt("out");
const said: string[] = [];
if (outFile) {
  const log = console.log;
  console.log = (...a: unknown[]) => {
    said.push(a.map(String).join(" "));
    log(...a);
  };
}
const fails: string[] = [];
const warns: string[] = [];
const fail = (m: string) => {
  fails.push(m);
  console.log(`  !! ${m}`);
};

console.log(`${film.id}: "${film.title}", ${film.duration.toFixed(2)} s, ${film.width}x${film.height} at ${film.fps} fps, look ${film.look}, ${film.words.length} words`);

// ---- the sequences, one after another, must cover the film with no gap
{
  const S = film.sequences;
  if (!S.length) fail("the film has no sequences");
  S.forEach((s, i) => {
    if (!(s.t0 <= s.tFull && s.tFull <= s.end)) fail(`${s.id}: t0 (${s.t0}) <= tFull (${s.tFull}) <= end (${s.end}) does not hold`);
    if (i === 0 && s.t0 > 1e-6) fail(`${s.id}: the first sequence must start at 0, not at ${s.t0}`);
    if (i > 0 && s.tFull > S[i - 1].end + 1e-6) fail(`nothing covers the frame between ${S[i - 1].end.toFixed(2)} s (the end of ${S[i - 1].id}) and ${s.tFull.toFixed(2)} s (where ${s.id} covers it)`);
    if (i === S.length - 1 && s.end < film.duration - 1e-6) fail(`${s.id}: the last sequence ends at ${s.end.toFixed(2)} s but the voice runs to ${film.duration.toFixed(2)} s`);
    if (S.findIndex((x) => x.id === s.id) !== i) fail(`two sequences are called "${s.id}"`);
  });
}

let frames = 0;
for (const seq of film.sequences) {
  if (only && seq.id !== only) continue;
  const r = checkSequence(film, seq, { cam: args.includes("--cam"), pops: args.includes("--pops") });
  fails.push(...r.fails);
  warns.push(...r.warns);
  frames += r.frames;
}
if (only && !film.sequences.some((s) => s.id === only)) fail(`no sequence "${only}" in ${film.id}`);

// ---- the words the takes hang on: their timing is the film's timing
{
  const idx = anchoredWords(film.words);
  if (idx.length) {
    const inner = idx.filter((k) => k > 0 && film.words[k].t0 - film.words[k - 1].t1 < 0.12);
    console.log(`the takes are anchored to ${idx.length} word(s): ${idx.map((k) => `${film.words[k].w.replace(/[,.;:!?]+$/, "")} ${film.words[k].t0.toFixed(2)}`).join("  ")}`);
    if (inner.length) console.log(`  ${inner.length} of them stand inside a phrase (${inner.map((k) => film.words[k].w.replace(/[,.;:!?]+$/, "")).join(", ")}): a word after a pause is timed exactly by the audio, one inside a phrase only as well as the timings allow. For those that carry type or a contact, look once: python tools/words.py ${film.id} --look <word>`);
  }
}

// ---- moves written out of time order: the later-written one silently removes the other
{
  const mine = ORDER_WARNINGS.filter((w) => w.includes(`films/${film.id}/`));
  if (mine.length) {
    console.log(`moves written out of time order (${mine.length}): each removed a move that was written before it. Check that this was meant.`);
    for (const w of mine.slice(0, 20)) console.log(`  ?  ${w}`);
    warns.push(`${mine.length} move(s) written out of time order (see the list above): a verb or a move written later in the file starts earlier and has removed an earlier-written one`);
  }
}

// ---- moves that back up before they set off, or run past their target before they arrive
{
  const mine = RANGE_WARNINGS.filter((w) => w.includes(`films/${film.id}/`));
  if (mine.length) {
    console.log(`moves that leave the stretch between their start and their target (${mine.length}):`);
    for (const w of mine.slice(0, 20)) console.log(`  ?  ${w}`);
    warns.push(`${mine.length} move(s) back up or run past before they arrive (see the list above): on screen the thing travels the wrong way first`);
  }
}

// ---- facts: every name and spelling that goes on screen, and whether the user has confirmed it
if (film.facts?.length) {
  console.log("facts:");
  for (const f of film.facts) console.log(`  "${f.text}"  ${f.confirmed ? "confirmed" : "NOT YET CONFIRMED by the user"}  (${f.source})`);
  const open = film.facts.filter((f) => !f.confirmed);
  if (open.length) warns.push(`spellings or figures the user has not confirmed: ${open.map((f) => `"${f.text}"`).join(", ")} (say so when you deliver)`);
}

// ---- the film's own source against the house rules
{
  const dir = path.join("src", "films", film.id);
  const banned: [RegExp, string][] = [
    [/Math\.random/, "Math.random (use hash, noise or wander: a frame must come out the same every time it is rendered)"],
    [/\bDate\.now\b|new Date\b/, "the clock (every value is a function of the film's time)"],
    [/<filter|filter=|filter:|feGaussian|feTurbulence|mixBlendMode|mix-blend-mode|backdropFilter|backdrop-filter|blur\(/, "a filter, blend mode or blur (the look has none; light is a gradient, shadow is the unlit surface)"],
    [/useCurrentFrame|durationInFrames|\bframe\s*[*\/]\s*(fps|\d)/, "frame numbers (time is seconds, taken from words)"],
    [/\binterpolate\(|Easing\./, "Remotion's interpolate or Easing (moves go through Track.to with a weight class)"],
    [/<svg|<path|<g\b|<rect|React\./, "SVG or React (a sequence is data: its frame is a display list)"],
  ];
  const found: string[] = [];
  let typed = 0;
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) {
        if (name !== "source") walk(p);
        continue;
      }
      if (name.endsWith(".tsx")) found.push(`${p}: a .tsx file (films hold no view code)`);
      if (!/\.tsx?$/.test(name) || name === "words.ts") continue;
      const text = fs.readFileSync(p, "utf8");
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const [re, what] of banned) if (re.test(code)) found.push(`${p}: ${what}`);
      if (!/palette|bible/i.test(name)) {
        const hex = code.match(/["'`]#[0-9a-fA-F]{3,8}["'`]/g);
        if (hex) found.push(`${p}: ${hex.length} colour(s) written as literals (${[...new Set(hex)].slice(0, 4).join(", ")}): colours live in a palette (src/assets, or the film's palette.ts)`);
      }
      typed += (code.match(/\bat:\s*-?\d+(\.\d+)?\s*[,}]/g) ?? []).length;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  console.log(`source rules (${dir}): ${found.length ? "" : "no randomness, clock, filters, blends, blurs, frame numbers, view code or stray colours"}`);
  for (const f of found) fail(f);
  if (typed) console.log(`  ${typed} moment(s) typed as plain numbers (\`at: 5.05\`): fine for small acting between two words; anything that should land on a word takes its time from W("word")`);
}

if (opt("cues")) {
  const dst = opt("cues")!;
  const list = cueList(film);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, JSON.stringify(list, null, 1));
  console.log(`wrote ${list.cues.length} cues to ${dst}`);
}

console.log("");
for (const w of warns) console.log(`?  ${w}`);
if (fails.length) {
  console.log(`FAILED (${fails.length}) after ${frames} frames:`);
  for (const f of fails) console.log(`  - ${f}`);
} else console.log(`PASSED: ${frames} frames, ${film.sequences.length} sequence(s)${warns.length ? `, ${warns.length} thing(s) to look at` : ""}`);
process.exitCode = fails.length ? 1 : 0;
if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  let written = false;
  for (let k = 0; k < 8 && !written; k++) {
    try {
      fs.writeFileSync(outFile, `${said.join("\n")}\n`);
      written = true;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400 * (k + 1));
    }
  }
  if (!written) {
    console.log(`FAILED: could not write ${outFile} (it is locked): what it holds is from an earlier run`);
    process.exitCode = 1;
  }
}
