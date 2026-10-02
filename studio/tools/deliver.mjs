// The last step: joins the finished picture and the mix, checks the file, and gathers what goes to the user.
// Usage: node tools/deliver.mjs <film> [--picture out/final/<film>_finished.mp4] [--mix out/<film>/mix.wav]
// Writes out/<film>/deliver/: <film>.mp4 (full mix), <film>_sfx-only.mp3, <film>_vo-tight.wav, report.md
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FFMPEG, OUT, ensureDir, ffmpeg, need, root } from "./lib/env.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const id = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!id) throw new Error("usage: node tools/deliver.mjs <film> [--picture file] [--mix file]");
const { filmById } = await import(pathToFileURL(resolve(root, "src/films/index.ts")).href);
const film = filmById(id);
const picture = need(resolve(root, opt("picture", `out/final/${id}_finished.mp4`)), `render the film and run node tools/finish.mjs out/video/${id}_clean.mp4 --look ${film.look} --out ${id}_finished`);
const mix = need(resolve(root, opt("mix", `out/${id}/mix.wav`)), `run python tools/audio_mix.py src/films/${id}/sound.json out/${id}/cues.json --out out/${id}`);
const dir = ensureDir(join(OUT, id, "deliver"));
const final = join(dir, `${id}.mp4`);

ffmpeg(["-i", picture, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", final]);
const sfx = join(root, "out", id, "sfx-only.mp3");
const vo = join(root, "public", "audio", id, "vo-tight.wav");
if (existsSync(sfx)) copyFileSync(sfx, join(dir, `${id}_sfx-only.mp3`));
if (existsSync(vo)) copyFileSync(vo, join(dir, `${id}_vo-tight.wav`));

// ---- what the file is
const probe = (file, extra = []) => {
  // ffmpeg writes what it finds to stderr, whether or not it "succeeds"
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", file, ...extra], { encoding: "utf8", maxBuffer: 1 << 26 });
  return `${r.stderr ?? ""}${r.stdout ?? ""}`;
};
const info = probe(final);
const v = /Video: (\w+)[^\n]*?, (yuv\w+)\(([^)]*)\)[^\n]*?, (\d+)x(\d+)[^\n]*?, ([\d.]+) fps/.exec(info);
const a = /Audio: (\w+)[^\n]*?, (\d+) Hz, (\w+)/.exec(info);
const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
const seconds = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
const loud = probe(final, ["-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"]);
const tail = loud.slice(loud.lastIndexOf("Summary:"));
const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(tail)?.[1] ?? NaN);
const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(tail)?.[1] ?? NaN);

const checks = [
  ["picture is H.264, yuv420p, tagged bt709", !!v && v[1] === "h264" && v[2] === "yuv420p" && /bt709/.test(v[3]), v ? `${v[1]} ${v[2]} (${v[3]})` : "not found"],
  [`${film.width}x${film.height} at ${film.fps} fps`, !!v && Number(v[4]) === film.width && Number(v[5]) === film.height && Math.abs(Number(v[6]) - film.fps) < 0.01, v ? `${v[4]}x${v[5]} at ${v[6]} fps` : "not found"],
  ["sound is AAC, 48 kHz, stereo", !!a && a[1] === "aac" && a[2] === "48000" && a[3] === "stereo", a ? `${a[1]} ${a[2]} Hz ${a[3]}` : "no sound stream"],
  [`length within 0.1 s of the voice (${film.duration.toFixed(2)} s)`, Math.abs(seconds - film.duration) < 0.1, `${seconds.toFixed(2)} s`],
  ["loudness -14 LUFS, give or take 0.6", Math.abs(lufs + 14) <= 0.6, `${lufs} LUFS`],
  ["true peak at or under -1 dB", peak <= -1.0, `${peak} dB`],
];
let ok = true;
console.log(final);
for (const [name, pass, got] of checks) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}: ${got}`);
  if (!pass) ok = false;
}

// ---- the report that goes with it
const lines = [`# ${film.title}`, "", `Delivered files (in \`out/${id}/deliver/\`): \`${id}.mp4\` (full mix), \`${id}_sfx-only.mp3\` (effects and air only, lined up with the tightened voice), \`${id}_vo-tight.wav\` (the tightened voice).`, ""];
lines.push("## The file", "", ...checks.map(([name, pass, got]) => `- ${pass ? "ok" : "**FAIL**"}: ${name} (${got})`), "");
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const rep = read(join(root, "out", id, "mix-report.json"));
if (rep) {
  lines.push("## The mix (set by measurement, not by ear)", "");
  lines.push(`- Loudness ${rep.mix?.lufs} LUFS, true peak ${rep.mix?.truePeak} dB.`);
  const c = rep["voice clear"];
  if (c) lines.push(`- Wherever someone speaks, the voice is at least ${c.effects?.worst} dB over the effects (needs ${c.effects?.need}) and ${c.music?.worst} dB over the music (needs ${c.music?.need}).`);
  if (rep.music) lines.push(`- Music: \`${rep.music.file}\`.`);
  for (const n of rep.notes ?? []) lines.push(`- ${n}`);
  for (const [k, val] of Object.entries(rep.checks ?? {})) if (val === false) lines.push(`- **Not met:** ${k}`), (ok = false);
  // a mix that failed half way leaves the older mix.wav in place: say so instead of delivering it
  if (!args.includes("--mix"))
    for (const m of rep["made from"] ?? []) {
      const p = resolve(root, m.file);
      const now = existsSync(p) ? createHash("sha1").update(readFileSync(p)).digest("hex") : "missing";
      if (now !== m.sha1) {
        console.log(`  FAIL the mix was made from an older ${m.file}: run python tools/audio_mix.py again and see that it finishes`);
        lines.push(`- **Not met:** the mix was made from an older \`${m.file}\``);
        ok = false;
      }
    }
  lines.push("");
}
const audit = read(join(root, "out", id, "audit.json"));
if (audit?.length) {
  lines.push("## How it moves (measured on the render)", "");
  for (const r of audit) lines.push(`- ${r.label}: frames with no visible change ${r.no_change_pct} %, held frames inside a move ${r.held_in_move_pct} %, near-still time ${r.quiet_pct} % (longest ${r.longest_quiet_s} s), cuts ${r.cuts}, flash frames ${r.flashes}.`);
  lines.push("");
}
try {
  const words = await import(pathToFileURL(resolve(root, `src/films/${id}/words.ts`)).href);
  const trims = (words.TRIMS ?? []).filter((t) => t.was - t.now > 0.005);
  lines.push("## Trims to the voice (pauses only; no word was cut or sped up)", "");
  if (!trims.length) lines.push("- none");
  for (const t of trims) lines.push(`- after "${t.after}": ${t.was.toFixed(2)} s -> ${t.now.toFixed(2)} s`);
  const kept = (words.TRIMS ?? []).filter((t) => t.kept);
  if (kept.length) lines.push(`- kept on purpose: ${kept.map((t) => `after "${t.after}" (${t.was.toFixed(2)} s)`).join(", ")}`);
  lines.push("");
} catch {}
const open = (film.facts ?? []).filter((f) => !f.confirmed);
lines.push("## Spellings and figures on screen", "");
if (!(film.facts ?? []).length) lines.push("- every on-screen string is the narrator's own words; no names were looked up");
for (const f of film.facts ?? []) lines.push(`- "${f.text}": ${f.confirmed ? "confirmed" : "**not yet confirmed**"} (${f.source})`);
lines.push("");
const picks = join(root, "out", id, "sound_picks.md");
if (existsSync(picks)) lines.push("## Sounds", "", `See \`out/${id}/sound_picks.md\` for every sound with its preview link.`, "");
writeFileSync(join(dir, "report.md"), lines.join("\n"));
console.log(join(dir, "report.md"));
if (open.length) console.log(`  tell the user: not yet confirmed: ${open.map((f) => `"${f.text}"`).join(", ")}`);
console.log(ok ? "DELIVERABLE" : "NOT READY: fix what failed above");
process.exitCode = ok ? 0 : 1;
