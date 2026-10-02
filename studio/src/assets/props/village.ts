// Things of a village lane in Bihar: a tin trunk, a rolled degree, a hand pump, a straw stack, dung cakes drying on a
// wall, a small hut with a rail to hang bags from, a white woven sack (a stand-in until the shared mushroom props
// land), and the birds that cross a morning sky. Library pieces: no words and no film's text in any of them.
// Sizes are in `u`, px per head-height of a person standing beside the thing.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, roundRect, spline, stroke } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const VILLAGE_PROPS_PALETTE: Palette = {
  "vp.trunk": "#4f7192",
  "vp.trunk.band": "#c7a24c",
  "vp.trunk.edge": "#35506b",
  "vp.paper": "#f2ead6",
  "vp.ribbon": "#b8362f",
  "vp.pump": "#3f5560",
  "vp.pump.light": "#6f8790",
  "vp.cement": "#bcb09c",
  "vp.water": "#d3e6ec",
  "vp.straw": "#ddb866",
  "vp.straw.dark": "#b48d47",
  "vp.straw.light": "#f0d48e",
  "vp.dung": "#6d5036",
  "vp.hut.thatch": "#c29e58",
  "vp.hut.wall": "#c99569",
  "vp.hut.dark": "#33251f",
  "vp.rope": "#d8c69a",
  "vp.pole": "#7a5a3c",
  "vp.sack": "#f1efe7",
  "vp.sack.weave": "#d6d2c5",
  "vp.sack.seam": "#a8a192",
  "vp.bird": "#3a3034",
};

const flat = { form: "flat", ink: 0, paper: false } as const;
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * A blue tin trunk with brass bands, a hasp and a handle on the lid. `c` is the middle of its bottom edge;
 * the trunk turns about it by `tilt`. It is 1.3 u long and 0.72 u high.
 */
export function tinTrunk(id: string, o: { c: Pt; u: number; tilt?: number }): Shape[] {
  const { c, u } = o;
  const a = o.tilt ?? 0;
  const P = (x: number, y: number): Pt => add(c, rot([x * u, y * u], a));
  const W = 0.65;
  const H = 0.72;
  const out: Shape[] = [];
  out.push(shape(`${id}/body`, "vp.trunk", [P(-W, 0), P(-W, -H + 0.2), P(W, -H + 0.2), P(W, 0)], { form: "plane", facing: [0, 0.2] }));
  out.push(shape(`${id}/lid`, "vp.trunk", [P(-W - 0.02, -H + 0.21), P(-W + 0.02, -H), P(W - 0.02, -H), P(W + 0.02, -H + 0.21)], { form: "plane", facing: [0, -1] }));
  out.push(shape(`${id}/lid.edge`, "vp.trunk.edge", [P(-W - 0.02, -H + 0.19), P(W + 0.02, -H + 0.19), P(W + 0.02, -H + 0.23), P(-W - 0.02, -H + 0.23)], flat));
  for (const bx of [-0.42, 0.42]) out.push(shape(`${id}/band${bx > 0 ? "R" : "L"}`, "vp.trunk.band", [P(bx - 0.045, 0), P(bx - 0.045, -H + 0.01), P(bx + 0.045, -H + 0.01), P(bx + 0.045, 0)], { ...flat, opacity: 0.9 }));
  out.push(shape(`${id}/foot`, "vp.trunk.edge", [P(-W, 0), P(-W, -0.05), P(W, -0.05), P(W, 0)], flat));
  out.push(shape(`${id}/hasp`, "vp.trunk.band", roundRect(P(0, -H + 0.26), 0.06 * u, 0.09 * u, 0.02 * u, a), { ...flat, ink: 0.5 }));
  out.push(shape(`${id}/lock`, "vp.trunk.edge", ellipse(P(0, -H + 0.36), 0.035 * u, 0.045 * u, a, 3), flat));
  out.push(shape(`${id}/handle`, "vp.trunk.edge", stroke([P(-0.16, -H), P(-0.12, -H - 0.07), P(0.12, -H - 0.07), P(0.16, -H)], () => 0.018 * u, true, 3), flat));
  return out;
}
/** Where a hand takes the trunk's handle. */
export function trunkHandle(o: { c: Pt; u: number; tilt?: number }): Pt {
  return add(o.c, rot([0, -0.79 * o.u], o.tilt ?? 0));
}

/** A rolled degree tied with a red ribbon, from end `a` to end `b`. */
export function rolledDegree(id: string, a: Pt, b: Pt, u: number): Shape[] {
  const r = 0.07 * u;
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const along = (k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return [
    shape(`${id}/roll`, "vp.paper", capsule(a, b, r, r, 4), { depth: r * 1.2 }),
    shape(`${id}/end`, "vp.paper", ellipse(b, r * 0.45, r * 0.95, ang, 3), { form: "flat", tone: "shade", ink: 0.4, paper: false }),
    shape(`${id}/curl`, "vp.paper", ellipse(b, r * 0.2, r * 0.45, ang, 3), { form: "flat", tone: "deep", ink: 0, paper: false, opacity: 0.6 }),
    shape(`${id}/ribbon`, "vp.ribbon", capsule(along(0.46), along(0.54), r * 1.08, r * 1.08, 3), { form: "flat", ink: 0.5, paper: false }),
    shape(`${id}/tail`, "vp.ribbon", [add(m, rot([0, r], ang)), add(m, rot([-0.06 * u, r + 0.16 * u], ang)), add(m, rot([0.02 * u, r + 0.14 * u], ang)), add(m, rot([0.03 * u, r], ang))], { ...flat }),
  ];
}

/**
 * A village hand pump on its cement platform. `dir` is the way the spout points (1 = screen right); the handle
 * runs the other way. `handle` 0 = up (at rest), 1 = pushed down. Returns where a hand grips the handle and the
 * mouth of the spout.
 */
export function handPump(id: string, o: { x: number; ground: number; u: number; dir?: 1 | -1; handle?: number; water?: number }): { shapes: Shape[]; grip: Pt; mouth: Pt } {
  const { x, ground: g, u } = o;
  const d = o.dir ?? 1;
  const out: Shape[] = [];
  out.push(shape(`${id}/slab`, "vp.cement", [[x - 0.95 * u, g + 0.04 * u], [x - 0.86 * u, g - 0.2 * u], [x + 0.86 * u, g - 0.2 * u], [x + 0.95 * u, g + 0.04 * u]], { form: "plane", facing: [0, -1] }));
  out.push(shape(`${id}/slab.lip`, "vp.cement", box(x - 0.95 * u, g - 0.02 * u, x + 0.95 * u, g + 0.06 * u), { ...flat, tone: "shade" }));
  out.push(shape(`${id}/drain`, "vp.water", ellipse([x + d * 0.42 * u, g - 0.1 * u], 0.3 * u, 0.05 * u, 0, 4), { ...flat, opacity: 0.55 }));
  // the stand: a pipe on a flanged foot
  out.push(shape(`${id}/foot`, "vp.pump", [[x - 0.22 * u, g - 0.18 * u], [x - 0.13 * u, g - 0.36 * u], [x + 0.13 * u, g - 0.36 * u], [x + 0.22 * u, g - 0.18 * u]], { depth: 0.1 * u }));
  out.push(shape(`${id}/pipe`, "vp.pump", box(x - 0.09 * u, g - 1.9 * u, x + 0.09 * u, g - 0.3 * u), { depth: 0.09 * u }));
  // the head, the spout and the water
  const top = g - 2.0 * u;
  out.push(shape(`${id}/head`, "vp.pump", roundRect([x, top - 0.18 * u], 0.17 * u, 0.3 * u, 0.04 * u), { depth: 0.14 * u }));
  out.push(shape(`${id}/cap`, "vp.pump.light", roundRect([x, top - 0.5 * u], 0.2 * u, 0.04 * u, 0.02 * u), { ...flat }));
  const mouth: Pt = [x + d * 0.62 * u, top + 0.02 * u];
  out.push(shape(`${id}/spout`, "vp.pump", stroke([[x + d * 0.1 * u, top - 0.12 * u], [x + d * 0.4 * u, top - 0.1 * u], [x + d * 0.58 * u, top - 0.04 * u], mouth], (k) => (0.075 - 0.02 * k) * u, true, 3), { depth: 0.05 * u }));
  if ((o.water ?? 0) > 0.01) {
    const w = o.water ?? 0;
    out.push(shape(`${id}/stream`, "vp.water", stroke([mouth, [mouth[0] + d * 0.03 * u, mouth[1] + 0.9 * u * w], [mouth[0] + d * 0.05 * u, g - 0.2 * u]], () => 0.035 * u * w, true, 3), { ...flat, opacity: 0.8 }));
  }
  // the handle turns on a pin at the top of the head
  const pin: Pt = [x - d * 0.12 * u, top - 0.42 * u];
  const ang = -d * (0.32 - 0.62 * (o.handle ?? 0));
  const H = (k: number, off: number): Pt => add(pin, rot([-d * k * u, off * u], ang));
  out.push(shape(`${id}/handle`, "vp.pump", stroke([H(-0.1, 0), H(0.5, 0.02), H(1.2, 0.04), H(1.55, 0.08)], (k) => (0.05 - 0.018 * k) * u, true, 3), { depth: 0.05 * u }));
  out.push(shape(`${id}/grip`, "vp.pump.light", capsule(H(1.36, 0.06), H(1.58, 0.08), 0.045 * u, 0.04 * u, 3), { ...flat, opacity: 0.8 }));
  out.push(shape(`${id}/pin`, "vp.pump.light", ellipse(pin, 0.04 * u, 0.04 * u, 0, 3), flat));
  return { shapes: out, grip: H(1.45, 0.07), mouth };
}

/** A stack of paddy straw: a rounded heap with a twisted cap, streaks of straw, and loose straws at its foot. */
export function strawStack(id: string, o: { x: number; ground: number; w: number; h: number; seed?: number }): Shape[] {
  const { x, ground: g, w, h } = o;
  const seed = o.seed ?? 1;
  const j = (i: number, k: number) => (hash(seed * 3.3 + i * 1.7) - 0.5) * 2 * k;
  const out: Shape[] = [];
  const body = spline(
    [
      [x - w * 0.5, g + 4],
      [x - w * (0.49 + j(1, 0.02)), g - h * 0.35],
      [x - w * (0.4 + j(2, 0.02)), g - h * 0.7],
      [x - w * 0.22, g - h * (0.92 + j(3, 0.02))],
      [x, g - h],
      [x + w * 0.22, g - h * (0.93 + j(4, 0.02))],
      [x + w * (0.41 + j(5, 0.02)), g - h * 0.7],
      [x + w * (0.5 + j(6, 0.02)), g - h * 0.33],
      [x + w * 0.52, g + 4],
    ],
    { closed: true, step: 6 },
  );
  out.push(shape(`${id}/body`, "vp.straw", body, { depth: w * 0.3 }));
  // streaks that follow the heap's curve
  for (let i = 0; i < 14; i++) {
    const fx = -0.42 + 0.84 * hash(seed * 7.1 + i * 2.3);
    const fy = 0.18 + 0.68 * hash(seed * 5.3 + i * 1.1);
    const lim = Math.sqrt(Math.max(0.02, 1 - Math.pow(fy, 1.6))) * 0.48;
    if (Math.abs(fx) > lim) continue;
    const cx = x + fx * w;
    const cy = g - fy * h;
    const len = (0.08 + 0.1 * hash(seed + i * 3.9)) * w;
    const tilt = fx * 1.1;
    out.push(shape(`${id}/streak${i}`, i % 3 ? "vp.straw.dark" : "vp.straw.light", stroke([add([cx, cy], rot([-len / 2, 0], tilt + Math.PI / 2)), add([cx, cy], rot([len / 2, 0], tilt + Math.PI / 2))], () => 2.2, true, 2), { ...flat, opacity: 0.55 }));
  }
  // the cap
  out.push(shape(`${id}/cap`, "vp.straw.dark", spline([[x - w * 0.14, g - h * 0.95], [x - w * 0.05, g - h * 1.1], [x + w * 0.02, g - h * 1.16], [x + w * 0.08, g - h * 1.08], [x + w * 0.15, g - h * 0.96]], { closed: true, step: 4 }), { depth: w * 0.06 }));
  // loose straws on the ground
  for (let i = 0; i < 8; i++) {
    const sx = x + (hash(seed * 2.9 + i) - 0.5) * w * 1.3;
    const a = (hash(seed * 4.1 + i * 2.2) - 0.5) * 0.6;
    const len = (0.06 + 0.07 * hash(i + seed)) * w;
    out.push(shape(`${id}/loose${i}`, "vp.straw.light", stroke([[sx - len * Math.cos(a), g + 6 + 10 * hash(i * 7 + seed) - len * Math.sin(a)], [sx + len * Math.cos(a), g + 6 + 10 * hash(i * 7 + seed) + len * Math.sin(a)]], () => 1.8, true, 2), { ...flat, opacity: 0.85 }));
  }
  return out;
}

/** A handful of straw, in a fist or falling from one: a loose bundle of strands about `c`. */
export function strawHandful(id: string, c: Pt, u: number, spread = 0.3, seed = 1): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + 2.4 * hash(seed * 1.9 + i * 3.1) * (0.4 + spread);
    const len = (0.18 + 0.16 * hash(seed + i * 2.7)) * u;
    const off = (hash(seed * 4.4 + i) - 0.5) * 0.12 * u;
    out.push(shape(`${id}/s${i}`, i % 3 ? "vp.straw" : "vp.straw.dark", stroke([add(c, rot([-len * 0.5, off], a)), add(c, rot([len * 0.5, off], a))], () => 1.9, true, 2), { ...flat }));
  }
  return out;
}

/**
 * Dung cakes slapped onto a wall to dry: round flat patties in loose rows, each with the marks of the fingers that
 * pressed it on. `x0, y0` is the middle of the first one; `r` is a cake's radius.
 */
export function dungCakes(id: string, o: { x0: number; y0: number; cols: number; rows: number; r: number; seed?: number; gap?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const out: Shape[] = [];
  const step = o.r * (o.gap ?? 2.5);
  for (let rI = 0; rI < o.rows; rI++) {
    for (let cI = 0; cI < o.cols; cI++) {
      const k = rI * o.cols + cI;
      if (hash(seed * 9.7 + k * 1.3) < 0.14) continue;
      const cx = o.x0 + cI * step + (rI % 2 ? step * 0.5 : 0) + (hash(seed + k * 2.1) - 0.5) * o.r * 0.5;
      const cy = o.y0 + rI * step * 0.86 + (hash(seed * 3.1 + k) - 0.5) * o.r * 0.4;
      const r = o.r * (0.86 + 0.24 * hash(seed * 5.5 + k));
      out.push(shape(`${id}/c${k}`, "vp.dung", ellipse([cx, cy], r, r * 0.94, 0, 4), { depth: r * 0.5 }));
      for (let f = 0; f < 4; f++) {
        const fx = cx + (f - 1.5) * r * 0.32;
        out.push(shape(`${id}/c${k}.f${f}`, "vp.dung", capsule([fx - r * 0.08, cy - r * 0.38], [fx + r * 0.05, cy + r * 0.3], r * 0.07, r * 0.06, 2), { ...flat, tone: "deep", opacity: 0.5 }));
      }
    }
  }
  return out;
}

/**
 * A small mud hut with a thatched roof, a dark doorway, and a bamboo rail under the eave. `hooks` are the points on
 * the rail where something can hang (grow bags).
 */
export function smallHut(id: string, o: { x: number; foot: number; u: number; seed?: number; hooks?: number }): { shapes: Shape[]; hooks: Pt[]; door: { x0: number; x1: number; y0: number; y1: number } } {
  const { x, foot: g, u } = o;
  const seed = o.seed ?? 1;
  const n = o.hooks ?? 3;
  const out: Shape[] = [];
  const W = 1.5 * u;
  const eave = g - 2.0 * u;
  out.push(shape(`${id}/wall`, "vp.hut.wall", box(x - W, eave, x + W, g + 4), { ...flat }));
  out.push(shape(`${id}/plinth`, "vp.hut.wall", box(x - W, g - 0.3 * u, x + W, g + 4), { ...flat, tone: "shade" }));
  const door = { x0: x - W * 0.75, x1: x - W * 0.75 + 0.75 * u, y0: g - 1.55 * u, y1: g };
  out.push(shape(`${id}/door`, "vp.hut.dark", box(door.x0, door.y0, door.x1, door.y1), { ...flat }));
  out.push(shape(`${id}/shade`, "vp.hut.wall", box(x - W, eave, x + W, eave + 0.3 * u), { ...flat, tone: "deep", opacity: 0.55 }));
  // the thatch: a thick rounded mass with a ragged fringe
  const t0 = eave - 1.15 * u;
  const roof: Pt[] = [[x - W - 0.4 * u, eave + 0.12 * u], [x - W * 0.5, t0 + 0.1 * u], [x + (hash(seed) - 0.5) * 0.3 * u, t0], [x + W * 0.5, t0 + 0.08 * u], [x + W + 0.4 * u, eave + 0.12 * u]];
  out.push(shape(`${id}/thatch`, "vp.hut.thatch", spline(roof, { closed: true, step: 5, tension: 0.3 }), { form: "plane", facing: [0, -1] }));
  for (let i = 0; i < 12; i++) {
    const fx = x - W - 0.35 * u + (i / 11) * (2 * W + 0.7 * u);
    const len = (0.12 + 0.14 * hash(seed * 2.2 + i)) * u;
    out.push(shape(`${id}/fringe${i}`, "vp.hut.thatch", [[fx - 0.09 * u, eave + 0.08 * u], [fx + 0.09 * u, eave + 0.08 * u], [fx + 0.01 * u, eave + 0.1 * u + len]], { ...flat, tone: "shade" }));
  }
  for (let i = 0; i < 5; i++) out.push(shape(`${id}/streak${i}`, "vp.hut.thatch", stroke([[x - W * 0.8 + i * W * 0.4, t0 + 0.25 * u], [x - W * 0.95 + i * W * 0.45, eave - 0.05 * u]], () => 2.4, true, 2), { ...flat, tone: "shade", opacity: 0.6 }));
  // the rail, and its hooks
  const railY = eave + 0.35 * u;
  out.push(shape(`${id}/rail`, "vp.pole", capsule([x - W * 0.2, railY], [x + W + 0.3 * u, railY], 0.035 * u, 0.035 * u, 3), { ...flat }));
  const hooks: Pt[] = [];
  for (let i = 0; i < n; i++) hooks.push([x - W * 0.05 + ((i + 0.5) / n) * (W * 1.2 + 0.3 * u), railY]);
  out.push(shape(`${id}/post`, "vp.pole", box(x + W + 0.24 * u, eave + 0.05 * u, x + W + 0.32 * u, g + 2), { ...flat }));
  return { shapes: out, hooks, door };
}

/**
 * A white woven polypropylene sack, stuffed full: pillow-shaped, sewn across the top with two ears. `c` is its
 * middle; it is `w` wide and `h` tall and turns by `tilt`. (Stand-in for the shared spawn sack.)
 */
export function wovenSack(id: string, c: Pt, w: number, h: number, tilt = 0, seed = 1): Shape[] {
  const S = (x: number, y: number): Pt => add(c, rot([x * w, y * h], tilt));
  const j = (i: number) => (hash(seed * 6.1 + i * 2.7) - 0.5) * 0.04;
  const out: Shape[] = [];
  const body = spline(
    [S(-0.5, -0.44), S(-0.3 + j(1), -0.5), S(0, -0.47), S(0.3 + j(2), -0.5), S(0.5, -0.44), S(0.53 + j(3), -0.1), S(0.5, 0.3), S(0.42, 0.5), S(0, 0.53), S(-0.42, 0.5), S(-0.5, 0.3), S(-0.53 + j(4), -0.1)],
    { closed: true, step: 5 },
  );
  out.push(shape(`${id}/body`, "vp.sack", body, { depth: w * 0.26 }));
  // the weave: faint bands across
  for (let i = 0; i < 6; i++) {
    const y = -0.36 + i * 0.15;
    out.push(shape(`${id}/weave${i}`, "vp.sack.weave", [S(-0.47, y), S(0.47, y - 0.01), S(0.47, y + 0.02), S(-0.47, y + 0.03)], { ...flat, opacity: 0.55 }));
  }
  // the sewn top and its two ears
  out.push(shape(`${id}/seam`, "vp.sack.seam", [S(-0.48, -0.42), S(0.48, -0.42), S(0.48, -0.385), S(-0.48, -0.385)], { ...flat, opacity: 0.8 }));
  out.push(shape(`${id}/earL`, "vp.sack", [S(-0.5, -0.44), S(-0.62, -0.56), S(-0.42, -0.5)], { ...flat, tone: "shade" }));
  out.push(shape(`${id}/earR`, "vp.sack", [S(0.5, -0.44), S(0.42, -0.5), S(0.62, -0.56)], { ...flat, tone: "shade" }));
  out.push(shape(`${id}/sag`, "vp.sack", spline([S(-0.4, 0.36), S(0, 0.44), S(0.4, 0.36), S(0.3, 0.48), S(-0.3, 0.48)], { closed: true, step: 4 }), { ...flat, tone: "shade", opacity: 0.5 }));
  return out;
}

/** A small bird seen from far off: a body and two wings. `flap` -1..1 (1 = wings up). */
export function bird(id: string, c: Pt, size: number, flap: number, dir: 1 | -1 = 1): Shape[] {
  const s = size;
  const up = -flap * 0.55 * s;
  return [
    shape(`${id}/body`, "vp.bird", ellipse(c, 0.28 * s, 0.09 * s, 0, 3), flat),
    shape(`${id}/wingL`, "vp.bird", [[c[0] - 0.05 * s, c[1]], [c[0] - 0.45 * s, c[1] + up], [c[0] - 0.62 * s * dir * dir, c[1] + up * 0.8 + 0.06 * s], [c[0] + 0.05 * s, c[1] + 0.04 * s]], flat),
    shape(`${id}/wingR`, "vp.bird", [[c[0] + 0.05 * s, c[1]], [c[0] + 0.45 * s, c[1] + up], [c[0] + 0.62 * s, c[1] + up * 0.8 + 0.06 * s], [c[0] - 0.05 * s, c[1] + 0.04 * s]], flat),
  ];
}
