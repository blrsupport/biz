// Mushroom farming props: the hanging grow bag, the spawn bottle and the white spawn sack.
// Library pieces: no words, labels or prices on any of them. Each is drawn about one anchor point and a head-height `u`.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, roundRect, roundedPoly, spline } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const MUSHROOM_PALETTE: Palette = {
  "bag.straw": "#d8b56a",
  "bag.plastic": "#eef3f2",
  "bag.myc": "#f5f2e9",
  "bag.mould": "#7f8b79",
  "bag.rot": "#5b4835",
  "mush.rope": "#b59a6c",
  oyster: "#ece4d2",
  "oyster.gill": "#c9bca4",
  "spawn.glass": "#c4dcd8",
  "spawn.grain": "#c99f58",
  "spawn.myc": "#f8f6ef",
  "spawn.bad": "#87925f",
  "spawn.plug": "#f1ebdc",
  "spawn.glint": "#ffffff",
  "sack.white": "#ebe7dc",
  "sack.weave": "#cfc8b8",
  "sack.tie": "#b2925f",
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const flat = { form: "flat", ink: 0, paper: false } as const;

// ---------------------------------------------------------------------------------------------------------------
// Grow bag
// ---------------------------------------------------------------------------------------------------------------

export interface GrowBagOpts {
  /** the tie at the top of the bag, where it hangs from its rope (or is held) */
  top: Pt;
  u: number;
  /** oyster mushrooms coming out of the holes, 0..1 (they grow one cluster after another) */
  sprout?: number;
  /** the bag has gone bad: grey-green mould, darkened straw, a sag, 0..1 */
  failed?: number;
  /** white of the spawn running through the straw, 0..1 (default 0.55) */
  myc?: number;
  /** turn about the tie, radians (a bag lying on the floor is +-PI/2) */
  swing?: number;
  /** a tear down the front, opened by hand, 0..1 */
  split?: number;
  seed?: number;
  /** size, as multiples of the standard bag */
  scale?: number;
}

export interface GrowBagOut {
  shapes: Shape[];
  top: Pt;
  bottom: Pt;
  mid: Pt;
  /** where hands take hold of it: either side, a third of the way down */
  grips: { L: Pt; R: Pt };
}

/** A cylinder of chopped straw packed in clear plastic, tied at the top, with holes the mushrooms come out of. */
export function growBag(id: string, o: GrowBagOpts): GrowBagOut {
  const sc = o.scale ?? 1;
  const w = 0.58 * o.u * sc;
  const h = 1.06 * o.u * sc;
  const sw = o.swing ?? 0;
  const fail = clamp01(o.failed ?? 0);
  const sprout = clamp01(o.sprout ?? 0);
  const myc = clamp01(o.myc ?? 0.55) * (1 - fail);
  const seed = o.seed ?? 1;
  const sag = 0.07 * fail;
  const S = (x: number, y: number): Pt => add(o.top, rot([x * w, y * h], sw));
  const j = (i: number, k = 0.02) => (hash(seed * 5.1 + i * 3.7) - 0.5) * 2 * k;
  const out: Shape[] = [];

  const body = spline(
    [
      S(-0.13, 0.1),
      S(-0.4 + sag, 0.17),
      S(-0.49 + j(1) + sag * 0.5, 0.36),
      S(-0.5 + j(2) - sag * 0.3, 0.62),
      S(-0.48 - sag, 0.86),
      S(-0.3 - sag, 0.99),
      S(0.02, 1.0 + sag * 0.3),
      S(0.32 + sag, 0.985),
      S(0.49 + sag, 0.85),
      S(0.5 + j(3) - sag * 0.3, 0.6),
      S(0.49 + j(4) + sag * 0.5, 0.34),
      S(0.4 - sag, 0.16),
      S(0.13, 0.1),
    ],
    { closed: true, step: 5 },
  );
  // the gathered neck of the plastic above the body, and the tie
  out.push(shape(`${id}/neck`, "bag.plastic", [S(-0.15, 0.13), S(-0.06, 0.06), S(-0.1, -0.03), S(0, 0.0), S(0.1, -0.035), S(0.06, 0.06), S(0.15, 0.13)], { form: "flat", tone: "base", ink: 0.6, paper: false, opacity: 0.85 }));
  out.push(shape(`${id}/body`, "bag.straw", body, { depth: w * 0.42 }));
  // chopped straw: short strokes at all angles
  for (let i = 0; i < 18; i++) {
    const x = -0.36 + 0.72 * hash(seed * 3.3 + i * 1.71);
    const y = 0.2 + 0.72 * hash(seed * 7.9 + i * 2.33);
    const a = (hash(seed + i * 4.1) - 0.5) * 2.4;
    const L = 0.06 + 0.05 * hash(i * 9.1 + seed);
    const p = S(x, y);
    const q = add(p, rot([L * w * Math.cos(a), L * w * Math.sin(a)], sw));
    out.push(shape(`${id}/straw${i}`, "bag.straw", capsule(p, q, 1.6 * sc, 1.6 * sc, 2), { ...flat, tone: i % 3 ? "shade" : "light", opacity: 0.8 }));
  }
  // the white of the spawn running through it
  if (myc > 0.02) {
    for (let i = 0; i < 7; i++) {
      const p = S(-0.3 + 0.6 * hash(seed * 2.2 + i * 5.3), 0.25 + 0.65 * hash(seed * 6.1 + i * 3.9));
      out.push(shape(`${id}/myc${i}`, "bag.myc", ellipse(p, (0.09 + 0.07 * hash(i + seed)) * w, (0.06 + 0.05 * hash(i * 2 + seed)) * h, sw + i, 3), { ...flat, opacity: 0.25 + 0.6 * myc }));
    }
  }
  // gone bad: the straw darkens, grey-green mould spreads
  if (fail > 0.01) {
    out.push(shape(`${id}/rot`, "bag.rot", body, { ...flat, opacity: 0.5 * fail }));
    for (let i = 0; i < 8; i++) {
      const p = S(-0.32 + 0.64 * hash(seed * 4.4 + i * 2.7), 0.22 + 0.7 * hash(seed * 8.3 + i * 1.9));
      const r = (0.06 + 0.08 * hash(i * 3.3 + seed)) * w * (0.4 + 0.6 * fail);
      out.push(shape(`${id}/mould${i}`, "bag.mould", ellipse(p, r * 1.3, r, sw + i * 0.7, 3), { ...flat, tone: i % 2 ? "base" : "light", opacity: 0.9 * fail }));
    }
  }
  // the holes cut in the plastic
  const HOLES: [number, number][] = [
    [-1, 0.3],
    [1, 0.42],
    [-1, 0.64],
    [1, 0.76],
    [0, 0.53],
  ];
  HOLES.forEach(([s, y], i) => {
    const p = s === 0 ? S(0.05, y) : S(s * 0.45, y);
    out.push(shape(`${id}/hole${i}`, "bag.straw", ellipse(p, 0.05 * w, 0.035 * h, sw, 2), { ...flat, tone: "deep", opacity: 0.7 }));
  });
  // a tear down the front, pulled open
  const split = clamp01(o.split ?? 0);
  if (split > 0.01) {
    const half = 0.2 * split;
    const lip: Pt[] = [S(0, 0.28), S(half * 0.6, 0.36), S(half, 0.48), S(half * 0.8, 0.6), S(half, 0.72), S(0, 0.8), S(-half * 0.9, 0.7), S(-half, 0.56), S(-half * 0.7, 0.44), S(-half * 0.9, 0.36)];
    out.push(shape(`${id}/tear`, "bag.rot", lip, { ...flat, tone: "deep" }));
    for (let i = 0; i < 9; i++) {
      const p = S((hash(i * 2.9 + seed) - 0.5) * 1.4 * half, 0.36 + 0.36 * hash(i * 4.7 + seed));
      out.push(shape(`${id}/grain${i}`, "spawn.grain", ellipse(p, 3.2 * sc, 2.2 * sc, i, 2), { ...flat, tone: i % 2 ? "base" : "light", opacity: split }));
    }
    out.push(shape(`${id}/flapL`, "bag.plastic", [S(-half * 0.9, 0.36), S(-half - 0.05, 0.56), S(-half * 0.9, 0.7), S(-half * 0.6, 0.56)], { ...flat, tone: "light", opacity: 0.6 }));
    out.push(shape(`${id}/flapR`, "bag.plastic", [S(half * 0.6, 0.36), S(half + 0.05, 0.48), S(half, 0.72), S(half * 0.7, 0.5)], { ...flat, tone: "light", opacity: 0.6 }));
  }
  // the plastic: a sheen over all of it, a long highlight down the lit side, and the tie
  out.push(shape(`${id}/film`, "bag.plastic", body, { ...flat, opacity: 0.14 }));
  out.push(shape(`${id}/sheen`, "bag.plastic", capsule(S(-0.36, 0.24), S(-0.38, 0.84), 2.6 * sc, 3.6 * sc, 3), { ...flat, tone: "light", opacity: 0.6 }));
  out.push(shape(`${id}/sheen2`, "bag.plastic", capsule(S(0.3, 0.3), S(0.33, 0.5), 1.6 * sc, 2 * sc, 3), { ...flat, tone: "light", opacity: 0.4 }));
  out.push(shape(`${id}/tie`, "mush.rope", capsule(S(-0.09, 0.06), S(0.09, 0.06), 3 * sc, 3 * sc, 3), { ...flat, ink: 0.5 }));

  // oyster mushrooms: shelves of pale fan-shaped caps out of each hole, one cluster after another
  if (sprout > 0.01) {
    HOLES.forEach(([s, y], k) => {
      const g = clamp01((sprout - 0.1 * k) / 0.55);
      if (g < 0.03) return;
      const base = s === 0 ? S(0.05, y) : S(s * 0.47, y);
      const dir = s === 0 ? -1 : s;
      for (let c = 0; c < 3; c++) {
        const r = (0.17 - 0.035 * c) * o.u * sc * g;
        const off = rot([dir * (0.06 + 0.07 * c) * o.u * sc * g, (-0.05 + 0.065 * c) * o.u * sc * g], sw);
        const p = add(base, off);
        const ang = sw + dir * (0.32 - 0.22 * c);
        out.push(shape(`${id}/gill${k}_${c}`, "oyster.gill", ellipse(add(p, rot([0, 0.18 * r], ang)), r * 0.92, r * 0.42, ang, 3), { ...flat, opacity: Math.min(1, g * 3) }));
        out.push(shape(`${id}/cap${k}_${c}`, "oyster", ellipse(p, r, r * 0.46, ang, 3), { depth: r * 0.6, opacity: Math.min(1, g * 3) }));
      }
    });
  }
  return { shapes: out, top: o.top, bottom: S(0, 1), mid: S(0, 0.5), grips: { L: S(-0.5, 0.36), R: S(0.5, 0.36) } };
}

// ---------------------------------------------------------------------------------------------------------------
// Spawn bottle
// ---------------------------------------------------------------------------------------------------------------

export interface SpawnBottleOpts {
  /** middle of its base */
  at: Pt;
  u: number;
  /** turn about the base, radians */
  tilt?: number;
  /** the grain has gone grey-green: a bad batch, 0..1 */
  bad?: number;
  /** white threads of the fungus through the grain, 0..1 (default 1) */
  myc?: number;
  scale?: number;
}

export interface SpawnBottleOut {
  shapes: Shape[];
  /** the plug, the middle of the grain, the base */
  top: Pt;
  mid: Pt;
  at: Pt;
  /** its outline, for a glow or a shadow */
  outline: Pt[];
}

/** A glass bottle of boiled wheat grain run through with white threads, stopped with cotton. */
export function spawnBottle(id: string, o: SpawnBottleOpts): SpawnBottleOut {
  const sc = o.scale ?? 1;
  const w = 0.3 * o.u * sc;
  const h = 0.68 * o.u * sc;
  const tilt = o.tilt ?? 0;
  const bad = clamp01(o.bad ?? 0);
  const myc = clamp01(o.myc ?? 1) * (1 - bad);
  const B = (x: number, y: number): Pt => add(o.at, rot([x * w, -y * h], tilt));
  const out: Shape[] = [];
  const glass = roundedPoly(
    [
      { p: B(-0.5, 0), r: 5 * sc },
      { p: B(0.5, 0), r: 5 * sc },
      { p: B(0.5, 0.62), r: 0.14 * w },
      { p: B(0.2, 0.79), r: 0.06 * w },
      { p: B(0.19, 0.95), r: 2 },
      { p: B(-0.19, 0.95), r: 2 },
      { p: B(-0.2, 0.79), r: 0.06 * w },
      { p: B(-0.5, 0.62), r: 0.14 * w },
    ],
    3,
  );
  out.push(shape(`${id}/glass`, "spawn.glass", glass, { form: "flat", tone: "base", ink: 0.9, paper: false, opacity: 0.6 }));
  const grain = roundedPoly(
    [
      { p: B(-0.43, 0.04), r: 4 * sc },
      { p: B(0.43, 0.04), r: 4 * sc },
      { p: B(0.43, 0.6), r: 0.1 * w },
      { p: B(0.25, 0.7), r: 0.05 * w },
      { p: B(-0.25, 0.7), r: 0.05 * w },
      { p: B(-0.43, 0.6), r: 0.1 * w },
    ],
    3,
  );
  out.push(shape(`${id}/grain`, "spawn.grain", grain, { depth: w * 0.45 }));
  for (let i = 0; i < 16; i++) {
    const p = B(-0.36 + 0.72 * hash(i * 3.1 + 0.4), 0.08 + 0.56 * hash(i * 5.7 + 1.3));
    out.push(shape(`${id}/g${i}`, "spawn.grain", ellipse(p, 2.6 * sc, 1.8 * sc, i * 0.9 + tilt, 2), { ...flat, tone: i % 3 ? "light" : "shade", opacity: 0.85 }));
  }
  if (bad > 0.01) {
    out.push(shape(`${id}/bad`, "spawn.bad", grain, { ...flat, opacity: 0.8 * bad }));
    for (let i = 0; i < 6; i++) {
      const p = B(-0.3 + 0.6 * hash(i * 7.7 + 2), 0.12 + 0.5 * hash(i * 2.3 + 5));
      out.push(shape(`${id}/spot${i}`, "spawn.bad", ellipse(p, 0.07 * w, 0.05 * w, i, 2), { ...flat, tone: "deep", opacity: 0.8 * bad }));
    }
  }
  // the white threads: wavy runs through the grain and a bloom of white where they meet
  if (myc > 0.01) {
    for (let i = 0; i < 6; i++) {
      const y = 0.12 + 0.09 * i;
      const x0 = -0.38 + 0.2 * hash(i * 1.9);
      const pts = [B(x0, y), B(x0 + 0.22, y + 0.035 * (i % 2 ? 1 : -1)), B(x0 + 0.44, y - 0.02), B(Math.min(0.38, x0 + 0.66), y + 0.03)];
      for (let k = 0; k < 3; k++) out.push(shape(`${id}/thread${i}_${k}`, "spawn.myc", capsule(pts[k], pts[k + 1], 1.3 * sc, 1.1 * sc, 2), { ...flat, opacity: 0.85 * myc }));
    }
    for (let i = 0; i < 4; i++) {
      const p = B(-0.25 + 0.5 * hash(i * 6.3 + 3), 0.2 + 0.4 * hash(i * 4.1 + 7));
      out.push(shape(`${id}/bloom${i}`, "spawn.myc", ellipse(p, 0.16 * w, 0.06 * h, tilt + i, 3), { ...flat, opacity: 0.55 * myc }));
    }
  }
  // glass catches the light: a long streak down the lit side and a tick on the shoulder
  out.push(shape(`${id}/glint`, "spawn.glint", capsule(B(-0.34, 0.1), B(-0.34, 0.56), 2.2 * sc, 2.8 * sc, 3), { ...flat, opacity: 0.6 }));
  out.push(shape(`${id}/glint2`, "spawn.glint", capsule(B(-0.3, 0.66), B(-0.14, 0.76), 1.6 * sc, 1.6 * sc, 3), { ...flat, opacity: 0.5 }));
  out.push(shape(`${id}/rim`, "spawn.glass", roundRect(B(0, 0.95), 0.24 * w, 0.025 * h, 2, tilt), { ...flat, tone: "light", ink: 0.5 }));
  out.push(shape(`${id}/plug`, "spawn.plug", ellipse(B(0, 1.0), 0.2 * w, 0.075 * h, tilt, 3), { depth: 0.12 * w, ink: 0.6 }));
  return { shapes: out, top: B(0, 1.02), mid: B(0, 0.4), at: o.at, outline: glass };
}

// ---------------------------------------------------------------------------------------------------------------
// Spawn sack
// ---------------------------------------------------------------------------------------------------------------

export interface SpawnSackOpts {
  /** its middle */
  c: Pt;
  u: number;
  /** width and height in head-heights (default 0.95 x 1.3) */
  w?: number;
  h?: number;
  tilt?: number;
  /** set down: it spreads and settles, 0..1 */
  slump?: number;
  seed?: number;
}

export interface SpawnSackOut {
  shapes: Shape[];
  top: Pt;
  bottom: Pt;
  /** the two stitched-up corners, where it is carried */
  grips: { L: Pt; R: Pt };
}

/** A white woven sack, stitched shut along the top, plain (no print). */
export function spawnSack(id: string, o: SpawnSackOpts): SpawnSackOut {
  const sl = clamp01(o.slump ?? 0);
  const w = (o.w ?? 0.95) * o.u * (1 + 0.12 * sl);
  const h = (o.h ?? 1.3) * o.u * (1 - 0.1 * sl);
  const tilt = o.tilt ?? 0;
  const seed = o.seed ?? 1;
  const P = (x: number, y: number): Pt => add(o.c, rot([x * w, y * h], tilt));
  const j = (i: number, k = 0.025) => (hash(seed * 6.7 + i * 2.1) - 0.5) * 2 * k;
  const out: Shape[] = [];
  const body = spline(
    [
      P(-0.5, -0.5),
      P(-0.28, -0.45 + j(1)),
      P(0, -0.47),
      P(0.28, -0.45 + j(2)),
      P(0.5, -0.5),
      P(0.52 + j(3), -0.22),
      P(0.54 + j(4), 0.18),
      P(0.49, 0.46),
      P(0.02, 0.5 + 0.02 * sl),
      P(-0.49, 0.46),
      P(-0.54 + j(5), 0.18),
      P(-0.52 + j(6), -0.22),
    ],
    { closed: true, step: 5 },
  );
  out.push(shape(`${id}/body`, "sack.white", body, { depth: w * 0.32 }));
  // the weave: faint bands across it
  for (let i = 0; i < 11; i++) {
    const y = -0.36 + i * 0.075;
    const x = 0.47 - 0.04 * Math.abs(y) * 2;
    out.push(shape(`${id}/weave${i}`, "sack.weave", [P(-x, y - 0.006), P(x, y - 0.006), P(x, y + 0.006), P(-x, y + 0.006)], { ...flat, opacity: 0.45 }));
  }
  // folds from the corners, the sag at the bottom
  out.push(shape(`${id}/foldL`, "sack.white", [P(-0.44, -0.44), P(-0.2, -0.1), P(-0.08, 0.06), P(-0.24, -0.14)], { ...flat, tone: "shade", opacity: 0.6 }));
  out.push(shape(`${id}/foldR`, "sack.white", [P(0.44, -0.44), P(0.26, -0.12), P(0.14, 0.02), P(0.3, -0.16)], { ...flat, tone: "shade", opacity: 0.6 }));
  out.push(shape(`${id}/sag`, "sack.white", spline([P(-0.4, 0.36), P(0, 0.42), P(0.4, 0.36), P(0.3, 0.47), P(-0.3, 0.47)], { closed: true, step: 4 }), { ...flat, tone: "shade", opacity: 0.55 }));
  // the stitched seam along the top, and the two ears
  out.push(shape(`${id}/seam`, "sack.tie", capsule(P(-0.46, -0.42), P(0.46, -0.42), 2.2, 2.2, 3), { ...flat, opacity: 0.9 }));
  for (let i = 0; i < 9; i++) out.push(shape(`${id}/st${i}`, "sack.tie", capsule(P(-0.4 + i * 0.1, -0.445), P(-0.37 + i * 0.1, -0.395), 1.4, 1.4, 2), { ...flat, tone: "shade" }));
  out.push(shape(`${id}/earL`, "sack.white", ellipse(P(-0.49, -0.48), 0.05 * w, 0.035 * h, tilt - 0.6, 2), { ...flat, tone: "light" }));
  out.push(shape(`${id}/earR`, "sack.white", ellipse(P(0.49, -0.48), 0.05 * w, 0.035 * h, tilt + 0.6, 2), { ...flat, tone: "light" }));
  return { shapes: out, top: P(0, -0.5), bottom: P(0, 0.5), grips: { L: P(-0.5, -0.42), R: P(0.5, -0.42) } };
}
