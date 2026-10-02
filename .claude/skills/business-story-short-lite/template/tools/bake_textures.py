# Bakes the paper textures used by the finishing pass. Run once: python tools/bake_textures.py
# Each texture is grey around 128, so a soft-light blend adds tooth without changing brightness.
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

W, H = 1080, 1920
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tex")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def fbm(scales, weights):
    acc = np.zeros((H, W), np.float32)
    for s, w in zip(scales, weights):
        n = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), s)
        acc += w * n / (n.std() + 1e-6)
    return acc / np.sqrt(sum(w * w for w in weights))


def fibres(count, length, sigma):
    img = np.zeros((H, W), np.float32)
    for _ in range(count):
        x, y, a = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0, np.pi)
        t = np.arange(int(length * rng.uniform(0.4, 1.0)))
        bend = rng.uniform(-0.012, 0.012)
        xs = (x + np.cos(a + bend * t) * t).astype(int) % W
        ys = (y + np.sin(a + bend * t) * t).astype(int) % H
        img[ys, xs] += rng.uniform(0.5, 1.0) * rng.choice([-1.0, 1.0])
    img = gaussian_filter(img, sigma)
    return img / (img.std() + 1e-6)


def save(a, name):
    Image.fromarray(np.clip(128.0 + a, 0, 255).astype(np.uint8), "L").convert("RGB").save(os.path.join(OUT, name))
    print(name, "std", round(float(a.std()), 2))


# fine tooth for looks A and B
save(5.0 * fbm([0.6, 1.5, 8.0], [1.0, 0.7, 0.5]) + 2.6 * fibres(2600, 40, 0.7), "paper_fine.png")
# kraft and print stock for look C: coarser, with fibres and the odd dark speck
speck = gaussian_filter((rng.uniform(size=(H, W)) > 0.9994).astype(np.float32), 1.2)
save(8.0 * fbm([0.7, 2.2, 14.0, 70.0], [1.0, 0.8, 0.6, 0.5]) + 5.5 * fibres(5200, 70, 0.8) - 420.0 * speck, "paper_kraft.png")
