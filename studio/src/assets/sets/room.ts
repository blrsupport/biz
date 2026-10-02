// The bare rented room of the Minus Degre story, seen side-on.
// Morning sun comes in low through the open shutter at frame left: it lays one long warm patch across the floor
// and up the lower wall. Everything else sits in cool shade. Lit and unlit surfaces are separate materials.
import { fade, fill, group, paint, rect, shadow, type Item, type Space } from "../../engine/draw/list.ts";
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, clipConvex, ellipse, roundRect } from "../../engine/geom/outline.ts";
import type { Pt } from "../../engine/geom/vec.ts";

export const ROOM_PALETTE: Palette = {
  wall: "#b9cbbf",
  "wall.sun": "#f1e3bd",
  dado: "#55837f",
  "dado.sun": "#a3bf93",
  trim: "#3f6664",
  "trim.sun": "#7fa37c",
  floor: "#857d78",
  "floor.sun": "#d3bd98",
  "floor.line": "#766e6a",
  board: "#e9e2d2",
  switch: "#f6f1e6",
  conduit: "#a9b6ad",
  flex: "#3a3438",
  bulb: "#f4ead0",
  holder: "#2f2b30",
  // the air of the room: laid over the surfaces as gradients, never as shapes
  "room.air.top": "#27434d",
  "room.air.far": "#1f3a44",
  "room.air.sun": "#fff0c4",
  "room.air.near": "#2a1f26",
  "room.air.dark": "#0e1a22",
};

/** How far a point on the floor moves left on screen for every pixel it comes toward the camera. */
export const FLOOR_K = 0.83;

export interface RoomOpts {
  /** the line the actors stand on */
  GY: number;
  /** px per head-height: the room is drawn to the scale of the people in it */
  u: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** where the sun's edge crosses the wall at x = 0, in head-heights above the floor, and its slope */
  sunAt?: number;
  sunSlope?: number;
  /**
   * x of the room's back-left corner, when the room has a left wall with the door in it (see door.ts).
   * The sun then comes in from that corner; without it the room simply runs off to the left.
   */
  corner?: number;
  /** how far out from the back wall the sun patch on the floor reaches at the door, head-heights (default 2.9) */
  sunDepth?: number;
  /** x of the switchboard and of the hanging bulb (null leaves one out) */
  boardX?: number | null;
  bulbX?: number | null;
  /** y of the bulb holder (default: 2.05 head-heights below the top of the room) */
  bulbY?: number;
}

export interface RoomSun {
  /** the sunlit part of the wall, painted over it */
  wallSun: Shape[];
  /** the sunlit part of the floor, as a polygon to clip shadows to */
  floorSun: Pt[];
  floorSunShapes: Shape[];
}

export interface RoomOut extends RoomSun {
  /** wall, dado and fittings in shade */
  wall: Shape[];
  /** things on the wall that sit in front of the light (switchboard, conduit, bulb) */
  fittings: Shape[];
  floor: Shape[];
  /** y where the wall meets the floor */
  junction: number;
  dadoTop: number;
  box: { x0: number; x1: number; y0: number; y1: number };
  /** where the soft falloffs of the view sit: the light's centre, the far-end shade, the top shade, the near floor */
  air: { sunX: number; sunY: number; farFrom: number; farTo: number; top: number; nearTo: number };
  /** the sun patches for another height of the sun's edge (a shutter that is still rolling up) */
  sun(sunAt: number): RoomSun;
}

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const set = { form: "flat", ink: 0, paper: false } as const;

export function buildRoom(o: RoomOpts): RoomOut {
  const { GY, u, x0, x1, y0, y1 } = o;
  const junction = GY - 0.34 * u;
  const dadoTop = junction - 2.95 * u;
  const band = 0.075 * u;
  const skirt = 0.13 * u;
  const hasCorner = o.corner !== undefined;
  const corner = o.corner ?? x0;
  const wall: Shape[] = [
    shape("room/wall", "wall", box(x0, y0, x1, dadoTop), set),
    // the dado runs on under the floor, so a camera move never opens a gap between wall and floor
    shape("room/dado", "dado", box(x0, dadoTop, x1, junction + 1.2 * u), set),
    shape("room/band", "trim", box(x0, dadoTop, x1, dadoTop + band), set),
    shape("room/skirt", "trim", box(x0, junction - skirt, x1, junction), set),
  ];

  // sun on the wall: everything under a line that falls to the right; on the floor: a strip along the wall
  const slope = o.sunSlope ?? 0.36;
  const left = hasCorner ? corner - 1.5 * u : x0;
  const depth = (o.sunDepth ?? 2.9) * u;
  const nearSlope = hasCorner ? 0.089 : (0.7 * u) / (x1 - x0);
  const sun = (sunAt: number): RoomSun => {
    const sy = junction - sunAt * u;
    const edge = (x: number) => sy + slope * x;
    const yBot = junction + 4;
    if (edge(left) >= yBot - 2) return { wallSun: [], floorSun: [], floorSunShapes: [] };
    const xEnd = left + (yBot - edge(left)) / slope; // where the sun's edge comes down to the floor
    const patch: Pt[] = xEnd < x1 ? [[left, edge(left)], [xEnd, yBot], [left, yBot]] : [[left, edge(left)], [x1, edge(x1)], [x1, yBot], [left, yBot]];
    const lit = (id: string, mat: string, pts: Pt[]): Shape[] => {
      const c = clipConvex(pts, patch);
      return c.length >= 3 ? [shape(id, mat, c, set)] : [];
    };
    const wallSun: Shape[] = [
      ...lit("room/wall.sun", "wall.sun", box(x0, y0, x1, dadoTop)),
      ...lit("room/dado.sun", "dado.sun", box(x0, dadoTop, x1, junction)),
      ...lit("room/band.sun", "trim.sun", box(x0, dadoTop, x1, dadoTop + band)),
      ...lit("room/skirt.sun", "trim.sun", box(x0, junction - skirt, x1, junction)),
    ];
    let floorSun: Pt[];
    if (!hasCorner) {
      floorSun = [[x0, junction], [x1, junction], [x1, junction + 2.2 * u], [x0, junction + 2.9 * u]];
    } else if (xEnd - corner < 4) {
      floorSun = [];
    } else {
      // the strip starts on the threshold (the foot of the left wall) and ends on the shadow of the shutter's rail
      const p0: Pt = [corner - FLOOR_K * depth, junction + depth];
      if (xEnd < x1) {
        const s = (xEnd - corner) / (1 - FLOOR_K * nearSlope);
        const d = Math.max(0, depth - nearSlope * s);
        floorSun = [[corner, junction], [xEnd, junction], [xEnd - FLOOR_K * d, junction + d], p0];
      } else {
        floorSun = [[corner, junction], [x1, junction], [x1, p0[1] - nearSlope * (x1 - p0[0])], p0];
      }
    }
    return { wallSun, floorSun, floorSunShapes: floorSun.length ? [shape("room/floor.sun", "floor.sun", floorSun, set)] : [] };
  };

  // fittings: a switchboard fed by a conduit along the wall, and the bulb on its flex
  const fittings: Shape[] = [];
  const bx = o.boardX === undefined ? 118 : o.boardX;
  const by = dadoTop - 0.62 * u;
  if (bx !== null) {
    fittings.push(shape("room/conduit", "conduit", box(x0, by + 0.3 * u - 5, bx - 0.3 * u, by + 0.3 * u + 5), { form: "flat", ink: 0.5, paper: false }));
    fittings.push(shape("room/board", "board", roundRect([bx, by + 0.3 * u], 0.36 * u, 0.3 * u, 6), { form: "plane", facing: [0, 0], ink: 0.8 }));
    for (const [i, dx] of [-0.2, 0.0].entries()) {
      fittings.push(shape(`room/switch${i}`, "switch", roundRect([bx + dx * u, by + 0.26 * u], 0.07 * u, 0.11 * u, 3), { form: "flat", tone: "light", ink: 0.5, paper: false }));
      fittings.push(shape(`room/switch${i}.rocker`, "board", box(bx + dx * u - 0.04 * u, by + 0.26 * u - 0.01 * u, bx + dx * u + 0.04 * u, by + 0.26 * u + 0.07 * u), { form: "flat", tone: "shade", ink: 0, paper: false }));
    }
    fittings.push(shape("room/socket", "switch", roundRect([bx + 0.2 * u, by + 0.3 * u], 0.085 * u, 0.12 * u, 3), { form: "flat", tone: "light", ink: 0.5, paper: false }));
    for (const [i, p] of ([[-0.035, -0.03], [0.035, -0.03], [0, 0.04]] as Pt[]).entries()) {
      fittings.push(shape(`room/pin${i}`, "holder", ellipse([bx + (0.2 + p[0]) * u, by + (0.3 + p[1]) * u], 2.4, 2.4, 0, 8), { form: "flat", ink: 0, paper: false }));
    }
  }
  const lx = o.bulbX === undefined ? 972 : o.bulbX;
  const ly = o.bulbY ?? y0 + 2.05 * u;
  if (lx !== null) {
    fittings.push(shape("room/flex", "flex", box(lx - 2, y0, lx + 2, ly), { form: "flat", ink: 0, paper: false }));
    fittings.push(shape("room/holder", "holder", roundRect([lx, ly + 0.09 * u], 0.075 * u, 0.1 * u, 3), { form: "flat", ink: 0.5, paper: false }));
    fittings.push(shape("room/bulb", "bulb", ellipse([lx, ly + 0.36 * u], 0.17 * u, 0.2 * u, 0, 5), { depth: 0.08 * u, ink: 0.8 }));
    fittings.push(shape("room/bulb.neck", "bulb", capsule([lx, ly + 0.17 * u], [lx, ly + 0.26 * u], 0.07 * u, 0.1 * u, 4), { depth: 0.05 * u, ink: 0.8 }));
  }

  // floor: in shade, with the sun patch running from the shutter out past frame right
  const floor: Shape[] = [shape("room/floor", "floor", box(x0, junction, x1, y1), set)];
  // faint joints in the cement, converging a little toward the wall
  const span = x1 - x0;
  const joints = hasCorner ? Math.max(5, Math.round(span / 470)) : 5;
  const fan = hasCorner ? 0.3 : 0.55;
  const mid = hasCorner ? corner + 4.5 * u : (x0 + x1) / 2;
  for (let i = 0; i < joints; i++) {
    const fx = x0 + span * ((i + 0.6) / joints);
    floor.push(shape(`room/joint${i}`, "floor.line", [[fx - 2, junction], [fx + 2, junction], [fx + (fx - mid) * fan + 4, y1], [fx + (fx - mid) * fan - 4, y1]], { ...set, opacity: 0.5 }));
  }
  const k = u / 178;
  const air = hasCorner
    ? { sunX: corner + 150 * k, sunY: GY - 632 * k, farFrom: corner + 588 * k, farTo: corner + 1400 * k, top: GY - 1565 * k, nearTo: junction + 536 * k }
    : { sunX: x0 + 150, sunY: y0 + (junction - y0) * 0.62, farFrom: x0 + span * 0.42, farTo: x1, top: y0, nearTo: y1 };
  return { wall, fittings, floor, junction, dadoTop, box: { x0, x1, y0, y1 }, air, sun, ...sun(o.sunAt ?? 3.7) };
}

// ---------------------------------------------------------------------------------------------------------------
// The room as display items, in two parts, so that actors and type can go between them
// ---------------------------------------------------------------------------------------------------------------

/**
 * The back wall: paint, sun patch, the air of the room, then `inner` (whatever is written or hung on the wall),
 * then the fittings. `glow` scales the warm bloom of the light (0 while the shutter is still down).
 * The soft falloffs are gradients, not filters.
 */
export function roomBack(room: RoomOut, o: { id: string; space: Space; glow?: number; inner?: Item[] }): Item[] {
  const { x0, x1, y0 } = room.box;
  const a = room.air;
  const P = ROOM_PALETTE;
  const glow = o.glow ?? 1;
  const items: Item[] = [
    paint(`${o.id}/wall`, o.space, [...room.wall, ...room.wallSun]),
    fill(`${o.id}/air.top`, o.space, { kind: "linear", x1: 0, y1: a.top, x2: 0, y2: a.top + 820, stops: fade(P["room.air.top"], 0.3, 0) }, [rect(x0, y0, x1 - x0, a.top + 820 - y0)]),
    fill(`${o.id}/air.far`, o.space, { kind: "linear", x1: a.farFrom, y1: 0, x2: a.farTo, y2: 0, stops: fade(P["room.air.far"], 0, 0.3) }, [rect(a.farFrom, y0, x1 - a.farFrom, room.junction - y0)]),
  ];
  if (glow > 0.01) {
    items.push(fill(`${o.id}/air.sun`, o.space, { kind: "radial", cx: a.sunX, cy: a.sunY, r: 840, stops: fade(P["room.air.sun"], 0.5 * glow, 0) }, [rect(a.sunX - 840, a.sunY - 840, 1680, Math.min(1680, room.junction - a.sunY + 840))]));
  }
  items.push(...(o.inner ?? []), paint(`${o.id}/fittings`, o.space, room.fittings));
  return items;
}

/**
 * The floor: cement in shade, the sun patch, and inside the patch the shadows of everything that stands on it.
 * A shadow is simply the unlit floor showing, so overlapping shadows never double up.
 */
export function roomFloor(room: RoomOut, o: { id: string; space: Space; casters: readonly Shape[]; groundY: number; stretch?: number; drop?: number }): Item[] {
  const { x0, x1, y1 } = room.box;
  const items: Item[] = [paint(`${o.id}/floor`, o.space, [...room.floor, ...room.floorSunShapes])];
  if (room.floorSun.length) {
    items.push(group(`${o.id}/cast`, o.space, [shadow(`${o.id}/cast.on`, o.space, o.casters, "floor", { tone: "base", ground: { y: o.groundY, stretch: o.stretch ?? 0.5, drop: o.drop ?? 0.3 } })], { clip: [room.floorSun] }));
  }
  items.push(fill(`${o.id}/air.near`, o.space, { kind: "linear", x1: 0, y1: room.junction + 150, x2: 0, y2: room.air.nearTo, stops: fade(ROOM_PALETTE["room.air.near"], 0, 0.44) }, [rect(x0, room.junction + 150, x1 - x0, y1 - room.junction - 150)]));
  return items;
}
