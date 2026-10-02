// The left wall of the room, seen at an angle, with the street door and its rolling shutter.
// A point on this wall is given by how far it is from the back corner (z, toward the camera) and its height (h).
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { clipConvex, roundRect } from "../../engine/geom/outline.ts";
import type { Pt } from "../../engine/geom/vec.ts";
import { FLOOR_K } from "./room.ts";

export const DOOR_PALETTE: Palette = {
  shutter: "#70808a",
  "shutter.rail": "#434f57",
  "street.sky": "#fff5dc",
  "street.far": "#f4dcab",
  "street.door": "#dcb983",
  "street.ground": "#edd4a2",
};

export interface DoorOpts {
  /** x of the room's back-left corner, and y where the back wall meets the floor */
  corner: number;
  junction: number;
  u: number;
  /** how far the drawing has to run to the left, up and down */
  x0: number;
  y0: number;
  y1: number;
  /** height of the opening, head-heights */
  height?: number;
}

export interface ShutterOut {
  shapes: Shape[];
  /** the part of the opening that is clear, as a polygon */
  open: Pt[];
  /** height of the rail above the floor, px */
  rail: number;
}

export interface DoorOut {
  /** the wall itself, in shade */
  solid: Shape[];
  /** what shows through the opening, and the sunlit edge of the wall */
  view: Shape[];
  /** the housing the shutter rolls into */
  housing: Shape[];
  /** the whole opening */
  opening: Pt[];
  /** height of the opening, px */
  H: number;
  /** a point on the wall */
  at(z: number, h: number): Pt;
  /** the shutter when it is `open` (0 = down, 1 = rolled up) */
  shutter(open: number): ShutterOut;
  /** screen x at which someone standing `z` px in front of the back wall passes through the doorway */
  threshold(z: number): number;
}

const flat = { form: "flat", ink: 0, paper: false } as const;

export function buildDoor(o: DoorOpts): DoorOut {
  const { corner, junction, u, x0, y0, y1 } = o;
  const H = (o.height ?? 5.9) * u;
  const zA = 0.1 * u;
  const zB = 2.75 * u;
  const reveal = 0.2 * u;
  const zS = zA + reveal / FLOOR_K;
  // the wall grows a little taller toward the camera, as it would seen from just above head height
  const at = (z: number, h: number): Pt => [corner - FLOOR_K * z, junction + z - h * (1 + (0.7 * z) / H)];
  const quad = (z0: number, z1: number, h0: number, h1: number): Pt[] => [at(z0, h0), at(z1, h0), at(z1, h1), at(z0, h1)];
  const Z = y1 - junction;
  const hd = 2.95 * u;

  const solid: Shape[] = [
    shape("door/wall", "wall", [[x0, y0], [corner, y0], [corner, junction], at(Z, 0), [x0, y1]], { ...flat, tone: "shade" }),
    shape("door/dado", "dado", quad(0, Z, 0, hd), { ...flat, tone: "shade" }),
    shape("door/band", "trim", quad(0, Z, hd - 0.075 * u, hd), { ...flat, tone: "shade" }),
    shape("door/skirt", "trim", quad(0, Z, 0, 0.13 * u), { ...flat, tone: "shade" }),
  ];

  // through the opening: morning sky, the sunlit wall across the lane, the lane itself
  const opening = quad(zS, zB, 0, H);
  const xs = opening.map((p) => p[0]);
  const xa = Math.min(...xs) - 4;
  const xb = Math.max(...xs) + 4;
  const band = (id: string, mat: string, ya: number, yb: number, extra: Partial<Shape> = {}): Shape[] => {
    const c = clipConvex([[xa, ya], [xb, ya], [xb, yb], [xa, yb]], opening);
    return c.length >= 3 ? [shape(id, mat, c, { ...flat, ...extra })] : [];
  };
  const laneTop = junction - 3.9 * u;
  const laneFoot = junction - 0.5 * u;
  const view: Shape[] = [
    shape("door/sky", "street.sky", opening, flat),
    ...band("door/far", "street.far", laneTop, laneFoot),
    ...band("door/far.cap", "street.door", laneTop, laneTop + 0.09 * u),
    ...band("door/ground", "street.ground", laneFoot, y1),
  ];
  // a doorway and a window on the far wall, kept pale: this is a glare, not a picture
  const far = (id: string, cx: number, w: number, ya: number, yb: number): Shape[] => {
    const c = clipConvex([[cx - w / 2, ya], [cx + w / 2, ya], [cx + w / 2, yb], [cx - w / 2, yb]], opening);
    return c.length >= 3 ? [shape(id, "street.door", c, flat)] : [];
  };
  const mx = (xa + xb) / 2;
  view.push(...far("door/far.door", mx - 0.5 * u, 0.62 * u, laneFoot - 1.9 * u, laneFoot));
  view.push(...far("door/far.win", mx + 0.62 * u, 0.5 * u, laneFoot - 2.5 * u, laneFoot - 1.7 * u));
  // the thickness of the wall at the back jamb catches the sun
  view.push(shape("door/reveal", "wall.sun", quad(zA, zS, 0, H), flat));
  view.push(shape("door/sill", "floor.sun", [at(zA, 0), at(zB, 0), [at(zB, 0)[0] - 0.16 * u, at(zB, 0)[1]], [at(zA, 0)[0] - 0.16 * u, at(zA, 0)[1]]], flat));

  const housing: Shape[] = [
    shape("door/box", "shutter", quad(zA - 0.04 * u, zB + 0.14 * u, H, H + 0.52 * u), { ...flat, tone: "shade" }),
    shape("door/box.lip", "shutter.rail", quad(zA - 0.04 * u, zB + 0.14 * u, H - 0.035 * u, H + 0.04 * u), flat),
    shape("door/guide", "shutter.rail", quad(zB, zB + 0.07 * u, 0, H), flat),
  ];

  const slat = 0.3 * u;
  const railH = 0.17 * u;
  const shutter = (open: number): ShutterOut => {
    const rail = Math.max(0, Math.min(1, open)) * (H - 0.04 * u);
    const shapes: Shape[] = [];
    for (let k = 0, h = rail + railH; h < H; k++, h += slat) {
      shapes.push(shape(`door/slat${k}`, "shutter", quad(zS, zB, h, Math.min(H, h + slat)), { ...flat, tone: k % 2 ? "shade" : "base" }));
      shapes.push(shape(`door/slat${k}.gap`, "shutter.rail", quad(zS, zB, h, Math.min(H, h + 0.03 * u)), { ...flat, opacity: 0.5 }));
    }
    if (rail < H - railH) {
      shapes.push(shape("door/rail", "shutter.rail", quad(zS, zB, rail, rail + railH), flat));
      const m = at((zS + zB) / 2, rail + railH * 0.5);
      shapes.push(shape("door/handle", "shutter", roundRect(m, 0.13 * u, 0.028 * u, 3, -0.6), { ...flat, tone: "light" }));
    }
    return { shapes, open: quad(zS, zB, 0, rail), rail };
  };

  return { solid, view, housing, opening, H, at, shutter, threshold: (z: number) => corner - FLOOR_K * z };
}
