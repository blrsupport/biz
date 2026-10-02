# Builds the soundtrack from the cue list the take exports and the film's sound sheet.
#   voice (compressed so it can be loud without clipping) + music (ducked under speech) + effects on their cues + room air
# and writes the full mix, the effects-only stem, the music stem, and a report with the numbers that were measured.
# Nothing here is judged by ear: every level is a measured target, and the report says what was reached.
#
# Run: python tools/audio_mix.py src/films/md/sound.json out/md/cues.json --out out/md
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
from ffpath import FFMPEG, unlocked  # noqa: E402
SR = 48000


def run(args, check=False, **kw):
    """ffmpeg, tried again when it fails: on Windows a file written a moment ago can still be locked."""
    for k in range(5):
        r = subprocess.run(args, capture_output=True, **kw)
        if r.returncode == 0 or not check:
            return r
        time.sleep(0.6 * (k + 1))
    sys.stderr.write(r.stderr.decode("utf-8", "replace")[-1500:] + "\n")
    r.check_returncode()
    return r


def made_from(path):
    """A file the mix was built from, with a mark of its contents: deliver.mjs refuses a mix whose inputs have changed."""
    with open(os.path.join(ROOT, path), "rb") as f:
        return {"file": path.replace("\\", "/"), "sha1": hashlib.sha1(f.read()).hexdigest()}


def decode(path, filters=None):
    """A file as float32 stereo at 48 kHz, through an optional ffmpeg filter chain."""
    cmd = [FFMPEG, "-v", "error", "-i", os.path.join(ROOT, path) if not os.path.isabs(path) else path]
    if filters:
        cmd += ["-af", filters]
    cmd += ["-f", "f32le", "-ac", "2", "-ar", str(SR), "-"]
    raw = run(cmd, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def write_wav(path, x):
    y = np.clip(x, -1.0, 1.0)
    pcm = (y * 32767.0).round().astype("<i2")
    with wave.open(unlocked(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def db(x):
    return 20 * np.log10(max(float(x), 1e-9))


def lin(d):
    return 10 ** (d / 20)


def pk_of(x):
    """Loudest 1/24 s RMS, dBFS (the same measure the effects library was levelled with)."""
    m = x.mean(axis=1) if x.ndim == 2 else x
    k = max(1, SR // 24)
    if len(m) < k:
        return db(np.sqrt((m**2).mean())) if len(m) else -99.0
    c = np.cumsum(np.concatenate([[0.0], m**2]))
    return db(np.sqrt(((c[k:] - c[:-k]) / k).max()))


def loudness(x, tmp):
    """Integrated loudness (LUFS), loudness range and true peak (dBTP) of a stereo buffer, measured by ffmpeg's EBU R128 meter."""
    write_wav(tmp, x)
    err = run([FFMPEG, "-hide_banner", "-nostats", "-i", tmp, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr.decode("utf-8", "replace")
    tail = err[err.rfind("Summary:") :]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
    lra = re.search(r"LRA:\s+(-?[\d.]+) LU", tail)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail)
    return float(i.group(1)) if i else -99.0, float(lra.group(1)) if lra else 0.0, float(tp.group(1)) if tp else 0.0


def fade(x, fin, fout):
    n = len(x)
    a = min(n, int(fin * SR))
    b = min(n, int(fout * SR))
    y = x.copy()
    if a > 1:
        y[:a] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a))[:, None]
    if b > 1:
        y[n - b :] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(b) / b))[:, None]
    return y


def pan(x, p):
    """Constant-power pan of a stereo slice treated as one source; p in -1..1."""
    m = x.mean(axis=1)
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([m * np.cos(th) * np.sqrt(2), m * np.sin(th) * np.sqrt(2)], axis=1)


def place(bus, x, t):
    i = int(round(t * SR))
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), len(bus) - i)
    if n > 0:
        bus[i : i + n] += x[:n]


def envelope_db(x, win=0.05):
    m = x.mean(axis=1)
    k = max(1, int(SR * win))
    c = np.cumsum(np.concatenate([[0.0], m**2]))
    r = np.sqrt(np.maximum((c[k:] - c[:-k]) / k, 1e-18))
    r = np.concatenate([np.full(k // 2, r[0]), r, np.full(len(m) - len(r) - k // 2, r[-1])])
    return 20 * np.log10(r)


def smooth(g, attack, release):
    """One-pole follower: quick to fall (attack), slow to recover (release)."""
    out = np.empty_like(g)
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    y = g[0]
    for i in range(len(g)):
        k = a if g[i] < y else r
        y = k * y + (1 - k) * g[i]
        out[i] = y
    return out


def keyed(keys, n):
    """A gain curve in dB through (time, dB) keys, linear between them."""
    t = np.arange(n) / SR
    return np.interp(t, [k[0] for k in keys], [k[1] for k in keys])


def main():
    sheet_path, cues_path = sys.argv[1], sys.argv[2]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "out/mix"
    os.makedirs(os.path.join(ROOT, out), exist_ok=True)
    O = lambda name: os.path.join(ROOT, out, name)  # noqa: E731
    sheet = json.load(open(os.path.join(ROOT, sheet_path), encoding="utf-8"))
    cue_file = json.load(open(os.path.join(ROOT, cues_path), encoding="utf-8"))
    dur = float(cue_file["duration"])
    N = int(round(dur * SR))
    tmp = O("_meter.wav")
    report = {"duration": dur, "cues": [], "notes": []}

    # ---- voice: high-pass, gentle compression, then to its target loudness
    V = sheet["vo"]
    vo = decode(V["file"], "highpass=f=70,acompressor=threshold=-24dB:ratio=3:attack=6:release=140:makeup=2")
    if abs(len(vo) / SR - dur) > 0.05:
        report["notes"].append(f"the cue list is for a film of {dur:.2f} s but the voice is {len(vo) / SR:.2f} s long: export the cues again (node tools/check.ts <film> --cues ...)")
    vo = np.concatenate([vo, np.zeros((max(0, N - len(vo)), 2))])[:N]
    i0, _, _ = loudness(vo, tmp)
    vo *= lin(V.get("lufs", -15.0) - i0)
    report["voice"] = {"before": round(i0, 1), "target": V.get("lufs", -15.0)}

    # ---- music: at its place, at its level, lower while someone is speaking
    music = np.zeros((N, 2))
    if sheet.get("music"):
        M = sheet["music"]
        m = decode(M["file"])
        if M.get("to"):
            m = m[: int(M["to"] * SR)]
        if M.get("from"):
            m = m[int(M["from"] * SR) :]
        room = N - int(round(M.get("at", 0.0) * SR))
        if len(m) > room > 0:
            m = m[:room]
            if M.get("fadeOut", 0.05) < 0.2:
                report["notes"].append("the music runs past the end of the film and is cut there with a short fade: give it a `to` and a `fadeOut`, or an edit of the right length")
        m = fade(m, M.get("fadeIn", 0.02), M.get("fadeOut", 0.05))
        im, _, _ = loudness(m, tmp)
        m *= lin(M.get("lufs", -28.0) - im)
        place(music, m, M.get("at", 0.0))
        speaking = (envelope_db(vo) > -42).astype(np.float64)
        duck = smooth(-float(M.get("duck", 4.0)) * speaking, 0.08, 0.45)
        music *= lin(duck)[:, None]
        if M.get("keys"):
            music *= lin(keyed(M["keys"], N))[:, None]
        report["music"] = {"file": M["file"], "at": M.get("at", 0.0), "before": round(im, 1), "target": M.get("lufs", -28.0), "duck": M.get("duck", 4.0)}

    # ---- room air
    # (one bed, or several laid over each other: each with its own level and its own curve through time)
    amb = np.zeros((N, 2))
    beds = sheet.get("amb") or []
    for A in beds if isinstance(beds, list) else [beds]:
        a = decode(A["file"])
        s = int(A.get("from", 0) * SR)
        a = a[s : s + N]
        a = np.concatenate([a, np.zeros((max(0, N - len(a)), 2))])[:N]
        a *= lin(A.get("pk", -46.0) - pk_of(a))
        if A.get("keys"):
            a *= lin(keyed(A["keys"], N))[:, None]
        amb += fade(a, 0.05, 0.3)

    # ---- effects on their cues
    sfx = np.zeros((N, 2))
    cache = {}
    counters = {}
    missing = set()
    past = set()
    used_names = set()
    for c in cue_file["cues"]:
        layers = sheet["cues"].get(c["what"])
        if layers is None:
            missing.add(c["what"])
            continue
        used_names.add(c["what"])
        for li, L in enumerate(layers):
            f = L["file"]
            if f not in cache:
                cache[f] = decode(f)
            src = cache[f]
            if "variants" in L:
                key = f"{c['what']}/{li}/{f}"
                k = counters.get(key, 0)
                counters[key] = k + 1
                a, b = L["variants"][k % len(L["variants"])]
            else:
                a, b = L.get("from", 0.0), L.get("to", len(src) / SR)
            x = src[int(a * SR) : int(b * SR)].copy()
            if len(x) == 0:
                past.add(f"{c['what']}: {os.path.basename(f)} {a}-{b} s (the file is {len(src) / SR:.2f} s long)")
                continue
            x = fade(x, L.get("fadeIn", 0.004), L.get("fadeOut", 0.06))
            level = L.get("pk", -24.0) + c.get("gain", 0.0)
            x *= lin(level - pk_of(x))
            x = pan(x, c.get("pan", 0.0) * L.get("width", 1.0))
            # `lead` is where in the slice the sound itself begins: that instant goes on the cue
            t = c["t"] + L.get("dt", 0.0) - L.get("lead", 0.0)
            place(sfx, x, t)
            report["cues"].append({"t": round(c["t"], 3), "what": c["what"], "file": os.path.basename(f), "from": a, "to": b, "starts": round(t + L.get("lead", 0.0), 3), "pk": round(level, 1)})
    if missing:
        report["notes"].append("cues with no sound in the sheet: " + ", ".join(sorted(missing)))
    if past:
        report["notes"].append("slices that lie past the end of their file and play nothing: " + "; ".join(sorted(past)))
    unused = sorted(set(sheet["cues"]) - used_names)
    if unused:
        report["notes"].append("sheet entries that no cue uses: " + ", ".join(unused))

    # ---- sum, bring to the target loudness, limit
    target = float(sheet.get("lufs", -14.0))
    ceiling = float(sheet.get("ceiling", -1.7))
    mix = vo + music + sfx + amb
    gain = 0.0
    lag = int(round(0.003 * SR))  # the limiter looks ahead by its attack time and delays the sound by as much
    for k in range(5):
        y = mix * lin(gain)
        write_wav(tmp, y * 0.25)  # 12 dB of headroom: a 16-bit file would clip the peaks the limiter is there to catch
        lim = O("_limited.wav")
        run([FFMPEG, "-v", "error", "-y", "-i", tmp, "-af", f"volume=4.0,alimiter=limit={lin(ceiling):.4f}:attack=3:release=60:level=disabled", "-ar", str(SR), lim], check=True)
        yl = decode(lim)
        yl = np.concatenate([yl[lag:], np.zeros((lag, 2))])
        i, lra, tp = loudness(yl, tmp)
        if abs(i - target) < 0.15 or k == 4:
            break
        gain += target - i
    final = yl[:N]
    report["mix"] = {"lufs": round(i, 2), "target": target, "lra": round(lra, 1), "truePeak": round(tp, 2), "gain": round(gain, 2)}

    # stems carry the same gain, so they sum back to the mix (before limiting)
    g = lin(gain)
    write_wav(O("mix.wav"), final)
    write_wav(O("sfx-only.wav"), (sfx + amb) * g)
    write_wav(O("music-only.wav"), music * g)
    write_wav(O("vo-processed.wav"), vo * g)
    run([FFMPEG, "-v", "error", "-y", "-i", O("sfx-only.wav"), "-c:a", "libmp3lame", "-b:a", "256k", O("sfx-only.mp3")], check=True)
    for name, bus in [("voice", vo), ("music", music), ("effects", sfx), ("air", amb)]:
        if np.abs(bus).max() > 1e-6:
            li, _, _ = loudness(bus * g, tmp)
            report.setdefault("stems", {})[name] = round(li, 1)

    # ---- is the voice in the clear? While someone speaks, effects must sit well under the voice and music further under
    clear = {"effects": {"need": 6.0, "worst": 99.0, "at": 0.0, "under": []}, "music": {"need": 10.0, "worst": 99.0, "at": 0.0, "under": []}}
    win = int(0.4 * SR)
    starts = list(range(0, N - win, win // 2))
    vdb = [db(np.sqrt((vo[s : s + win] ** 2).mean())) for s in starts]
    spoken = [v for v in vdb if v > -40]
    floor = (float(np.median(spoken)) if spoken else -20.0) - 6.0  # only windows that are mostly speech count
    for s, v in zip(starts, vdb):
        if v < floor:
            continue
        for name, bus in (("effects", sfx + amb), ("music", music)):
            margin = v - db(np.sqrt((bus[s : s + win] ** 2).mean()))
            if margin < clear[name]["need"]:
                clear[name]["under"].append([round(s / SR, 2), round(margin, 1)])
            if margin < clear[name]["worst"]:
                clear[name]["worst"] = round(margin, 1)
                clear[name]["at"] = round(s / SR, 2)
    report["voice clear"] = clear

    # ---- checks
    env = envelope_db(final, 0.1)
    quiet = env < -60
    longest = 0
    runlen = 0
    for q in quiet:
        runlen = runlen + 1 if q else 0
        longest = max(longest, runlen)
    report["checks"] = {
        "loudness ok": bool(abs(i - target) <= 0.5),
        "true peak ok": bool(tp <= -1.0),
        "longest silence s": round(longest / SR, 2),
        "no silent window": bool(longest / SR < 0.5),
        "voice over effects ok": bool(clear["effects"]["worst"] >= clear["effects"]["need"]),
        "voice over music ok": bool(clear["music"]["worst"] >= clear["music"]["need"]),
        "cues placed": len(report["cues"]),
    }
    for f in ("_meter.wav", "_limited.wav"):
        try:
            os.remove(O(f))
        except OSError:
            pass
    report["made from"] = [made_from(sheet_path), made_from(cues_path)]
    json.dump(report, open(unlocked(O("mix-report.json")), "w", encoding="utf-8"), indent=1)
    print(json.dumps({k: report[k] for k in ("voice", "music", "mix", "stems", "voice clear", "checks", "notes") if k in report}, indent=1))


if __name__ == "__main__":
    main()
