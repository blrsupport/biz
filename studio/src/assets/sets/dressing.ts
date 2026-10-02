// Set dressing: the small, flat, faint things that keep a big plain surface from looking empty, and the pieces a
// skyline is made of. They were first drawn for the yard (yard.ts); here they take their materials and sizes as
// arguments, so a new world can use them. Everything is flat and placed by seed, the same in every frame.
//
// Use them sparingly: the look is a few big shapes under one light. A wall wants three or four stains and one or
// two patches of brick, not twenty. Texture sits at an opacity of 0.4 to 0.65, so it never competes with a figure.
import { shape, type Shape } from "../../engine/draw/shape.ts";
import { ellipse, spline } from "../../engine/geom/outline.ts";
import type { Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const flat = { form: "flat" } as const;

/**
 * Rain stains running down a wall from its top edge. `top` is the y they start at, `u` px per head-height.
 * Each is a narrow wedge 0.8 to 2.7 head-heights long.
 */
export function stains(id: string, mat: string, o: { x0: number; x1: number; top: number; u: number; count?: number; seed?: number; opacity?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const out: Shape[] = [];
  for (let k = 0; k < (o.count ?? 5); k++) {
    const sx = o.x0 + (o.x1 - o.x0) * hash(seed * 5.1 + k * 2.3);
    const sw = 14 + 30 * hash(seed + k * 4.1);
    const sl = (0.8 + 1.9 * hash(seed * 2.2 + k)) * o.u;
    out.push(shape(`${id}/stain${k}`, mat, [[sx - sw / 2, o.top], [sx + sw / 2, o.top], [sx + sw * 0.18, o.top + sl], [sx - sw * 0.12, o.top + sl * 0.86]], { ...flat, opacity: o.opacity ?? 0.42 }));
  }
  return out;
}

/**
 * A place where the plaster has come away and the brick shows: an uneven patch about `w` by `h` (half-sizes) with
 * courses of mortar across it. `brick` and `mortar` are materials.
 */
export function brickPatch(id: string, brick: string, mortar: string, c: Pt, w: number, h: number, seed = 1): Shape[] {
  const pts: Pt[] = [];
  for (let a = 0; a < 9; a++) {
    const th = (a / 9) * Math.PI * 2;
    const r = 0.72 + 0.5 * hash(seed * 4.4 + a * 1.9);
    pts.push([c[0] + Math.cos(th) * w * r, c[1] + Math.sin(th) * h * r]);
  }
  const out: Shape[] = [shape(`${id}/brick`, brick, spline(pts, { closed: true, step: 5 }), flat)];
  // bed joints right across, upright joints staggered from one course to the next
  const course = h * 0.26;
  for (let r = -3; r <= 3; r++) {
    const y = c[1] + r * course;
    const half = w * 0.78 * Math.sqrt(Math.max(0, 1 - Math.pow((r * course) / (h * 1.05), 2)));
    if (half < 8) continue;
    out.push(shape(`${id}/bed${r + 3}`, mortar, box(c[0] - half, y - 1.4, c[0] + half, y + 1.4), { ...flat, opacity: 0.65 }));
    for (let k = -4; k <= 4; k++) {
      const x = c[0] + (k + (r % 2 ? 0.5 : 0)) * course * 2.3;
      if (Math.abs(x - c[0]) < half - 6) out.push(shape(`${id}/joint${r + 3}.${k + 4}`, mortar, box(x - 1.3, y - course, x + 1.3, y), { ...flat, opacity: 0.55 }));
    }
  }
  return out;
}

/** Ruts or scuffs on the ground: long thin ellipses below `top`, spread over `depth` px toward the camera. */
export function ruts(id: string, mat: string, o: { x0: number; x1: number; top: number; depth: number; u: number; count?: number; seed?: number; opacity?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const n = o.count ?? 5;
  const out: Shape[] = [];
  for (let k = 0; k < n; k++) {
    const gy = o.top + o.depth * ((k + 0.5 + 0.6 * (hash(seed * 6.6 + k) - 0.5)) / n);
    const gx = o.x0 + (o.x1 - o.x0) * hash(seed * 1.9 + k * 5.3);
    out.push(shape(`${id}/rut${k}`, mat, ellipse([gx, gy], (1.1 + 1.6 * hash(seed + k * 7.7)) * o.u, 0.035 * o.u * (1 + k * 0.4), 0.02, 6), { ...flat, opacity: o.opacity ?? 0.4 }));
  }
  return out;
}

/**
 * A skyline as ONE outline: flat roofs of uneven width and height standing on `base`. `lo` and `hi` are the lowest
 * and highest roof in px above `base`. It runs on `under` px below `base`, so a camera move never shows its foot.
 * Give a far skyline a material close to the sky's colour and a nearer one a step darker.
 */
export function roofline(id: string, mat: string, o: { x0: number; x1: number; base: number; lo: number; hi: number; seed?: number; under?: number }): Shape {
  const seed = o.seed ?? 1;
  const foot = o.base + (o.under ?? 400);
  const pts: Pt[] = [[o.x0, foot]];
  for (let x = o.x0, i = 0; x < o.x1; i++) {
    const w = 46 + 70 * hash(seed * 3.7 + i);
    const h = o.lo + (o.hi - o.lo) * hash(seed * 9.1 + i * 1.7);
    pts.push([x, o.base - h], [Math.min(o.x1, x + w), o.base - h]);
    x += w;
  }
  pts.push([o.x1, foot]);
  return shape(id, mat, pts, flat);
}

/** A factory's saw-tooth roof as one outline: `teeth` north-light bays, each `bay` wide and `rise` high, on `base`. */
export function sawtooth(id: string, mat: string, x: number, base: number, bay: number, rise: number, teeth: number, under = 400): Shape {
  const pts: Pt[] = [[x, base + under]];
  for (let k = 0; k < teeth; k++) pts.push([x + k * bay, base - rise], [x + (k + 1) * bay, base - rise * 0.38]);
  pts.push([x + teeth * bay, base + under]);
  return shape(id, mat, pts, flat);
}

/**
 * A factory chimney standing on `base`: a tapered stack `h` high and `w` wide at the foot, with a lip.
 * `smoke` 0 gives a dead chimney; above 0 it trails five puffs to the right in the material `smokeMat`
 * (give the puffs' ids to the sequence's `allow` list if the smoke starts or stops during a take).
 */
export function chimney(id: string, mat: string, x: number, base: number, h: number, w: number, smoke = 0, smokeMat = "smoke"): Shape[] {
  const out: Shape[] = [];
  // smoke first, so the stack stands in front of it: it leans away, thinning as it goes
  if (smoke > 0) {
    for (let i = 0; i < 5; i++) {
      const f = i / 4;
      out.push(shape(`${id}/smoke${i}`, smokeMat, ellipse([x + 16 + f * 150 * smoke, base - h - 16 - f * 46 * smoke], (20 + 30 * f) * smoke, (12 + 14 * f) * smoke, -0.3, 6), { ...flat, opacity: 0.62 - 0.4 * f }));
    }
  }
  out.push(shape(`${id}/stack`, mat, [[x - w / 2, base], [x - w * 0.3, base - h], [x + w * 0.3, base - h], [x + w / 2, base]], flat));
  out.push(shape(`${id}/lip`, mat, box(x - w * 0.38, base - h - 5, x + w * 0.38, base - h + 3), flat));
  return out;
}

/** A minaret on `base`: a tapered shaft with three galleries, a small dome and a spike. */
export function minaret(id: string, mat: string, x: number, base: number, h: number, w: number): Shape[] {
  const out: Shape[] = [shape(`${id}/shaft`, mat, [[x - w / 2, base], [x - w * 0.36, base - h], [x + w * 0.36, base - h], [x + w / 2, base]], flat)];
  for (const [i, f] of [0.42, 0.72, 1].entries()) out.push(shape(`${id}/gallery${i}`, mat, box(x - w * 0.72, base - h * f - h * 0.022, x + w * 0.72, base - h * f + h * 0.012), flat));
  out.push(shape(`${id}/dome`, mat, ellipse([x, base - h - h * 0.045], w * 0.44, h * 0.065, 0, 8), flat));
  out.push(shape(`${id}/spike`, mat, [[x - 1.6, base - h - h * 0.09], [x, base - h - h * 0.2], [x + 1.6, base - h - h * 0.09]], flat));
  return out;
}

/** A water tank on legs, as two flat shapes: a common thing on an Indian skyline. */
export function tank(id: string, mat: string, x: number, base: number, u: number): Shape[] {
  return [shape(`${id}/tank`, mat, box(x, base - 0.7 * u, x + 0.5 * u, base - 0.34 * u), flat), shape(`${id}/legs`, mat, box(x + 0.06 * u, base - 0.36 * u, x + 0.44 * u, base + 4), { ...flat, opacity: 0.8 })];
}
