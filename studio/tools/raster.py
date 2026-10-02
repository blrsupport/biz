# Turns the list of fills written by tools/preview.ts into a PNG, with Pillow and no browser.
# It mimics the look's painter: flat fills, a shifted copy clipped to the part for the core shadow, rim slivers,
# gradients, clips, and plain type. Run by preview.ts: python tools/raster.py in.json out.png [scale]
import json
import sys
import time

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

src, dst = sys.argv[1], sys.argv[2]
out_scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
doc = json.load(open(src, encoding="utf-8"))
W, H = int(doc["w"]), int(doc["h"])
FONTS = {}


def rgb(hexs):
    h = hexs.lstrip("#")
    if len(h) == 3:
        h = "".join(c + c for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def bbox(pts, pad=2):
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0 = max(0, int(min(xs)) - pad)
    y0 = max(0, int(min(ys)) - pad)
    x1 = min(W, int(max(xs)) + pad + 1)
    y1 = min(H, int(max(ys)) + pad + 1)
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


def mask(pts, box, dx=0.0, dy=0.0):
    m = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0)
    if len(pts) >= 3:
        ImageDraw.Draw(m).polygon([(p[0] + dx - box[0], p[1] + dy - box[1]) for p in pts], fill=255)
    return m


def fade(m, o):
    return m if o is None or o >= 0.999 else m.point(lambda v: int(v * max(0.0, o)))


def gradient(op, box):
    bw, bh = box[2] - box[0], box[3] - box[1]
    gx, gy = np.meshgrid(np.arange(bw) + box[0] + 0.5, np.arange(bh) + box[1] + 0.5)
    if op["k"] == "lin":
        vx, vy = op["x2"] - op["x1"], op["y2"] - op["y1"]
        t = ((gx - op["x1"]) * vx + (gy - op["y1"]) * vy) / max(vx * vx + vy * vy, 1e-9)
    else:
        sy = op.get("sy") or 1.0
        t = np.hypot(gx - op["cx"], (gy - op["cy"]) / sy) / max(op["r"], 1e-6)
    t = np.clip(t, 0, 1)
    stops = op["stops"]
    at = np.array([s["at"] for s in stops], dtype=float)
    chans = [np.interp(t, at, np.array([rgb(s["color"])[i] for s in stops], dtype=float)) for i in range(3)]
    alpha = np.interp(t, at, np.array([s["a"] for s in stops], dtype=float)) * 255.0 * (op.get("o") if op.get("o") is not None else 1.0)
    return Image.fromarray(np.dstack(chans + [alpha]).astype(np.uint8), "RGBA")


def draw(canvas, ops):
    for op in ops:
        k = op["k"]
        if k == "clip":
            sub = canvas.copy()
            draw(sub, op["ops"])
            m = Image.new("L", (W, H), 0)
            d = ImageDraw.Draw(m)
            for c in op["clip"]:
                if len(c) >= 3:
                    d.polygon([tuple(p) for p in c], fill=255)
            canvas.paste(sub, (0, 0), fade(m, op.get("o")))
            continue
        if k == "eo":
            m = Image.new("L", (W, H), 0)
            for c in op["paths"]:
                if len(c) < 3:
                    continue
                one = Image.new("L", (W, H), 0)
                ImageDraw.Draw(one).polygon([tuple(p) for p in c], fill=255)
                m = ImageChops.difference(m, one)
            canvas.paste(rgb(op["fill"]), (0, 0), fade(m, op.get("o")))
            continue
        if k == "text":
            size = max(4, int(round(op["size"])))
            key = (op["font"], size)
            if key not in FONTS:
                try:
                    FONTS[key] = ImageFont.truetype(op["font"], size)
                except OSError:
                    FONTS[key] = ImageFont.load_default()
            ImageDraw.Draw(canvas).text((op["x"], op["y"]), op["text"], font=FONTS[key], fill=rgb(op["fill"]), anchor="ls")
            continue
        box = bbox(op["pts"])
        if not box:
            continue
        m = mask(op["pts"], box)
        if k == "poly":
            canvas.paste(rgb(op["fill"]), box, fade(m, op.get("o")))
        elif k == "round":
            tmp = canvas.crop(box)
            tmp.paste(rgb(op["shade"]), (0, 0), m)
            if op.get("base"):
                tmp.paste(rgb(op["base"]), (0, 0), ImageChops.multiply(m, mask(op["pts"], box, op["dx"], op["dy"])))
            for c in op.get("casts", []):
                tmp.paste(rgb(c.get("fill") or op["shade"]), (0, 0), ImageChops.multiply(m, mask(c["pts"], box, c["dx"], c["dy"])))
            for r in op.get("rims", []):
                tmp.paste(rgb(op["rim"]), (0, 0), ImageChops.multiply(m, mask(r, box)))
            canvas.paste(tmp, box, fade(m, op.get("o")))
        elif k in ("lin", "rad"):
            g = gradient(op, box)
            canvas.paste(g.convert("RGB"), box, ImageChops.multiply(g.getchannel("A"), m))


img = Image.new("RGB", (W, H), rgb(doc["bg"]))
draw(img, doc["ops"])
if out_scale != 1:
    img = img.resize((max(1, int(W * out_scale)), max(1, int(H * out_scale))), Image.LANCZOS)
# (Windows may hold the old file for a moment: a viewer that has it open, the virus scanner)
for attempt in range(8):
    try:
        img.save(dst)
        break
    except PermissionError:
        if attempt == 7:
            raise
        time.sleep(0.4 * (attempt + 1))
