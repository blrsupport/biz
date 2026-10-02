"""Grades a film made with the skill against what can be measured. It judges the floor, not the look: a film can
pass every line here and still be dull, which is what the reviewer and the user are for.

  python grade_film.py "<studio>" <film> [--out grading.json]

Run it from anywhere; it starts no browser and renders nothing. It re-measures the delivered file itself rather than
trusting the film's own report. The JSON has one entry per check: { text, passed, evidence }.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(os.path.dirname(HERE), "template")


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return r.returncode, r.stdout.decode("utf8", "ignore"), r.stderr.decode("utf8", "ignore")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        raise SystemExit(__doc__)
    studio, film = os.path.abspath(args[0]), args[1]
    dst = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if dst in args:
        args.remove(dst)
    exe = ".exe" if os.name == "nt" else ""
    ffmpeg = os.environ.get("STUDIO_FFMPEG") or os.path.join(studio, "tools", "bin", "ffmpeg" + exe)
    out = os.path.join(studio, "out", film)
    deliver = os.path.join(out, "deliver")
    src = os.path.join(studio, "src", "films", film)
    rows = []

    def check(text, passed, evidence):
        rows.append({"text": text, "passed": bool(passed), "evidence": str(evidence)})
        print(f"  {'ok  ' if passed else 'FAIL'} {text}: {evidence}")

    def probe(path, extra=()):
        _, o, e = run([ffmpeg, "-hide_banner", "-nostats", "-i", path, *extra], studio)
        return e + o

    # ---- the project
    code, o, e = run(["node", os.path.join("node_modules", "typescript", "bin", "tsc"), "--noEmit"], studio)
    check("the project type-checks", code == 0, "clean" if code == 0 else (o or e).strip().splitlines()[:2])
    code, o, e = run(["node", "tools/check.ts", film], studio)
    last = [l for l in o.splitlines() if l.startswith(("PASSED", "FAILED"))]
    check("the dry run passes (shapes, joints, feet, type verbatim and on its word, safe zone, contrast, no pops, source rules)", code == 0, last[-1] if last else (e.strip().splitlines() or ["no verdict"])[-1])
    seqs = len(re.findall(r"^---- ", o, flags=re.M))
    cuts = len(re.findall(r"^\?\s+\S+: cuts in at", o, flags=re.M))
    check("no sequence is joined to the one before by a bare cut", cuts == 0, f"{seqs} sequence(s), {cuts} cut in")

    # ---- nothing of the engine or the tools was changed to get there
    changed = []
    for part in ("src/engine", "tools"):
        base = os.path.join(TEMPLATE, part)
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in ("bin", "__pycache__")]
            for f in files:
                a = os.path.join(root, f)
                b = os.path.join(studio, part, os.path.relpath(a, base))
                if not os.path.exists(b) or open(a, "rb").read() != open(b, "rb").read():
                    changed.append(os.path.relpath(b, studio))
    if os.path.isdir(TEMPLATE):
        check("the engine and the tools are as the skill delivered them", not changed, "unchanged" if not changed else ", ".join(changed[:8]))

    # ---- what was planned and recorded
    board = os.path.join(src, "board.md")
    rows_in_board = len(re.findall(r"^\|\s*\d", open(board, encoding="utf8").read(), flags=re.M)) if os.path.exists(board) else 0
    check("the board exists and has beats", rows_in_board >= 2, f"{rows_in_board} beat row(s)" if os.path.exists(board) else "no board.md")
    state = os.path.join(src, "STATE.md")
    check("STATE.md exists", os.path.exists(state), state if os.path.exists(state) else "missing")
    stills = os.listdir(os.path.join(studio, "out", "stills")) if os.path.isdir(os.path.join(studio, "out", "stills")) else []
    check("a cast sheet was rendered", any("cast" in s.lower() for s in stills), f"{sum('cast' in s.lower() for s in stills)} file(s) in out/stills")

    # ---- the delivered files
    mp4 = os.path.join(deliver, f"{film}.mp4")
    sfx = os.path.join(deliver, f"{film}_sfx-only.mp3")
    vo = os.path.join(deliver, f"{film}_vo-tight.wav")
    have = [os.path.exists(p) for p in (mp4, sfx, vo, os.path.join(deliver, "report.md"))]
    check("the three deliverables and the report exist", all(have), "film, effects-only, voice, report: " + " ".join("yes" if h else "NO" for h in have))
    if have[0]:
        info = probe(mp4)
        v = re.search(r"Video: (\w+)[^\n]*?, (yuv\w+)\(([^)]*)\)[^\n]*?, (\d+)x(\d+)[^\n]*?, ([\d.]+) fps", info)
        a = re.search(r"Audio: (\w+)[^\n]*?, (\d+) Hz, (\w+)", info)
        d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
        secs = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0
        check("picture is H.264, yuv420p, bt709, 1080x1920 at 30 fps", bool(v) and v.group(1) == "h264" and v.group(2) == "yuv420p" and "bt709" in v.group(3) and v.group(4, 5) == ("1080", "1920") and abs(float(v.group(6)) - 30) < 0.01, v.group(0)[:110] if v else "no video stream")
        check("sound is AAC, 48 kHz, stereo", bool(a) and a.group(1, 2, 3) == ("aac", "48000", "stereo"), a.group(0) if a else "no sound stream")
        if have[2]:
            dv = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe(vo))
            vsecs = int(dv.group(1)) * 3600 + int(dv.group(2)) * 60 + float(dv.group(3)) if dv else 0
            check("the film is as long as the tightened voice (within 0.15 s)", abs(secs - vsecs) <= 0.15, f"film {secs:.2f} s, voice {vsecs:.2f} s")
        loud = probe(mp4, ["-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"])
        tail = loud[loud.rfind("Summary:"):]
        i = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
        p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail)
        lufs = float(i.group(1)) if i else float("nan")
        peak = float(p.group(1)) if p else float("nan")
        check("loudness is -14 LUFS, give or take 0.6", abs(lufs + 14) <= 0.6, f"{lufs} LUFS")
        check("true peak is at or under -1 dB", peak <= -1.0, f"{peak} dB")
    if have[1]:
        vol = probe(sfx, ["-af", "volumedetect", "-f", "null", "-"])
        m = re.search(r"mean_volume: (-?[\d.]+) dB", vol)
        check("the effects-only file is not silent", bool(m) and float(m.group(1)) > -60, f"mean {m.group(1)} dB" if m else "not measured")

    # ---- the mix's own checks, and the motion audit
    mix = os.path.join(out, "mix-report.json")
    if os.path.exists(mix):
        rep = json.load(open(mix, encoding="utf8"))
        checks = rep.get("checks", {})
        bad = [k for k, val in checks.items() if val is False]
        check("every check in the mix report is true", bool(checks) and not bad, "all true" if checks and not bad else (", ".join(bad) or "no checks in the report"))
    else:
        check("every check in the mix report is true", False, "no mix-report.json")
    audit = os.path.join(out, "audit.json")
    if os.path.exists(audit):
        r = json.load(open(audit, encoding="utf8"))[-1]
        check("no held frames inside a move (1 % or less)", r["held_in_move_pct"] <= 1.0, f"{r['held_in_move_pct']} %")
        check("near-still time is 8 % or less, and no stretch over 1.25 s", r["quiet_pct"] <= 8.0 and r["longest_quiet_s"] <= 1.25, f"{r['quiet_pct']} %, longest {r['longest_quiet_s']} s")
        check("no flash frames", r["flashes"] == 0, r["flashes"])
    else:
        check("the motion audit was run on the clean render", False, "no out/<film>/audit.json")

    # ---- what the report owes the user
    rp = os.path.join(deliver, "report.md")
    if os.path.exists(rp):
        text = open(rp, encoding="utf8").read()
        check("the report lists the trims to the voice", "Trims" in text, "section present" if "Trims" in text else "no trims section")
    picks = os.path.join(out, "sound_picks.md")
    links = len(re.findall("https?://", open(picks, encoding="utf8").read())) if os.path.exists(picks) else 0
    check("every sound used is listed with a preview link (out/<film>/sound_picks.md)", links > 0, f"{links} link(s)" if os.path.exists(picks) else "no sound_picks.md")

    passed = sum(r["passed"] for r in rows)
    print(f"{passed} of {len(rows)} passed")
    if dst:
        os.makedirs(os.path.dirname(os.path.abspath(dst)) or ".", exist_ok=True)
        json.dump({"expectations": rows, "summary": {"passed": passed, "failed": len(rows) - passed, "total": len(rows), "pass_rate": round(passed / len(rows), 3)}}, open(dst, "w", encoding="utf8"), indent=1)
    sys.exit(0 if passed == len(rows) else 1)


main()
