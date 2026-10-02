# Measures how a clip moves, the same way the two old films were measured (plan, appendix A4).
# Usage: python tools/audit.py "<clip>|<label>[|<from s>|<to s>]" ... [--out out/<film>/audit.json]
#   (the numbers are also written as JSON: to --out, or to out/audit.json; tools/deliver.mjs reads out/<film>/audit.json)
# Metric: mean absolute grey difference between consecutive frames on a 108x192 downscale (0-255).
#   still frames read below 0.05, eye darts 0.2-0.8, real moves 5-30, cuts above 40.
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
from ffpath import FFMPEG, unlocked  # noqa: E402
W, H = 108, 192


def frames(path, t0=None, t1=None):
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error"]
    if t0 is not None:
        cmd += ["-ss", str(t0)]
    if t1 is not None:
        cmd += ["-to", str(t1)]
    cmd += ["-i", path, "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)


def fps_of(path):
    out = subprocess.run([FFMPEG, "-hide_banner", "-i", path], stderr=subprocess.PIPE, stdout=subprocess.PIPE).stderr.decode("utf8", "ignore")
    for part in out.split(","):
        part = part.strip()
        if part.endswith(" fps"):
            return float(part.split()[0])
    return 30.0


def runs(mask):
    """Start and length of every run of True."""
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append((start, i - start))
            start = None
    if start is not None:
        out.append((start, len(mask) - start))
    return out


def audit(path, label, t0=None, t1=None):
    fps = fps_of(path)
    f = frames(path, t0, t1)
    n = len(f)
    d = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))  # d[i]: change from frame i to i+1
    still = d < 0.05
    cut = d > 40
    # a frame is inside a move when something moved within 3 frames before it and within 3 after it
    moved = d >= 1.0
    before = np.zeros(len(d), bool)
    after = np.zeros(len(d), bool)
    for k in range(1, 4):
        before[k:] |= moved[:-k]
        after[:-k] |= moved[k:]
    in_move = before & after & ~cut
    held = still & in_move
    # near-still stretches: motion, averaged over 7 frames, below 0.6 for at least 0.75 s
    smooth = np.convolve(np.where(cut, 0, d), np.ones(7) / 7, mode="same")
    quiet = [(s, m) for s, m in runs(smooth < 0.6) if m / fps >= 0.75]
    quiet_s = sum(m for _, m in quiet) / fps
    # flash frames: the whole frame jumps toward white and comes back within 4 frames
    mean = f.mean(axis=(1, 2))
    flashes = 0
    i = 1
    while i < n - 1:
        if mean[i] - mean[i - 1] > 45 and mean[i] > 200:
            j = min(n - 1, i + 4)
            if mean[i] - mean[j] > 30:
                flashes += 1
                i = j
        i += 1
    dur = n / fps
    return {
        "label": label,
        "seconds": round(dur, 2),
        "fps": round(fps, 2),
        "frames": n,
        "no_change_pct": round(100 * still.mean(), 1),
        "held_in_move_pct": round(100 * held.sum() / max(1, in_move.sum()), 1),
        "quiet_stretches": len(quiet),
        "quiet_seconds": round(quiet_s, 2),
        "quiet_pct": round(100 * quiet_s / dur, 1),
        "longest_quiet_s": round(max([m for _, m in quiet], default=0) / fps, 2),
        "cuts": int(cut.sum()),
        "flashes": flashes,
        "median_move": round(float(np.median(d[d >= 1.0])) if (d >= 1.0).any() else 0.0, 2),
    }


def main():
    rows = []
    args = sys.argv[1:]
    dst = None
    if "--out" in args:
        dst = args[args.index("--out") + 1]
        args = [a for i, a in enumerate(args) if a != "--out" and (i == 0 or args[i - 1] != "--out")]
    for spec in args:
        parts = spec.split("|")
        path, label = parts[0], parts[1] if len(parts) > 1 else os.path.basename(parts[0])
        t0 = float(parts[2]) if len(parts) > 2 else None
        t1 = float(parts[3]) if len(parts) > 3 else None
        rows.append(audit(path, label, t0, t1))
    keys = [
        ("seconds", "length (s)"),
        ("fps", "frames a second"),
        ("no_change_pct", "frames with no visible change (%)"),
        ("held_in_move_pct", "held frames inside a move (%)"),
        ("quiet_pct", "time near-still for 0.75 s or more (%)"),
        ("longest_quiet_s", "longest near-still stretch (s)"),
        ("cuts", "cuts"),
        ("flashes", "full-screen flash frames"),
    ]
    wl = max(len(k[1]) for k in keys)
    print(" " * wl + "  " + "  ".join(r["label"].rjust(16) for r in rows))
    for k, name in keys:
        print(name.ljust(wl) + "  " + "  ".join(str(r[k]).rjust(16) for r in rows))
    out = dst or os.path.join(HERE, "..", "out", "audit.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(unlocked(out), "w", encoding="utf8") as fh:
        json.dump(rows, fh, indent=1)


if __name__ == "__main__":
    main()
