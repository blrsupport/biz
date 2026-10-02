"""Words and tighten: turns a voice file plus word timings into the word table every beat is anchored to.

  python tools/words.py md        (reads src/films/md/film.json)

Steps
  1. decode the voice, find where it is actually voiced (10 ms loudness envelope)
  2. read word timings (whisper full JSON with DTW times, or a word-level .srt)
  3. snap every word edge onto voiced audio (timings drift late into pauses)
  4. cut the stretch the film uses and tighten its pauses; never cut or speed a word
  5. write public/audio/<film>/vo-tight.wav, src/films/<film>/words.ts, out/<film>/words.png (to check by eye)

film.json keys
  vo            path to the voice file, relative to the studio folder
  timings       path to words.srt (one word per cue is best; phrases are split) or a whisper dtw.json, relative to the film folder
  script        the narration as written, when the user has it: the authority on spelling and punctuation
  from, to      stretch of the source voice to use, in seconds (omit for the whole file)
  lead, tail    seconds of voice kept before the first word and after the last (0.10, 0.45)
  fixes         {"heard": "correct"} spelling corrections for names the transcriber garbles
  fixAt         [[seconds, "correct"]] replaces the one word spoken at that time of the source
  starts        [["2017,", 1, 6.35]] where a word really starts: the nth time it is said, seconds of the source.
                For a word inside a phrase whose fitted start is off (find the true start with --look).
  keepAfter     [["1976", 1]] pauses to leave alone: after the nth occurrence of that word
  pause         {"comma": 0.28, "stop": 0.42, "inner": 0.20} target pause lengths in seconds

  python tools/words.py <film> -v                 also prints the silences and the words whose end moved most
  python tools/words.py <film> --look "2017"      the fine loudness of the voice around that word, to see where it starts
  python tools/words.py <film> --look 12.5-15.6   the same over a range of source seconds (a whole sentence at once)
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from ffpath import FFMPEG, unlocked  # noqa: E402

SR = 48000
HOP = 0.01
MIN_SIL = 0.12


def decode(path):
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def envelope(x):
    hop = int(SR * HOP)
    n = len(x) // hop
    fr = x[: n * hop].reshape(n, hop)
    db = 20 * np.log10(np.sqrt((fr**2).mean(axis=1)) + 1e-9)
    return np.convolve(db, np.ones(3) / 3, mode="same")


def islands(db):
    """Voiced stretches [a, b) in seconds, and the silences between them."""
    loud = np.percentile(db, 95)
    floor = np.percentile(db, 5)
    thr = max(floor + 10, loud - 24)
    v = db > thr
    # protect weak onsets and tails: widen every voiced run by 30 ms on both sides
    pad = 3
    idx = np.nonzero(v)[0]
    for k in range(1, pad + 1):
        v[np.clip(idx - k, 0, len(v) - 1)] = True
        v[np.clip(idx + k, 0, len(v) - 1)] = True
    # close gaps shorter than MIN_SIL (stop consonants), drop blips shorter than 30 ms
    n = len(v)
    k = 0
    runs = []
    while k < n:
        j = k
        while j < n and v[j] == v[k]:
            j += 1
        runs.append([bool(v[k]), k, j])
        k = j
    for r in runs:
        if not r[0] and (r[2] - r[1]) * HOP < MIN_SIL and r[1] > 0 and r[2] < n:
            r[0] = True
    merged = []
    for r in runs:
        if merged and merged[-1][0] == r[0]:
            merged[-1][2] = r[2]
        else:
            merged.append(r)
    for r in merged:
        if r[0] and (r[2] - r[1]) * HOP < 0.03:
            r[0] = False
    out = []
    for r in merged:
        if out and out[-1][0] == r[0]:
            out[-1][2] = r[2]
        else:
            out.append(r)
    voiced = [(a * HOP, b * HOP) for f, a, b in out if f]
    return voiced, thr


def read_dtw(path):
    data = json.load(open(path, encoding="utf8"))
    words = []
    prev_end = 0.0
    for seg in data["transcription"]:
        text = seg["text"].strip()
        toks = [t for t in seg.get("tokens", []) if not t["text"].startswith("[_")]
        if not text or not toks:
            continue
        spoken = [t for t in toks if re.search(r"[A-Za-z0-9]", t["text"])]
        if not spoken:
            # a stray punctuation segment belongs to the word before it
            if words:
                words[-1]["w"] += text
            continue
        dtw = spoken[-1].get("t_dtw", -1)
        end = dtw / 100 if dtw >= 0 else seg["offsets"]["to"] / 1000
        start = max(prev_end, min(seg["offsets"]["from"] / 1000, end - 0.04))
        if not seg["text"].startswith(" ") and words:
            # continuation of the previous word (for example "'s")
            words[-1]["w"] += text
            words[-1]["t1"] = end
        else:
            words.append({"w": text, "t0": start, "t1": end})
        prev_end = end
    # DTW gives token ends; a word starts where the one before it ended
    for k in range(1, len(words)):
        words[k]["t0"] = words[k - 1]["t1"]
    return words


def read_srt(path):
    words = []
    blocks = re.split(r"\r?\n\r?\n", open(path, encoding="utf8").read())
    ts = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")
    for b in blocks:
        m = ts.search(b)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        t0 = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        t1 = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        raw = b[m.end():]
        text = raw.strip()
        if not text:
            continue
        if not re.search(r"[A-Za-z0-9]", text) and words:
            words[-1]["w"] += text
            continue
        if not raw.lstrip("\r\n").startswith(" ") and words and not re.match(r"^\s", raw.lstrip("\r\n")) and text[0] in "'’-":
            words[-1]["w"] += text
            words[-1]["t1"] = t1
            continue
        toks = text.split()
        if len(toks) == 1:
            words.append({"w": text, "t0": t0, "t1": t1})
            continue
        # several words in one cue: share its time out by syllables (the fit onto the audio corrects the rest)
        wts = [syllables(x) + 0.35 for x in toks]
        acc = t0
        for x, wt in zip(toks, wts):
            d = (t1 - t0) * wt / sum(wts)
            words.append({"w": x, "t0": acc, "t1": acc + d})
            acc += d
    return words


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "x x twenty thirty forty fifty sixty seventy eighty ninety".split()


def say_number(n):
    """English words for an integer, the way a narrator reads it (years as pairs)."""
    if 1100 <= n <= 2099 and n % 100 != 0 and not (2000 <= n <= 2009):
        return say_number(n // 100) + " " + (say_number(n % 100) if n % 100 >= 10 else "oh " + say_number(n % 100))
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + say_number(n % 100))
    for size, name in ((10**7, "crore"), (10**5, "lakh"), (1000, "thousand")):
        if n >= size:
            return say_number(n // size) + " " + name + ("" if n % size == 0 else " " + say_number(n % size))
    return str(n)


def syllables(word):
    w = re.sub(r"[^A-Za-z0-9.]", "", word).strip(".")
    if re.fullmatch(r"\d+", w or "x"):
        w = say_number(int(w))
    groups = re.findall(r"[aeiouy]+", w.lower())
    n = len(groups)
    if w.lower().endswith("e") and not w.lower().endswith(("le", "ee")) and n > 1:
        n -= 1
    return max(1, n)


FUNC = set("a an the of to in on at for and but or is it its his her he she they that this was were be by with from as you are will up so".split())
# How a subtitle file's cue times are used inside one stretch of sound (measured on the two demo films against
# their DTW tables): `blend` is the share given to the cue times, the rest goes to the pace model below;
# a cue whose length is under `lo` or over `hi` times what the model expects is not believed at all.
LOOSE = {"blend": 0.5, "lo": 0.45, "hi": 2.2, "a": 0.6, "c": 0.15, "func": 0.5, "final": 1.3}


def say_weight(word, last):
    """How long a word takes to say, in relative units: by its letters as spoken, short for the small
    words of grammar, drawn out when it is the last before a pause."""
    w = re.sub(r"[^A-Za-z0-9.]", "", word).strip(".")
    if re.fullmatch(r"\d+", w or "x"):
        w = say_number(int(w))
    w = w.lower()
    x = LOOSE["a"] + LOOSE["c"] * len(re.sub(r"[^a-z]", "", w))
    if w in FUNC:
        x *= LOOSE["func"]
    if last:
        x *= LOOSE["final"]
    return max(0.05, x)


def align(words, voiced, db, loose=False, pins=None):
    """Fits the words, in order, onto the voiced stretches of the audio.

    `loose`: the timings are cue times from a subtitle file, not token ends from the transcriber's own alignment.
    Such cues are contiguous (each ends where the next begins), so a pause is hidden inside the cue before it, and
    the words before a pause are timed late. The fit then trusts the audio and the text more than the cue times.

    Pauses are known exactly from the loudness envelope; which words sit between which pauses is decided by a small
    dynamic programme that prefers an even speaking rate, pauses after punctuation, and the timings we were given.
    Returns (words moved by more than 20 ms, largest move in seconds).
    """
    pins = pins or {}
    raw_end = [w["t1"] for w in words]
    lo, hi = words[0]["t0"] - 0.5, words[-1]["t1"] + 0.6
    isl = [(a, b) for a, b in voiced if b > lo and a < hi]
    M, N = len(isl), len(words)
    syl = [syllables(w["w"]) for w in words]
    S = np.concatenate([[0], np.cumsum(syl)])
    r0 = sum(b - a for a, b in isl) / max(1, S[-1])
    punct = [w["w"][-1] in ",.;:?!" for w in words]
    # sentence ends, counted up to each word: a sentence rarely ends in the middle of a breath
    stop = [w["w"].rstrip("\"')]”’")[-1:] in ".?!" for w in words]
    ST = np.concatenate([[0], np.cumsum(stop)])
    INF = 1e18
    KMAX = 45
    f = np.full((M + 1, N + 1), INF)
    back = np.zeros((M + 1, N + 1), dtype=np.int32)
    f[0][0] = 0.0
    for j in range(1, M + 1):
        a, b = isl[j - 1]
        dur = b - a
        gap_after = (isl[j][0] - b) if j < M else 0.5
        gap_before = (a - isl[j - 2][1]) if j >= 2 else 0.0
        for i in range(0, N + 1):
            best, arg = INF, i
            # an island that holds no word (a breath or a click): cheap only when it is short
            if f[j - 1][i] < INF:
                best, arg = f[j - 1][i] + 6.0 * dur, i
            if i > 0:
                d = raw_end[i - 1] - b
                c_end = (min(abs(d), 1.2) ** 2) * (1.0 if d > 0 else 2.5)
                if loose and j < M:
                    # a cue that runs on through the pause ends where the next word begins
                    d2 = raw_end[i - 1] - isl[j][0]
                    c_end = min(c_end, (min(abs(d2), 1.2) ** 2) * 1.5)
                c_p = -0.15 * min(1.0, gap_after / 0.4) if punct[i - 1] else 0.10 * min(1.0, gap_after / 0.4)
                for p in range(max(0, i - KMAX), i):
                    if f[j - 1][p] >= INF:
                        continue
                    # a word whose start has been pinned belongs to the stretch of sound that holds that moment
                    if pins and any(p <= k < i and not (a - 0.05 <= pins[k] <= b + 0.05) for k in pins):
                        continue
                    # the last word before a pause is drawn out, so count it as a little more than its syllables;
                    # speech cannot be squeezed much (fast is expensive) but is often stretched (slow is cheap)
                    rate = dur / (S[i] - S[p] + 0.7)
                    lr = np.log(rate / r0)
                    c = f[j - 1][p] + (6.0 if lr < 0 else 1.0) * lr * lr + c_end + c_p
                    # Word times from a transcriber drift late into pauses, so the word before a pause is often
                    # timed as if it came after it. The text knows better: a full stop inside a breath is unlikely,
                    # and a sentence's last word standing first after a real pause is very unlikely.
                    c += 0.6 * (ST[i - 1] - ST[p])
                    if stop[p] and i - p > 1 and gap_before >= 0.25:
                        c += 2.5
                    if c < best:
                        best, arg = c, p
            f[j][i] = best
            back[j][i] = arg
    if f[M][N] >= INF:
        raise SystemExit("could not fit the words onto the voiced audio")
    # walk back: which words each island holds
    i = N
    spans = [None] * M
    for j in range(M, 0, -1):
        p = int(back[j][i])
        spans[j - 1] = (p, i)
        i = p
    def inner(p, i, a, b, final):
        """Ends of the words p..i-1, which fill the stretch of sound a..b. `final`: the last of them stands before a pause."""
        n = i - p
        ends = []
        if loose and n > 1:
            # Cue times drift late and crush the last words against the pause. Keep only their proportions
            # (squeezed into this stretch of sound), believe a cue only when its length is plausible for the
            # word, and lean the rest of the way toward a pace model.
            wt = np.array([say_weight(words[k]["w"], final and k == i - 1) for k in range(p, i)], dtype=float)
            share = (b - a) * wt / wt.sum()
            prop = a + np.cumsum(share)
            g0 = raw_end[p - 1] if p > 0 else words[p]["t0"]
            g1 = raw_end[i - 1]
            sc = (b - a) / max(1e-6, g1 - g0)
            given = [a + (raw_end[k] - g0) * sc for k in range(p, i)]
            glen = [(given[q] - (given[q - 1] if q else a)) for q in range(n)]
            ok = [LOOSE["lo"] * share[q] <= glen[q] <= LOOSE["hi"] * share[q] for q in range(n)]
            for q in range(n):
                if q == n - 1:
                    ends.append(b)
                    continue
                beta = LOOSE["blend"] if (ok[q] and ok[q + 1]) else 0.0
                ends.append(beta * given[q] + (1 - beta) * prop[q])
            # no word shorter than half its share of the stretch
            prev_e = a
            for q in range(n - 1):
                ends[q] = max(ends[q], prev_e + 0.5 * share[q])
                prev_e = ends[q]
            nxt = b
            for q in range(n - 2, -1, -1):
                ends[q] = min(ends[q], nxt - 0.5 * share[q + 1])
                nxt = ends[q]
        else:
            # inner edges: the given times when they sit inside the stretch, otherwise spread by syllable weight
            wt = np.array([syl[k] + 0.35 for k in range(p, i)], dtype=float)
            prop = a + (b - a) * np.cumsum(wt) / wt.sum()
            for q, k in enumerate(range(p, i)):
                e = raw_end[k]
                if q == n - 1:
                    e = b
                elif not (a + 0.05 < e < b - 0.05):
                    e = prop[q]
                ends.append(e)
        # (Snapping inner edges to loudness dips was tried and dropped: soft consonants inside a word look like dips.)
        for q in range(n - 2, -1, -1):  # keep order, at least 60 ms a word
            ends[q] = min(ends[q], ends[q + 1] - 0.06)
        prev = a
        for q in range(n):
            ends[q] = max(ends[q], prev + 0.06) if q < n - 1 else ends[q]
            words[p + q]["t0"] = prev
            words[p + q]["t1"] = ends[q]
            prev = ends[q]

    for j, (p, i) in enumerate(spans):
        if i == p:
            continue
        a, b = isl[j]
        # a pinned start cuts the stretch in two: the words before it end there, and it begins there
        cuts = [k for k in range(p + 1, i) if k in pins]
        if p in pins and abs(pins[p] - a) > 0.08:
            raise SystemExit(f'"{words[p]["w"]}" is the first word after a pause, so it starts where the sound starts ({a:.2f} s); the start given for it ({pins[p]:.2f} s) cannot hold. Pin the word that the pause really follows instead.')
        ks = [p] + cuts + [i]
        ts = [a] + [pins[k] for k in cuts] + [b]
        for q in range(1, len(ts)):
            if ts[q] - ts[q - 1] < 0.06 * (ks[q] - ks[q - 1]):
                raise SystemExit(f'the starts given in film.json leave no room for the words around "{words[ks[q - 1]]["w"]}" (between {ts[q - 1]:.2f} and {ts[q]:.2f} s)')
        for q in range(len(ks) - 1):
            inner(ks[q], ks[q + 1], ts[q], ts[q + 1], q == len(ks) - 2)
    moved = sum(1 for k in range(N) if abs(words[k]["t1"] - raw_end[k]) > 0.02)
    worst = max(abs(words[k]["t1"] - raw_end[k]) for k in range(N))
    for k in range(N):
        words[k]["raw1"] = raw_end[k]
    return moved, worst


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def look(x, words, what, tmap=None):
    """Prints the fine loudness of the voice around a word, or over a range of seconds, so that true starts can be read off.

    Nobody here can hear, but the numbers show a good deal. A closure (the short silence before p, t, k, b, d, g, and
    every pause) is a dip in everything. Voice (a vowel, and m, n, l, r, w) is strong in the low band. A hiss (s, sh,
    ch, f, and the burst of t and k) is strong in the high band and weak in the low one.
    """
    m = re.fullmatch(r"\s*([0-9.]+)\s*-\s*([0-9.]+)\s*", what)
    if m:
        t0, t1 = float(m.group(1)), float(m.group(2))
        head = f"{t0:.2f}-{t1:.2f} s of the source"
        pin = None
    else:
        word, _, nth = what.partition(":")
        hits = [k for k, w in enumerate(words) if norm(w["w"]) == norm(word)]
        if not hits:
            raise SystemExit(f'"{word}" is not in the narration (or lies outside "from".."to")')
        k = hits[min(len(hits), int(nth or 1)) - 1]
        t0 = max(0.0, words[k]["t0"] - 0.6)
        t1 = min(len(x) / SR, words[k]["t1"] + 0.45)
        head = f'around "{words[k]["w"]}" (fitted {words[k]["t0"]:.2f}-{words[k]["t1"]:.2f} s of the source)'
        pin = words[k]["w"]
    hop, win = int(SR * 0.005), int(SR * 0.02)
    lo_i = max(0, int((t0 - 0.1) * SR))
    seg = x[lo_i : int((t1 + 0.1) * SR) + win]
    n = max(0, (len(seg) - win) // hop)
    if n < 4:
        raise SystemExit("nothing to look at there")
    frames = np.stack([seg[i * hop : i * hop + win] for i in range(n)]) * np.hanning(win)
    mag = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    freq = np.fft.rfftfreq(win, 1 / SR)

    def band(f0, f1):
        return 10 * np.log10(mag[:, (freq >= f0) & (freq < f1)].sum(axis=1) + 1e-12)

    low, mid, high, total = band(80, 500), band(500, 3000), band(3500, 11000), band(80, 11000)
    whole = envelope(x)
    loud = np.percentile(total, 95)
    quiet = loud - (np.percentile(whole, 95) - max(np.percentile(whole, 5) + 10, np.percentile(whole, 95) - 24)) + 4
    starts = {round(w["t0"] / 0.02): w["w"] for w in words}
    print(f"{head}. Rows are 20 ms; 'film' is the time in the tightened voice.")
    print(" source   film   all dB                                       low   mid  high")
    prev = None
    t = round(t0 / 0.02) * 0.02
    while t <= t1:
        i = int(round((t * SR - lo_i) / hop))
        if 0 <= i < n - 3:
            lv, lw, md, hg = total[i : i + 4].mean(), low[i : i + 4].mean(), mid[i : i + 4].mean(), high[i : i + 4].max()
            kind = "hiss" if hg > lw + 3 and hg > np.percentile(high, 95) - 14 else "closure" if lv < quiet else "voice" if lw > np.percentile(low, 90) - 16 else ""
            rise = "  << rises" if prev is not None and lv - prev > 9 else ""
            w = starts.get(round(t / 0.02))
            film = f"{tmap(t):6.2f}" if tmap else "      "
            print(f"{t:7.2f} {film} {lv:7.1f} {'#' * int(max(0, (lv - loud + 44) / 1.1)):40s} {lw:5.0f} {md:5.0f} {hg:5.0f}  {kind:8s}{rise}{('  <- ' + w) if w else ''}")
            prev = lv
        t += 0.02
    print("closure: a short dip (the silence before p, t, k, b, d, g) or a pause. hiss: s, sh, ch, f, or the burst of t and k.")
    print("voice: a vowel, or m, n, l, r, w. A word that begins with a stop begins as its closure ends (at '<< rises'); one that")
    print("begins with s or f begins where the hiss begins. A word that begins with a vowel or with w, l, m, n, r has no closure:")
    print("look for the small dip, or the change in the mid band, between two stretches of voice, and trust it less.")
    print("If the arrow for a word is more than about 0.1 s from where its sound begins, give its true start (source seconds)")
    print('in film.json and run again:   "starts": [["' + (pin or "<word>") + '", 1, <seconds>]]')


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
        print(__doc__)
        raise SystemExit(0 if "--help" in sys.argv or "-h" in sys.argv else 2)
    film = sys.argv[1]
    fdir = os.path.join(ROOT, "src", "films", film)
    cfg = json.load(open(os.path.join(fdir, "film.json"), encoding="utf8"))
    x = decode(os.path.join(ROOT, cfg["vo"]))
    db = envelope(x)
    voiced, thr = islands(db)
    # a recording that begins or ends in the middle of a sound was cut by hand, and what is cut off is not a word of ours
    if voiced and "to" not in cfg and voiced[-1][1] > len(x) / SR - 0.03:
        gap = f"{voiced[-2][1]:.2f}-{voiced[-1][0]:.2f} s" if len(voiced) > 1 else "none"
        print(f'NOTE: the recording ends in the middle of a sound (voiced to its last sample; the last burst is {voiced[-1][0]:.2f}-{voiced[-1][1]:.2f} s, the silence before it {gap}).')
        print('      If that burst is the start of a next sentence, set "to" in film.json to a moment inside that silence and run again.')
        print("      If it is the last word, the recording was cut too early: ask for one with its ending. Check with --look " + f"{max(0.0, voiced[-1][0] - 0.8):.1f}-{len(x) / SR:.1f}")
    if voiced and "from" not in cfg and voiced[0][0] < 0.03:
        print(f'NOTE: the recording is voiced from its very first sample (the first burst is {voiced[0][0]:.2f}-{voiced[0][1]:.2f} s).')
        print('      If it opens with the tail of an earlier sentence, set "from" in film.json to the silence after that and run again; if the first word starts right there, its onset may be clipped: a recording with a little silence before it is safer.')
    tpath = os.path.join(fdir, cfg["timings"])
    loose = not tpath.endswith(".json")
    words = read_srt(tpath) if loose else read_dtw(tpath)
    for w in words:
        for bad, good in cfg.get("fixes", {}).items():
            if norm(w["w"]) == norm(bad):
                w["w"] = re.sub(re.escape(re.sub(r"[^A-Za-z0-9]+$", "", w["w"])), lambda _m: good, w["w"])
    for at, good in cfg.get("fixAt", []):
        for w in words:
            if w["t0"] - 0.05 <= at <= w["t1"] + 0.05:
                w["w"] = good
                break
    # the script, when given, is the authority on spelling and punctuation: match it to the timed words in order
    if cfg.get("script"):
        import difflib
        stoks = cfg["script"].split()
        a_n = [norm(w["w"]) for w in words]
        b_n = [norm(s) for s in stoks]
        sm = difflib.SequenceMatcher(None, a_n, b_n, autojunk=False)
        blocks = [m for m in sm.get_matching_blocks() if m.size]
        if not blocks:
            raise SystemExit("the script does not match the timed words")
        votes = {}
        for m in blocks:
            votes[m.a - m.b] = votes.get(m.a - m.b, 0) + m.size
        shift = max(votes, key=votes.get)
        if votes[shift] < 0.8 * len(stoks) or shift < 0 or shift + len(stoks) > len(words):
            raise SystemExit(f"the script and the timed words do not line up word for word ({votes[shift]} of {len(stoks)} match); fix the script or the timings")
        respelt = []
        for bi, s in enumerate(stoks):
            if norm(words[bi + shift]["w"]) != norm(s):
                respelt.append(f'{words[bi + shift]["w"].strip()} -> {s}')
            words[bi + shift]["w"] = s
        if respelt:
            # (read these: a script that is one word out of step shows up here as a run of unrelated pairs)
            print("spelling taken from the script where the timings heard something else: " + "; ".join(respelt))
    src_from = cfg.get("from", 0.0)
    src_to = cfg.get("to", len(x) / SR)
    for w in words:
        w["raw0"] = w["t0"]
    if loose and ("from" in cfg or "to" in cfg):
        # A plain .srt gives no better times than its cues, so the stretch is taken first and fitted on its own
        # sound: words whose cue starts inside it, onto the voiced audio inside it. (Otherwise a stray sound past
        # "to" can draw the last word out of the stretch.)
        words = [w for w in words if src_from - 0.3 <= w["t0"] <= src_to + 0.05]
        voiced = [(max(a, src_from), min(b, src_to)) for a, b in voiced if min(b, src_to) - max(a, src_from) > 0.03]
        if not words or not voiced:
            raise SystemExit('no words or no sound between "from" and "to"')
    pins = {}
    for word, nth, at in cfg.get("starts", []):
        seen = 0
        for k, w in enumerate(words):
            if norm(w["w"]) == norm(word):
                seen += 1
                if seen == nth:
                    pins[k] = float(at)
        if seen < nth:
            raise SystemExit(f'starts: "{word}" is not said {nth} time(s)')
    moved, worst = align(words, voiced, db, loose, pins)

    if "-v" in sys.argv:
        print("silences:", " ".join(f"{voiced[k][1]:.2f}-{voiced[k + 1][0]:.2f}" for k in range(len(voiced) - 1) if src_from - 2 <= voiced[k][1] <= src_to + 2))
        for w in words:
            if src_from - 3 <= w["t0"] <= src_from + 3:
                print(f"  near start: {w['t0']:.2f}-{w['t1']:.2f} {w['w']}")
    for w in words:
        if (w["t0"] < src_from - 0.02 < w["t1"]) or (w["t0"] < src_to + 0.02 < w["t1"]):
            print(f'note: "{w["w"]}" ({w["t0"]:.2f}-{w["t1"]:.2f} s) straddles the edge of the stretch and is left out: move "from" or "to" into a silence')
    for w in words:
        if not (w["t0"] >= src_from - 0.02 and w["t1"] <= src_to + 0.02) and src_from <= w["raw0"] and w.get("raw1", w["t1"]) <= src_to and not (w["t0"] < src_from - 0.02 < w["t1"]) and not (w["t0"] < src_to + 0.02 < w["t1"]):
            print(f'NOTE: "{w["w"]}" is timed at {w["raw0"]:.2f} s in the timings, inside the stretch, but was fitted at {w["t0"]:.2f}-{w["t1"]:.2f} s, outside it, and is LEFT OUT.')
            print(f'      If it belongs to the film, pin it: "starts": [["{w["w"]}", 1, <seconds>]] (find the moment with --look {max(0.0, w["raw0"] - 1):.1f}-{w["raw0"] + 1:.1f})')
    words = [w for w in words if w["t0"] >= src_from - 0.02 and w["t1"] <= src_to + 0.02]
    if not words:
        raise SystemExit("no words in the stretch")
    moved = sum(1 for w in words if abs(w["t1"] - w.get("raw1", w["t1"])) > 0.02)
    worst = max(abs(w["t1"] - w.get("raw1", w["t1"])) for w in words)
    lead, tail = cfg.get("lead", 0.10), cfg.get("tail", 0.45)
    a0 = max(src_from, words[0]["t0"] - lead)
    b0 = min(src_to, words[-1]["t1"] + tail, len(x) / SR)

    targets = {"comma": 0.28, "stop": 0.42, "inner": 0.20, **cfg.get("pause", {})}
    keep = set()
    for word, nth in cfg.get("keepAfter", []):
        seen = 0
        for k, w in enumerate(words):
            if norm(w["w"]) == norm(word):
                seen += 1
                if seen == nth:
                    keep.add(k)
    cuts = []  # (src_a, src_b) removed
    trims = []
    for k in range(len(words) - 1):
        a, b = words[k]["t1"], words[k + 1]["t0"]
        gap = b - a
        if gap < MIN_SIL:
            continue
        last = words[k]["w"].rstrip("\"')]”’")[-1:]
        kind = "stop" if last in ".?!" else "comma" if last in ",;:" else "inner"
        tgt = targets[kind]
        if k in keep or gap <= tgt + 0.02:
            trims.append({"after": words[k]["w"], "kind": kind, "was": round(gap, 3), "now": round(gap, 3), "kept": k in keep})
            continue
        ca, cb = a + tgt / 2, b - tgt / 2
        cuts.append((ca, cb))
        trims.append({"after": words[k]["w"], "kind": kind, "was": round(gap, 3), "now": round(tgt, 3), "kept": False, "srcFrom": round(ca, 3), "srcTo": round(cb, 3)})

    def tmap(t):
        t = min(max(t, a0), b0)
        off = 0.0
        for ca, cb in cuts:
            if t >= cb:
                off += cb - ca
            elif t > ca:
                off += t - ca
        return t - a0 - off

    if "--look" in sys.argv:
        look(x, words, sys.argv[sys.argv.index("--look") + 1], tmap)
        return

    # build the tightened audio: every splice sits in the middle of a pause, so a short fade out and a short
    # fade in on either side is enough, and the pieces keep their exact length (the time map stays exact)
    fade = int(0.006 * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    pieces = []
    pos = a0
    bounds = cuts + [(b0, b0)]
    for k, (ca, cb) in enumerate(bounds):
        p = x[int(round(pos * SR)): int(round(ca * SR))].copy()
        if len(p) > 2 * fade:
            if k > 0:
                p[:fade] *= ramp
            if k < len(bounds) - 1:
                p[-fade:] *= ramp[::-1]
        pieces.append(p)
        pos = cb
    out = np.concatenate(pieces)
    adir = os.path.join(ROOT, "public", "audio", film)
    os.makedirs(adir, exist_ok=True)
    wav = os.path.join(adir, "vo-tight.wav")
    import time
    for attempt in range(8):  # a virus scanner briefly locks freshly written files on this PC
        try:
            with wave.open(unlocked(wav), "wb") as f:
                f.setnchannels(1)
                f.setsampwidth(2)
                f.setframerate(SR)
                f.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
            break
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(0.6 * (attempt + 1))
    dur = len(out) / SR
    if "-v" in sys.argv:
        for w in words:
            if abs(w["t1"] - w.get("raw1", w["t1"])) > 0.2:
                print(f"  moved {w['w']!r}: given end {w['raw1']:.2f} -> {w['t1']:.2f} (source time)")

    table = []
    for w in words:
        table.append({"w": w["w"], "n": norm(w["w"]), "t0": round(tmap(w["t0"]), 3), "t1": round(tmap(w["t1"]), 3), "src": round(w["t0"], 3)})
    with open(unlocked(os.path.join(fdir, "words.ts")), "w", encoding="utf8") as f:
        f.write("// Written by tools/words.py from film.json. Times are seconds in the tightened voice. Do not edit by hand.\n")
        f.write("export const VO = " + json.dumps({"file": f"audio/{film}/vo-tight.wav", "duration": round(dur, 3), "srcFrom": round(a0, 3), "srcTo": round(b0, 3)}) + " as const;\n")
        f.write("export const WORDS = [\n" + "".join(" " + json.dumps(r, ensure_ascii=False) + ",\n" for r in table) + "] as const;\n")
        f.write("export const TRIMS = " + json.dumps(trims, ensure_ascii=False, indent=1) + " as const;\n")

    removed = sum(cb - ca for ca, cb in cuts)
    print(f"{film}: {len(words)} words, source {a0:.2f}-{b0:.2f} s ({b0 - a0:.2f} s) -> {dur:.2f} s; removed {removed:.2f} s in {len(cuts)} pauses")
    print(f"snap: {moved} word ends moved, largest {worst * 1000:.0f} ms; voiced threshold {thr:.1f} dB")
    for t in trims:
        print(f"  pause after {t['after']!r:16s} {t['kind']:6s} {t['was']:.2f} -> {t['now']:.2f}{'  (kept)' if t['kept'] else ''}")
    for r in table:
        print(f"  {r['t0']:6.2f}-{r['t1']:6.2f}  {r['w']}")

    # picture to check by eye: envelope with word edges, source above, tightened below
    try:
        from PIL import Image, ImageDraw
        Wd, Hh = 2400, 520
        img = Image.new("RGB", (Wd, Hh), (250, 248, 244))
        d = ImageDraw.Draw(img)

        def lane(y0, sig, t_a, t_b, marks, label):
            e = envelope(sig)
            n0, n1 = int(t_a / HOP), int(t_b / HOP)
            seg = e[n0:n1]
            for i, v in enumerate(seg):
                px = int(i / max(1, len(seg)) * Wd)
                h = int(np.clip((v + 70) / 60, 0, 1) * 180)
                d.line([px, y0 + 200, px, y0 + 200 - h], fill=(90, 110, 140))
            for (t, txt) in marks:
                px = int((t - t_a) / (t_b - t_a) * Wd)
                d.line([px, y0 + 10, px, y0 + 200], fill=(200, 60, 40))
                d.text((px + 3, y0 + 205 + (hash(txt) % 2) * 14), txt, fill=(30, 30, 30))
            d.text((6, y0 + 2), label, fill=(0, 0, 0))

        lane(0, x, a0, b0, [(w["t0"], w["w"]) for w in words], f"source {a0:.2f}-{b0:.2f} s (red = word start)")
        lane(260, out, 0, dur, [(r["t0"], r["w"]) for r in table], f"tightened 0-{dur:.2f} s")
        odir = os.path.join(ROOT, "out", film)
        os.makedirs(odir, exist_ok=True)
        img.save(unlocked(os.path.join(odir, "words.png")))
        print("wrote", os.path.join(odir, "words.png"))
    except Exception as ex:  # the picture is a convenience, never a blocker
        print("no picture:", ex)


if __name__ == "__main__":
    main()
