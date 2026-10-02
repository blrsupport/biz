// Adds a sequence to a film: a placeholder that compiles, passes the dry run and renders, registered in film.ts.
// It fixes the interface (files, exports, when the sequence starts) before anyone builds the real thing, which is
// what a worker's pack needs (docs/worker-pack.md).
//
//   node tools/new-seq.mjs <film> <seq> --from "<word>[:n]"
//
// <seq>: a short lower-case name for the world ("yard", "auction"). --from: the word of the narration the sequence
// starts on (":2" for the second time it is said). Afterwards, give it its real `tFull` and set the `end` of the
// sequence before it so that the two overlap for the hand-over (node tools/check.ts <film> reports any gap).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./lib/env.mjs";
import { sequenceFiles } from "./lib/seq-template.mjs";

const args = process.argv.slice(2);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const [film, seq] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!film || !seq || !opt("from")) throw new Error('usage: node tools/new-seq.mjs <film> <seq> --from "<word>[:n]"');
if (!/^[a-z][a-z0-9]{1,23}$/.test(seq)) throw new Error(`"${seq}" will not do as a sequence id: lower-case letters and digits, starting with a letter`);
const dir = join(root, "src", "films", film);
const filmFile = join(dir, "film.ts");
if (!existsSync(filmFile)) throw new Error(`${filmFile} not found: start the film with node tools/new-film.mjs`);
if (existsSync(join(dir, seq))) throw new Error(`${join(dir, seq)} already exists`);

// the word it starts on must be in the narration
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const [word, nthText] = opt("from").split(":");
const nth = Number(nthText ?? 1);
const { WORDS } = await import(pathToFileURL(resolve(dir, "words.ts")).href);
const hits = WORDS.filter((w) => w.n === norm(word));
if (hits.length < nth) throw new Error(`"${word}" is said ${hits.length} time(s) in the narration, not ${nth}: see node tools/script.ts ${film} --words`);
const t0 = hits[nth - 1].t0;

let text = readFileSync(filmFile, "utf8");
const title = /title:\s*("(?:[^"\\]|\\.)*")/.exec(text)?.[1];
const S = seq.toUpperCase();
mkdirSync(join(dir, seq), { recursive: true });
for (const [name, body] of Object.entries(sequenceFiles({ title: title ? JSON.parse(title) : film, seq, anchor: norm(word), nth, first: false }))) writeFileSync(join(dir, seq, name), body);

// ---- register it: an import, and a place at the end of the film's list of sequences
const lastImport = text.lastIndexOf("import ");
const lineEnd = text.indexOf("\n", lastImport) + 1;
text = text.slice(0, lineEnd) + `import { ${S}_SEQ } from "./${seq}/index.ts";\n` + text.slice(lineEnd);
const m = /sequences:\s*\[([^\]]*)\]/.exec(text);
if (!m) throw new Error(`could not find "sequences: [...]" in ${filmFile}: add ${S}_SEQ to it by hand`);
text = text.replace(m[0], `sequences: [${m[1].trim() ? `${m[1].trim().replace(/,\s*$/, "")}, ` : ""}${S}_SEQ]`);
writeFileSync(filmFile, text);

console.log(`made src/films/${film}/${seq}/ and added ${S}_SEQ to film.ts; it starts on "${hits[nth - 1].w}" at ${t0.toFixed(2)} s
next:
  node tools/check.ts ${film}                       the sequences must cover the film with no gap
  set the \`end\` of the sequence before it to ${t0.toFixed(2)} s or later, and this one's \`tFull\`, for the hand-over
  node tools/preview.ts ${film}-${seq}:${(t0 + 1).toFixed(1)}            a first look at the placeholder`);
