// Small things that live in the yard: a crow, a porter's bundle, and the bell that the shadows on the wall ring.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, spline, stroke } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const YARDLIFE_PALETTE: Palette = {
  crow: "#2a2226",
  "crow.beak": "#4a4038",
  /** people and things close to the lens, in shade */
  sil: "#33262a",
  "sil.cloth": "#4a3430",
  dust: "#f3deb0",
};

const flat = { form: "flat", ink: 0, paper: false } as const;

/**
 * A crow. `c` is the middle of its body, `dir` the way it faces (1 = screen right), `tilt` its climb in radians,
 * `flap` -1..1 the wings (1 = up, -1 = down), `fold` 1 = wings shut (perched).
 */
export function crow(id: string, c: Pt, size: number, o: { dir: 1 | -1; tilt?: number; flap?: number; fold?: number }): Shape[] {
  const d = o.dir;
  const tilt = -(o.tilt ?? 0) * d;
  const fold = o.fold ?? 0;
  const P = (x: number, y: number): Pt => add(c, rot([x * size * d, y * size], tilt));
  const out: Shape[] = [];
  // tail, body, head, beak
  out.push(shape(`${id}/tail`, "crow", [P(-0.42, -0.04), P(-0.98, 0.02), P(-0.94, 0.16), P(-0.4, 0.1)], flat));
  const wing = (key: string, liftIn: number, len: number, tone: "base" | "shade"): Shape => {
    // root on the back, tip swinging up and down; shut, it lies along the body toward the tail.
    // (a wing passing through level keeps a little thickness, so it never collapses to a line)
    const lift = (liftIn >= 0 ? 1 : -1) * Math.max(Math.abs(liftIn), 0.14);
    const k = 1 - fold;
    const up = -lift * len * k;
    const pts = spline([P(0.2, -0.06), P(0.03 - 0.1 * fold, up * 0.6 - 0.07), P(-0.14 * k - 0.62 * fold, up + 0.05 * fold), P(-0.3 - 0.1 * fold, up * 0.42 + 0.1), P(-0.24, 0.1)], { closed: true, step: 3 });
    return shape(`${id}/${key}`, "crow", pts, { ...flat, tone });
  };
  const flap = o.flap ?? 0;
  out.push(wing("wing.far", flap * 0.85 + 0.1, 0.78, "shade"));
  out.push(shape(`${id}/body`, "crow", ellipse(P(-0.02, 0.02), 0.46 * size, 0.2 * size, tilt, 3), flat));
  out.push(shape(`${id}/head`, "crow", ellipse(P(0.42, -0.1), 0.17 * size, 0.15 * size, tilt, 3), flat));
  out.push(shape(`${id}/beak`, "crow.beak", [P(0.52, -0.16), P(0.82, -0.07), P(0.54, -0.02)], flat));
  out.push(wing("wing.near", flap, 0.9, "base"));
  if (fold > 0.6) {
    // legs, when it stands
    out.push(shape(`${id}/leg0`, "crow.beak", capsule(P(-0.02, 0.18), P(-0.04, 0.4), 1.6, 1.4, 2), flat));
    out.push(shape(`${id}/leg1`, "crow.beak", capsule(P(0.1, 0.18), P(0.1, 0.4), 1.6, 1.4, 2), flat));
  }
  return out;
}

/** A cloth bundle carried on the head: wider than tall, lumpy, tied on top. `c` is the middle of its underside. */
export function bundle(id: string, c: Pt, w: number, h: number, tilt = 0, seed = 1, mat = "sil.cloth"): Shape[] {
  const S = (x: number, y: number): Pt => add(c, rot([x * w, y * h], tilt));
  const j = (i: number) => (hash(seed * 4.1 + i * 2.7) - 0.5) * 0.07;
  const body = spline([S(-0.36, 0.0), S(-0.52 + j(1), -0.3), S(-0.44 + j(2), -0.7), S(-0.16 + j(3), -0.95), S(0.2 + j(4), -0.98), S(0.46 + j(5), -0.72), S(0.52 + j(6), -0.32), S(0.36, 0.0), S(0, 0.05)], { closed: true, step: 5 });
  return [
    shape(`${id}/knot`, mat, spline([S(-0.07, -0.96), S(-0.2, -1.2), S(-0.03, -1.1), S(0.06, -1.26), S(0.13, -1.08), S(0.26, -1.16), S(0.1, -0.95)], { closed: true, step: 3 }), { depth: w * 0.03 }),
    shape(`${id}/body`, mat, body, { depth: w * 0.14 }),
  ];
}

/**
 * The bell on its bracket, as outlines for a shadow on a wall. `pivot` is where it hangs; `swing` its angle (radians);
 * `clap` the clapper's own angle. `rope` is the path of the rope from the bell down through the hands that pull it.
 */
export function bellShadow(id: string, pivot: Pt, u: number, swing: number, clap: number, rope: readonly Pt[]): Shape[] {
  const B = (x: number, y: number): Pt => add(pivot, rot([x * u, y * u], swing));
  const out: Shape[] = [];
  // bracket: a plate on the wall top and an arm out to the pivot
  out.push(shape(`${id}/arm`, "sil", capsule([pivot[0] - 0.62 * u, pivot[1] - 0.2 * u], pivot, 0.035 * u, 0.045 * u, 3), flat));
  out.push(shape(`${id}/stay`, "sil", capsule([pivot[0] - 0.6 * u, pivot[1] + 0.22 * u], [pivot[0] - 0.12 * u, pivot[1] - 0.02 * u], 0.025 * u, 0.025 * u, 3), flat));
  out.push(shape(`${id}/plate`, "sil", [[pivot[0] - 0.7 * u, pivot[1] - 0.34 * u], [pivot[0] - 0.56 * u, pivot[1] - 0.34 * u], [pivot[0] - 0.56 * u, pivot[1] + 0.3 * u], [pivot[0] - 0.7 * u, pivot[1] + 0.3 * u]], flat));
  // the bell: crown, waist and a flared lip
  const half = (s: 1 | -1): Pt[] => [B(s * 0.07, 0.04), B(s * 0.15, 0.12), B(s * 0.2, 0.36), B(s * 0.25, 0.56), B(s * 0.38, 0.72), B(s * 0.41, 0.8)];
  const left = half(-1);
  const right = half(1).reverse();
  out.push(shape(`${id}/yoke`, "sil", capsule(B(-0.16, 0.02), B(0.16, 0.02), 0.045 * u, 0.045 * u, 3), flat));
  out.push(shape(`${id}/bell`, "sil", spline([...left, B(0, 0.83), ...right, B(0, 0.0)], { closed: true, step: 3, tension: 0.42 }), flat));
  // clapper
  const C = (y: number): Pt => add(B(0, 0.42), rot([0, y * u], swing + clap));
  out.push(shape(`${id}/clapper`, "sil", capsule(C(0), C(0.42), 0.02 * u, 0.02 * u, 3), flat));
  out.push(shape(`${id}/knob`, "sil", ellipse(C(0.48), 0.06 * u, 0.07 * u, 0, 3), flat));
  if (rope.length >= 2) {
    const pts = stroke(spline(rope as Pt[], { closed: false, step: 6 }), () => 0.036 * u, true, 4);
    if (pts.length >= 3) out.push(shape(`${id}/rope`, "sil", pts, flat));
    // a tassel on the end of it
    const e = rope[rope.length - 1];
    out.push(shape(`${id}/tassel`, "sil", [[e[0] - 0.05 * u, e[1] - 0.02 * u], [e[0] + 0.05 * u, e[1] - 0.02 * u], [e[0] + 0.1 * u, e[1] + 0.3 * u], [e[0] - 0.1 * u, e[1] + 0.3 * u]], flat));
  }
  return out;
}
