// Bihar Mushroom: the village lane that "s1" and "home" share (today and the early 2000s are the same place).
// The set is built once here; each sequence lists it in its frame with its own light and sky.
import { CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { MUSHROOM_PALETTE } from "../../../assets/props/mushroom.ts";
import { TIN_PALETTE } from "../../../assets/props/tin.ts";
import { VILLAGE_PROPS_PALETTE, handPump, strawStack } from "../../../assets/props/village.ts";
import { VILLAGE_PALETTE, bananaPlant, farCity, farHills, fields, grassTufts, lane, mudHouse, tree, yardGround } from "../../../assets/sets/village.ts";
import { fade, fill, paint, rect, type Item } from "../../../engine/draw/list.ts";
import { mergePalettes, shape, type Palette, type Shape } from "../../../engine/draw/shape.ts";
import { ellipse } from "../../../engine/geom/outline.ts";
import type { Actor, Solved } from "../../../engine/motion/actor.ts";
import { PALETTE } from "../palette.ts";

export const LANE = { W: 1080, HGT: 1920, U: 172, GY: 1500 } as const;
export const LANE_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE, VILLAGE_PALETTE, VILLAGE_PROPS_PALETTE, TIN_PALETTE, MUSHROOM_PALETTE);
const P = LANE_PALETTE;
const { U, GY, W, HGT } = LANE;

/** How far behind (or in front of) the actors each layer is, for the camera's parallax. */
export const DEPTH = { sky: 6, far: 4, type: 30, fields: 1.6, house: 0.35, pump: 0.12, near: -0.3, lens: -0.6 } as const;
export const JUNCTION = GY - 0.36 * U;
/** the horizon, where the fields meet the sky */
export const HORIZON = 1012;
export const HOUSE_FOOT = 1262;
/** px per head-height of a person standing by the house, across the lane */
export const HU = 112;

export const HOUSE = mudHouse("house", { x: 300, foot: HOUSE_FOOT, u: HU, seed: 3 });
export const SET = {
  far: [...farHills("hills", { x0: -700, x1: 900, base: HORIZON + 4, hi: 270, seed: 3 }), ...farCity("city", { x0: 780, x1: 1900, base: HORIZON + 4, seed: 7 })],
  fields: fields("fields", { x0: -3600, x1: 2700, top: HORIZON, bottom: 1330, seed: 4 }),
  yard: yardGround("yard", { x0: -3600, x1: 2700, top: HOUSE_FOOT - 8, bottom: 1700, u: HU, seed: 2 }),
  trees: [...tree("tree0", { x: 1900, foot: HOUSE_FOOT - 30, h: 620, seed: 2 }), ...tree("tree1", { x: -1300, foot: HOUSE_FOOT - 40, h: 560, seed: 9 }), ...tree("tree2", { x: -2500, foot: HOUSE_FOOT - 36, h: 600, seed: 4 })],
  straw: [...strawStack("straw", { x: 1440, ground: HOUSE_FOOT + 6, w: 360, h: 300, seed: 4 }), ...strawStack("straw2", { x: -950, ground: HOUSE_FOOT + 6, w: 300, h: 250, seed: 8 })],
  lane: lane("lane", { x0: -3600, x1: 2700, top: JUNCTION, bottom: 2600, u: U, seed: 6 }),
  near: grassTufts("near", { x0: -3400, x1: 1900, y: 1990, h: 120, count: 46, seed: 5 }),
};
/** banana plants in the house layer (they sway, so they are built each frame) */
export const BANANAS = [
  { id: "banana0", x: 1060, foot: HOUSE_FOOT + 4, h: 460, seed: 2 },
  { id: "banana1", x: -280, foot: HOUSE_FOOT + 2, h: 400, seed: 5 },
  { id: "banana2", x: 1300, foot: HOUSE_FOOT + 6, h: 380, seed: 8 },
  { id: "banana3", x: -1750, foot: HOUSE_FOOT + 4, h: 440, seed: 11 },
];
export const PUMP = { x: 1000, ground: JUNCTION + 6, u: 150, dir: -1 as const };
export const PUMP_SHAPES: Shape[] = handPump("pump", { ...PUMP, handle: 0 }).shapes;

const SCREEN = [rect(-80, -80, W + 160, HGT + 160)];
export type SkyKind = "morning" | "afternoon";
/** what writing across this sky stands against */
export const SKY_OVER: Record<SkyKind, string[]> = {
  morning: [P["vil.sky.top"], P["vil.sky.band"], P["vil.sky.low"], P["vil.sun.glow"]],
  afternoon: [P["vil.sky.pm.top"], P["vil.sky.band"], P["vil.sky.pm.low"], P["vil.sun.pm"]],
};

/** The sky, the low sun, and the far horizon (what a sequence writes across the sky goes after these). */
export function laneSky(sky: SkyKind, birds: Shape[]): Item[] {
  const am = sky === "morning";
  return [
    fill("sky", "screen", { kind: "linear", x1: 0, y1: -60, x2: 0, y2: 1060, stops: [{ at: 0, color: P[am ? "vil.sky.top" : "vil.sky.pm.top"], a: 1 }, { at: 0.55, color: P["vil.sky.band"], a: 1 }, { at: 1, color: P[am ? "vil.sky.low" : "vil.sky.pm.low"], a: 1 }] }, SCREEN),
    fill("sky.glow", "screen", { kind: "radial", cx: am ? -60 : W + 60, cy: 860, r: 1000, stops: fade(P[am ? "vil.sun.glow" : "vil.sun.pm"], 0.95, 0) }, SCREEN),
    paint("birds", DEPTH.sky, birds),
    paint("far", DEPTH.far, SET.far),
    fill("far.haze", DEPTH.far, { kind: "linear", x1: 0, y1: HORIZON - 300, x2: 0, y2: HORIZON + 8, stops: fade(P["vil.air.haze"], 0.15, 0.6) }, [rect(-2600, HORIZON - 300, 6000, 320)]),
  ];
}

/** The fields, and the house, plants and straw across the lane, with the air over them. `extra` goes in the house layer. */
export function laneMiddle(t: number, sky: SkyKind, extra: { before?: Shape[]; after?: Shape[] } = {}): Item[] {
  const am = sky === "morning";
  const bananas: Shape[] = BANANAS.flatMap((b, i) => bananaPlant(b.id, { ...b, sway: 0.05 * Math.sin(0.9 * t + 1.9 * i) + 0.02 * Math.sin(2.3 * t + i) }));
  return [
    paint("fields", DEPTH.fields, SET.fields),
    fill("fields.haze", DEPTH.fields, { kind: "linear", x1: 0, y1: HORIZON, x2: 0, y2: HORIZON + 240, stops: fade(P["vil.air.haze"], 0.5, 0) }, [rect(-3600, HORIZON, 6400, 240)]),
    paint("yard", DEPTH.house, SET.yard),
    paint("trees", DEPTH.house, SET.trees),
    paint("house.behind", DEPTH.house, extra.before ?? []),
    paint("house", DEPTH.house, HOUSE.shapes),
    paint("bananas", DEPTH.house, bananas),
    paint("straw", DEPTH.house, SET.straw),
    paint("house.front", DEPTH.house, extra.after ?? []),
    fill("house.warm", DEPTH.house, { kind: "radial", cx: am ? -300 : 1400, cy: 860, r: 1300, stops: fade(P["vil.air.warm"], am ? 0.4 : 0.46, 0) }, [rect(-3600, 300, 6400, 1500)]),
    fill("house.haze", DEPTH.house, { kind: "linear", x1: 0, y1: 500, x2: 0, y2: 1300, stops: fade(P["vil.air.haze"], 0.12, 0.2) }, [rect(-3600, 300, 6400, 1000)]),
  ];
}

/** The pump and the lane, with the warmth of the low sun on it. */
export function laneGround(sky: SkyKind): Item[] {
  return [
    paint("pump", DEPTH.pump, PUMP_SHAPES),
    paint("lane", 0, SET.lane),
    fill("lane.warm", 0, { kind: "radial", cx: sky === "morning" ? -200 : 1300, cy: 1560, r: 1000, stops: fade(P["vil.air.warm"], 0.3, 0) }, [rect(-3600, 1430, 6400, 1200)]),
  ];
}

/** Grass close to the lens, and the darker air at the foot of the frame. */
export function laneNear(): Item[] {
  return [paint("near", DEPTH.near, SET.near), fill("near.air", 0, { kind: "linear", x1: 0, y1: 1640, x2: 0, y2: 2100, stops: fade(P["vil.air.near"], 0, 0.42) }, [rect(-3600, 1640, 6400, 900)])];
}

const flat = { form: "flat", ink: 0, paper: false } as const;
/** Soft shadows under the feet; they fade as a foot leaves the ground. */
export function footContacts(id: string, a: Actor, s: Solved, mat = "vil.lane"): Shape[] {
  return (["L", "R"] as const).map((k) => {
    const f = s.feet[k];
    const lift = Math.min(1, f.lift / (0.3 * a.H));
    return shape(`${id}/contact${k}`, mat, ellipse([f.x + s.fwd * 0.18 * a.H, a.groundY + 5], a.H * (0.44 - 0.12 * lift), a.H * (0.075 - 0.03 * lift), 0, 4), { ...flat, tone: "deep", opacity: 0.42 * (1 - 0.75 * lift) });
  });
}

/** What a figure is when all that shows of it is its outline: one flat tone (villagers, porters). */
const INNER = /eye|glint|brow|mouth|teeth|nose|\.in$|lens|rim|button|placket|collar|bridge|temple|lash/;
export function asShadow(shapes: readonly Shape[], mat = "sil"): Shape[] {
  const out: Shape[] = [];
  for (const s of shapes) if (!INNER.test(s.id)) out.push({ id: s.id, pts: s.pts, mat, form: "flat", ink: 0, paper: false });
  return out;
}
