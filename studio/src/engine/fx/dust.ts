// Designed dust: a puff is a few soft-edged lobes that open away from a point, not a cloud of circles.
import { shape, type Shape } from "../draw/shape.ts";
import { ellipse, spline } from "../geom/outline.ts";
import type { Pt } from "../geom/vec.ts";
import { hash } from "../motion/track.ts";

/**
 * A puff of dust kicked out sideways from `at`.
 * `dir` -1 = to the left, 1 = to the right; `age` 0..1 grows and thins it; `size` is its length in px.
 */
export function dustPuff(id: string, at: Pt, size: number, dir: 1 | -1, age = 0.5, seed = 1, mat = "dust"): Shape[] {
  const out: Shape[] = [];
  const grow = 0.45 + 0.75 * age;
  const fade = Math.max(0, 1 - age * age);
  // one lobed body: a scalloped outline along the ground
  const n = 4;
  const top: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const f = i / (n * 2);
    const bump = i % 2 === 1 ? 1 : 0.55;
    const h = size * 0.34 * grow * bump * (0.75 + 0.5 * hash(seed * 31 + i)) * Math.sin(Math.PI * Math.min(1, f * 1.15 + 0.08));
    top.push([at[0] + dir * f * size * grow, at[1] - h]);
  }
  const body: Pt[] = [...spline(top, { closed: false, step: 4 }), [at[0] + dir * size * grow, at[1] + 2], [at[0], at[1] + 2]];
  out.push(shape(`${id}/body`, mat, body, { form: "flat", ink: 0, paper: false, opacity: 0.5 * fade }));
  // two or three loose motes ahead of it
  for (let i = 0; i < 3; i++) {
    const f = 0.55 + 0.3 * i + 0.2 * hash(seed * 7 + i);
    const r = size * 0.05 * (1.2 - 0.25 * i) * (0.8 + 0.5 * hash(seed * 13 + i));
    out.push(shape(`${id}/mote${i}`, mat, ellipse([at[0] + dir * f * size * grow, at[1] - size * (0.12 + 0.2 * hash(seed * 3 + i)) * grow], r * 1.3, r, 0, 6), { form: "flat", ink: 0, paper: false, opacity: 0.55 * fade }));
  }
  return out;
}

/** Dust hanging in a shaft of light: a few specks, placed by seed so they hold still from frame to frame. */
export function motes(id: string, x0: number, y0: number, x1: number, y1: number, count: number, seed = 1, mat = "dust"): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * hash(seed * 17 + i * 3);
    const y = y0 + (y1 - y0) * hash(seed * 29 + i * 5);
    const r = 1.6 + 2.4 * hash(seed * 41 + i);
    out.push(shape(`${id}/${i}`, mat, ellipse([x, y], r, r, 0, 4), { form: "flat", ink: 0, paper: false, opacity: 0.35 + 0.4 * hash(seed + i) }));
  }
  return out;
}
