// Props of the Minus Degre room: the steel table and the oven. Seen side-on and a little from above,
// so every box shows a front, a top and a right side.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, roundRect, roundedPoly } from "../../engine/geom/outline.ts";
import type { Pt } from "../../engine/geom/vec.ts";

export const MD_PROP_PALETTE: Palette = {
  steel: "#8d98a3",
  "steel.top": "#aab3ba",
  rubber: "#2f2c31",
  "oven.body": "#dcd8cc",
  "oven.trim": "#4a444a",
  "oven.glass": "#2a2830",
  "oven.handle": "#b7bbc1",
  "oven.knob": "#3a363d",
  "oven.lamp": "#d8482f",
  dust: "#f3e6c9",
};

const quad = (a: Pt, b: Pt, c: Pt, d: Pt): Pt[] => [a, b, c, d];
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export interface TableOut {
  /** legs at the back: paint these before anything that stands behind the table top */
  back: Shape[];
  /** top, apron and front legs */
  front: Shape[];
  /** y of the front edge of the top surface */
  topY: number;
  /** how far the top's back edge is shifted from its front edge */
  depth: Pt;
  x0: number;
  x1: number;
}

/** A plain steel work table. `x` is the middle of its front edge, `ground` the floor under its front legs. */
export function buildTable(id: string, o: { x: number; ground: number; w: number; h: number; u: number }): TableOut {
  const { x, ground, w, h, u } = o;
  const D: Pt = [0.2 * u, -0.24 * u];
  const topY = ground - h;
  const th = 0.1 * u;
  const lw = 0.105 * u;
  const inset = 0.09 * u;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const legX = [x0 + inset, x1 - inset - lw];
  const back: Shape[] = legX.map((lx, i) =>
    shape(`${id}/leg.back${i}`, "steel", box(lx + D[0], topY + D[1] + th, lx + D[0] + lw, ground + D[1]), { form: "flat", tone: "shade", ink: 0.6 }),
  );
  back.push(shape(`${id}/bar.back`, "steel", box(legX[0] + D[0], ground + D[1] - 0.62 * h, legX[1] + D[0] + lw, ground + D[1] - 0.62 * h + 0.06 * u), { form: "flat", tone: "shade", ink: 0.5 }));
  const front: Shape[] = [
    shape(`${id}/side`, "steel", quad([x1, topY], [x1 + D[0], topY + D[1]], [x1 + D[0], topY + D[1] + th], [x1, topY + th]), { form: "plane", facing: [1, 0] }),
    shape(`${id}/top`, "steel.top", quad([x0, topY], [x0 + D[0], topY + D[1]], [x1 + D[0], topY + D[1]], [x1, topY]), { form: "plane", facing: [0, -1] }),
    shape(`${id}/apron`, "steel", roundedPoly([{ p: [x0, topY] }, { p: [x1, topY] }, { p: [x1, topY + th], r: 3 }, { p: [x0, topY + th], r: 3 }]), { form: "plane", facing: [0, 0] }),
  ];
  // side stretchers run back from each front leg; the front one joins the two front legs low down
  legX.forEach((lx, i) => {
    front.push(shape(`${id}/leg${i}`, "steel", roundRect([lx + lw / 2, (topY + th + ground) / 2], lw / 2, (ground - topY - th) / 2, 2), { depth: lw * 0.55 }));
    front.push(shape(`${id}/shoe${i}`, "rubber", roundRect([lx + lw / 2, ground - 0.035 * u], lw / 2 + 2, 0.045 * u, 3), { form: "flat", ink: 0.6 }));
  });
  front.push(shape(`${id}/bar`, "steel", box(legX[0] + lw, ground - 0.3 * h, legX[1], ground - 0.3 * h + 0.07 * u), { form: "plane", facing: [0, 0] }));
  front.push(shape(`${id}/bar.top`, "steel.top", box(legX[0] + lw, ground - 0.3 * h - 3, legX[1], ground - 0.3 * h), { form: "flat", tone: "light", ink: 0, paper: false }));
  return { back, front, topY, depth: D, x0, x1 };
}

export interface OvenOut {
  shapes: Shape[];
  /** y of the front edge of its top */
  topY: number;
  x0: number;
  x1: number;
  /** where the hands hold it */
  grips: { near: Pt; far: Pt; pat: Pt };
}

/** A small countertop oven with a glass door and three knobs. `x` is the middle of its front, `base` what it stands on. */
export function buildOven(id: string, o: { x: number; base: number; w: number; h: number; u: number; tilt?: number }): OvenOut {
  const { x, base, w, h, u } = o;
  const D: Pt = [0.15 * u, -0.18 * u];
  const foot = 0.04 * u;
  const y1 = base - foot;
  const y0 = y1 - h;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const m = 0.07 * h;
  const doorX1 = x0 + 0.71 * w;
  const out: Shape[] = [];
  out.push(shape(`${id}/side`, "oven.body", quad([x1, y0], [x1 + D[0], y0 + D[1]], [x1 + D[0], y1 + D[1]], [x1, y1]), { form: "plane", facing: [1, 0] }));
  out.push(shape(`${id}/top`, "oven.body", quad([x0, y0], [x0 + D[0], y0 + D[1]], [x1 + D[0], y0 + D[1]], [x1, y0]), { form: "plane", facing: [0, -1] }));
  for (const [i, fx] of [x0 + 0.1 * w, x1 - 0.1 * w].entries()) out.push(shape(`${id}/foot${i}`, "rubber", box(fx - 0.05 * w, y1 - 2, fx + 0.05 * w, base), { form: "flat", ink: 0.5 }));
  out.push(shape(`${id}/front`, "oven.body", roundRect([x, (y0 + y1) / 2], w / 2, h / 2, 0.05 * u), { form: "plane", facing: [0, 0] }));
  // the door: dark bezel, glass, a rack inside, two streaks of reflected light
  const gx0 = x0 + m;
  const gx1 = doorX1 - m * 0.4;
  const gy0 = y0 + m + 0.16 * h;
  const gy1 = y1 - m;
  out.push(shape(`${id}/bezel`, "oven.trim", roundRect([(gx0 + gx1) / 2, (y0 + m + gy1) / 2], (gx1 - gx0) / 2, (gy1 - y0 - m) / 2, 0.035 * u), { form: "flat", ink: 0.5 }));
  const ix0 = gx0 + m * 0.7;
  const ix1 = gx1 - m * 0.7;
  out.push(shape(`${id}/glass`, "oven.glass", roundRect([(ix0 + ix1) / 2, (gy0 + gy1 - m * 0.7) / 2], (ix1 - ix0) / 2, (gy1 - m * 0.7 - gy0) / 2, 0.025 * u), { form: "flat", ink: 0, paper: false }));
  const gh = gy1 - m * 0.7 - gy0;
  out.push(shape(`${id}/rack`, "oven.handle", box(ix0 + 4, gy0 + gh * 0.58, ix1 - 4, gy0 + gh * 0.58 + 3), { form: "flat", ink: 0, paper: false, opacity: 0.35 }));
  for (const [i, f] of [0.2, 0.34].entries()) {
    const sx = ix0 + (ix1 - ix0) * f;
    const sw = (ix1 - ix0) * (i === 0 ? 0.09 : 0.035);
    out.push(shape(`${id}/streak${i}`, "oven.handle", quad([sx + gh * 0.32, gy0 + 3], [sx + gh * 0.32 + sw, gy0 + 3], [sx + sw, gy1 - m * 0.7 - 3], [sx, gy1 - m * 0.7 - 3]), { form: "flat", ink: 0, paper: false, opacity: 0.2 }));
  }
  // handle across the top of the door, with its shadow on the bezel
  const hy = y0 + m + 0.085 * h;
  out.push(shape(`${id}/handle.shadow`, "oven.trim", box(gx0 + 0.07 * w, hy + 0.03 * h, gx1 - 0.05 * w, hy + 0.075 * h), { form: "flat", tone: "deep", ink: 0, paper: false }));
  out.push(shape(`${id}/handle`, "oven.handle", capsule([gx0 + 0.06 * w, hy], [gx1 - 0.06 * w, hy], 0.035 * h, 0.035 * h, 3), { depth: 0.03 * h, ink: 0.7 }));
  // control panel: lamp and three knobs
  const px = (doorX1 + x1) / 2;
  out.push(shape(`${id}/panel.line`, "oven.body", box(doorX1 + 1, y0 + m, doorX1 + 4, y1 - m), { form: "flat", tone: "shade", ink: 0, paper: false }));
  out.push(shape(`${id}/lamp`, "oven.lamp", ellipse([px, y0 + 0.13 * h], 0.022 * h + 2, 0.022 * h + 2, 0, 6), { form: "flat", ink: 0.4, paper: false }));
  [0.34, 0.57, 0.8].forEach((f, i) => {
    const c: Pt = [px, y0 + f * h];
    const r = 0.078 * h;
    out.push(shape(`${id}/knob${i}`, "oven.knob", ellipse(c, r, r, 0, 5), { depth: r * 0.5, ink: 0.6 }));
    const a = [-0.6, 0.5, -1.9][i];
    const tip: Pt = [c[0] + Math.cos(a) * r * 0.8, c[1] + Math.sin(a) * r * 0.8];
    out.push(shape(`${id}/knob${i}.mark`, "oven.body", capsule(c, tip, 1.6, 1.6, 2), { form: "flat", ink: 0, paper: false }));
  });
  return {
    shapes: out,
    topY: y0,
    x0,
    x1,
    grips: { near: [x0 + 0.16 * w, y1 - 0.34 * h], far: [x0 + 0.3 * w, y0 + 0.2 * h], pat: [x1 - 0.2 * w, y0 + D[1] * 0.5 - 0.02 * u] },
  };
}
