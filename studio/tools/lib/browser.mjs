// The only place a browser is ever launched.
// Rules: Remotion's headless shell only, one browser at a time behind a lock, never the system Chrome,
// two workers, GPU path, below-normal priority. docs/machine.md has the measurements and the reasons.
import { bundle } from "@remotion/bundler";
import { openBrowser } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { OUT, SHELL, ensureDir, need, retry, root, sleep } from "./env.mjs";

/** `angle` = the same GPU path every browser window on this PC uses. Software GL was 8x slower at 96 % CPU. */
export const DEFAULT_GL = process.env.STUDIO_GL || "angle";
/** Default worker count. The budget on this PC is 80 % of CPU and 80 % of RAM (the user's own limit). */
export const WORKERS = Math.max(1, Math.min(4, Number(process.env.STUDIO_WORKERS) || 2));

/**
 * Workers for a video render, chosen from the RAM that is free right now so that the total stays under 80 %.
 * A worker tab costs roughly 3 % of this PC's 16 GB, the browser itself about the same again.
 */
export function pickWorkers() {
  if (process.env.STUDIO_WORKERS) return WORKERS;
  const used = 1 - os.freemem() / os.totalmem();
  // the user's rule (2 Oct 2026): normal speed and power, just never crash. Two workers unless RAM is already tight.
  const room = 0.9 - used - 0.03;
  // (never more than two: measured, a third and a fourth worker render no faster and only use more memory)
  return Math.max(used < 0.84 ? 2 : 1, Math.min(2, Math.floor(room / 0.03)));
}
const LOCK = join(OUT, ".render.lock");

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Number of headless shells already running on this PC (ours or another session's). */
export function shellsRunning() {
  try {
    if (process.platform !== "win32") return execFileSync("pgrep", ["-f", "chrome-headless-shell"]).toString().split("\n").filter(Boolean).length;
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq chrome-headless-shell.exe", "/FO", "CSV", "/NH"]).toString();
    return out.split(/\r?\n/).filter((l) => l.toLowerCase().includes("chrome-headless-shell")).length;
  } catch {
    return 0;
  }
}

async function waitForQuiet(maxMinutes = 30) {
  const until = Date.now() + maxMinutes * 60000;
  let told = false;
  for (;;) {
    const lockPid = existsSync(LOCK) ? Number(readFileSync(LOCK, "utf8")) : 0;
    const locked = lockPid && lockPid !== process.pid && alive(lockPid);
    const n = locked ? 1 : shellsRunning();
    if (!locked && n === 0) return;
    if (!told) {
      console.log(`waiting: ${locked ? `render lock held by pid ${lockPid}` : `${n} headless shell process(es) from another job`}`);
      told = true;
    }
    if (Date.now() > until) throw new Error("another render is still running after the wait; not launching a second browser");
    await sleep(30000); // slow poll: each check starts a process, and process starts are what this PC dislikes
  }
}

/** Everything this job starts (browser, ffmpeg) inherits below-normal priority, so the desktop stays usable. */
export function beGentle() {
  try {
    os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {}
}

export async function makeBundle() {
  beGentle();
  // (the virus scanner holds freshly written bundle files for a moment: this is the step that most often needs a second try)
  return retry(() => bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") }), 9, "bundle");
}

/** Opens the one browser, runs fn(browser), always closes it and drops the lock. */
export async function withBrowser(opts, fn) {
  const gl = opts?.gl ?? DEFAULT_GL;
  need(SHELL, "the headless browser is missing: run node tools/doctor.mjs for how to get it");
  ensureDir(OUT);
  beGentle();
  await waitForQuiet();
  writeFileSync(LOCK, String(process.pid));
  const dropLock = () => {
    try {
      unlinkSync(LOCK);
    } catch {}
  };
  process.once("exit", dropLock);
  // When a render fails, Remotion's own clean-up can reject after the browser is gone ("Target closed").
  // Without this handler that late rejection kills the process before the real error is printed.
  let closing = false;
  const late = (e) => {
    if (closing) return;
    console.error("unhandled:", e?.stack ?? e);
    process.exitCode = 1;
  };
  process.on("unhandledRejection", late);
  let browser;
  try {
    browser = await openBrowser("chrome", {
      browserExecutable: SHELL,
      chromeMode: "headless-shell",
      chromiumOptions: { gl },
      logLevel: "error",
    });
    return await fn(browser);
  } catch (e) {
    // print the cause and where it came from, briefly (Remotion attaches hundreds of stack frames)
    const names = [];
    for (const f of e?.stackFrame ?? []) if (f.functionName && names[names.length - 1] !== f.functionName && names.length < 8) names.push(f.functionName);
    console.error("RENDER FAILED:", e?.message ?? e, e?.frame !== undefined ? `(frame ${e.frame})` : "");
    if (names.length) console.error("  in:", names.join(" <- "));
    else if (e?.stack) console.error(String(e.stack).split("\n").slice(1, 6).join("\n"));
    process.exitCode = 1;
    return null;
  } finally {
    closing = true;
    try {
      await browser?.close({ silent: true });
    } catch {}
    dropLock();
    await sleep(300);
    process.off("unhandledRejection", late);
  }
}

/** Options every render call passes so Remotion never looks for another browser. */
export const shellOpts = (browser, gl = DEFAULT_GL) => ({
  puppeteerInstance: browser,
  browserExecutable: SHELL,
  chromeMode: "headless-shell",
  chromiumOptions: { gl },
  logLevel: "error",
});
