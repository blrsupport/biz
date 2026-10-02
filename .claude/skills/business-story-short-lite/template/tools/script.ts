// The narration, sentence by sentence, with its times in the tightened voice: the starting point for the board.
// Also lists every number and every capitalised name, which are the candidates for type on screen and for `facts`.
//   node tools/script.ts <film> [--words]
import "./lib/fail.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const id = process.argv[2];
if (!id || id.startsWith("--")) {
  console.log("usage: node tools/script.ts <film> [--words]");
  process.exit(2);
}
const mod = await import(pathToFileURL(path.resolve("src", "films", id, "words.ts")).href);
const WORDS: { w: string; n: string; t0: number; t1: number }[] = mod.WORDS;
const VO: { duration: number } = mod.VO;
const TRIMS: { after: string; was: number; now: number; kept: boolean }[] = mod.TRIMS ?? [];

const f = (t: number) => t.toFixed(2).padStart(6);
console.log(`${id}: ${WORDS.length} words in ${VO.duration.toFixed(2)} s (${(WORDS.length / VO.duration).toFixed(1)} words a second)`);
if (TRIMS.length) {
  const cut = TRIMS.reduce((a, t) => a + (t.was - t.now), 0);
  console.log(`pauses: ${TRIMS.filter((t) => t.was - t.now > 0.005).length} tightened (${cut.toFixed(2)} s in all), ${TRIMS.filter((t) => t.kept).length} kept on purpose`);
}
console.log("\nsentences (start - end, length, the pause that follows):");
let start = 0;
let n = 1;
for (let i = 0; i < WORDS.length; i++) {
  const last = i === WORDS.length - 1;
  if (!/[.?!]["')\]]?$/.test(WORDS[i].w) && !last) continue;
  const a = WORDS[start];
  const b = WORDS[i];
  const gap = last ? VO.duration - b.t1 : WORDS[i + 1].t0 - b.t1;
  console.log(`${String(n++).padStart(3)}. ${f(a.t0)} -${f(b.t1)}  ${(b.t1 - a.t0).toFixed(1).padStart(4)} s  +${gap.toFixed(2)}  ${WORDS.slice(start, i + 1).map((w) => w.w).join(" ")}`);
  start = i + 1;
}

console.log("\npauses of 0.3 s or more inside the narration (room for an action with no words over it):");
for (let i = 0; i < WORDS.length - 1; i++) {
  const gap = WORDS[i + 1].t0 - WORDS[i].t1;
  if (gap >= 0.3) console.log(`  ${f(WORDS[i].t1)} -${f(WORDS[i + 1].t0)}  ${gap.toFixed(2)} s  after "${WORDS[i].w}"`);
}

console.log("\nnumbers (each wants a type moment, landing on its word):");
for (const w of WORDS) if (/\d/.test(w.w)) console.log(`  ${f(w.t0)}  ${w.w}`);

console.log("\ncapitalised words that do not start a sentence (names: confirm each spelling and list it in the film's facts):");
const seen = new Set<string>();
for (let i = 0; i < WORDS.length; i++) {
  const w = WORDS[i].w.replace(/[^A-Za-z'’-]/g, "");
  const first = i === 0 || /[.?!]["')\]]?$/.test(WORDS[i - 1].w);
  if (!first && /^[A-Z][a-z]/.test(w) && w !== "I" && !seen.has(w)) {
    seen.add(w);
    console.log(`  ${f(WORDS[i].t0)}  ${w}`);
  }
}

if (process.argv.includes("--words")) {
  console.log("\nevery word:");
  for (const w of WORDS) console.log(`  ${f(w.t0)} -${f(w.t1)}  ${w.w}`);
}
