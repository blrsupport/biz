# Are two pictures the same? Used after a refactor of the engine or of a shared asset: render the same stills
# before and after, then compare. Prints, for each pair, the largest and the mean difference (0-255) and how many
# pixels differ by more than 8.
# Usage: python tools/same.py out/stills before_ after_      (pairs every before_<x>.png with after_<x>.png)
#        python tools/same.py a.png b.png
import os
import sys

import numpy as np
from PIL import Image


def diff(a, b):
    x = np.asarray(Image.open(a).convert("RGB"), dtype=np.int16)
    y = np.asarray(Image.open(b).convert("RGB"), dtype=np.int16)
    if x.shape != y.shape:
        return None
    d = np.abs(x - y).max(axis=2)
    return int(d.max()), float(d.mean()), int((d > 8).sum())


def main():
    args = sys.argv[1:]
    pairs = []
    if len(args) == 3 and os.path.isdir(args[0]):
        folder, pa, pb = args
        for name in sorted(os.listdir(folder)):
            if name.startswith(pa) and name.endswith(".png"):
                other = os.path.join(folder, pb + name[len(pa):])
                if os.path.exists(other):
                    pairs.append((os.path.join(folder, name), other))
    elif len(args) == 2:
        pairs.append((args[0], args[1]))
    else:
        raise SystemExit(__doc__ or "usage: python tools/same.py <folder> <prefixA> <prefixB> | <a.png> <b.png>")
    if not pairs:
        raise SystemExit("no pairs of pictures to compare")
    worst = 0
    for a, b in pairs:
        r = diff(a, b)
        if r is None:
            print(f"{os.path.basename(a):28s} sizes differ")
            worst = 255
            continue
        mx, mean, many = r
        worst = max(worst, mx if many > 40 else 0)
        print(f"{os.path.basename(a):28s} largest {mx:3d}  mean {mean:6.3f}  pixels over 8: {many}")
    print("SAME" if worst == 0 else "DIFFERENT")
    sys.exit(0 if worst == 0 else 1)


main()
