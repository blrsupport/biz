// The machine the brothers build: a hand-made sheet press. A welded frame in red-oxide primer, two plates,
// a bottle jack under the lower one, a control box on the side. Its parts can sit loose, so it can be seen being built.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { moveShapes, turnShapes } from "../../engine/draw/xform.ts";
import { capsule, ellipse, quad as curve, roundRect, stroke } from "../../engine/geom/outline.ts";
import { add, fromAngle, rot, type Pt } from "../../engine/geom/vec.ts";

export const PRESS_PALETTE: Palette = {
  "press.frame": "#a64a30",
  "press.plate": "#b6bdc1",
  "press.jack": "#2f5b8c",
  "press.box": "#e2dccb",
  "press.dial": "#e9b83a",
  "press.lamp": "#d8482f",
  "press.cable": "#2e2b30",
  tool: "#c7cdd1",
};

export interface PressState {
  /** top beam: 0 = seated on the uprights, 1 = its right end still propped up */
  beam: number;
  /** lower plate: 0 = up and locked, 1 = resting low and a little crooked */
  platen: number;
  /** control box: how far it hangs askew, radians */
  box: number;
  /** spanner on the right-hand bolt: its angle, radians (PI/2 = hanging straight down) */
  spanner: number;
  /** sideways shudder of the upper parts, px */
  shake: number;
}

export const PRESS_BUILT: PressState = { beam: 0, platen: 0, box: 0, spanner: Math.PI / 2, shake: 0 };

export interface PressOut {
  shapes: Shape[];
  /** centre of the bolt the spanner sits on */
  bolt: Pt;
  /** where a hand holds the spanner */
  spannerEnd: Pt;
  /** top of the right-hand end of the beam */
  beamEnd: Pt;
  x0: number;
  x1: number;
  topY: number;
}

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const FRONT = { form: "plane", facing: [0, 0] as Pt } as const;
const TOP = { form: "plane", facing: [0, -1] as Pt } as const;
const SIDE = { form: "plane", facing: [1, 0] as Pt } as const;

/** A box seen a little from above and from the right: front, top and right-hand faces. `d` is the depth offset. */
function block(id: string, mat: string, x0: number, y0: number, x1: number, y1: number, d: Pt): Shape[] {
  return [
    shape(`${id}.side`, mat, [[x1, y0], [x1 + d[0], y0 + d[1]], [x1 + d[0], y1 + d[1]], [x1, y1]], SIDE),
    shape(`${id}.top`, mat, [[x0, y0], [x0 + d[0], y0 + d[1]], [x1 + d[0], y0 + d[1]], [x1, y0]], TOP),
    shape(`${id}.front`, mat, box(x0, y0, x1, y1), FRONT),
  ];
}

/** The points hands work at, without building the drawing (pins call this many times a frame). */
export function pressPoints(o: { x: number; ground: number; u: number }, st: PressState): { bolt: Pt; spannerEnd: Pt; beamEnd: Pt } {
  const { x, ground, u } = o;
  const topY = ground - 3.6 * u;
  const pivot: Pt = [x - 0.8 * u, topY];
  const ang = -st.beam * 0.19;
  const place = (p: Pt): Pt => add(add(pivot, rot([p[0] - pivot[0], p[1] - pivot[1]], ang)), [st.shake, 0]);
  const bolt = place([x + 0.8 * u, topY - 0.135 * u]);
  const dir = fromAngle(st.spanner);
  return { bolt, spannerEnd: add(bolt, [dir[0] * 0.5 * u, dir[1] * 0.5 * u]), beamEnd: place([x + 0.92 * u, topY - 0.27 * u]) };
}

/** `x` is the middle of the frame, `ground` the floor under its front feet. */
export function buildPress(id: string, o: { x: number; ground: number; u: number }, st: PressState): PressOut {
  const { x, ground, u } = o;
  const D: Pt = [0.2 * u, -0.24 * u];
  const xl = x - 0.8 * u;
  const xr = x + 0.8 * u;
  const cw = 0.17 * u;
  const topY = ground - 3.6 * u;
  const out: Shape[] = [];

  // back half of the frame
  for (const [i, ux] of [xl, xr].entries()) {
    out.push(shape(`${id}/post.back${i}`, "press.frame", box(ux - cw / 2 + D[0], topY + D[1], ux + cw / 2 + D[0], ground + D[1]), { form: "flat", tone: "shade", ink: 0.6 }));
  }
  out.push(shape(`${id}/bed.back`, "press.frame", box(xl + D[0], ground - 1.0 * u + D[1], xr + D[0], ground - 0.8 * u + D[1]), { form: "flat", tone: "shade", ink: 0.5 }));
  // skids on the floor, running front to back under each upright
  for (const [i, ux] of [xl, xr].entries()) out.push(...block(`${id}/skid${i}`, "press.frame", ux - cw / 2 - 0.09 * u, ground - 0.1 * u, ux + cw / 2 + 0.09 * u, ground, D));
  // the bed the jack stands on
  out.push(...block(`${id}/bed`, "press.frame", xl, ground - 1.0 * u, xr, ground - 0.8 * u, D));

  // bottle jack, and the plate it lifts
  const yb = ground - 1.0 * u - 0.07 * u;
  const off = st.platen * 0.34 * u;
  const yP = ground - 2.24 * u + off;
  out.push(shape(`${id}/jack.foot`, "press.jack", box(x - 0.24 * u, yb - 0.06 * u, x + 0.24 * u, yb), { form: "flat", tone: "shade", ink: 0.5 }));
  out.push(shape(`${id}/ram`, "tool", box(x - 0.055 * u, yP + 0.16 * u, x + 0.055 * u, yb - 0.5 * u), { depth: 0.03 * u, ink: 0.5, rim: 0 }));
  out.push(shape(`${id}/jack`, "press.jack", roundRect([x, yb - 0.06 * u - 0.25 * u], 0.17 * u, 0.25 * u, 0.05 * u), { depth: 0.09 * u }));
  out.push(shape(`${id}/jack.band`, "press.jack", box(x - 0.17 * u, yb - 0.2 * u, x + 0.17 * u, yb - 0.16 * u), { form: "flat", tone: "light", ink: 0, paper: false }));
  out.push(shape(`${id}/lever`, "tool", capsule([x + 0.13 * u, yb - 0.17 * u], [x + 0.66 * u, yb - 0.5 * u], 0.03 * u, 0.03 * u, 3), { depth: 0.02 * u, ink: 0.5, rim: 0 }));
  out.push(shape(`${id}/lever.grip`, "press.cable", capsule([x + 0.52 * u, yb - 0.413 * u], [x + 0.7 * u, yb - 0.525 * u], 0.042 * u, 0.042 * u, 3), { depth: 0.02 * u, ink: 0.5, rim: 0 }));
  const lower = [
    shape(`${id}/boss`, "tool", box(x - 0.13 * u, yP + 0.16 * u, x + 0.13 * u, yP + 0.24 * u), { form: "flat", tone: "shade", ink: 0.5 }),
    ...block(`${id}/plate.low`, "press.plate", x - 0.67 * u, yP, x + 0.67 * u, yP + 0.16 * u, [D[0] * 0.85, D[1] * 0.85]),
  ];
  out.push(...turnShapes(lower, [x, yP + 0.08 * u], st.platen * 0.075));

  // front uprights, drilled
  for (const [i, ux] of [xl, xr].entries()) {
    out.push(shape(`${id}/post${i}.side`, "press.frame", [[ux + cw / 2, topY], [ux + cw / 2 + 0.06 * u, topY - 0.07 * u], [ux + cw / 2 + 0.06 * u, ground - 0.17 * u], [ux + cw / 2, ground - 0.1 * u]], SIDE));
    out.push(shape(`${id}/post${i}`, "press.frame", box(ux - cw / 2, topY, ux + cw / 2, ground - 0.1 * u), FRONT));
    for (const [k, h] of [1.5, 2.0, 2.5, 3.0].entries()) {
      out.push(shape(`${id}/post${i}.hole${k}`, "press.frame", ellipse([ux, ground - h * u], 0.026 * u, 0.026 * u, 0, 2), { form: "flat", tone: "deep", ink: 0, paper: false }));
    }
  }

  // top beam with the upper plate hung under it; it pivots on the left upright while its right end is still propped up
  const pivot: Pt = [xl, topY];
  const ang = -st.beam * 0.19;
  const top: Shape[] = [
    ...block(`${id}/plate.up`, "press.plate", x - 0.67 * u, topY + 0.2 * u, x + 0.67 * u, topY + 0.36 * u, [D[0] * 0.85, D[1] * 0.85]),
    shape(`${id}/hanger0`, "tool", box(x - 0.5 * u, topY, x - 0.41 * u, topY + 0.2 * u), { form: "flat", tone: "shade", ink: 0.5 }),
    shape(`${id}/hanger1`, "tool", box(x + 0.41 * u, topY, x + 0.5 * u, topY + 0.2 * u), { form: "flat", tone: "shade", ink: 0.5 }),
    ...block(`${id}/beam`, "press.frame", x - 1.0 * u, topY - 0.27 * u, x + 1.0 * u, topY, D),
    shape(`${id}/bolt0`, "tool", ellipse([xl, topY - 0.135 * u], 0.05 * u, 0.05 * u, 0, 2), { form: "flat", tone: "light", ink: 0.5, paper: false }),
  ];
  out.push(...moveShapes(turnShapes(top, pivot, ang), [st.shake, 0]));
  const { bolt, beamEnd, spannerEnd } = pressPoints(o, st);

  // control box, hung on the left upright, with its lead to the lower plate
  const hook: Pt = [xl - 0.1 * u, ground - 2.98 * u];
  const cable = stroke(curve(add(hook, rot([0.05 * u, 0.7 * u], st.box)), [xl + 0.2 * u, yP + 0.6 * u], [x - 0.67 * u, yP + 0.1 * u], 6), () => 0.02 * u, true, 3);
  out.push(shape(`${id}/cable`, "press.cable", cable, { form: "flat", ink: 0, paper: false }));
  const B = (px: number, py: number): Pt => [hook[0] + px * u, hook[1] + py * u];
  const boxShapes: Shape[] = [
    shape(`${id}/box.strap`, "press.cable", box(hook[0] - 0.05 * u, hook[1] - 0.05 * u, hook[0] + 0.05 * u, hook[1] + 0.08 * u), { form: "flat", ink: 0, paper: false }),
    shape(`${id}/box`, "press.box", roundRect(B(0, 0.38), 0.28 * u, 0.33 * u, 0.04 * u), { ...FRONT, ink: 0.8 }),
    shape(`${id}/box.dial`, "press.dial", ellipse(B(-0.07, 0.3), 0.105 * u, 0.105 * u, 0, 3), { depth: 0.04 * u, ink: 0.6, rim: 0 }),
    shape(`${id}/box.needle`, "press.cable", capsule(B(-0.07, 0.3), B(-0.01, 0.24), 0.012 * u, 0.008 * u, 2), { form: "flat", ink: 0, paper: false }),
    shape(`${id}/box.lamp`, "press.lamp", ellipse(B(0.15, 0.2), 0.036 * u, 0.036 * u, 0, 2), { form: "flat", ink: 0.4, paper: false }),
    shape(`${id}/box.sw0`, "press.cable", box(hook[0] + 0.1 * u, hook[1] + 0.34 * u, hook[0] + 0.2 * u, hook[1] + 0.39 * u), { form: "flat", ink: 0, paper: false }),
    shape(`${id}/box.sw1`, "press.cable", box(hook[0] + 0.1 * u, hook[1] + 0.46 * u, hook[0] + 0.2 * u, hook[1] + 0.51 * u), { form: "flat", ink: 0, paper: false }),
    shape(`${id}/box.plate`, "press.box", box(hook[0] - 0.2 * u, hook[1] + 0.52 * u, hook[0] + 0.03 * u, hook[1] + 0.62 * u), { form: "flat", tone: "shade", ink: 0, paper: false }),
  ];
  out.push(...turnShapes(boxShapes, hook, st.box));

  // the spanner on the right-hand bolt
  const dir = fromAngle(st.spanner);
  const len = 0.6 * u;
  out.push(shape(`${id}/spanner`, "tool", capsule(add(bolt, [dir[0] * 0.06 * u, dir[1] * 0.06 * u]), add(bolt, [dir[0] * len, dir[1] * len]), 0.03 * u, 0.04 * u, 3), { depth: 0.025 * u, ink: 0.6, rim: 0.5 }));
  out.push(shape(`${id}/spanner.head`, "tool", ellipse(bolt, 0.088 * u, 0.088 * u, 0, 3), { depth: 0.03 * u, ink: 0.6, rim: 0.5 }));
  out.push(shape(`${id}/bolt1`, "press.cable", ellipse(bolt, 0.043 * u, 0.043 * u, 0, 2), { form: "flat", ink: 0, paper: false }));

  return { shapes: out, bolt, spannerEnd, beamEnd, x0: xl - cw / 2 - 0.09 * u, x1: xr + cw / 2 + 0.09 * u + D[0], topY: topY - 0.27 * u };
}
