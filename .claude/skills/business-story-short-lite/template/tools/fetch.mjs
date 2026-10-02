// Downloads the sounds a film will use from the links the sound library's connector hands out, in one go.
// The links are long and signed and expire within minutes, so they are not for retyping: put them in a list as you
// get them and run this once.
//
//   node tools/fetch.mjs <film> <list.json> [--music]
//
// list.json: [{ "name": "gate_chain", "url": "https://...", "title": "Chains, Movement, Metal ...", "preview": "https://..." }, ...]
//   name     the short name to save under (the extension comes from the link; give one to force it)
//   url      the download link
//   title    the library's own title of the sound       } both optional: they go into the list of what was fetched,
//   preview  the preview link the user can listen to    } which is what the picks file is written from
// Effects go to public/sfx/<film>/; with --music (or "music": true on an entry) to public/audio/<film>/.
// A file that is already there is kept. Each download is tried three times. Writes out/<film>/sound_fetched.md.
//
// Whose sounds: only fetch from a source the user has agreed to (see docs/sound.md). This tool does not decide that.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { OUT, root, sleep } from "./lib/env.mjs";

const args = process.argv.slice(2);
const [film, listFile] = args.filter((a) => !a.startsWith("--"));
if (!film || !listFile) throw new Error("usage: node tools/fetch.mjs <film> <list.json> [--music]");
if (!existsSync(join(root, "src", "films", film))) throw new Error(`no film "${film}" in src/films`);
const list = JSON.parse(readFileSync(resolve(listFile), "utf8"));
if (!Array.isArray(list) || !list.length) throw new Error("the list is empty: it wants [{ name, url, title?, preview? }, ...]");

const rows = [];
let failed = 0;
for (const it of list) {
  if (!it.name || !it.url) throw new Error(`an entry lacks its name or its url: ${JSON.stringify(it).slice(0, 120)}`);
  const music = args.includes("--music") || it.music === true;
  const dir = join(root, "public", music ? "audio" : "sfx", film);
  mkdirSync(dir, { recursive: true });
  let host = "?";
  let ext = extname(it.name);
  try {
    const u = new URL(it.url);
    host = u.host;
    if (!ext) ext = extname(u.pathname) || ".mp3";
  } catch {
    throw new Error(`not a link: ${String(it.url).slice(0, 80)}`);
  }
  const file = join(dir, extname(it.name) ? it.name : `${it.name}${ext}`);
  const rel = file.slice(root.length + 1).replace(/\\/g, "/");
  if (existsSync(file) && statSync(file).size > 1000) {
    console.log(`  kept     ${rel} (already there)`);
    rows.push({ ...it, rel });
    continue;
  }
  let done = false;
  let why = "";
  for (let k = 1; k <= 3 && !done; k++) {
    try {
      const r = await fetch(it.url);
      if (r.status === 401 || r.status === 403) {
        why = `the link was refused (${r.status}): it has expired, ask the connector for a fresh one`;
        break;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1000) throw new Error(`only ${buf.length} bytes came back`);
      writeFileSync(file, buf);
      console.log(`  fetched  ${rel} (${(buf.length / 1024).toFixed(0)} KB, from ${host})`);
      rows.push({ ...it, rel });
      done = true;
    } catch (e) {
      why = String(e?.message ?? e);
      if (k < 3) await sleep(1500 * k);
    }
  }
  if (!done) {
    failed++;
    console.log(`  FAILED   ${it.name}: ${why}`);
  }
}

// what came in, for the picks file and for STATE.md ("Fetched from outside")
mkdirSync(join(OUT, film), { recursive: true });
const md = join(OUT, film, "sound_fetched.md");
const old = existsSync(md) ? readFileSync(md, "utf8").split("\n").filter((l) => l.startsWith("| `")) : [];
const lines = new Map(old.map((l) => [l.split("`")[1], l]));
for (const r of rows) lines.set(r.rel, `| \`${r.rel}\` | ${r.title ?? ""} | ${r.preview ?? ""} |`);
writeFileSync(md, `# Sounds fetched for ${film}\n\nWrite out/${film}/sound_picks.md from this (docs/sound.md, "Deliverables"): the moment each sound is heard at, in the film's own words.\n\n| File | Library title | Preview |\n|---|---|---|\n${[...lines.values()].join("\n")}\n`);
console.log(`${rows.length} of ${list.length} in place; list: out/${film}/sound_fetched.md`);
if (failed) {
  console.log(`FAILED: ${failed} sound(s) did not arrive`);
  process.exitCode = 1;
}
