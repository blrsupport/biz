# Describes a music track without ears: loudness, brightness, bass and beat density through time.
# Usage: python tools/music_scan.py <file> [--step 4] [--to 160]
# Prints one line per step: time, level (dB), low band (dB), brightness (Hz), onsets per second.
# Use it to find where a track is sparse, where it builds and where it arrives, before cutting an edit.
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
from ffpath import FFMPEG  # noqa: E402
SR = 22050


def load(path):
    raw = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, np.float32)


def scan(path, step=4.0, to=None):
    x = load(path)
    n = 2048
    hop = 512
    win = np.hanning(n)
    frames = 1 + (len(x) - n) // hop
    mags = np.empty((frames, n // 2 + 1), np.float32)
    for i in range(frames):
        mags[i] = np.abs(np.fft.rfft(x[i * hop : i * hop + n] * win))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    level = 20 * np.log10(np.sqrt((mags ** 2).sum(1)) / n + 1e-9)
    low = 20 * np.log10(np.sqrt((mags[:, freqs < 160] ** 2).sum(1)) / n + 1e-9)
    cent = (mags * freqs).sum(1) / (mags.sum(1) + 1e-9)
    flux = np.maximum(0, np.diff(np.log1p(mags * 50), axis=0)).sum(1)
    flux = np.concatenate([[0], flux])
    thr = np.convolve(flux, np.ones(43) / 43, mode="same") * 1.5 + 0.1 * flux.max()
    peaks = (flux > thr) & (flux >= np.roll(flux, 1)) & (flux > np.roll(flux, -1))
    fps = SR / hop
    dur = len(x) / SR
    end = min(dur, to or dur)
    print(f"{os.path.basename(path)}: {dur:.1f} s")
    print("   t     level   low    bright  onsets/s")
    t = 0.0
    while t < end:
        a, b = int(t * fps), int(min(end, t + step) * fps)
        if b <= a:
            break
        bar = "#" * int(max(0, (level[a:b].mean() + 70) / 2))
        print(f"{t:6.1f}  {level[a:b].mean():6.1f} {low[a:b].mean():6.1f} {cent[a:b].mean():7.0f}  {peaks[a:b].sum() / (b - a) * fps:5.1f}  {bar}")
        t += step


if __name__ == "__main__":
    args = sys.argv[1:]
    step = float(args[args.index("--step") + 1]) if "--step" in args else 4.0
    to = float(args[args.index("--to") + 1]) if "--to" in args else None
    for p in [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--step", "--to"))]:
        scan(p, step, to)
