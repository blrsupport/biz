// A wooden crate seen a little from above: front face, top face, slats.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { roundedPoly } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";

export const CRATE_PALETTE: Palette = { wood: "#8a5a3a" };

export function buildCrate(id: string, c: Pt, w: number, h: number, tilt = 0, mat = "wood"): Shape[] {
  const P = (x: number, y: number): Pt => add(c, rot([x, y], tilt));
  const d = h * 0.22;
  const front = roundedPoly(
    [
      { p: P(-w / 2, -h / 2), r: 3 },
      { p: P(w / 2, -h / 2), r: 3 },
      { p: P(w / 2, h / 2), r: 5 },
      { p: P(-w / 2, h / 2), r: 5 },
    ],
    3,
  );
  const top: Pt[] = [P(-w / 2, -h / 2), P(-w / 2 + d * 0.9, -h / 2 - d), P(w / 2 + d * 0.9, -h / 2 - d), P(w / 2, -h / 2)];
  const side: Pt[] = [P(w / 2, -h / 2), P(w / 2 + d * 0.9, -h / 2 - d), P(w / 2 + d * 0.9, h / 2 - d), P(w / 2, h / 2)];
  const out: Shape[] = [
    shape(`${id}/side`, mat, side, { form: "plane", facing: [1, 0] }),
    shape(`${id}/top`, mat, top, { form: "plane", facing: [0, -1] }),
    shape(`${id}/front`, mat, front, { form: "plane", facing: [0, 0] }),
  ];
  // slats: two darker gaps across the front and a brace
  for (const [i, fy] of [-0.18, 0.18].entries()) {
    out.push(shape(`${id}/gap${i}`, mat, [P(-w / 2 + 4, fy * h - 2.5), P(w / 2 - 4, fy * h - 2.5), P(w / 2 - 4, fy * h + 2.5), P(-w / 2 + 4, fy * h + 2.5)], { form: "flat", tone: "shade", ink: 0, paper: false }));
  }
  for (const [i, fx] of [-0.36, 0.36].entries()) {
    const x = fx * w;
    out.push(shape(`${id}/post${i}`, mat, [P(x - w * 0.045, -h / 2 + 2), P(x + w * 0.045, -h / 2 + 2), P(x + w * 0.045, h / 2 - 2), P(x - w * 0.045, h / 2 - 2)], { form: "flat", tone: "light", ink: 0, paper: false }));
  }
  return out;
}
