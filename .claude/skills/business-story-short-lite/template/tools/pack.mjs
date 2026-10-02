// Builds the review pack for one sequence: what a fresh reviewer needs, and nothing else.
// Usage: node tools/pack.mjs <film> <seq> [--at "1.2,3.26,5.1"] [--clip out/video/<draft>.mp4 --clipFrom <s>] [--strips "3.0-3.6,5.0-5.7"]
//   --at       moments for the stills (default: first and last frame, every type landing, and cues spread through the take; 12 at most)
//   --clip     a draft render of the sequence, for the motion audit and the frame strips
//   --clipFrom where in the film that draft starts (default: the sequence's t0)
//   --strips   stretches of film time to lay out frame by frame (the fast part of each action)
// Writes out/<film>/pack/<seq>/: check.txt, sheet.jpg, strip_*.png, audit.txt, pack.md
// It starts one browser (for the stills); everything else is light.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { OUT, ensureDir, root } from "./lib/env.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const plain = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [id, seqId] = plain;
if (!id || !seqId) throw new Error('usage: node tools/pack.mjs <film> <seq> [--at "t,t,t"] [--clip draft.mp4] [--strips "a-b,c-d"]');
const { filmById } = await import(pathToFileURL(resolve(root, "src/films/index.ts")).href);
const { framesOf } = await import(pathToFileURL(resolve(root, "src/engine/qa/check.ts")).href);
const { measure } = await import(pathToFileURL(resolve(root, "src/engine/type/blockspec.ts")).href);
const { flatItems } = await import(pathToFileURL(resolve(root, "src/engine/draw/list.ts")).href);
const film = filmById(id);
const seq = film.sequences.find((s) => s.id === seqId);
if (!seq) throw new Error(`no sequence "${seqId}" in ${id}`);
const { until } = framesOf(film, seq);
const dir = ensureDir(join(OUT, id, "pack", seqId));
// a pack shows one state of the sequence: nothing of an earlier pack may be left for the reviewer to mistake for it
for (const f of readdirSync(dir)) if (/^(strip_|sheet|audit|check|pack\.md)/.test(f)) rmSync(join(dir, f), { force: true });
const run = (cmd, a) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });

// 1. the dry run
const chk = run(process.execPath, ["tools/check.ts", id, "--seq", seqId]);
writeFileSync(join(dir, "check.txt"), `${chk.stdout}${chk.stderr}`);
const verdict = /^(PASSED|FAILED)[^\n]*/m.exec(chk.stdout)?.[0] ?? "did not run";
console.log(`dry run: ${verdict}`);

// 2. the moments worth a still
let times;
if (opt("at")) times = opt("at").split(",").map(Number);
else {
  const set = new Set([seq.t0 + 0.05, until - 0.1]);
  // every type landing, a little after it has settled
  const mid = seq.frame((seq.t0 + until) / 2, film.look);
  for (const { item } of flatItems(mid.items)) if (item.kind === "type") for (const p of measure(item.block, film.type)) if (Number.isFinite(p.at)) set.add(p.at + 0.35);
  for (const s of [seq.t0 + (until - seq.t0) * 0.25, seq.t0 + (until - seq.t0) * 0.75]) {
    const fr = seq.frame(s, film.look);
    for (const { item } of flatItems(fr.items)) if (item.kind === "type") for (const p of measure(item.block, film.type)) if (Number.isFinite(p.at)) set.add(p.at + 0.35);
  }
  const cues = seq.cues.map((c) => c.t).sort((a, b) => a - b);
  const want = 12 - set.size;
  for (let k = 0; k < want && cues.length; k++) set.add(cues[Math.floor(((k + 0.5) / want) * cues.length)]);
  times = [...set];
}
times = [...new Set(times.map((t) => Math.round(Math.min(until - 0.04, Math.max(seq.t0, t)) * 100) / 100))].sort((a, b) => a - b).slice(0, 12);
const comp = `${id}-${seqId}`;
const names = times.map((t) => `pack_${id}_${seqId}_${t.toFixed(2)}`);
const st = run(process.execPath, ["tools/stills.mjs", ...times.map((t, i) => `${comp}:${t}@0.5=${names[i]}`)]);
if (st.status !== 0) console.log(`stills failed:\n${st.stdout}${st.stderr}`.slice(0, 1500));
const shots = names.map((n) => join("out", "stills", `${n}.png`)).filter((p) => existsSync(join(root, p)));
if (shots.length) {
  // one row, or two rows of the same length, each still labelled with its time
  const per = shots.length > 6 ? Math.ceil(shots.length / 2) : shots.length;
  const rows = [];
  for (let i = 0; i < shots.length; i += per) rows.push(i);
  const parts = [];
  for (const [k, i] of rows.entries()) {
    const name = `pack_${id}_${seqId}_row${k}`;
    run(process.execPath, ["tools/board.mjs", "--out", name, "--size", "640", "--labels", times.slice(i, i + per).map((t) => `${t.toFixed(2)} s`).join("|"), ...shots.slice(i, i + per)]);
    parts.push(join("out", "boards", `${name}.png`));
  }
  run(process.execPath, ["tools/board.mjs", "--out", `pack_${id}_${seqId}`, "--dir", "v", "--size", "2400", "--jpg", ...parts]);
  const sheet = join(root, "out", "boards", `pack_${id}_${seqId}.jpg`);
  if (existsSync(sheet)) {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(sheet, join(dir, "sheet.jpg"));
    console.log(join(dir, "sheet.jpg"));
  }
}

// 3. from a draft render: the motion audit, and every frame of the fast parts
const clip = opt("clip");
const strips = [];
if (clip) {
  const clipFrom = Number(opt("clipFrom", seq.t0));
  const au = run(process.platform === "win32" ? "python" : "python3", ["tools/audit.py", `${clip}|${seqId}`, "--out", join("out", id, "pack", seqId, "audit.json")]);
  writeFileSync(join(dir, "audit.txt"), `${au.stdout}${au.stderr}`);
  for (const [k, span] of (opt("strips") ?? "").split(",").filter(Boolean).entries()) {
    const [a, b] = span.split("-").map(Number);
    const name = `pack_${id}_${seqId}_strip${k}`;
    run(process.execPath, ["tools/strip.mjs", clip, "--from", String(a - clipFrom), "--to", String(b - clipFrom), "--every", "1", "--cols", "8", "--rows", String(Math.ceil(((b - a) * film.fps) / 8)), "--w", "270", "--out", name]);
    const p = join(root, "out", "strips", `${name}.png`);
    if (existsSync(p)) {
      const { copyFileSync } = await import("node:fs");
      copyFileSync(p, join(dir, `strip_${a}-${b}.png`));
      strips.push(`strip_${a}-${b}.png`);
    }
  }
}

writeFileSync(
  join(dir, "pack.md"),
  [
    `# Review pack: ${id} / ${seqId} (${seq.t0.toFixed(2)}-${until.toFixed(2)} s)`,
    "",
    "The reviewer sees the approved style frames, `docs/review.md` (the rubric and the hard fails) and this folder. Nothing else.",
    "",
    `The narrator says, in this stretch: "${film.words.filter((w) => w.t0 >= seq.t0 - 0.02 && w.t0 < until).map((w) => w.w).join(" ")}"`,
    "",
    `- \`check.txt\`: the dry run (${verdict}).`,
    shots.length ? `- \`sheet.jpg\`: stills at ${times.map((t) => t.toFixed(2)).join(", ")} s.` : "- no stills (the render failed: see above).",
    ...strips.map((s) => `- \`${s}\`: every frame of that stretch, left to right, top to bottom.`),
    clip ? "- `audit.txt`: how the draft render moves (held frames, near-still time, cuts, flash frames)." : "- no draft render was given, so there is no motion audit and no frame strip yet.",
    "",
    "## Scores (1 to 5; anything under 4 goes back with at most five named defects, each with its time)",
    "",
    "| Point | Score | Defects |",
    "|---|---|---|",
    "| 1. Same film as the style frames | | |",
    "| 2. Motion: wind-up, arc, overlap, settle; weight | | |",
    "| 3. Staging: one thing to look at; reads in silhouette | | |",
    "| 4. Type: verbatim, on its word, big, clear of heads | | |",
    "| 5. Joins: arrives from and hands to its neighbours | | |",
    "| 6. Life: nothing frozen; holds are alive | | |",
    "",
    "Hard fails, whatever the scores: a limb through a head or torso; a planted foot that slides; type outside the safe zone; a word or number on screen that the narrator does not say; a redrawn trademark; a flash frame.",
    "",
  ].join("\n"),
);
console.log(join(dir, "pack.md"));
