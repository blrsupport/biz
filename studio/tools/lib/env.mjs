// Shared paths and small helpers for every tool. No render is ever started from this file.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import "./fail.mjs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exe = process.platform === "win32" ? ".exe" : "";
/** A full ffmpeg (loudness meter, limiter, tile). Remotion's own is cut down. STUDIO_FFMPEG points at one elsewhere. */
export const FFMPEG = process.env.STUDIO_FFMPEG || join(root, `tools/bin/ffmpeg${exe}`);

/** Remotion's own headless browser, wherever this platform keeps it under node_modules/.remotion. */
function findShell() {
  const base = join(root, "node_modules/.remotion/chrome-headless-shell");
  if (existsSync(base)) {
    for (const plat of readdirSync(base)) {
      const dir = join(base, plat);
      let inner = [];
      try {
        inner = readdirSync(dir);
      } catch {
        continue;
      }
      for (const sub of inner) {
        const f = join(dir, sub, `chrome-headless-shell${exe}`);
        if (existsSync(f)) return f;
      }
    }
  }
  return join(base, "win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
}
export const SHELL = findShell();
export const OUT = join(root, "out");

export function need(file, hint) {
  if (!existsSync(file)) throw new Error(`missing ${file}${hint ? ` — ${hint}` : ""}`);
  return file;
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Retries a step that Windows briefly locks (virus scanner on freshly written files). */
export async function retry(fn, tries = 6, label = "step") {
  for (let k = 1; ; k++) {
    try {
      return await fn();
    } catch (e) {
      if (k >= tries || !/EPERM|EBUSY|EACCES|Permission denied/i.test(String(e))) throw e;
      console.warn(`${label}: ${e.code ?? "locked"} - retry ${k}`);
      await new Promise((r) => setTimeout(r, Math.min(5000, 700 * k)));
    }
  }
}

export function ffmpeg(args, opts = {}) {
  return execFileSync(need(FFMPEG), ["-hide_banner", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28, ...opts });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Puts a finished file in its place, waiting out a lock on the old one (a player that has it open, the virus
 * scanner). If the place stays locked, the new file is kept beside it and the error says where, so that a long
 * render is never lost to a locked file.
 */
export async function moveInto(made, place) {
  for (let k = 1; ; k++) {
    try {
      if (existsSync(place)) rmSync(place, { force: true });
      try {
        renameSync(made, place);
      } catch {
        copyFileSync(made, place);
        rmSync(made, { force: true });
      }
      return place;
    } catch (e) {
      if (k >= 8) throw new Error(`${place} is locked by another program (a player? a scanner?) and could not be replaced. The new file is safe at ${made}: close whatever holds the old one and rename it.`);
      console.warn(`${place}: ${e.code ?? "locked"} - retry ${k}`);
      await sleep(Math.min(5000, 700 * k));
    }
  }
}
