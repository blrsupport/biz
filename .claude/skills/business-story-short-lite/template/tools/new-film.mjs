// Starts a film in this studio from a voice file and its word timings.
//   node tools/new-film.mjs <id> --vo "<voice file>" --srt "<words.srt>" [--title "<title>"] [--script "<script.txt>"]
// <id> is a short lower-case name (letters and digits, starting with a letter): it names the folder and the composition.
// Makes src/films/<id>/ with: the source files, film.json (for tools/words.py), a provisional word table, board.md and
// STATE.md to fill in, an empty sound sheet, and one placeholder sequence (s1) that already passes the dry run.
// Further sequences are added with: node tools/new-seq.mjs <id> <seq> --from "<word>"
// Then run: python tools/words.py <id> -v      (snaps the words to the audio and tightens the pauses)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { root } from "./lib/env.mjs";
import { sequenceFiles } from "./lib/seq-template.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const id = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const usage = 'usage: node tools/new-film.mjs <id> --vo "<voice file>" --srt "<words.srt>" [--title "<title>"] [--script "<script.txt>"]';
if (!id || !opt("vo") || !opt("srt")) throw new Error(usage);
if (!/^[a-z][a-z0-9]{1,23}$/.test(id)) throw new Error(`"${id}" will not do as an id: lower-case letters and digits, starting with a letter (for example "haq" or "minus2")`);
const dir = join(root, "src", "films", id);
if (existsSync(dir)) throw new Error(`${dir} already exists`);
const vo = resolve(opt("vo"));
const srt = resolve(opt("srt"));
for (const f of [vo, srt]) if (!existsSync(f)) throw new Error(`not found: ${f}`);
const title = opt("title", id);
const script = opt("script") ? readFileSync(resolve(opt("script")), "utf8").replace(/\s+/g, " ").trim() : null;
const ID = id.toUpperCase();

// ---- the source files, kept with the film
mkdirSync(join(dir, "source"), { recursive: true });
mkdirSync(join(dir, "s1"), { recursive: true });
const voName = `vo${extname(vo).toLowerCase()}`;
copyFileSync(vo, join(dir, "source", voName));
copyFileSync(srt, join(dir, "source", "words.srt"));
if (script) writeFileSync(join(dir, "source", "script.txt"), script);

writeFileSync(
  join(dir, "film.json"),
  `${JSON.stringify({ title, vo: `src/films/${id}/source/${voName}`, timings: "source/words.srt", ...(script ? { script } : {}), lead: 0.1, tail: 0.5, fixes: {}, keepAfter: [], pause: { comma: 0.28, stop: 0.42, inner: 0.2 } }, null, 2)}\n`,
);

// ---- a provisional word table straight from the .srt, so the film compiles before words.py has run
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = [];
const ts = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/;
for (const block of readFileSync(srt, "utf8").replace(/^﻿/, "").split(/\r?\n\r?\n/)) {
  const m = ts.exec(block);
  if (!m) continue;
  const g = m.slice(1).map(Number);
  const t0 = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000;
  const t1 = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000;
  const toks = block.slice(block.indexOf(m[0]) + m[0].length).trim().split(/\s+/).filter(Boolean);
  toks.forEach((w, k) => {
    if (!norm(w)) {
      if (words.length) words[words.length - 1].w += w;
      return;
    }
    const a = t0 + ((t1 - t0) * k) / toks.length;
    words.push({ w, n: norm(w), t0: +a.toFixed(3), t1: +(t0 + ((t1 - t0) * (k + 1)) / toks.length).toFixed(3), src: +a.toFixed(3) });
  });
}
if (!words.length) throw new Error(`no timed words found in ${srt}`);
const duration = +(words[words.length - 1].t1 + 0.5).toFixed(3);
writeFileSync(
  join(dir, "words.ts"),
  `// PROVISIONAL: straight from the .srt. Run python tools/words.py ${id} to snap the words to the audio and tighten the pauses.\n` +
    `export const VO = ${JSON.stringify({ file: `audio/${id}/vo-tight.wav`, duration, srcFrom: 0, srcTo: duration })} as const;\n` +
    `export const WORDS = [\n${words.map((w) => ` ${JSON.stringify(w)},\n`).join("")}] as const;\n` +
    `export const TRIMS = [] as const;\n`,
);

// ---- the opening words, for the placeholder's type (only if the type face has every character of them)
const plain = (w) => w.replace(/[,.;:!?"“”]+$/g, "");
let opening = [];
for (const w of words.slice(0, 3)) {
  if (!/^[A-Za-z0-9'’,.\-–]+$/.test(w.w)) break;
  opening.push(w.w);
}
if (opening.length) opening[opening.length - 1] = plain(opening[opening.length - 1]);
const openingText = opening.join(" ");
const firstWord = words[0].n;

writeFileSync(
  join(dir, "palette.ts"),
  `// Colours that belong to this film alone. A film file may not hold a colour anywhere else (the dry run checks):
// sets, props and people bring their own palettes from src/assets; what is listed here is extra.
import type { Palette } from "../../engine/draw/shape.ts";

export const PALETTE: Palette = {
  "stage.wall": "#b9cbbf",
  "stage.floor": "#857d78",
};
`,
);

// ---- the placeholder sequence: take, frame and sequence object
for (const [name, text] of Object.entries(sequenceFiles({ title, seq: "s1", anchor: firstWord, first: true, opening: openingText || undefined }))) {
  writeFileSync(join(dir, "s1", name), text);
}

writeFileSync(
  join(dir, "film.ts"),
  `// ${title}: the film as a list of sequences. Add each new sequence here, in order.
import type { Film } from "../../engine/film.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { S1_SEQ } from "./s1/index.ts";
import { VO, WORDS } from "./words.ts";

export const ${ID}_FILM: Film = {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(title)},
  width: 1080,
  height: 1920,
  fps: 30,
  duration: VO.duration,
  look: "A",
  type: TYPE_LOOKS.A,
  words: WORDS,
  sequences: [S1_SEQ],
  // every name or spelling that goes on screen and had to be looked up: { text, source, confirmed }
  facts: [],
};
`,
);

writeFileSync(join(dir, "sound.json"), `${JSON.stringify({ lufs: -14.0, ceiling: -1.7, vo: { file: `public/audio/${id}/vo-tight.wav`, lufs: -15.0 }, cues: {} }, null, 2)}\n`);

writeFileSync(
  join(dir, "board.md"),
  `# ${title}: board

Written from \`node tools/script.ts ${id}\`. The user approves this page (with the cast sheet and one style frame per world) before any sequence is built. docs/directing.md says how to write it.

## Sequences and joins

One row per world. A sequence is one continuous take: no cuts inside it.

| # | Sequence | Seconds | Words it covers | The world and its light | How it hands over to the next |
|---|---|---|---|---|---|
| 1 | s1 | 0.00 - | | | |

## Beats

### 1. s1

| Beat | Words (verbatim) | Seconds | What happens (who does what, on which word) | Camera | Type (verbatim, and the word it lands on) | Sound cues |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## Cast

| Who | Build and shape | Hair, face | Clothes and colours | Reuses or starts from |
|---|---|---|---|---|

## Questions for the user

- Spellings to confirm:
- Anything the narration implies but does not say (do not show it):
`,
);

writeFileSync(
  join(dir, "STATE.md"),
  `# ${title}: state

Read this and board.md at the start of every session. Update it after every sequence. Nothing that matters lives only in a conversation.

## Scoreboard

| Step | Status |
|---|---|
| Words and tighten (\`python tools/words.py ${id} -v\`) | |
| Board | |
| Cast sheet and one style frame per world | |
| Stop A: the user approves board, cast and style frames | |
| Sequences | see the table below |
| Assembly, audit, finishing pass | |
| Sound | |
| Delivered (Stop B) | |

## Sequences

| Seq | Seconds | Dry run | Stills looked at | Draft with voice sent | Review scores (same film, motion, staging, type, joins, life) | Status |
|---|---|---|---|---|---|---|
| s1 | | | | | | placeholder |

## Decisions taken

## The stage (so the next session need not read the take to find it)

Where each set piece, prop and actor's mark stands, where the light comes from, and which later beat depends on which position.

## Files this film owns outside its folder

Library files made or changed for this film (under src/assets), and whether another film uses them.

## Which outputs are current

The render, the dry run output and the review pack that describe the film as it stands now, with their times. Anything older is stale: say so or delete it.

## Departures from the board (tell the user)

## Known weak spots (tell the user before they find them)

## Fetched from outside (every download, with its source; for a music track its recording id as well, since signed links expire)

## Open with the user
`,
);

// ---- register the film
const indexPath = join(root, "src", "films", "index.ts");
let index = readFileSync(indexPath, "utf8");
const imp = `import { ${ID}_FILM } from "./${id}/film.ts";\n`;
const lastImport = index.lastIndexOf("import ");
const lineEnd = index.indexOf("\n", lastImport) + 1;
index = index.slice(0, lineEnd) + imp + index.slice(lineEnd);
index = index.replace(/export const FILMS: Film\[\] = \[([^\]]*)\];/, (_, inner) => `export const FILMS: Film[] = [${inner.trim() ? `${inner.trim()}, ` : ""}${ID}_FILM];`);
writeFileSync(indexPath, index);

console.log(`made src/films/${id}/ (${words.length} words, about ${duration.toFixed(1)} s before tightening) and registered it`);

// ---- snap the words to the audio and tighten the pauses now, if Python is here
const py = process.platform === "win32" ? "python" : "python3";
const r = spawnSync(py, ["tools/words.py", id], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
if (r.status === 0) console.log(r.stdout.split("\n").slice(0, 2).join("\n"));
else console.log(`words.py did not run (${(r.stderr || r.stdout || "").trim().split("\n").pop()}): the word table is the provisional one from the .srt`);
console.log(`next:
  python tools/words.py ${id} -v        look at out/${id}/words.png: every red line at the start of a burst of sound
  node tools/script.ts ${id}            the narration by sentence, to write src/films/${id}/board.md
  node tools/check.ts ${id}             the placeholder sequence passes; keep it passing as you replace it
  node tools/new-seq.mjs ${id} <seq> --from "<word>"    one placeholder more for each further sequence of the board
  node tools/stills.mjs ${id}:1         one still, to see the stage`);
