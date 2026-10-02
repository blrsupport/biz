"""Cuts static faces from the downloaded variable fonts, checks every needed codepoint exists in each face,
and writes the metrics the layout code needs (advance widths, cap height, digit boxes).

  python tools/fonts.py

In:  public/fonts/src/*.ttf (full files from the Google Fonts repository)
Out: public/fonts/<Face>.ttf, src/engine/type/metrics.ts
"""
import json
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, "public", "fonts", "src")
dst = os.path.join(root, "public", "fonts")

# face name -> (source file, axis settings or None for a static file)
FACES = {
    "FrauncesDisplay": ("Fraunces-VF.ttf", {"wght": 900, "opsz": 144, "SOFT": 0, "WONK": 0}),
    "FrauncesText": ("Fraunces-VF.ttf", {"wght": 600, "opsz": 72, "SOFT": 0, "WONK": 0}),
    "FrauncesItalic": ("Fraunces-Italic-VF.ttf", {"wght": 600, "opsz": 72, "SOFT": 0, "WONK": 0}),
    "InterBold": ("Inter-VF.ttf", {"wght": 700, "opsz": 32}),
    "InterBlack": ("Inter-VF.ttf", {"wght": 900, "opsz": 32}),
    "Baloo": ("Baloo2-VF.ttf", {"wght": 800}),
    "Anton": ("Anton-Regular.ttf", None),
    "PlexMono": ("IBMPlexMono-Medium.ttf", None),
}

NEED = "0123456789₹,.–-—%+ ’'\"“”!?&:/()·…" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz"

metrics = {}
bad = []
for face, (file, axes) in FACES.items():
    font = TTFont(os.path.join(src, file))
    if axes:
        have = {a.axisTag for a in font["fvar"].axes}
        font = instancer.instantiateVariableFont(font, {k: v for k, v in axes.items() if k in have}, inplace=False)
    out = os.path.join(dst, face + ".ttf")
    font.save(out)
    font = TTFont(out)
    cmap = font.getBestCmap()
    missing = [c for c in NEED if ord(c) not in cmap]
    if missing:
        bad.append((face, "".join(missing)))
    upm = font["head"].unitsPerEm
    os2 = font["OS/2"]
    hmtx = font["hmtx"]
    gs = font.getGlyphSet()
    adv = {}
    box = {}
    for c in NEED:
        g = cmap.get(ord(c))
        if g is None:
            continue
        adv[c] = round(hmtx[g][0] / upm, 4)
        if c in "0123456789₹HxXA":
            bp = BoundsPen(gs)
            gs[g].draw(bp)
            if bp.bounds:
                x0, y0, x1, y1 = bp.bounds
                box[c] = [round(x0 / upm, 4), round(y0 / upm, 4), round(x1 / upm, 4), round(y1 / upm, 4)]
    cap = getattr(os2, "sCapHeight", 0) or (box.get("H", [0, 0, 0, 0])[3] * upm)
    xh = getattr(os2, "sxHeight", 0) or (box.get("x", [0, 0, 0, 0])[3] * upm)
    digits = [adv[d] for d in "0123456789" if d in adv]
    metrics[face] = {
        "file": face + ".ttf",
        "capHeight": round(cap / upm, 4),
        "xHeight": round(xh / upm, 4),
        "ascent": round(font["hhea"].ascent / upm, 4),
        "descent": round(-font["hhea"].descent / upm, 4),
        "digitCell": max(digits) if digits else None,
        "digitTop": max((box[d][3] for d in "0123456789" if d in box), default=None),
        "adv": adv,
        "box": box,
    }
    print(f"{face:18s} {os.path.getsize(out):7d} B  cap {metrics[face]['capHeight']:.3f}  digit cell {metrics[face]['digitCell']}  "
          f"digit widths {min(digits):.3f}-{max(digits):.3f}  rupee {'yes' if '₹' in adv else 'NO'}  missing '{''.join(missing)}'")

ts = os.path.join(root, "src", "engine", "type", "metrics.ts")
os.makedirs(os.path.dirname(ts), exist_ok=True)
with open(ts, "w", encoding="utf8") as f:
    f.write("// Written by tools/fonts.py. Advance widths and boxes are in em units. Do not edit by hand.\n")
    f.write("export const FONT_METRICS = ")
    f.write(json.dumps(metrics, ensure_ascii=False, indent=1))
    f.write(" as const;\n")
    f.write("export type FaceName = keyof typeof FONT_METRICS;\n")
print("wrote", ts)
if bad:
    print("MISSING GLYPHS:", bad)
    sys.exit(1)
