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
  oyster: "#e9d6a8",
  "oyster.gill": "#c4a979",
  "spawn.glass": "#c4dcd8",
  "spawn.grain": "#c99f58",
  "spawn.myc": "#f8f6ef",
  "spawn.bad": "#87925f",
  "spawn.plug": "#f1ebdc",
  "spawn.glint": "#ffffff",
  "sack.white": "#ebe7dc",
  "sack.weave": "#cfc8b8",
  "sack.tie": "#b2925f",
  "lamp.metal": "#8a3a2a",
  "lamp.glass": "#dfe8e2",
  "lamp.flame": "#ffcf6e",
  "lamp.wire": "#3a3532",
  "rack.frame": "#55635f",
  "rack.shelf": "#9a8a70",
  "mush.drum": "#8d969a",
  "mush.drum.band": "#5d666b",
  "mush.steam": "#f4f4f0",
  "mush.tray": "#b9c0c2",
  "mush.lota": "#c4933a",
  "mush.water": "#cfe6ee",
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const flat = { form: "flat", ink: 0, paper: false } as const;

/**
 * One oyster cap seen from the side: a fan from a narrow stem at `base`, spreading `r` toward `dir` (radians, in the
 * bag's own frame), its far edge wavy; `squash` flattens it top to bottom; `lift` keeps only the upper rim band.
 */
function fanPts(base: Pt, dir: number, r: number, squash: number, turn: number, lift = 0): Pt[] {
  const pts: Pt[] = [];
  const n = 12;
  const side = Math.cos(dir) >= 0 ? 1 : -1;
  const local = (p: Pt): Pt => add(base, rot(p, turn));
  pts.push(local([-side * 0.02 * r, -0.06 * r]));
  for (let i = 0; i <= n; i++) {
    const a = dir - 0.8 + (1.6 * i) / n;
    const rr = r * (1 + 0.06 * Math.sin(i * 2.1));
    pts.push(local([rr * Math.cos(a), rr * Math.sin(a) * squash - lift * r]));
  }
  pts.push(local([-side * 0.02 * r, 0.06 * r]));
  return side * squash >= 0 ? pts : pts.reverse();
}

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

  // oyster mushrooms: cream, fan-shaped caps in overlapping shelves out of each hole, one cluster after another
  if (sprout > 0.01) {
    HOLES.forEach(([s, y], k) => {
      const g = clamp01((sprout - 0.1 * k) / 0.55);
      if (g < 0.03) return;
      const base = s === 0 ? S(0.05, y) : S(s * 0.46, y);
      const r0 = 0.21 * o.u * sc * g;
      const op = Math.min(1, g * 3);
      // [direction in the bag's frame, size, offset up/down]: the upper shelf behind, the lower in front
      const fans: [number, number, number][] =
        s === 0
          ? [
              [Math.PI + 0.35, 0.8, -0.06],
              [-0.35, 0.8, -0.06],
              [-Math.PI / 2, 0.55, -0.1],
            ]
          : [
              [s > 0 ? -0.5 : Math.PI + 0.5, 0.72, -0.13],
              [s > 0 ? -0.15 : Math.PI + 0.15, 1, 0],
              [s > 0 ? 0.12 : Math.PI - 0.12, 0.66, 0.11],
            ];
      fans.forEach(([dir, size, dy], c) => {
        const b = add(base, rot([0, dy * o.u * sc * g], sw));
        const r = r0 * size;
        out.push(shape(`${id}/gill${k}_${c}`, "oyster.gill", fanPts(add(b, rot([0, 0.12 * r], sw)), dir, r * 0.94, 0.42, sw), { ...flat, opacity: op }));
        out.push(shape(`${id}/cap${k}_${c}`, "oyster", fanPts(b, dir, r, 0.4, sw), { depth: r * 0.45, ink: 0.6, opacity: op }));
        out.push(shape(`${id}/rim${k}_${c}`, "oyster", fanPts(b, dir, r * 0.97, 0.12, sw, 0.18), { ...flat, tone: "light", opacity: 0.8 * op }));
      });
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
  /** few shapes, for bottles by the dozen on a rack */
  lite?: boolean;
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
  if (o.lite) {
    out.push(shape(`${id}/bad`, "spawn.bad", grain, { ...flat, opacity: 0.8 * bad }));
    out.push(shape(`${id}/myc`, "spawn.myc", roundedPoly([{ p: B(-0.36, 0.14), r: 3 }, { p: B(0.36, 0.2), r: 3 }, { p: B(0.3, 0.55), r: 3 }, { p: B(-0.34, 0.5), r: 3 }], 3), { ...flat, opacity: 0.6 * myc }));
    out.push(shape(`${id}/glint`, "spawn.glint", capsule(B(-0.32, 0.12), B(-0.32, 0.55), 1.6 * sc, 2 * sc, 2), { ...flat, opacity: 0.55 }));
    out.push(shape(`${id}/plug`, "spawn.plug", ellipse(B(0, 1.0), 0.2 * w, 0.075 * h, tilt, 3), { ...flat, tone: "light" }));
    return { shapes: out, top: B(0, 1.02), mid: B(0, 0.4), at: o.at, outline: glass };
  }
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

// ---------------------------------------------------------------------------------------------------------------
// The things of the shed's nights and of the lab: a hurricane lamp, a rack of bottles, the steaming drum, a tray,
// a lota of water
// ---------------------------------------------------------------------------------------------------------------

/** A hurricane lantern standing on its base: tank, glass globe, wire guards, cap and bail. `lit` 0..1. */
export function hurricaneLamp(id: string, o: { at: Pt; u: number; lit: number }): { shapes: Shape[]; flame: Pt } {
  const { u } = o;
  const P = (x: number, y: number): Pt => [o.at[0] + x * u, o.at[1] - y * u];
  const lit = clamp01(o.lit);
  const out: Shape[] = [
    shape(`${id}/bail`, "lamp.wire", capsule(P(-0.17, 0.66), P(0, 0.82), 1.6, 1.6, 2), { ...flat }),
    shape(`${id}/bail2`, "lamp.wire", capsule(P(0, 0.82), P(0.17, 0.66), 1.6, 1.6, 2), { ...flat }),
    shape(`${id}/tank`, "lamp.metal", roundedPoly([{ p: P(-0.2, 0), r: 4 }, { p: P(0.2, 0), r: 4 }, { p: P(0.22, 0.1), r: 6 }, { p: P(0.12, 0.17), r: 4 }, { p: P(-0.12, 0.17), r: 4 }, { p: P(-0.22, 0.1), r: 6 }], 3), { depth: 0.12 * u }),
    shape(`${id}/globe`, "lamp.glass", ellipse(P(0, 0.36), 0.13 * u, 0.2 * u, 0, 4), { form: "flat", tone: "base", ink: 0.7, paper: false, opacity: 0.6 }),
  ];
  if (lit > 0.01) {
    out.push(shape(`${id}/globe.lit`, "lamp.flame", ellipse(P(0, 0.36), 0.12 * u, 0.19 * u, 0, 4), { ...flat, opacity: 0.55 * lit }));
    out.push(shape(`${id}/flame`, "lamp.flame", roundedPoly([{ p: P(0, 0.48), r: 1 }, { p: P(0.035, 0.37), r: 4 }, { p: P(0, 0.32), r: 3 }, { p: P(-0.035, 0.37), r: 4 }], 3), { ...flat, tone: "light", opacity: lit }));
  }
  out.push(shape(`${id}/wick`, "lamp.wire", roundRect(P(0, 0.31), 0.03 * u, 0.012 * u, 1), { ...flat }));
  for (const [i, x] of [-0.15, 0.15].entries()) out.push(shape(`${id}/guard${i}`, "lamp.wire", capsule(P(x, 0.17), P(x * 0.9, 0.58), 1.6, 1.4, 2), { ...flat }));
  out.push(shape(`${id}/cap`, "lamp.metal", [P(-0.12, 0.56), P(0.12, 0.56), P(0.07, 0.66), P(-0.07, 0.66)], { form: "plane", facing: [0, -1], ink: 0.6 }));
  out.push(shape(`${id}/glint`, "spawn.glint", capsule(P(-0.08, 0.28), P(-0.08, 0.44), 1.6, 1.6, 2), { ...flat, opacity: 0.5 }));
  return { shapes: out, flame: P(0, 0.4) };
}

export interface RackOut {
  shapes: Shape[];
  /** y of the top of each shelf, from the bottom one up */
  shelfY: number[];
  x0: number;
  x1: number;
}

/**
 * An iron rack of spawn bottles: two end frames, `shelves` planks, bottles standing on each.
 * `filled(shelf, i)` says whether a place holds a bottle (default: all); `x` is its middle, `ground` the floor.
 */
export function bottleRack(id: string, o: { x: number; ground: number; u: number; w?: number; shelves?: number; per?: number; filled?: (shelf: number, i: number) => boolean; seed?: number }): RackOut {
  const { u } = o;
  const w = (o.w ?? 1.9) * u;
  const n = o.shelves ?? 4;
  const per = o.per ?? 6;
  const top = o.ground - 4.3 * u;
  const x0 = o.x - w / 2;
  const x1 = o.x + w / 2;
  const out: Shape[] = [];
  const shelfY: number[] = [];
  for (const [i, x] of [x0, x1].entries()) out.push(shape(`${id}/post${i}`, "rack.frame", [[x - 4, top], [x + 4, top], [x + 4, o.ground], [x - 4, o.ground]], { form: "plane", facing: [-1, 0], ink: 0.6 }));
  for (let k = 0; k < n; k++) {
    const y = o.ground - 0.35 * u - k * ((o.ground - 0.35 * u - top - 0.2 * u) / (n - 1));
    shelfY.push(y);
    out.push(shape(`${id}/shelf${k}`, "rack.shelf", [[x0 - 6, y], [x1 + 6, y], [x1 + 6, y + 0.07 * u], [x0 - 6, y + 0.07 * u]], { form: "plane", facing: [0, -1], ink: 0.6 }));
    for (let i = 0; i < per; i++) {
      if (o.filled && !o.filled(k, i)) continue;
      const bx = x0 + ((i + 0.5) / per) * w;
      const b = spawnBottle(`${id}/b${k}_${i}`, { at: [bx, y], u, scale: 0.78, lite: true, myc: 0.5 + 0.5 * hash((o.seed ?? 1) * 3.1 + k * 7 + i) });
      out.push(...b.shapes);
    }
  }
  out.push(shape(`${id}/brace`, "rack.frame", [[x0, o.ground - 0.12 * u], [x1, o.ground - 0.12 * u], [x1, o.ground - 0.08 * u], [x0, o.ground - 0.08 * u]], { ...flat, tone: "shade" }));
  return { shapes: out, shelfY, x0, x1 };
}

/** The sterilising drum on its clay stove: `lid` 0..1 lifts and tips the lid; `steam` 0..1 how much steam; `phase` drives the puffs (pass time). */
export function steamDrum(id: string, o: { at: Pt; u: number; lid: number; steam: number; phase: number }): { shapes: Shape[]; lidGrip: Pt; mouth: Pt } {
  const { u } = o;
  const P = (x: number, y: number): Pt => [o.at[0] + x * u, o.at[1] - y * u];
  const out: Shape[] = [
    shape(`${id}/stove`, "wall", roundedPoly([{ p: P(-0.62, 0), r: 6 }, { p: P(0.62, 0), r: 6 }, { p: P(0.56, 0.5), r: 4 }, { p: P(-0.56, 0.5), r: 4 }], 3), { form: "plane", facing: [0, 0], ink: 0.6 }),
    shape(`${id}/mouth`, "mush.drum.band", roundRect(P(0, 0.2), 0.18 * u, 0.13 * u, 6), { ...flat, tone: "deep" }),
    shape(`${id}/body`, "mush.drum", roundedPoly([{ p: P(-0.5, 0.5), r: 4 }, { p: P(0.5, 0.5), r: 4 }, { p: P(0.5, 1.75), r: 4 }, { p: P(-0.5, 1.75), r: 4 }], 3), { depth: 0.35 * u }),
  ];
  for (const [i, y] of [0.72, 1.5].entries()) out.push(shape(`${id}/band${i}`, "mush.drum.band", roundRect(P(0, y), 0.51 * u, 0.035 * u, 2), { ...flat }));
  const lift = clamp01(o.lid);
  const lc = P(-0.25 * lift, 1.8 + 0.5 * lift);
  const tilt = -0.5 * lift;
  out.push(shape(`${id}/lid`, "mush.drum", roundRect(lc, 0.54 * u, 0.06 * u, 6, tilt), { form: "plane", facing: [0, -1], ink: 0.6 }));
  const knob = add(lc, rot([0, -0.1 * u], tilt));
  out.push(shape(`${id}/knob`, "mush.drum.band", roundRect(knob, 0.08 * u, 0.04 * u, 3, tilt), { ...flat }));
  const st = clamp01(o.steam);
  if (st > 0.01) {
    for (let i = 0; i < 6; i++) {
      const k = (o.phase * 0.55 + i / 6) % 1;
      const p = P(-0.3 + 0.6 * hash(i * 2.7) + 0.15 * Math.sin(o.phase + i), 1.85 + 1.6 * k);
      const r = (0.12 + 0.22 * k) * u;
      out.push(shape(`${id}/steam${i}`, "mush.steam", ellipse(p, r, r * 0.8, i, 4), { ...flat, opacity: st * 0.5 * Math.sin(Math.PI * k) }));
    }
  }
  return { shapes: out, lidGrip: add(knob, [0.04 * u, -0.02 * u]), mouth: P(0, 1.8) };
}

/** A metal tray of four spawn bottles, carried level; `c` is the middle of its underside. */
export function bottleTray(id: string, o: { c: Pt; u: number; tilt?: number }): Shape[] {
  const { u } = o;
  const tilt = o.tilt ?? 0;
  const P = (x: number, y: number): Pt => add(o.c, rot([x * u, -y * u], tilt));
  const out: Shape[] = [];
  for (let i = 0; i < 4; i++) out.push(...spawnBottle(`${id}/b${i}`, { at: P(-0.36 + i * 0.24, 0.05), u, scale: 0.78, lite: true, tilt, myc: 0.2 }).shapes);
  out.push(shape(`${id}/tray`, "mush.tray", [P(-0.52, 0.09), P(0.52, 0.09), P(0.48, 0), P(-0.48, 0)], { form: "plane", facing: [0, 0], ink: 0.6 }));
  return out;
}

/** A brass lota (water pot); `at` is the middle of its base, `tilt` tips it to pour. Returns the lip it pours from. */
export function lota(id: string, o: { at: Pt; u: number; tilt?: number }): { shapes: Shape[]; lip: Pt } {
  const { u } = o;
  const tilt = o.tilt ?? 0;
  const P = (x: number, y: number): Pt => add(o.at, rot([x * u, -y * u], tilt));
  const out: Shape[] = [
    shape(`${id}/body`, "mush.lota", spline([P(-0.08, 0), P(0.08, 0), P(0.2, 0.12), P(0.16, 0.27), P(0.07, 0.33), P(-0.07, 0.33), P(-0.16, 0.27), P(-0.2, 0.12)], { closed: true, step: 4 }), { depth: 0.12 * u }),
    shape(`${id}/neck`, "mush.lota", roundRect(P(0, 0.37), 0.065 * u, 0.04 * u, 2, tilt), { ...flat, tone: "shade" }),
    shape(`${id}/rim`, "mush.lota", roundRect(P(0, 0.41), 0.1 * u, 0.02 * u, 2, tilt), { ...flat, tone: "light" }),
  ];
  return { shapes: out, lip: P(-0.1, 0.42) };
}
