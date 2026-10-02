# Looks inside sound files without ears: length, peak, and where the separate sounds in each file start and end.
# A recording of "footsteps" or "ratchet turns" holds many events; this lists them so a cue can name the one it wants.
# Run: python tools/sfx_scan.py public/sfx/md [--gap 0.12] [--floor -42] [--all] [--json out/md/sfx_scan.json]
#      (a folder, or one file; --all prints every event instead of the first 14)
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
from ffpath import FFMPEG, unlocked  # noqa: E402
SR = 48000


def decode(path, channels=1):
    """The file as float32 samples at 48 kHz (mono by default)."""
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-f", "f32le", "-ac", str(channels), "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    return a.reshape(-1, channels) if channels > 1 else a


def db(x):
    return 20 * np.log10(max(float(x), 1e-9))


def envelope(x, win=0.01):
    """RMS in windows of `win` seconds, as (times, dB)."""
    n = max(1, int(SR * win))
    m = len(x) // n
    if m == 0:
        return np.zeros(0), np.zeros(0)
    r = np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1))
    return (np.arange(m) + 0.5) * win, 20 * np.log10(np.maximum(r, 1e-9))


def events(x, floor_db=-42.0, gap=0.12, win=0.01):
    """Stretches louder than the floor, merged when closer than `gap`: [start, end, loudest 1/24 s RMS in dB, time of the loudest instant]."""
    t, e = envelope(x, win)
    if len(e) == 0:
        return []
    # the floor is relative to the file's own loudest moment, but never below an absolute hiss level
    thr = max(floor_db, e.max() - 34)
    on = e > thr
    out = []
    i = 0
    n = len(on)
    while i < n:
        if not on[i]:
            i += 1
            continue
        j = i
        last = i
        while j < n and (on[j] or (j - last) * win < gap):
            if on[j]:
                last = j
            j += 1
        a = max(0.0, t[i] - win)
        b = t[last] + win
        seg = x[int(a * SR) : int(b * SR)]
        k = max(1, SR // 24)
        if len(seg) >= k:
            c = np.cumsum(np.concatenate([[0.0], seg.astype(np.float64) ** 2]))
            pk = db(np.sqrt(((c[k:] - c[:-k]) / k).max()))
        else:
            pk = db(np.sqrt((seg**2).mean())) if len(seg) else -99
        hit = a + (int(np.abs(seg).argmax()) / SR if len(seg) else 0)
        out.append([round(float(a), 3), round(float(b), 3), round(pk, 1), round(float(hit), 3)])
        i = j
    return out


def scan(path, floor_db, gap):
    x = decode(path)
    return {"file": os.path.basename(path), "seconds": round(len(x) / SR, 3), "peak": round(db(np.abs(x).max()) if len(x) else -99, 1), "events": events(x, floor_db, gap)}


def main():
    args = sys.argv[1:]
    folder = args[0]
    gap = float(args[args.index("--gap") + 1]) if "--gap" in args else 0.12
    floor = float(args[args.index("--floor") + 1]) if "--floor" in args else -42.0
    out = []
    files = [folder] if os.path.isfile(folder) else [os.path.join(folder, n) for n in sorted(os.listdir(folder))]
    show = 10**6 if "--all" in args else 14
    for path in files:
        if not path.lower().endswith((".wav", ".mp3")):
            continue
        r = scan(path, floor, gap)
        out.append(r)
        ev = r["events"]
        shown = "  ".join(f"{a:.2f}-{b:.2f}({pk:.0f})" for a, b, pk, _ in ev[:show])
        print(f"{r['file']:36s} {r['seconds']:7.2f} s  peak {r['peak']:6.1f} dB  {len(ev):3d} events: {shown}{' ...' if len(ev) > show else ''}")
    if "--json" in args:
        dst = args[args.index("--json") + 1]
        if os.path.dirname(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(unlocked(dst), "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1)
        print("wrote", dst)


if __name__ == "__main__":
    main()
