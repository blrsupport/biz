// The Ahmedabad scrapyard of the GGSP story, late afternoon, 1976.
// Far: mill chimneys and minarets in haze. Middle: the yard wall. Near: dusty ground. The sun is low at frame left.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { ellipse, spline } from "../../engine/geom/outline.ts";
import type { Pt } from "../../engine/geom/vec.ts";
import { hash } from "../../engine/motion/track.ts";

export const YARD_PALETTE: Palette = {
  "sky.far": "#edd9b0",
  "sky.mid": "#d9bf94",
  smoke: "#f6ead0",
  "yard.wall": "#d09a6b",
  "yard.coping": "#e8c494",
  "yard.brick": "#b3634a",
  "yard.mortar": "#d6a67e",
  "yard.stain": "#b47f58",
  "yard.plinth": "#b98560",
  "yard.vent": "#5a3a33",
  "yard.ground": "#dbb882",
  "yard.rut": "#c9a471",
  // the sky and the air of the yard: laid over the surfaces as gradients, never as shapes
  "yard.sky.top": "#7fa6ad",
  "yard.sky.band": "#c3cdb0",
  "yard.sky.low": "#f8dfab",
  "yard.sun.glow": "#ffeab4",
  "yard.air.haze": "#fbe8be",
  "yard.air.warm": "#ffe3a6",
  "yard.air.far": "#4a2f3a",
  "yard.air.dust": "#f6dcab",
  "yard.air.near": "#3a2420",
  "yard.air.shaft": "#fff1c4",
};

export interface YardOpts {
  /** the line the actors stand on */
  GY: number;
  u: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** y of the top of the yard wall */
  wallTop: number;
  seed?: number;
}

export interface YardOut {
  /** two layers of skyline, farthest first */
  skyFar: Shape[];
  skyMid: Shape[];
  wall: Shape[];
  ground: Shape[];
  /** the face of the wall, for clipping shadows to it */
  wallBox: Pt[];
  junction: number;
  wallTop: number;
  box: { x0: number; x1: number; y0: number; y1: number };
}

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const set = { form: "flat", ink: 0, paper: false } as const;

function minaret(id: string, mat: string, x: number, base: number, h: number, w: number): Shape[] {
  const out: Shape[] = [shape(`${id}/shaft`, mat, [[x - w / 2, base], [x - w * 0.36, base - h], [x + w * 0.36, base - h], [x + w / 2, base]], set)];
  for (const [i, f] of [0.42, 0.72, 1].entries()) out.push(shape(`${id}/gallery${i}`, mat, box(x - w * 0.72, base - h * f - h * 0.022, x + w * 0.72, base - h * f + h * 0.012), set));
  out.push(shape(`${id}/dome`, mat, ellipse([x, base - h - h * 0.045], w * 0.44, h * 0.065, 0, 8), set));
  out.push(shape(`${id}/spike`, mat, [[x - 1.6, base - h - h * 0.09], [x, base - h - h * 0.2], [x + 1.6, base - h - h * 0.09]], set));
  return out;
}

function chimney(id: string, mat: string, x: number, base: number, h: number, w: number, smoke: number): Shape[] {
  const out: Shape[] = [];
  // smoke first, so the stack stands in front of it: it leans away from the sun, thinning as it goes
  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    out.push(shape(`${id}/smoke${i}`, "smoke", ellipse([x + 16 + f * 150 * smoke, base - h - 16 - f * 46 * smoke], (20 + 30 * f) * smoke, (12 + 14 * f) * smoke, -0.3, 6), { ...set, opacity: 0.62 - 0.4 * f }));
  }
  out.push(shape(`${id}/stack`, mat, [[x - w / 2, base], [x - w * 0.3, base - h], [x + w * 0.3, base - h], [x + w / 2, base]], set));
  out.push(shape(`${id}/lip`, mat, box(x - w * 0.38, base - h - 5, x + w * 0.38, base - h + 3), set));
  return out;
}

export function buildYard(o: YardOpts): YardOut {
  const { GY, u, x0, x1, y0, y1, wallTop } = o;
  const seed = o.seed ?? 1;
  const junction = GY - 0.36 * u;
  const span = x1 - x0;

  // far skyline: low roofs, a dome and two pairs of minarets
  const far: Pt[] = [[x0, wallTop + 4]];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = 46 + 70 * hash(seed * 3.7 + i);
    const h = 28 + 62 * hash(seed * 9.1 + i * 1.7);
    far.push([x, wallTop - h], [x + w, wallTop - h]);
    x += w;
    i++;
  }
  far.push([x1, wallTop + 4]);
  const skyFar: Shape[] = [shape("yard/far", "sky.far", far, set)];
  skyFar.push(shape("yard/far.dome", "sky.far", ellipse([x0 + span * 0.3, wallTop - 78], 64, 46, 0, 6), set));
  skyFar.push(...minaret("yard/min0", "sky.far", x0 + span * 0.22, wallTop, 2.0 * u, 0.19 * u));
  skyFar.push(...minaret("yard/min1", "sky.far", x0 + span * 0.38, wallTop, 2.0 * u, 0.19 * u));
  skyFar.push(...minaret("yard/min2", "sky.far", x0 + span * 0.8, wallTop, 1.5 * u, 0.15 * u));

  // nearer: the mills, with saw-tooth roofs and three stacks
  const skyMid: Shape[] = [];
  const teeth: Pt[] = [[x0 + span * 0.48, wallTop + 4]];
  for (let k = 0; k < 6; k++) {
    const tx = x0 + span * 0.48 + k * 0.42 * u;
    teeth.push([tx, wallTop - 0.42 * u], [tx + 0.42 * u, wallTop - 0.16 * u]);
  }
  teeth.push([x0 + span * 0.48 + 6 * 0.42 * u, wallTop + 4]);
  skyMid.push(...chimney("yard/ch0", "sky.mid", x0 + span * 0.56, wallTop, 2.5 * u, 0.26 * u, 1));
  skyMid.push(...chimney("yard/ch1", "sky.mid", x0 + span * 0.67, wallTop, 1.9 * u, 0.22 * u, 0.75));
  skyMid.push(...chimney("yard/ch2", "sky.mid", x0 + span * 0.1, wallTop, 1.55 * u, 0.2 * u, 0.6));
  skyMid.push(shape("yard/mill", "sky.mid", teeth, set));
  skyMid.push(shape("yard/tank", "sky.mid", box(x0 + span * 0.9, wallTop - 0.7 * u, x0 + span * 0.9 + 0.5 * u, wallTop - 0.34 * u), set));
  skyMid.push(shape("yard/tank.legs", "sky.mid", box(x0 + span * 0.9 + 0.06 * u, wallTop - 0.36 * u, x0 + span * 0.9 + 0.44 * u, wallTop + 4), { ...set, opacity: 0.8 }));

  // the yard wall: plaster over brick, a coping on top, a plinth at the foot
  const wallBox = box(x0, wallTop, x1, junction);
  const wall: Shape[] = [
    shape("yard/wall", "yard.wall", box(x0, wallTop, x1, junction + 1.2 * u), set),
    shape("yard/plinth", "yard.plinth", box(x0, junction - 0.42 * u, x1, junction + 1.2 * u), set),
    shape("yard/plinth.line", "yard.stain", box(x0, junction - 0.42 * u, x1, junction - 0.42 * u + 5), set),
  ];
  // rain stains running down from the coping
  for (let k = 0; k < 9; k++) {
    const sx = x0 + span * hash(seed * 5.1 + k * 2.3);
    const sw = 14 + 30 * hash(seed + k * 4.1);
    const sl = (0.8 + 1.9 * hash(seed * 2.2 + k)) * u;
    wall.push(shape(`yard/stain${k}`, "yard.stain", [[sx - sw / 2, wallTop + 0.1 * u], [sx + sw / 2, wallTop + 0.1 * u], [sx + sw * 0.18, wallTop + sl], [sx - sw * 0.12, wallTop + sl * 0.86]], { ...set, opacity: 0.42 }));
  }
  // places where the plaster has come away and the brick shows
  const patch = (k: number, cx: number, cy: number, w: number, h: number) => {
    const pts: Pt[] = [];
    for (let a = 0; a < 9; a++) {
      const th = (a / 9) * Math.PI * 2;
      const r = 0.72 + 0.5 * hash(seed * 4.4 + k * 3 + a * 1.9);
      pts.push([cx + Math.cos(th) * w * r, cy + Math.sin(th) * h * r]);
    }
    const blob = spline(pts, { closed: true, step: 5 });
    wall.push(shape(`yard/brick${k}`, "yard.brick", blob, set));
    // courses of brick: bed joints right across, upright joints staggered from one course to the next
    const course = h * 0.26;
    for (let r = -3; r <= 3; r++) {
      const y = cy + r * course;
      const half = w * 0.78 * Math.sqrt(Math.max(0, 1 - Math.pow((r * course) / (h * 1.05), 2)));
      if (half < 8) continue;
      wall.push(shape(`yard/brick${k}.b${r + 3}`, "yard.mortar", box(cx - half, y - 1.4, cx + half, y + 1.4), { ...set, opacity: 0.65 }));
      for (let c = -4; c <= 4; c++) {
        const x = cx + (c + (r % 2 ? 0.5 : 0)) * course * 2.3;
        if (Math.abs(x - cx) < half - 6) wall.push(shape(`yard/brick${k}.v${r + 3}.${c + 4}`, "yard.mortar", box(x - 1.3, y - course, x + 1.3, y), { ...set, opacity: 0.55 }));
      }
    }
  };
  patch(0, x0 + span * 0.19, wallTop + 2.0 * u, 0.5 * u, 0.36 * u);
  patch(1, x0 + span * 0.46, wallTop + 0.95 * u, 0.4 * u, 0.26 * u);
  patch(2, x0 + span * 0.9, wallTop + 4.0 * u, 0.44 * u, 0.3 * u);
  wall.push(shape("yard/coping", "yard.coping", box(x0, wallTop - 0.09 * u, x1, wallTop + 0.06 * u), set));
  wall.push(shape("yard/coping.under", "yard.stain", box(x0, wallTop + 0.06 * u, x1, wallTop + 0.1 * u), set));

  // the ground: packed earth with cart ruts
  const ground: Shape[] = [shape("yard/ground", "yard.ground", box(x0, junction, x1, y1), set)];
  for (let k = 0; k < 6; k++) {
    const gy = junction + (0.35 + k * 0.5 + 0.3 * hash(seed * 6.6 + k)) * u;
    const gx = x0 + span * hash(seed * 1.9 + k * 5.3);
    ground.push(shape(`yard/rut${k}`, "yard.rut", ellipse([gx, gy], (1.1 + 1.6 * hash(seed + k * 7.7)) * u, 0.035 * u * (1 + k * 0.4), 0.02, 6), { ...set, opacity: 0.4 }));
  }
  return { skyFar, skyMid, wall, ground, wallBox, junction, wallTop, box: { x0, x1, y0, y1 } };
}
