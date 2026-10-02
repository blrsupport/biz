// A village lane in Nalanda, Bihar. Far: blue pine hills at the left end of the horizon, a faint city at the right
// end, flat fields between. Middle: a mud-brick house with a tiled roof and dung cakes drying on its wall, a small
// thatched shed beside it with a dark doorway, banana plants, trees. Near: the packed-earth lane and its grass.
// Every piece takes its place and its size (`u`, px per head-height of a person standing by it) as arguments, so a
// sequence lays the village out as its camera needs. Library pieces: no film text.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { capsule, ellipse, spline, stroke } from "../../engine/geom/outline.ts";
import { add, rot, unit, type Pt } from "../../engine/geom/vec.ts";
import type { SceneLight } from "../../engine/look/color.ts";
import { hash } from "../../engine/motion/track.ts";
import { dungCakes } from "../props/village.ts";
import { brickPatch, chimney, roofline, ruts, stains, tank } from "./dressing.ts";

export const VILLAGE_PALETTE: Palette = {
  // the sky and the air: laid over the surfaces as gradients, never as shapes
  "vil.sky.top": "#7fb0c8",
  "vil.sky.band": "#d3dcc4",
  "vil.sky.low": "#f8e2b2",
  "vil.sun.glow": "#fff0c6",
  "vil.sky.pm.top": "#86a3c2",
  "vil.sky.pm.low": "#f4c487",
  "vil.sun.pm": "#ffd08c",
  "vil.air.haze": "#fae8c2",
  "vil.air.warm": "#ffe0a2",
  "vil.air.near": "#3b2a22",
  "vil.air.shaft": "#fff2c8",
  "vil.dust": "#f4e0b4",
  "vil.smoke": "#ede6d8",
  // far
  "vil.hill.far": "#aebdd4",
  "vil.hill": "#93a8c8",
  "vil.pine": "#7a91b6",
  "vil.city": "#d4d5cd",
  "vil.field.far": "#ccc78f",
  "vil.field": "#b8b36c",
  "vil.crop": "#97a355",
  "vil.bund": "#d2b886",
  "vil.tree.far": "#9faa80",
  "vil.tree": "#6d8448",
  "vil.bark": "#6e5440",
  // the house and the shed
  "vil.mud": "#c99466",
  "vil.lime": "#ece6d6",
  "vil.plinth": "#a8744f",
  "vil.stain": "#ae7c56",
  "vil.brick": "#ad6044",
  "vil.mortar": "#d5a67d",
  "vil.tile": "#b25b3c",
  "vil.tile.dark": "#80402c",
  "vil.door": "#6a4630",
  "vil.frame": "#82593a",
  "vil.dark": "#1d1517",
  "vil.thatch": "#c9a35d",
  "vil.thatch.dark": "#9a773d",
  "vil.pole": "#6d5038",
  "vil.banana": "#79a24b",
  "vil.banana.old": "#ab9d55",
  // the ground
  "vil.ground": "#d7b37e",
  "vil.lane": "#d0aa73",
  "vil.rut": "#bd9864",
  "vil.grass": "#8fa456",
};

/** The village's lights: one per time of day the film visits. */
export const VILLAGE_LIGHTS: Record<"morning" | "afternoon" | "sunrise", SceneLight> = {
  /** low morning sun at frame left */
  morning: { dir: unit([-0.84, -0.54]), key: "#ffd9a0", ambient: "#6f84a8", strength: 0.86, rim: 1 },
  /** late afternoon, amber, low at frame right */
  afternoon: { dir: unit([0.87, -0.49]), key: "#ffbd68", ambient: "#5f6b9c", strength: 0.92, rim: 1 },
  /** sunrise gold, low at frame left */
  sunrise: { dir: unit([-0.9, -0.43]), key: "#ffcb80", ambient: "#6a78a4", strength: 0.88, rim: 1 },
};

const flat = { form: "flat", ink: 0, paper: false } as const;
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Blue pine hills on the horizon `base`, highest at `x0` and sinking to nothing at `x1`. */
export function farHills(id: string, o: { x0: number; x1: number; base: number; hi: number; seed?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const span = o.x1 - o.x0;
  const ridge = (k: number, hi: number, s: number): Pt[] => {
    const pts: Pt[] = [[o.x0, o.base + 300]];
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const fall = Math.pow(1 - f, 1.3);
      pts.push([o.x0 + f * span, o.base - hi * fall * (0.6 + 0.4 * hash(s * 3.1 + i * 1.7 + k))]);
    }
    pts.push([o.x1, o.base + 300]);
    return spline(pts, { closed: true, step: 8, tension: 0.4 });
  };
  const out: Shape[] = [shape(`${id}/back`, "vil.hill.far", ridge(0, o.hi, seed), flat), shape(`${id}/front`, "vil.hill", ridge(1, o.hi * 0.62, seed * 2.3), flat)];
  // pines along the nearer ridge, and a few on the slopes
  for (let i = 0; i < 46; i++) {
    const f = hash(seed * 5.9 + i * 2.1) * 0.85;
    const fall = Math.pow(1 - f, 1.3);
    const x = o.x0 + f * span;
    const y = o.base - o.hi * 0.62 * fall * (0.35 + 0.5 * hash(seed + i * 4.3));
    const h = (16 + 26 * hash(i * 3.3 + seed)) * (0.6 + 0.5 * fall);
    out.push(shape(`${id}/pine${i}`, "vil.pine", [[x, y - h], [x + h * 0.2, y - h * 0.55], [x + h * 0.12, y - h * 0.55], [x + h * 0.3, y], [x - h * 0.3, y], [x - h * 0.12, y - h * 0.55], [x - h * 0.2, y - h * 0.55]], flat));
  }
  return out;
}

/** A faint city on the horizon `base`: low roofs, a few towers, a chimney with smoke, a water tank. */
export function farCity(id: string, o: { x0: number; x1: number; base: number; seed?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const span = o.x1 - o.x0;
  const out: Shape[] = [roofline(`${id}/roofs`, "vil.city", { x0: o.x0, x1: o.x1, base: o.base, lo: 14, hi: 54, seed, under: 300 })];
  for (let i = 0; i < 7; i++) {
    const x = o.x0 + span * (0.08 + 0.84 * hash(seed * 2.7 + i * 1.9));
    const w = 26 + 34 * hash(seed + i * 3.1);
    const h = 70 + 120 * hash(seed * 4.2 + i);
    out.push(shape(`${id}/tower${i}`, "vil.city", box(x, o.base - h, x + w, o.base + 4), flat));
  }
  out.push(...chimney(`${id}/ch`, "vil.city", o.x0 + span * 0.62, o.base, 150, 22, 0.7, "vil.smoke"));
  out.push(...tank(`${id}/tank`, "vil.city", o.x0 + span * 0.3, o.base - 40, 90));
  return out;
}

/** Flat fields from the horizon `top` down to `bottom`: bands of crop, raised bunds, trees along the far edge. */
export function fields(id: string, o: { x0: number; x1: number; top: number; bottom: number; seed?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const span = o.x1 - o.x0;
  const out: Shape[] = [shape(`${id}/ground`, "vil.field.far", box(o.x0, o.top, o.x1, o.bottom), flat)];
  // bands that widen toward us
  for (let k = 0; k < 6; k++) {
    const y0 = o.top + (o.bottom - o.top) * Math.pow(k / 6, 1.6);
    const y1 = o.top + (o.bottom - o.top) * Math.pow((k + 0.55) / 6, 1.6);
    out.push(shape(`${id}/band${k}`, k % 2 ? "vil.crop" : "vil.field", box(o.x0, y0, o.x1, y1), { ...flat, opacity: 0.55 }));
    out.push(shape(`${id}/bund${k}`, "vil.bund", box(o.x0, y1, o.x1, y1 + 2 + k), { ...flat, opacity: 0.5 }));
  }
  // a line of trees on the far edge, in haze; now and then a palm
  for (let i = 0; i < Math.floor(span / 120); i++) {
    const x = o.x0 + span * hash(seed * 7.7 + i * 1.3);
    if (hash(seed * 2.3 + i) < 0.18) {
      const h = 90 + 50 * hash(i + seed);
      out.push(shape(`${id}/palm${i}`, "vil.tree.far", stroke([[x, o.top + 4], [x + 6, o.top - h * 0.5], [x + 4, o.top - h]], () => 3, true, 3), flat));
      for (let f = 0; f < 5; f++) {
        const a = -Math.PI / 2 + (f - 2) * 0.62;
        out.push(shape(`${id}/palm${i}.f${f}`, "vil.tree.far", spline([[x + 4, o.top - h], add([x + 4, o.top - h], rot([30, -6], a)), add([x + 4, o.top - h], rot([44, 10], a)), add([x + 4, o.top - h], rot([26, 4], a))], { closed: true, step: 3 }), flat));
      }
      continue;
    }
    const r = 22 + 30 * hash(seed * 3.9 + i);
    out.push(shape(`${id}/tree${i}`, "vil.tree.far", spline([[x - r * 1.3, o.top + 3], [x - r * 1.2, o.top - r * 0.6], [x - r * 0.4, o.top - r * 1.25], [x + r * 0.5, o.top - r * 1.15], [x + r * 1.25, o.top - r * 0.5], [x + r * 1.3, o.top + 3]], { closed: true, step: 5 }), flat));
  }
  return out;
}

/** A tree with a round, lumpy crown on `foot`, `h` tall. */
export function tree(id: string, o: { x: number; foot: number; h: number; seed?: number; mat?: string }): Shape[] {
  const { x, foot: g, h } = o;
  const seed = o.seed ?? 1;
  const mat = o.mat ?? "vil.tree";
  const out: Shape[] = [shape(`${id}/trunk`, "vil.bark", [[x - 0.05 * h, g + 3], [x - 0.03 * h, g - 0.55 * h], [x + 0.03 * h, g - 0.6 * h], [x + 0.06 * h, g + 3]], { depth: 0.04 * h })];
  out.push(shape(`${id}/branch`, "vil.bark", stroke([[x, g - 0.5 * h], [x + 0.12 * h, g - 0.66 * h]], () => 0.016 * h, true, 3), flat));
  for (let i = 0; i < 5; i++) {
    const c: Pt = [x + (i - 2) * 0.17 * h + (hash(seed * 3 + i) - 0.5) * 0.06 * h, g - 0.72 * h - (i === 2 ? 0.15 * h : Math.abs(i - 2) < 2 ? 0.06 * h : -0.04 * h)];
    const r = (0.2 + 0.07 * hash(seed + i * 5.1)) * h;
    out.push(shape(`${id}/crown${i}`, mat, ellipse(c, r, r * 0.82, 0, 6), { depth: r * 0.9 }));
  }
  return out;
}

/** A banana plant: a pseudo-stem and broad, torn leaves, one of them dry and hanging. `sway` bends the leaves (radians). */
export function bananaPlant(id: string, o: { x: number; foot: number; h: number; seed?: number; sway?: number }): Shape[] {
  const { x, foot: g, h } = o;
  const seed = o.seed ?? 1;
  const sway = o.sway ?? 0;
  const top: Pt = [x + 0.02 * h, g - 0.5 * h];
  const out: Shape[] = [];
  // the old leaf hangs against the stem
  out.push(shape(`${id}/dry`, "vil.banana.old", spline([top, [x + 0.12 * h, g - 0.4 * h], [x + 0.16 * h, g - 0.18 * h], [x + 0.1 * h, g - 0.24 * h], [x + 0.05 * h, g - 0.42 * h]], { closed: true, step: 4 }), { depth: 6 }));
  out.push(shape(`${id}/stem`, "vil.banana.old", [[x - 0.05 * h, g + 3], [x - 0.025 * h, top[1]], [x + 0.045 * h, top[1]], [x + 0.06 * h, g + 3]], { depth: 0.05 * h }));
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * (0.35 + 0.22 * i) + sway * (0.6 + 0.1 * i) + (hash(seed * 2.1 + i) - 0.5) * 0.2;
    const len = (0.42 + 0.14 * hash(seed + i * 3.7)) * h;
    const wid = 0.11 * h;
    const base: Pt = [top[0], top[1] + 0.02 * h * i];
    const L = (k: number, off: number): Pt => add(base, rot([k * len, off * wid], a + side * 0.55 * k * k));
    const blade = spline([L(0.05, 0), L(0.3, -0.85), L(0.65, -0.95), L(0.98, -0.25), L(1, 0), L(0.7, 0.9), L(0.35, 0.95), L(0.1, 0.25)], { closed: true, step: 4 });
    out.push(shape(`${id}/leaf${i}`, "vil.banana", blade, { depth: wid * 0.5, rim: 0.6 }));
    out.push(shape(`${id}/leaf${i}.rib`, "vil.banana.old", stroke([L(0.02, 0), L(0.5, 0), L(0.97, 0)], (k) => 2.6 - 1.6 * k, true, 3), { ...flat, opacity: 0.8 }));
    // tears in the blade
    for (let k = 0; k < 2; k++) {
      const f = 0.35 + 0.28 * k + 0.1 * hash(seed * 5 + i + k);
      out.push(shape(`${id}/leaf${i}.tear${k}`, "vil.banana", stroke([L(f, 0.1), L(f + 0.05, 0.92 * (k % 2 ? 1 : -1))], () => 1.4, true, 2), { ...flat, tone: "deep", opacity: 0.6 }));
    }
  }
  return out;
}

/**
 * A mud-brick house seen from the front: plastered walls with the brick showing where the plaster has come away,
 * a plinth, a low door with its leaf half open on a dark room, a barred window, dung cakes drying on the wall, and a
 * tiled roof. `x` is its middle and `foot` the ground it stands on.
 */
export function mudHouse(id: string, o: { x: number; foot: number; u: number; seed?: number; cakes?: boolean }): { shapes: Shape[]; door: { x0: number; x1: number; y0: number; y1: number }; wall: { x0: number; x1: number; y0: number; y1: number }; ridge: number } {
  const { x, foot: g, u } = o;
  const seed = o.seed ?? 1;
  const W = 3.6 * u;
  const eave = g - 4.2 * u;
  const ridge = g - 5.9 * u;
  const out: Shape[] = [];
  out.push(shape(`${id}/wall`, "vil.mud", box(x - W, eave - 4, x + W, g + 6), flat));
  out.push(...brickPatch(`${id}/patch0`, "vil.brick", "vil.mortar", [x - 2.6 * u, g - 1.4 * u], 0.5 * u, 0.36 * u, seed * 3));
  out.push(...brickPatch(`${id}/patch1`, "vil.brick", "vil.mortar", [x + 2.85 * u, eave + 0.9 * u], 0.42 * u, 0.28 * u, seed * 5));
  out.push(...stains(`${id}/stains`, "vil.stain", { x0: x - W, x1: x + W, top: eave + 0.3 * u, u, count: 4, seed }));
  out.push(shape(`${id}/plinth`, "vil.plinth", box(x - W, g - 0.45 * u, x + W, g + 6), flat));
  out.push(shape(`${id}/plinth.top`, "vil.stain", box(x - W, g - 0.45 * u, x + W, g - 0.45 * u + 4), flat));
  // the door: a frame, the dark room, and one leaf swung half open
  const door = { x0: x - 2.05 * u, x1: x - 0.8 * u, y0: g - 3.4 * u, y1: g - 0.08 * u };
  out.push(shape(`${id}/door.frame`, "vil.frame", box(door.x0 - 0.12 * u, door.y0 - 0.14 * u, door.x1 + 0.12 * u, door.y1), { form: "plane", facing: [0, 0] }));
  out.push(shape(`${id}/door.dark`, "vil.dark", box(door.x0, door.y0, door.x1, door.y1), flat));
  out.push(shape(`${id}/door.leaf`, "vil.door", [[door.x0, door.y0], [door.x0 + 0.42 * u, door.y0 + 0.12 * u], [door.x0 + 0.42 * u, door.y1 - 0.1 * u], [door.x0, door.y1]], { form: "plane", facing: [0.6, 0] }));
  for (let k = 0; k < 3; k++) out.push(shape(`${id}/door.plank${k}`, "vil.dark", box(door.x0 + 0.1 * u + k * 0.11 * u, door.y0 + 0.2 * u, door.x0 + 0.115 * u + k * 0.11 * u, door.y1 - 0.2 * u), { ...flat, opacity: 0.35 }));
  out.push(shape(`${id}/step`, "vil.plinth", box(door.x0 - 0.25 * u, g - 0.12 * u, door.x1 + 0.25 * u, g + 6), { form: "plane", facing: [0, -1] }));
  // the window, with wooden bars
  const wn = { x0: x + 0.35 * u, x1: x + 1.35 * u, y0: g - 3.2 * u, y1: g - 2.25 * u };
  out.push(shape(`${id}/win.frame`, "vil.frame", box(wn.x0 - 0.1 * u, wn.y0 - 0.1 * u, wn.x1 + 0.1 * u, wn.y1 + 0.1 * u), flat));
  out.push(shape(`${id}/win.dark`, "vil.dark", box(wn.x0, wn.y0, wn.x1, wn.y1), flat));
  for (let k = 1; k < 4; k++) out.push(shape(`${id}/win.bar${k}`, "vil.frame", box(wn.x0 + (k * (wn.x1 - wn.x0)) / 4 - 3, wn.y0, wn.x0 + (k * (wn.x1 - wn.x0)) / 4 + 3, wn.y1), flat));
  out.push(shape(`${id}/win.sill`, "vil.plinth", box(wn.x0 - 0.18 * u, wn.y1 + 0.1 * u, wn.x1 + 0.18 * u, wn.y1 + 0.2 * u), flat));
  // dung cakes on the wall between the window and the corner
  if (o.cakes ?? true) out.push(...dungCakes(`${id}/cakes`, { x0: x + 1.95 * u, y0: g - 3.25 * u, cols: 3, rows: 4, r: 0.21 * u, seed: seed * 7 }));
  // the shade under the eave
  out.push(shape(`${id}/eave.shade`, "vil.mud", box(x - W, eave, x + W, eave + 0.45 * u), { ...flat, tone: "deep", opacity: 0.45 }));
  // the tiled roof, seen from the front: courses of half-round tiles
  const over = 0.38 * u;
  const roof: Pt[] = [[x - W - over, eave + 0.12 * u], [x - W + 0.5 * u, ridge], [x + W - 0.5 * u, ridge], [x + W + over, eave + 0.12 * u]];
  out.push(shape(`${id}/roof`, "vil.tile", roof, { form: "plane", facing: [0, -1] }));
  const rows = 6;
  for (let r = 1; r <= rows; r++) {
    const f = r / rows;
    const y = ridge + (eave + 0.12 * u - ridge) * f;
    const hw = W - 0.5 * u + (0.5 * u + over) * f;
    out.push(shape(`${id}/course${r}`, "vil.tile.dark", box(x - hw, y - 3, x + hw, y + 1), { ...flat, opacity: 0.5 }));
  }
  const channels = 22;
  for (let k = 0; k <= channels; k++) {
    const f = k / channels;
    const xt = x - W + 0.5 * u + f * (2 * W - u);
    const xb = x - W - over + f * (2 * W + 2 * over);
    out.push(shape(`${id}/channel${k}`, "vil.tile.dark", [[xt - 1.5, ridge], [xt + 1.5, ridge], [xb + 2.5, eave + 0.1 * u], [xb - 2.5, eave + 0.1 * u]], { ...flat, opacity: 0.32 }));
    out.push(shape(`${id}/end${k}`, "vil.tile.dark", ellipse([xb, eave + 0.12 * u], 0.11 * u, 0.07 * u, 0, 3), { ...flat, opacity: 0.85 }));
  }
  out.push(shape(`${id}/ridge`, "vil.tile.dark", box(x - W + 0.42 * u, ridge - 0.12 * u, x + W - 0.42 * u, ridge + 0.04 * u), { form: "plane", facing: [0, -1] }));
  // a few tiles out of line, and a pot on the ridge
  for (let k = 0; k < 4; k++) {
    const tx = x - W + (0.8 + 6.2 * hash(seed * 4 + k)) * u;
    const ty = ridge + (0.4 + 1.1 * hash(seed * 9 + k)) * u;
    out.push(shape(`${id}/odd${k}`, "vil.tile", ellipse([tx, ty], 0.12 * u, 0.07 * u, 0.3, 3), { ...flat, tone: "light", opacity: 0.6 }));
  }
  out.push(shape(`${id}/pot`, "vil.tile", ellipse([x + 2.3 * u, ridge - 0.26 * u], 0.2 * u, 0.17 * u, 0, 4), { depth: 0.1 * u }));
  return { shapes: out, door, wall: { x0: x - W, x1: x + W, y0: eave, y1: g }, ridge: ridge - 0.12 * u };
}

/**
 * A small shed beside the house: mud walls under a thick thatch on bamboo poles, and a dark doorway with no door.
 * `x` is its middle. The parts in front of the doorway (the jambs, the lintel, the thatch) are in `front`; the dark
 * of the doorway is in `dark`, so a figure can be put between them and walk into the dark.
 */
export function thatchShed(id: string, o: { x: number; foot: number; u: number; seed?: number; wall?: string }): { back: Shape[]; dark: Shape[]; front: Shape[]; door: { x0: number; x1: number; y0: number; y1: number } } {
  const { x, foot: g, u } = o;
  const seed = o.seed ?? 1;
  const mud = o.wall ?? "vil.mud";
  const W = 2.3 * u;
  const eave = g - 3.6 * u;
  const door = { x0: x - 0.85 * u, x1: x + 0.6 * u, y0: g - 3.0 * u, y1: g };
  const back: Shape[] = [];
  const dark: Shape[] = [shape(`${id}/dark`, "vil.dark", box(door.x0, door.y0, door.x1, door.y1 + 4), flat)];
  const front: Shape[] = [];
  // the wall round the doorway, as three pieces so the doorway is a real opening
  front.push(shape(`${id}/wallL`, mud, box(x - W, eave, door.x0, g + 6), flat));
  front.push(shape(`${id}/wallR`, mud, box(door.x1, eave, x + W, g + 6), flat));
  front.push(shape(`${id}/wallT`, mud, box(door.x0 - 2, eave, door.x1 + 2, door.y0), flat));
  front.push(...stains(`${id}/stains`, "vil.stain", { x0: x - W, x1: door.x0 - 10, top: eave + 0.3 * u, u, count: 2, seed }));
  front.push(shape(`${id}/plinthL`, "vil.plinth", box(x - W, g - 0.38 * u, door.x0, g + 6), flat));
  front.push(shape(`${id}/plinthR`, "vil.plinth", box(door.x1, g - 0.38 * u, x + W, g + 6), flat));
  front.push(shape(`${id}/lintel`, "vil.pole", box(door.x0 - 0.18 * u, door.y0 - 0.12 * u, door.x1 + 0.18 * u, door.y0 + 0.02 * u), { form: "plane", facing: [0, -0.3] }));
  front.push(shape(`${id}/jambL`, mud, box(door.x0 - 0.1 * u, door.y0, door.x0, g + 6), { ...flat, tone: "shade" }));
  front.push(shape(`${id}/eave.shade`, mud, box(x - W, eave, x + W, eave + 0.5 * u), { ...flat, tone: "deep", opacity: 0.5 }));
  // the poles that hold the overhang
  for (const px of [x - W - 0.25 * u, x + W + 0.25 * u]) front.push(shape(`${id}/pole${px < x ? "L" : "R"}`, "vil.pole", box(px - 0.07 * u, eave - 0.1 * u, px + 0.07 * u, g + 4), { depth: 0.05 * u }));
  // the thatch
  const t0 = eave - 1.7 * u;
  front.push(shape(`${id}/thatch`, "vil.thatch", spline([[x - W - 0.75 * u, eave + 0.3 * u], [x - W * 0.55, t0 + 0.2 * u], [x, t0], [x + W * 0.6, t0 + 0.15 * u], [x + W + 0.75 * u, eave + 0.3 * u], [x, eave + 0.18 * u]], { closed: true, step: 6, tension: 0.35 }), { form: "plane", facing: [0, -1] }));
  for (let i = 0; i < 9; i++) front.push(shape(`${id}/streak${i}`, "vil.thatch.dark", stroke([[x - W * 0.85 + i * W * 0.21, t0 + 0.35 * u + 0.1 * u * hash(i + seed)], [x - W * 1.0 + i * W * 0.24, eave + 0.05 * u]], () => 2.4, true, 2), { ...flat, opacity: 0.55 }));
  for (let i = 0; i < 18; i++) {
    const fx = x - W - 0.7 * u + (i / 17) * (2 * W + 1.4 * u);
    const len = (0.18 + 0.2 * hash(seed * 3.3 + i)) * u;
    front.push(shape(`${id}/fringe${i}`, "vil.thatch.dark", [[fx - 0.12 * u, eave + 0.2 * u], [fx + 0.12 * u, eave + 0.2 * u], [fx + 0.02 * u, eave + 0.22 * u + len]], flat));
  }
  front.push(shape(`${id}/tie`, "vil.pole", capsule([x - W - 0.4 * u, eave + 0.14 * u], [x + W + 0.4 * u, eave + 0.14 * u], 0.04 * u, 0.04 * u, 3), flat));
  return { back, dark, front, door };
}

/** The ground a house stands on, from `top` down: packed earth with scuffs. */
export function yardGround(id: string, o: { x0: number; x1: number; top: number; bottom: number; u: number; seed?: number; mat?: string }): Shape[] {
  return [shape(`${id}/ground`, o.mat ?? "vil.ground", box(o.x0, o.top, o.x1, o.bottom), flat), ...ruts(`${id}`, "vil.rut", { x0: o.x0, x1: o.x1, top: o.top + 20, depth: Math.min(500, o.bottom - o.top - 40), u: o.u, count: 5, seed: o.seed ?? 1, opacity: 0.35 })];
}

/** The lane: packed earth from `top` down, cart ruts, and a ragged edge of grass along its far side. */
export function lane(id: string, o: { x0: number; x1: number; top: number; bottom: number; u: number; seed?: number }): Shape[] {
  const seed = o.seed ?? 1;
  const out: Shape[] = [shape(`${id}/ground`, "vil.lane", box(o.x0, o.top, o.x1, o.bottom), flat)];
  out.push(...ruts(`${id}`, "vil.rut", { x0: o.x0, x1: o.x1, top: o.top + 0.3 * o.u, depth: 2.4 * o.u, u: o.u, count: 7, seed, opacity: 0.45 }));
  out.push(...grassTufts(`${id}/edge`, { x0: o.x0, x1: o.x1, y: o.top + 4, h: 0.16 * o.u, count: Math.floor((o.x1 - o.x0) / 70), seed }));
  return out;
}

/** Tufts of grass standing on the line `y`. */
export function grassTufts(id: string, o: { x0: number; x1: number; y: number; h: number; count: number; seed?: number; mat?: string }): Shape[] {
  const seed = o.seed ?? 1;
  const out: Shape[] = [];
  for (let i = 0; i < o.count; i++) {
    const x = o.x0 + (o.x1 - o.x0) * hash(seed * 8.3 + i * 1.7);
    const h = o.h * (0.6 + 0.8 * hash(seed + i * 2.9));
    const y = o.y + 6 * hash(i * 4.4 + seed);
    const pts: Pt[] = [[x - h * 0.5, y]];
    for (let b = 0; b < 4; b++) {
      const bx = x - h * 0.4 + b * h * 0.27;
      pts.push([bx + h * (b - 1.5) * 0.18, y - h * (0.7 + 0.3 * hash(i + b * 3.1))], [bx + h * 0.12, y - h * 0.18]);
    }
    pts.push([x + h * 0.5, y]);
    out.push(shape(`${id}/tuft${i}`, o.mat ?? "vil.grass", pts, flat));
  }
  return out;
}
