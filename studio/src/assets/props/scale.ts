// The hand-held beam scale of the scrapyard and the sack that hangs from it.
// The beam turns about its pivot; the chain, the sack and the brass poise always hang straight down from it.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, roundRect, spline } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const SCALE_PALETTE: Palette = {
  iron: "#3d3a38",
  "iron.light": "#77726d",
  brass: "#c99b36",
  jute: "#bd9b69",
  "jute.dark": "#93744a",
  "jute.patch": "#a98a5f",
  rope: "#e0cfa6",
};

export interface ScaleOpts {
  /** the knife-edge the beam turns on */
  pivot: Pt;
  u: number;
  /** which way the long (graduated) arm points: 1 = screen right */
  dir: 1 | -1;
  /** turn of the beam, radians, clockwise on screen */
  ang?: number;
  /** where the poise hangs on the long arm, 0..1 */
  poiseAt?: number;
  /** swing of the chain and load from the vertical, radians */
  swing?: number;
}

export interface ScaleOut {
  /** the stirrup the hand holds: paint it before the hand so the fingers close over it */
  back: Shape[];
  /** beam, pointer, poise, chain and hook */
  front: Shape[];
  /** top of the stirrup, inside the fist */
  handle: Pt;
  /** the little ring the poise hangs from, where the other hand's fingers go */
  poise: Pt;
  /** bottom of the hook: the neck of whatever is being weighed */
  hook: Pt;
  longEnd: Pt;
}

export function buildScale(id: string, o: ScaleOpts): ScaleOut {
  const { pivot, u, dir } = o;
  const ang = o.ang ?? 0;
  const La = 1.32 * u;
  const Ls = 0.52 * u;
  const B = (x: number, y: number): Pt => add(pivot, rot([x * dir, y], ang * dir));
  const handle: Pt = [pivot[0], pivot[1] - 0.36 * u];
  const back: Shape[] = [
    shape(`${id}/stirrup.l`, "iron", capsule([pivot[0] - 0.075 * u, pivot[1] + 0.02 * u], [pivot[0] - 0.05 * u, handle[1]], 4.2, 4.2, 3), { form: "flat", ink: 0.6, paper: false }),
    shape(`${id}/stirrup.r`, "iron", capsule([pivot[0] + 0.075 * u, pivot[1] + 0.02 * u], [pivot[0] + 0.05 * u, handle[1]], 4.2, 4.2, 3), { form: "flat", ink: 0.6, paper: false }),
    shape(`${id}/stirrup.top`, "iron", capsule([pivot[0] - 0.07 * u, handle[1]], [pivot[0] + 0.07 * u, handle[1]], 5.5, 5.5, 3), { form: "flat", ink: 0.6, paper: false }),
  ];
  const front: Shape[] = [];
  // the beam: thickest at the pivot, thin at the far end of the long arm, with a knob on the end
  front.push(
    shape(`${id}/beam`, "iron", [B(-Ls, -0.05 * u), B(0, -0.066 * u), B(La, -0.03 * u), B(La + 0.03 * u, 0), B(La, 0.03 * u), B(0, 0.066 * u), B(-Ls, 0.05 * u), B(-Ls - 0.03 * u, 0)], { depth: 0.045 * u, ink: 0.9 }),
  );
  front.push(shape(`${id}/knob`, "brass", ellipse(B(La + 0.03 * u, 0), 0.045 * u, 0.055 * u, 0, 6), { depth: 0.02 * u, ink: 0.7 }));
  for (let i = 1; i <= 11; i++) {
    const x = (i / 12) * La;
    const tall = i % 3 === 0;
    front.push(shape(`${id}/tick${i}`, "iron.light", [B(x - 1.6, -0.03 * u), B(x + 1.6, -0.03 * u), B(x + 1.6, tall ? 0.02 * u : -0.004 * u), B(x - 1.6, tall ? 0.02 * u : -0.004 * u)], { form: "flat", ink: 0, paper: false }));
  }
  // the pointer stands up from the pivot inside the stirrup and tells when the beam is level
  front.push(shape(`${id}/pointer`, "brass", [B(-0.02 * u, 0), B(0.02 * u, 0), B(0.005 * u, -0.27 * u), B(-0.005 * u, -0.27 * u)], { form: "flat", ink: 0.5, paper: false }));
  front.push(shape(`${id}/boss`, "brass", ellipse(pivot, 0.07 * u, 0.07 * u, 0, 6), { depth: 0.03 * u, ink: 0.7 }));
  // the poise: a brass pear on a ring that slides along the long arm
  const ring = B((o.poiseAt ?? 0.55) * La, 0);
  const pear: Pt = [ring[0], ring[1] + 0.27 * u];
  front.push(shape(`${id}/poise.link`, "iron", capsule(ring, [pear[0], pear[1] - 0.1 * u], 3.2, 3.2, 3), { form: "flat", ink: 0.4, paper: false }));
  front.push(shape(`${id}/poise.ring`, "iron.light", ellipse(ring, 0.04 * u, 0.085 * u, 0, 6), { form: "flat", ink: 0.6, paper: false }));
  front.push(shape(`${id}/poise`, "brass", spline([[pear[0], pear[1] - 0.12 * u], [pear[0] + 0.06 * u, pear[1] - 0.065 * u], [pear[0] + 0.115 * u, pear[1] + 0.065 * u], [pear[0], pear[1] + 0.15 * u], [pear[0] - 0.115 * u, pear[1] + 0.065 * u], [pear[0] - 0.06 * u, pear[1] - 0.065 * u]], { closed: true, step: 3 }), { depth: 0.06 * u, ink: 0.8 }));
  // the load chain and its hook
  const top = B(-Ls + 0.02 * u, 0.03 * u);
  const sw = o.swing ?? 0;
  const down = (d: number): Pt => add(top, rot([0, d], sw));
  const Lc = 0.5 * u;
  front.push(shape(`${id}/chain`, "iron", capsule(top, down(Lc), 3.2, 3.2, 3), { form: "flat", ink: 0.4, paper: false }));
  for (let i = 0; i < 5; i++) front.push(shape(`${id}/link${i}`, "iron.light", ellipse(down(((i + 0.5) / 5) * Lc), i % 2 ? 3.6 : 6.5, 8.5, sw, 6), { form: "flat", ink: 0.4, paper: false }));
  const hook = down(Lc + 0.13 * u);
  front.push(shape(`${id}/hook`, "iron", spline([down(Lc - 4), add(down(Lc + 0.05 * u), [0.05 * u, 0]), add(hook, [0.045 * u, 0]), add(hook, [0, 0.02 * u]), add(hook, [-0.05 * u, -0.01 * u]), add(hook, [-0.045 * u, -0.05 * u]), add(hook, [-0.02 * u, -0.045 * u]), add(hook, [0, -0.012 * u]), add(hook, [0.02 * u, -0.02 * u]), add(down(Lc + 0.05 * u), [0.025 * u, 0])], { closed: true, step: 3 }), { form: "flat", ink: 0.7, paper: false }));
  return { back, front, handle, poise: ring, hook, longEnd: B(La, 0) };
}

/** The points of the scale that hands and loads hang on, without building the drawing. */
export function scalePoints(o: ScaleOpts): { handle: Pt; poise: Pt; top: Pt; hook: Pt; longEnd: Pt } {
  const { pivot, u, dir } = o;
  const ang = o.ang ?? 0;
  const La = 1.32 * u;
  const Ls = 0.52 * u;
  const B = (x: number, y: number): Pt => add(pivot, rot([x * dir, y], ang * dir));
  const top = B(-Ls + 0.02 * u, 0.03 * u);
  return { handle: [pivot[0], pivot[1] - 0.36 * u], poise: B((o.poiseAt ?? 0.55) * La, 0), top, hook: add(top, rot([0, 0.63 * u], o.swing ?? 0)), longEnd: B(La, 0) };
}

/** A jute sack of scrap hanging by its tied neck: lumpy, heavy at the bottom, with a rod poking out of the mouth. */
export function buildSack(id: string, neck: Pt, w: number, h: number, swing = 0, seed = 1): { shapes: Shape[]; bottom: Pt } {
  const S = (x: number, y: number): Pt => add(neck, rot([x * w, y * h], swing));
  const j = (i: number, k = 0.035) => (hash(seed * 7.3 + i * 2.9) - 0.5) * 2 * k;
  const body = spline(
    [
      S(-0.1, 0.0),
      S(-0.3 + j(1), 0.14),
      S(-0.46 + j(2), 0.38),
      S(-0.5 + j(3), 0.66),
      S(-0.43 + j(4), 0.9),
      S(-0.2 + j(5), 1.0),
      S(0.14 + j(6), 0.985),
      S(0.42 + j(7), 0.92),
      S(0.52 + j(8), 0.68),
      S(0.47 + j(9), 0.4),
      S(0.31 + j(10), 0.15),
      S(0.1, 0.0),
    ],
    { closed: true, step: 5 },
  );
  const out: Shape[] = [];
  // a rod and a strip of sheet stick out of the mouth, behind the gathered top
  out.push(shape(`${id}/rod`, "iron", capsule(S(0.02, 0.02), S(0.34, -0.3), 3, 2.6, 3), { form: "flat", ink: 0.5, paper: false }));
  out.push(shape(`${id}/tuft`, "jute", [S(-0.09, 0.01), S(-0.2, -0.12), S(-0.07, -0.095), S(0.02, -0.15), S(0.1, -0.09), S(0.21, -0.11), S(0.09, 0.01)], { depth: w * 0.05, ink: 0.8 }));
  out.push(shape(`${id}/body`, "jute", body, { depth: w * 0.2 }));
  // folds that run down from the tie, a patch, and the sag at the bottom
  const fold = (i: number, x0: number, x1: number, len: number) =>
    out.push(shape(`${id}/fold${i}`, "jute", spline([S(x0 - 0.012, 0.03), S((x0 + x1) / 2 - 0.02, len * 0.5), S(x1, len), S((x0 + x1) / 2 + 0.03, len * 0.5), S(x0 + 0.012, 0.03)], { closed: true, step: 4 }), { form: "flat", tone: "shade", ink: 0, paper: false, opacity: 0.75 }));
  fold(0, -0.05, -0.2, 0.34);
  fold(1, 0.01, 0.03, 0.42);
  fold(2, 0.06, 0.24, 0.3);
  out.push(shape(`${id}/patch`, "jute.patch", roundRect(S(0.2, 0.62), w * 0.13, h * 0.09, 3, swing + 0.12), { form: "flat", ink: 0.5, paper: false }));
  for (let i = 0; i < 4; i++) out.push(shape(`${id}/stitch${i}`, "jute.dark", capsule(S(0.1 + i * 0.065, 0.535 + i * 0.008), S(0.115 + i * 0.065, 0.555 + i * 0.008), 1.4, 1.4, 2), { form: "flat", ink: 0, paper: false }));
  out.push(shape(`${id}/sag`, "jute", spline([S(-0.36, 0.86), S(-0.1, 0.93), S(0.2, 0.92), S(0.4, 0.85), S(0.2, 0.975), S(-0.14, 0.985)], { closed: true, step: 4 }), { form: "flat", tone: "shade", ink: 0, paper: false, opacity: 0.6 }));
  // the tie: three turns of rope round the neck
  for (let i = 0; i < 3; i++) out.push(shape(`${id}/tie${i}`, "rope", capsule(S(-0.115, 0.012 + i * 0.022), S(0.115, 0.018 + i * 0.022), 3.2, 3.2, 3), { form: "flat", tone: i === 1 ? "base" : "light", ink: 0.5, paper: false }));
  return { shapes: out, bottom: S(0, 1) };
}
