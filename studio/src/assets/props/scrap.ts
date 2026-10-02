// Scrap: plates, pipes, wheel rims, drums, gears, corrugated sheet, bundles of rod, and heaps made of them.
// A heap is a dark mound with pieces lying on it, placed by seed so it is the same heap in every frame.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, roundRect, spline } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const SCRAP_PALETTE: Palette = {
  "scrap.mass": "#5d3b2d",
  "scrap.rust": "#a8552e",
  "scrap.rust2": "#7e3c25",
  "scrap.steel": "#808b93",
  "scrap.steel2": "#56606a",
  "scrap.ochre": "#c58a2c",
  "scrap.teal": "#3f7873",
  "scrap.hole": "#2c2123",
  // the same things close to the lens and in shade
  "scrapN.mass": "#2f2325",
  "scrapN.rust": "#603226",
  "scrapN.rust2": "#472720",
  "scrapN.steel": "#454d57",
  "scrapN.steel2": "#323841",
  "scrapN.ochre": "#7a582b",
  "scrapN.teal": "#2a4c4d",
  "scrapN.hole": "#1d1618",
};

type Mk = (name: string) => string;
const R = (c: Pt, a: number) => (x: number, y: number): Pt => add(c, rot([x, y], a));

/** A flat plate lying at an angle, with its thickness showing along the lower edge. */
export function plate(id: string, c: Pt, w: number, h: number, a: number, mat: string): Shape[] {
  const P = R(c, a);
  return [
    shape(`${id}/edge`, mat, [P(-w / 2, h / 2 - 1), P(w / 2, h / 2 - 1), P(w / 2 + 3, h / 2 + 7), P(-w / 2 + 3, h / 2 + 7)], { form: "flat", tone: "deep", ink: 0.5, paper: false }),
    shape(`${id}/face`, mat, [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)], { form: "plane", facing: rot([0, -1], a) }),
  ];
}

/** A length of pipe with its open end toward us. */
export function pipe(id: string, c: Pt, len: number, r: number, a: number, mat: string, hole: string): Shape[] {
  const P = R(c, a);
  const end = P(len / 2, 0);
  return [
    shape(`${id}/body`, mat, capsule(P(-len / 2, 0), end, r, r, 4), { depth: r * 0.8 }),
    shape(`${id}/mouth`, mat, ellipse(end, r * 0.55, r, a, 6), { form: "flat", tone: "light", ink: 0.5, paper: false }),
    shape(`${id}/bore`, hole, ellipse(end, r * 0.36, r * 0.7, a, 6), { form: "flat", ink: 0, paper: false }),
  ];
}

/** A wheel rim seen at an angle: a ring with a hub. */
export function rim(id: string, c: Pt, r: number, squash: number, a: number, mat: string, hole: string): Shape[] {
  return [
    shape(`${id}/tyre`, mat, ellipse(c, r, r * squash, a, 5), { depth: r * 0.3 }),
    shape(`${id}/well`, hole, ellipse(c, r * 0.72, r * squash * 0.72, a, 5), { form: "flat", ink: 0.4, paper: false }),
    shape(`${id}/disc`, mat, ellipse(add(c, rot([r * 0.06, r * 0.04], a)), r * 0.5, r * squash * 0.5, a, 6), { form: "flat", tone: "shade", ink: 0, paper: false }),
    shape(`${id}/hub`, hole, ellipse(add(c, rot([r * 0.06, r * 0.04], a)), r * 0.16, r * squash * 0.16, a, 8), { form: "flat", ink: 0, paper: false }),
  ];
}

/** An oil drum on its side or standing, with two ribs. */
export function drum(id: string, c: Pt, w: number, h: number, a: number, mat: string, hole: string): Shape[] {
  const P = R(c, a);
  const out: Shape[] = [shape(`${id}/body`, mat, roundRect(c, w / 2, h / 2, w * 0.12, a), { depth: w * 0.3 })];
  for (const [i, f] of [-0.2, 0.2].entries()) {
    out.push(shape(`${id}/rib${i}`, mat, [P(-w / 2, f * h - 3), P(w / 2, f * h - 3), P(w / 2, f * h + 3), P(-w / 2, f * h + 3)], { form: "flat", tone: "shade", ink: 0, paper: false }));
  }
  out.push(shape(`${id}/top`, mat, ellipse(P(0, -h / 2 + 2), w / 2 - 2, w * 0.13, a, 5), { form: "flat", tone: "light", ink: 0.5, paper: false }));
  out.push(shape(`${id}/bung`, hole, ellipse(P(w * 0.2, -h / 2 + 2), w * 0.07, w * 0.03, a, 8), { form: "flat", ink: 0, paper: false }));
  return out;
}

/** A gear wheel lying flat-on. */
export function gear(id: string, c: Pt, r: number, teeth: number, a: number, mat: string, hole: string): Shape[] {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = a + (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    for (const [f, rr] of [[0.0, 0.84], [0.14, 1], [0.44, 1], [0.58, 0.84]] as const) pts.push([c[0] + Math.cos(a0 + f * da) * r * rr, c[1] + Math.sin(a0 + f * da) * r * rr]);
  }
  return [
    shape(`${id}/wheel`, mat, pts, { depth: r * 0.25 }),
    shape(`${id}/dish`, mat, ellipse(c, r * 0.6, r * 0.6, 0, 6), { form: "flat", tone: "shade", ink: 0, paper: false }),
    shape(`${id}/bore`, hole, ellipse(c, r * 0.22, r * 0.22, 0, 8), { form: "flat", ink: 0, paper: false }),
  ];
}

/** A corrugated sheet: a leaning rectangle with ridges. */
export function sheet(id: string, c: Pt, w: number, h: number, a: number, mat: string): Shape[] {
  const P = R(c, a);
  const out: Shape[] = [shape(`${id}/face`, mat, [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)], { form: "plane", facing: rot([-0.7, -0.7], a) })];
  const n = Math.max(3, Math.round(w / 16));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) / n) * w;
    out.push(shape(`${id}/ridge${i}`, mat, [P(x, -h / 2), P(x + w / n / 2.4, -h / 2), P(x + w / n / 2.4, h / 2), P(x, h / 2)], { form: "flat", tone: "shade", ink: 0, paper: false, opacity: 0.8 }));
  }
  return out;
}

/** A bundle of rods fanning out a little. */
export function rods(id: string, c: Pt, len: number, n: number, a: number, mat: string): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const ai = a + (i - (n - 1) / 2) * 0.05;
    const o: Pt = add(c, rot([0, (i - (n - 1) / 2) * 5], a));
    out.push(shape(`${id}/rod${i}`, mat, capsule(add(o, rot([-len / 2, 0], ai)), add(o, rot([len / 2 + i * 6, 0], ai)), 2.6, 2.2, 2), { form: "flat", tone: i % 2 ? "shade" : "base", ink: 0.4, paper: false }));
  }
  return out;
}

/**
 * A stack of oil drums, `cols` wide and `rows` high, a little out of true, with a sheet leaning on it and rods on top.
 * `x` is the middle of its base. The stack is solid from side to side, so it can pass in front of something and hide it.
 */
export function drumStack(id: string, o: { x: number; ground: number; cols: number; rows: number; w: number; h: number; seed: number; near?: boolean }): Shape[] {
  const m: Mk = (name) => `${o.near ? "scrapN" : "scrap"}.${name}`;
  const metal = ["rust", "teal", "rust2", "ochre", "steel2", "rust", "steel"];
  const out: Shape[] = [];
  const W = o.cols * o.w;
  // a core behind the drums, so no light shows between them
  out.push(shape(`${id}/core`, m("mass"), [[o.x - W / 2 + 6, o.ground + 6], [o.x - W / 2 + 6, o.ground - o.rows * o.h + 12], [o.x + W / 2 - 6, o.ground - o.rows * o.h + 12], [o.x + W / 2 - 6, o.ground + 6]], { form: "flat", ink: 0, paper: false }));
  out.push(...sheet(`${id}/lean`, [o.x - W / 2 - o.w * 0.22, o.ground - o.h * 1.05], o.w * 0.8, o.h * 2.2, -0.16, m("rust2")));
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const k = r * o.cols + c;
      const jx = (hash(o.seed * 3.3 + k * 1.7) - 0.5) * o.w * 0.1;
      const ja = (hash(o.seed * 5.9 + k * 2.3) - 0.5) * 0.05;
      const cx = o.x - W / 2 + (c + 0.5) * o.w + jx;
      const cy = o.ground - (r + 0.5) * o.h;
      out.push(...drum(`${id}/d${k}`, [cx, cy], o.w * 1.02, o.h * 1.02, ja, m(metal[Math.floor(hash(o.seed + k * 7.1) * metal.length)]), m("hole")));
    }
  }
  out.push(...rods(`${id}/rods`, [o.x + W * 0.08, o.ground - o.rows * o.h - 10], W * 1.05, 5, -0.07, m("steel2")));
  return out;
}

export interface HeapOpts {
  /** middle of the base, and the ground under it */
  x: number;
  ground: number;
  w: number;
  h: number;
  seed: number;
  /** piece size against the default */
  scale?: number;
  /** near the lens and in shade: uses the dark set of materials */
  near?: boolean;
  /** how many pieces */
  count?: number;
}

/** A heap of scrap: a mound, then pieces from the top down so the lower ones overlap the upper. */
export function scrapHeap(id: string, o: HeapOpts): Shape[] {
  const m: Mk = (name) => `${o.near ? "scrapN" : "scrap"}.${name}`;
  const k = o.scale ?? 1;
  const out: Shape[] = [];
  // the mound: lumpy, steeper on one side
  const n = 9;
  const top: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const env = Math.pow(Math.sin(Math.PI * f), 0.75);
    top.push([o.x + (f - 0.5) * o.w, o.ground - o.h * env * (0.72 + 0.4 * hash(o.seed * 5.3 + i))]);
  }
  const mound: Pt[] = [...spline(top, { closed: false, step: 6 }), [o.x + o.w / 2 + 10, o.ground + 6], [o.x - o.w / 2 - 10, o.ground + 6]];
  out.push(shape(`${id}/mass`, m("mass"), mound, { form: "flat", ink: 0.8 }));
  const count = o.count ?? Math.round((o.w * o.h) / (5200 * k * k));
  const metal = ["rust", "steel", "rust2", "steel2", "ochre", "rust", "teal", "steel"];
  const pieces: { y: number; shapes: Shape[] }[] = [];
  for (let i = 0; i < count; i++) {
    const h1 = hash(o.seed * 11.7 + i * 3.1);
    const h2 = hash(o.seed * 2.9 + i * 7.7);
    const h3 = hash(o.seed * 6.1 + i * 1.3);
    const fx = 0.08 + 0.84 * h1;
    const env = Math.pow(Math.sin(Math.PI * fx), 0.75);
    const c: Pt = [o.x + (fx - 0.5) * o.w, o.ground - o.h * env * (0.08 + 0.8 * h2)];
    const a = (h3 - 0.5) * 1.5;
    const mat = m(metal[Math.floor(hash(o.seed + i * 9.1) * metal.length)]);
    const s = k * (26 + 34 * hash(o.seed * 3.3 + i * 5.9)) * (0.75 + 0.5 * (1 - h2));
    const kind = Math.floor(hash(o.seed * 8.3 + i * 4.7) * 7);
    const pid = `${id}/p${i}`;
    let shapes: Shape[];
    if (kind === 0) shapes = plate(pid, c, s * 2.1, s * 1.1, a, mat);
    else if (kind === 1) shapes = pipe(pid, c, s * 2.6, s * 0.3, a * 0.8, mat, m("hole"));
    else if (kind === 2) shapes = rim(pid, c, s * 0.95, 0.55 + 0.4 * h3, a * 0.6, mat, m("hole"));
    else if (kind === 3) shapes = drum(pid, c, s * 1.15, s * 1.7, a * 1.3, mat, m("hole"));
    else if (kind === 4) shapes = gear(pid, c, s * 0.8, 9, a, mat, m("hole"));
    else if (kind === 5) shapes = sheet(pid, c, s * 2.3, s * 1.5, a * 0.7, mat);
    else shapes = rods(pid, c, s * 3, 4, a * 0.6 - 0.3, m("steel2"));
    pieces.push({ y: c[1], shapes });
  }
  pieces.sort((p, q) => p.y - q.y);
  for (const p of pieces) out.push(...p.shapes);
  return out;
}
