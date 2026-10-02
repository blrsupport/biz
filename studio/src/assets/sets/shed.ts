// The mushroom shed: the bare room of room.ts re-dressed as a mud-walled, thatched village shed, seen side-on.
// Daylight comes in low through the doorway in the left wall; the underside of the thatch closes the top of the frame;
// a bamboo pole on two posts carries the ropes the grow bags hang from. With `lab: true` the same room is whitewashed,
// gets a window in the back wall at right, and the floor is cement (the colours are LAB_PALETTE, same names).
import { fade, fill, group, paint, rect, shadow, type Item, type Space } from "../../engine/draw/list.ts";
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, clipConvex, clockwise, ellipse, roundRect } from "../../engine/geom/outline.ts";
import { unit, type Pt } from "../../engine/geom/vec.ts";
import type { SceneLight } from "../../engine/look/color.ts";
import { hash } from "../../engine/motion/track.ts";
import { FLOOR_K, buildRoom, type RoomOut } from "./room.ts";

const SHARED: Palette = {
  thatch: "#8d6c3e",
  "thatch.dark": "#3e2d1d",
  bamboo: "#a98a50",
  "door.wood": "#5d4330",
  "out.sky": "#fff1d4",
  "out.sky.low": "#f8d29c",
  "out.far": "#d8ab78",
  "out.roof": "#9c7a4e",
  "out.ground": "#e8c48f",
  jamb: "#1d1512",
  "jamb.edge": "#6b4b34",
  dust: "#fff2d2",
  "lamp.glow": "#ffc46b",
};

/** The shed: mud plaster, a darker dung-plastered plinth, a beaten-earth floor. Cool shade, warm doorlight. */
export const SHED_PALETTE: Palette = {
  ...SHARED,
  wall: "#ddc7a3",
  "wall.sun": "#f6dcae",
  dado: "#7a5e44",
  "dado.sun": "#c39667",
  trim: "#5a4533",
  "trim.sun": "#9b7754",
  floor: "#6f5c4a",
  "floor.sun": "#caa175",
  "floor.line": "#5d4b3c",
  "shed.air.top": "#2a1d16",
  "shed.air.far": "#1c1820",
  "shed.air.sun": "#ffe6b2",
  "shed.air.near": "#1e1511",
  "shed.air.dark": "#0c0a0b",
  "shed.dusk": "#1b2238",
};

/** The same room made into the lab: whitewashed walls over a pale lime-green plinth, a cement floor, morning air. */
export const LAB_PALETTE: Palette = {
  ...SHARED,
  wall: "#d9ddd6",
  "wall.sun": "#fbf2da",
  dado: "#a7bdb4",
  "dado.sun": "#d9e4c9",
  trim: "#87a097",
  "trim.sun": "#bcd0b4",
  floor: "#958f86",
  "floor.sun": "#e0d1b0",
  "floor.line": "#857f77",
  "shed.air.top": "#2c3c44",
  "shed.air.far": "#22323c",
  "shed.air.sun": "#fff3cf",
  "shed.air.near": "#262126",
  "shed.air.dark": "#0e1419",
  "shed.dusk": "#1b2238",
  "win.sky": "#e9f3f2",
  "win.far": "#cfe0c8",
  "win.bar": "#3d3a3c",
};

/** Daylight through the doorway at frame left, late in the day: a pale warm key and a cool, bluish shade. */
export const LIGHT_SHED: SceneLight = { dir: unit([-0.9, -0.44]), key: "#ffe2b0", ambient: "#5b6488", strength: 0.82, rim: 1 };
/** The lab in the morning: a clearer, whiter key from the door, a cool ambient from the new window. */
export const LIGHT_LAB: SceneLight = { dir: unit([-0.84, -0.54]), key: "#fff0cf", ambient: "#7287ab", strength: 0.8, rim: 1 };

export interface ShedOpts {
  GY: number;
  u: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** x of the back-left corner; the doorway is in the left wall */
  corner: number;
  /** height of the doorway, head-heights (default 5.3) */
  doorH?: number;
  /** lower edge of the thatch, head-heights above the floor line (default 7.6) */
  thatchAt?: number;
  /** the bamboo pole the ropes hang from: height (head-heights) and its two posts (x) */
  poleAt?: number;
  posts?: [number, number];
  sunAt?: number;
  sunSlope?: number;
  sunDepth?: number;
  lab?: boolean;
  /** lab only: middle of the new window in the back wall */
  windowX?: number;
}

export interface ShedOut {
  room: RoomOut;
  lab: boolean;
  pal: Palette;
  junction: number;
  /** marks and patches of the plaster, and cracks: on the wall, in front of the paint */
  texture: Shape[];
  thatch: Shape[];
  /** the left wall in shade, what shows through the doorway, the door frame */
  doorSolid: Shape[];
  doorView: Shape[];
  doorFrame: Shape[];
  opening: Pt[];
  doorTop: number;
  /** a point on the left wall: z toward the camera from the back corner, h above the floor */
  at(z: number, h: number): Pt;
  /** screen x at which someone standing z px in front of the back wall passes the threshold */
  threshold(z: number): number;
  /** the pole and its posts, and where the ropes start */
  rack: Shape[];
  poleY: number;
  /** lab: the window in the back wall, its glass, and the patch of light it lays on the wall */
  window: Shape[];
  windowPane: Pt[];
}

const flat = { form: "flat", ink: 0, paper: false } as const;
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function buildShed(o: ShedOpts): ShedOut {
  const { GY, u, x0, x1, y0, y1, corner } = o;
  const lab = !!o.lab;
  const room = buildRoom({ GY, u, x0, x1, y0, y1, corner, sunAt: o.sunAt ?? 4.2, sunSlope: o.sunSlope ?? 0.42, sunDepth: o.sunDepth ?? 2.6, boardX: null, bulbX: null });
  const junction = room.junction;

  // ---- the plaster: soft patches where it was smoothed again, a few cracks; none high on the wall where type goes
  const texture: Shape[] = [];
  const thatchY = junction - (o.thatchAt ?? 7.6) * u;
  const calmTo = junction - 5.4 * u;
  for (let i = 0; i < 26; i++) {
    const x = x0 + (x1 - x0) * hash(i * 3.7 + 0.3);
    const y = calmTo + (room.dadoTop - calmTo) * hash(i * 5.1 + 1.7);
    const r = (0.25 + 0.5 * hash(i * 2.3)) * u;
    texture.push(shape(`shed/patch${i}`, "wall", ellipse([x, y], r * 1.5, r * 0.7, (hash(i) - 0.5) * 0.6, 4), { ...flat, tone: i % 2 ? "light" : "shade", opacity: lab ? 0.08 : 0.22 }));
  }
  for (let i = 0; i < 14; i++) {
    const x = x0 + (x1 - x0) * hash(i * 7.3 + 4.1);
    const y = room.dadoTop + (junction - room.dadoTop) * hash(i * 1.9 + 2.2) * 0.8;
    const r = (0.2 + 0.3 * hash(i * 4.4)) * u;
    texture.push(shape(`shed/plinth${i}`, "dado", ellipse([x, y], r * 1.6, r * 0.6, 0, 4), { ...flat, tone: i % 2 ? "light" : "shade", opacity: lab ? 0.06 : 0.25 }));
  }
  for (let i = 0; i < 7; i++) {
    let p: Pt = [x0 + (x1 - x0) * hash(i * 9.1 + 5), room.dadoTop - (0.2 + 1.6 * hash(i * 3.9)) * u];
    for (let k = 0; k < 3; k++) {
      const q: Pt = [p[0] + (hash(i * 11 + k) - 0.5) * 0.5 * u, p[1] + (0.25 + 0.2 * hash(i * 13 + k)) * u];
      texture.push(shape(`shed/crack${i}_${k}`, "trim", capsule(p, q, 1.6, 1.0, 2), { ...flat, opacity: lab ? 0.15 : 0.55 }));
      p = q;
    }
  }

  // ---- the underside of the thatch: straw over bamboo rafters, a ragged fringe of straw along its lower edge
  const thatch: Shape[] = [shape("shed/thatch", "thatch", box(x0, y0, x1, thatchY + 0.06 * u), { ...flat, tone: "shade" })];
  for (let x = x0, i = 0; x < x1; x += 1.7 * u, i++) {
    thatch.push(shape(`shed/rafter${i}`, "bamboo", capsule([x, thatchY + 0.05 * u], [x + 2.6 * u, y0], 0.07 * u, 0.06 * u, 3), { ...flat, tone: "shade", opacity: 0.85 }));
  }
  for (let x = x0, i = 0; x < x1; x += 0.23 * u, i++) {
    const L = (0.2 + 0.32 * hash(i * 1.37 + 0.2)) * u;
    const lean = (hash(i * 2.71) - 0.5) * 0.14 * u;
    const w = (0.07 + 0.05 * hash(i * 3.3)) * u;
    thatch.push(shape(`shed/straw${i}`, "thatch", [[x - w, thatchY - 0.08 * u], [x + w, thatchY - 0.08 * u], [x + lean + 2, thatchY + L], [x + lean - 2, thatchY + L]], { ...flat, tone: i % 3 === 0 ? "light" : i % 3 === 1 ? "base" : "shade" }));
  }
  thatch.push(shape("shed/beam", "bamboo", box(x0, thatchY - 0.04 * u, x1, thatchY + 0.11 * u), { form: "plane", facing: [0, 1], ink: 0.6 }));
  for (let x = x0 + 0.8 * u, i = 0; x < x1; x += 1.7 * u, i++) {
    thatch.push(shape(`shed/lash${i}`, "mush.rope", roundRect([x, thatchY + 0.035 * u], 0.05 * u, 0.09 * u, 2), { ...flat, tone: "shade" }));
  }

  // ---- the left wall and its doorway (the geometry of door.ts: the wall recedes toward the camera)
  const H = (o.doorH ?? 5.3) * u;
  const zA = 0.1 * u;
  const zB = 2.75 * u;
  const reveal = 0.24 * u;
  const zS = zA + reveal / FLOOR_K;
  const at = (z: number, h: number): Pt => [corner - FLOOR_K * z, junction + z - h * (1 + (0.7 * z) / H)];
  const quad = (za: number, zb: number, ha: number, hb: number): Pt[] => [at(za, ha), at(zb, ha), at(zb, hb), at(za, hb)];
  const Z = y1 - junction;
  const hd = 2.95 * u;
  const doorSolid: Shape[] = [
    shape("door/wall", "wall", [[x0, y0], [corner, y0], [corner, junction], at(Z, 0), [x0, y1]], { ...flat, tone: "shade" }),
    shape("door/dado", "dado", quad(0, Z, 0, hd), { ...flat, tone: "shade" }),
    shape("door/band", "trim", quad(0, Z, hd - 0.075 * u, hd), { ...flat, tone: "shade" }),
  ];
  const opening = quad(zS, zB, 0, H);
  const xs = opening.map((p) => p[0]);
  const xa = Math.min(...xs) - 4;
  const xb = Math.max(...xs) + 4;
  const clip = (id: string, mat: string, pts: Pt[], extra: Partial<Shape> = {}): Shape[] => {
    const c = clipConvex(pts, opening);
    return c.length >= 3 ? [shape(id, mat, c, { ...flat, ...extra })] : [];
  };
  const horizon = junction - 1.9 * u;
  const doorView: Shape[] = [
    shape("door/sky", "out.sky", opening, flat),
    ...clip("door/sky.low", "out.sky.low", box(xa, horizon - 1.2 * u, xb, horizon)),
  ];
  // the village outside, kept pale: a glare, not a picture. Low huts under thatch, a tree.
  for (let i = 0; i < 3; i++) {
    const cx = xa + (xb - xa) * (0.2 + 0.32 * i);
    const hw = (0.55 + 0.25 * hash(i * 3.1)) * u;
    const top = horizon - (0.55 + 0.25 * hash(i * 5.3)) * u;
    doorView.push(...clip(`door/hut${i}`, "out.far", box(cx - hw, top, cx + hw, horizon + 0.1 * u)));
    doorView.push(...clip(`door/roof${i}`, "out.roof", [[cx - hw - 0.25 * u, top + 0.05 * u], [cx, top - 0.55 * u], [cx + hw + 0.25 * u, top + 0.05 * u]]));
  }
  doorView.push(...clip("door/tree", "out.far", ellipse([xa + (xb - xa) * 0.82, horizon - 1.7 * u], 0.9 * u, 0.7 * u, 0, 6), { opacity: 0.8 }));
  doorView.push(...clip("door/ground", "out.ground", box(xa, horizon, xb, y1)));
  doorView.push(shape("door/reveal", "wall.sun", quad(zA, zS, 0, H), flat));
  doorView.push(shape("door/sill", "floor.sun", [at(zA, 0), at(zB, 0), [at(zB, 0)[0] - 0.16 * u, at(zB, 0)[1]], [at(zA, 0)[0] - 0.16 * u, at(zA, 0)[1]]], flat));
  const doorFrame: Shape[] = [
    shape("door/post.back", "door.wood", quad(zS - 0.02 * u, zS + 0.1 * u, 0, H), { form: "plane", facing: [1, 0], ink: 0.6 }),
    shape("door/post.front", "door.wood", quad(zB - 0.04 * u, zB + 0.16 * u, 0, H), { ...flat, tone: "shade" }),
    shape("door/lintel", "door.wood", quad(zA - 0.04 * u, zB + 0.2 * u, H - 0.02 * u, H + 0.2 * u), { ...flat, tone: "shade" }),
  ];

  // ---- the hanging frame: a bamboo pole across the room on two posts
  const poleY = junction - (o.poleAt ?? 4.6) * u;
  const [pa, pb] = o.posts ?? [corner + 1.1 * u, corner + 7.6 * u];
  const rack: Shape[] = [];
  for (const [i, px] of [pa, pb].entries()) {
    rack.push(shape(`rack/post${i}`, "bamboo", box(px - 0.06 * u, poleY - 0.15 * u, px + 0.06 * u, junction + 0.22 * u), { depth: 0.08 * u }));
    for (let k = 0; k < 3; k++) rack.push(shape(`rack/node${i}_${k}`, "bamboo", box(px - 0.07 * u, poleY + (0.6 + 1.3 * k) * u, px + 0.07 * u, poleY + (0.63 + 1.3 * k) * u), { ...flat, tone: "shade" }));
  }
  rack.push(shape("rack/pole", "bamboo", box(pa - 0.5 * u, poleY - 0.07 * u, pb + 0.5 * u, poleY + 0.07 * u), { depth: 0.06 * u }));
  for (let x = pa + 1.3 * u, k = 0; x < pb - 0.5 * u; x += 1.3 * u, k++) rack.push(shape(`rack/node${k}`, "bamboo", box(x, poleY - 0.075 * u, x + 0.03 * u, poleY + 0.075 * u), { ...flat, tone: "shade" }));
  for (const [i, px] of [pa, pb].entries()) rack.push(shape(`rack/lash${i}`, "mush.rope", roundRect([px, poleY], 0.09 * u, 0.1 * u, 3), { ...flat, tone: "shade" }));

  // ---- lab: a window knocked through the back wall at right, with bars and a deep sill
  const window: Shape[] = [];
  let windowPane: Pt[] = [];
  if (lab) {
    const wx = o.windowX ?? corner + 6 * u;
    const wy = junction - 4.4 * u;
    const hw = 0.85 * u;
    const hh = 0.95 * u;
    windowPane = box(wx - hw, wy - hh, wx + hw, wy + hh);
    window.push(shape("win/frame", "door.wood", box(wx - hw - 0.12 * u, wy - hh - 0.12 * u, wx + hw + 0.12 * u, wy + hh + 0.16 * u), { form: "plane", facing: [0, 0], ink: 0.6 }));
    window.push(shape("win/sky", "win.sky", windowPane, flat));
    window.push(shape("win/far", "win.far", [[wx - hw, wy + 0.2 * hh], [wx - 0.2 * hw, wy - 0.1 * hh], [wx + 0.5 * hw, wy + 0.15 * hh], [wx + hw, wy], [wx + hw, wy + hh], [wx - hw, wy + hh]], flat));
    window.push(shape("win/reveal", "wall.sun", [[wx - hw, wy - hh], [wx - hw + 0.14 * u, wy - hh + 0.1 * u], [wx - hw + 0.14 * u, wy + hh], [wx - hw, wy + hh]], flat));
    for (let i = 0; i < 4; i++) {
      const bx = wx - hw + ((i + 1) / 5) * 2 * hw;
      window.push(shape(`win/bar${i}`, "win.bar", box(bx - 3, wy - hh, bx + 3, wy + hh), { ...flat, ink: 0.4 }));
    }
    window.push(shape("win/sill", "wall", box(wx - hw - 0.2 * u, wy + hh + 0.1 * u, wx + hw + 0.2 * u, wy + hh + 0.24 * u), { form: "plane", facing: [0, -1], ink: 0.6 }));
  }

  return {
    room,
    lab,
    pal: lab ? LAB_PALETTE : SHED_PALETTE,
    junction,
    texture,
    thatch,
    doorSolid,
    doorView,
    doorFrame,
    opening,
    doorTop: at(zS, H)[1],
    at,
    threshold: (z: number) => corner - FLOOR_K * z,
    rack,
    poleY,
    window,
    windowPane,
  };
}

/** A rope from the pole down to y (the bags are tied along it). */
export function shedRope(id: string, x: number, from: number, to: number, swing = 0): Shape {
  return shape(id, "mush.rope", capsule([x, from], [x + swing, to], 2.2, 1.8, 2), { form: "flat", tone: "shade", ink: 0, paper: false });
}

// ---------------------------------------------------------------------------------------------------------------
// The shed as display items, in two parts, so that actors and type can go between them
// ---------------------------------------------------------------------------------------------------------------

/**
 * The back wall: plaster, sun patch, `behind` (things just in front of the wall that the air should dim),
 * the air of the room, and `inner` (what is written or hung on the wall). The thatch is `shedTop`, drawn last.
 */
export function shedBack(s: ShedOut, o: { id: string; space: Space; glow?: number; behind?: Item[]; inner?: Item[] }): Item[] {
  const room = s.room;
  const { x0, x1, y0 } = room.box;
  const a = room.air;
  const P = s.pal;
  const glow = o.glow ?? 1;
  const items: Item[] = [paint(`${o.id}/wall`, o.space, [...room.wall, ...room.wallSun, ...s.texture, ...s.window]), ...(o.behind ?? [])];
  items.push(
    fill(`${o.id}/air.top`, o.space, { kind: "linear", x1: 0, y1: a.top, x2: 0, y2: a.top + 820, stops: fade(P["shed.air.top"], 0.2, 0) }, [rect(x0, y0, x1 - x0, a.top + 820 - y0)]),
    fill(`${o.id}/air.far`, o.space, { kind: "linear", x1: a.farFrom, y1: 0, x2: a.farTo, y2: 0, stops: fade(P["shed.air.far"], 0, 0.34) }, [rect(a.farFrom, y0, x1 - a.farFrom, room.junction - y0)]),
  );
  if (glow > 0.01) {
    items.push(fill(`${o.id}/air.sun`, o.space, { kind: "radial", cx: a.sunX, cy: a.sunY, r: 860, stops: fade(P["shed.air.sun"], 0.46 * glow, 0) }, [rect(a.sunX - 860, a.sunY - 860, 1720, Math.min(1720, room.junction - a.sunY + 860))]));
  }
  items.push(...(o.inner ?? []));
  return items;
}

/** The underside of the thatch, over everything else at the top of the frame (the left wall too). */
export function shedTop(s: ShedOut, o: { id: string; space: Space }): Item[] {
  return [paint(`${o.id}/thatch`, o.space, s.thatch)];
}

/** The floor: earth (or cement) in shade, the patch of doorlight, and inside it the shadows of what stands on it. */
export function shedFloor(s: ShedOut, o: { id: string; space: Space; casters: readonly Shape[]; groundY: number; stretch?: number; drop?: number }): Item[] {
  const room = s.room;
  const { x0, x1, y1 } = room.box;
  const items: Item[] = [paint(`${o.id}/floor`, o.space, [...room.floor, ...room.floorSunShapes])];
  if (room.floorSun.length) {
    items.push(group(`${o.id}/cast`, o.space, [shadow(`${o.id}/cast.on`, o.space, o.casters, "floor", { tone: "base", ground: { y: o.groundY, stretch: o.stretch ?? 0.5, drop: o.drop ?? 0.3 } })], { clip: [room.floorSun] }));
  }
  items.push(fill(`${o.id}/air.near`, o.space, { kind: "linear", x1: 0, y1: room.junction + 150, x2: 0, y2: room.air.nearTo, stops: fade(s.pal["shed.air.near"], 0, 0.42) }, [rect(x0, room.junction + 150, x1 - x0, y1 - room.junction - 150)]));
  return items;
}

/**
 * A dark mud door jamb close to the lens, for going in and out of the shed: a slab whose lit edge is at `edge`
 * (screen x), filling everything to the left of it (`side` -1) or to the right (`side` 1). Screen coordinates.
 */
export function shedJamb(id: string, edge: number, side: -1 | 1, W: number, Hgt: number, u: number): Shape[] {
  const far = side < 0 ? -W : 2 * W;
  const pts: Pt[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const y = -60 + ((Hgt + 120) * i) / n;
    pts.push([edge + side * -1 * (hash(i * 3.3 + 0.7) - 0.5) * 0.12 * u, y]);
  }
  const slab: Pt[] = side < 0 ? [[far, -60], ...pts.map((p) => p), [far, Hgt + 60]] : [[far, Hgt + 60], ...pts.slice().reverse(), [far, -60]];
  const lip: Pt[] = pts.map((p) => [p[0] - side * 0.16 * u, p[1]] as Pt);
  const edgeStrip: Pt[] = side < 0 ? [...lip, ...pts.slice().reverse()] : [...pts, ...lip.slice().reverse()];
  return [shape(`${id}/slab`, "jamb", clockwise(slab), { form: "flat", ink: 0, paper: false }), shape(`${id}/edge`, "jamb.edge", clockwise(edgeStrip), { form: "flat", ink: 0, paper: false, opacity: 0.85 })];
}
