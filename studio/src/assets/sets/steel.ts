// The second world of the GGSP opening, as shapes: the furnace and its melt, the rods drawn out of it,
// the flyover pier and the tower frame they end up inside, and the dawn city behind them.
// Everything here is plain geometry and colour. The take (films/ggsp/steel.ts) says when and where.
//
// Coordinates: every layer is drawn in the pixels of the LAST frame (camera at 540, 960, zoom 1), so a number
// here is where the thing sits on screen at the end. The melt lies far below that frame, at y = SW.POOL.
import type { Stop } from "../../engine/draw/list.ts";
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { ellipse, roundRect, roundedPoly } from "../../engine/geom/outline.ts";
import { unit, type Pt } from "../../engine/geom/vec.ts";
import { hexToRgb, rgbToHex, type SceneLight } from "../../engine/look/color.ts";
import { hash } from "../../engine/motion/track.ts";
import { SCRAP_PALETTE } from "../props/scrap.ts";
import { YARDLIFE_PALETTE } from "../props/yardlife.ts";

export const STEEL_PALETTE: Palette = {
  ...SCRAP_PALETTE,
  crow: YARDLIFE_PALETTE.crow,
  "crow.beak": YARDLIFE_PALETTE["crow.beak"],
  dust: YARDLIFE_PALETTE.dust,
  // the furnace
  "melt.core": "#fff0b0",
  "melt.gold": "#ffd27a",
  "melt.orange": "#ffb347",
  "melt.deep": "#e0661f",
  "furnace.warm": "#5a2614",
  "furnace.dark": "#3a1a12",
  "furnace.wall": "#26110b",
  // what comes out of it
  steel: "#808b93",
  "steel.far": "#8b99a2",
  "steel.tie": "#6b7680",
  // what it ends up inside
  concrete: "#b9b1a2",
  "concrete.cut": "#6e665f",
  "concrete.far": "#9fb0ad",
  // the dawn behind
  "sky.top": "#35606e",
  "sky.mid": "#8fb0a8",
  "sky.horizon": "#f6cf9a",
  "sun.glow": "#ffe2a6",
  sun: "#fff6d8",
  "city.veil": "#2f4d5a",
  roofs: "#4b3a3c",
  haze: "#fff1d2",
  // small life
  "truck.box": SCRAP_PALETTE["scrap.ochre"],
  "truck.cab": SCRAP_PALETTE["scrap.rust"],
  // type
  cream: "#fff3dc",
};

/** Dawn: the sun is low at frame right, behind the tower. */
export const LIGHT_DAWN: SceneLight = { dir: unit([0.85, -0.5]), key: "#ffd08a", ambient: "#4a6a8a", strength: 0.8, rim: 1 };
/** Inside the furnace everything is lit from the melt below. */
export const LIGHT_FURNACE: SceneLight = { dir: unit([0.14, 1]), key: "#ffb347", ambient: "#6a2a1a", strength: 0.9, rim: 1 };
/** The same melt as seen from the furnace wall at frame left, and from the one at frame right. */
export const LIGHT_FURNACE_L: SceneLight = { ...LIGHT_FURNACE, dir: unit([0.8, 0.6]) };
export const LIGHT_FURNACE_R: SceneLight = { ...LIGHT_FURNACE, dir: unit([-0.8, 0.6]) };
export const STEEL_LIGHTS = { dawn: LIGHT_DAWN, furnace: LIGHT_FURNACE, furnaceL: LIGHT_FURNACE_L, furnaceR: LIGHT_FURNACE_R } as const;
export type LightName = keyof typeof STEEL_LIGHTS;

// ---------------------------------------------------------------------------------------------------------------
// The display list: a frame of this world is an ordered list of these, back to front
// ---------------------------------------------------------------------------------------------------------------

// (the item types are the engine's: src/engine/draw/list.ts)
export type { Fill, FillItem, Item, PaintItem, Space, Stop } from "../../engine/draw/list.ts";

// ---------------------------------------------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------------------------------------------

export const SW = {
  W: 1080,
  H: 1920,
  /** y of the near crest of the melt; the two crests behind it are MID and REAR higher */
  POOL: 3000,
  MID: 110,
  REAR: 220,
  /** the point the furnace glow spreads from, far below the melt's surface */
  GLOW: [540, 4220] as Pt,
  /** layer depths: the tower and its rods, the high cloud, the far city, the roofs under the deck, the birds */
  BACK: 0.8,
  CLOUD: 7,
  CITY: 4,
  ROOFS: 2,
  BIRD: 1.4,
} as const;

export const PIER = {
  x: 400,
  /** the front face of the column, and the lit face on its right */
  x0: 262,
  x1: 538,
  side: 32,
  top: 1110,
  foot: 2500,
  /** the cut-away panel */
  win: { x0: 290, x1: 510, y0: 1190, y1: 1420, r: 14 },
  cap: { top: 1000, shoulder: 52, half: 250 },
  bars: [312, 356, 400, 444, 488],
  barR: 15,
  /** ring ties, from the lowest up */
  ties: [1397, 1351, 1305, 1259, 1213],
  deck: { top: 905, lip: 913, parapet: 944, bottom: 1000 },
  /** lamp standards on the deck, one each side of the pier: where they stand, and how tall */
  lamps: [228, 572],
  lampH: 128,
} as const;

export const TOWER = {
  cols: [622, 706, 790, 874],
  colW: 22,
  /** the lift core, in place of the first column */
  core: [606, 670],
  x0: 588,
  x1: 908,
  slab: 22,
  storey: 92,
  /** top of the top slab */
  top: 590,
  floors: 11,
  barR: 4.5,
  barOff: 6,
} as const;

export const SUN = { x: 748, y: 1192, r: 40, glow: 470 } as const;

// ---------------------------------------------------------------------------------------------------------------
// Colour helpers for gradients (a gradient is light, not a material, so it is mixed the way SVG mixes it)
// ---------------------------------------------------------------------------------------------------------------

/** Straight sRGB mix, the way a gradient blends between two stops. */
export function lerpHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  return rgbToHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
}

/** The dawn sky down the frame: deep teal behind the type, peach at the horizon, warm haze over the ground. */
export const SKY: readonly { y: number; color: string }[] = [
  { y: 0, color: STEEL_PALETTE["sky.top"] },
  { y: 500, color: "#386673" },
  { y: 900, color: "#5b8a8c" },
  { y: 1060, color: STEEL_PALETTE["sky.mid"] },
  { y: 1220, color: "#d9c7a2" },
  { y: 1340, color: STEEL_PALETTE["sky.horizon"] },
  { y: 1450, color: "#ebc192" },
  { y: 1920, color: "#c79d83" },
];

export function skyAt(y: number): string {
  if (y <= SKY[0].y) return SKY[0].color;
  for (let i = 1; i < SKY.length; i++) if (y <= SKY[i].y) return lerpHex(SKY[i - 1].color, SKY[i].color, (y - SKY[i - 1].y) / (SKY[i].y - SKY[i - 1].y));
  return SKY[SKY.length - 1].color;
}

/** Stops for a band of the sky's own colours between y0 and y1 with the given opacity at each height: haze. */
export function skyVeil(y0: number, y1: number, alpha: (y: number) => number, extra: readonly number[] = []): Stop[] {
  const ys = [y0, y1, ...extra, ...SKY.map((s) => s.y)].filter((y) => y >= y0 && y <= y1).sort((a, b) => a - b);
  const out: Stop[] = [];
  for (const y of ys) {
    const at = (y - y0) / (y1 - y0);
    if (out.length && Math.abs(out[out.length - 1].at - at) < 1e-6) continue;
    out.push({ at, color: skyAt(y), a: alpha(y) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------------------------

export const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Adds points along long edges, so that rim light and core shadow keep one width down a long part. */
export function dense(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

const FACING = {
  /** toward us and away from the sun: in shade */
  front: [-0.5, 0.3] as Pt,
  /** toward the sun */
  side: [1, 0] as Pt,
  top: [0, -1] as Pt,
  /** neither: the base tone */
  flat: [0, 0] as Pt,
};

/** A rod standing upright: sheared flat at the tip, running down to `bottom`. */
export function rodOutline(x: number, r: number, tip: number, bottom: number): Pt[] {
  const c = Math.min(r * 0.34, (bottom - tip) * 0.4);
  return dense([[x - r, bottom], [x - r, tip + c], [x - r + c, tip], [x + r - c, tip], [x + r, tip + c], [x + r, bottom]], 150);
}

/** A band of melt: everything below a wavy crest. */
export function meltBand(id: string, mat: string, crest: (x: number) => number, x0: number, x1: number, bottom: number, step = 26): Shape {
  const pts: Pt[] = [];
  for (let x = x0; x <= x1 + 0.01; x += step) pts.push([x, crest(x)]);
  pts.push([x1, bottom], [x0, bottom]);
  return shape(id, mat, pts, { form: "flat", ink: 0, paper: false });
}

/** The bright skin along a crest, thicker where the surface swells. */
export function crestStrip(id: string, mat: string, crest: (x: number) => number, thick: (x: number) => number, x0: number, x1: number, step = 26): Shape {
  const top: Pt[] = [];
  const under: Pt[] = [];
  for (let x = x0; x <= x1 + 0.01; x += step) {
    const y = crest(x);
    top.push([x, y - 0.5]);
    under.push([x, y + Math.max(1.5, thick(x))]);
  }
  return shape(id, mat, [...top, ...under.reverse()], { form: "flat", ink: 0, paper: false });
}

/** One ring tie round the bundle: a thin band, `half` wide each side of the pier's middle. */
export function tieShape(id: string, y: number, half: number): Shape {
  return shape(id, "steel.tie", roundRect([PIER.x, y], half, 5, 4, 0, 3), { depth: 4, rim: 0.7 });
}

export interface PierHalf {
  /** the inside of the cut-away, behind the bars */
  back: Shape[];
  /** the cut edge that catches the light, in front of the bars */
  bevel: Shape[];
  /** the face of the column, with its half of the opening */
  face: Shape[];
}

function pierHalf(side: "L" | "R"): PierHalf {
  const { x, x0, x1, top, foot, win } = PIER;
  const deep = { form: "flat", tone: "deep", ink: 0, paper: false } as const;
  const lit = { form: "flat", tone: "light", ink: 0, paper: false } as const;
  /** the joint between two lifts of the pour, across this half of the face */
  const joint = (k: number, y: number): Shape =>
    shape(`pier/${side}/joint${k}`, "concrete", side === "L" ? box(x0, y, x + 1, y + 3) : box(x - 1, y, x1, y + 3), { ...deep, opacity: 0.3 });
  const joints = [win.y0 - 42, win.y1 + 40, win.y1 + 330, win.y1 + 620].map((y, k) => joint(k, y));
  /** the holes the form ties left: a grid of them, clear of the cut-away */
  const holes: Shape[] = [];
  const cols = side === "L" ? [x0 + 26, x0 + 96] : [x1 - 96, x1 - 26];
  [top + 46, win.y1 + 86, win.y1 + 236, win.y1 + 386, win.y1 + 536, win.y1 + 686].forEach((hy, r) => {
    cols.forEach((hx, c) => {
      // (over the cut-away only the outer one: a stain runs down the middle there)
      if (r === 0 && c === (side === "L" ? 1 : 0)) return;
      holes.push(shape(`pier/${side}/hole${r}.${c}`, "concrete", ellipse([hx, hy], 4.2, 4.2, 0, 2), { ...deep, opacity: 0.42 }));
    });
  });
  const stain = (id: string, sx: number, w: number, len: number): Shape =>
    shape(id, "concrete", [[sx - w / 2, top], [sx + w / 2, top], [sx + w * 0.2, top + len], [sx - w * 0.14, top + len * 0.86]], { ...deep, opacity: 0.26 });
  if (side === "L") {
    // (the two halves overlap by a hair where they meet, so no seam shows)
    const face = roundedPoly([{ p: [x0, top] }, { p: [x + 1, top] }, { p: [x + 1, win.y0] }, { p: [win.x0, win.y0], r: win.r }, { p: [win.x0, win.y1], r: win.r }, { p: [x + 1, win.y1] }, { p: [x + 1, foot] }, { p: [x0, foot] }], 3);
    return {
      back: [shape("pier/L/back", "concrete.cut", box(win.x0 - 8, win.y0 - 8, x + 1, win.y1 + 8), deep)],
      bevel: [shape("pier/L/sill", "concrete", box(win.x0, win.y1 - 9, x + 1, win.y1), lit), shape("pier/L/jamb", "concrete", box(win.x0, win.y0, win.x0 + 8, win.y1), lit)],
      face: [shape("pier/L/face", "concrete", face, { form: "plane", facing: FACING.front }), ...joints, ...holes, stain("pier/L/stain0", x0 + 13, 14, 250)],
    };
  }
  const face = roundedPoly([{ p: [x - 1, top] }, { p: [x1, top] }, { p: [x1, foot] }, { p: [x - 1, foot] }, { p: [x - 1, win.y1] }, { p: [win.x1, win.y1], r: win.r }, { p: [win.x1, win.y0], r: win.r }, { p: [x - 1, win.y0] }], 3);
  return {
    back: [shape("pier/R/back", "concrete.cut", box(x - 1, win.y0 - 8, win.x1 + 8, win.y1 + 8), deep)],
    bevel: [shape("pier/R/sill", "concrete", box(x - 1, win.y1 - 9, win.x1, win.y1), lit)],
    face: [
      shape("pier/R/face", "concrete", face, { form: "plane", facing: FACING.front }),
      ...joints,
      ...holes,
      shape("pier/R/side", "concrete", box(x1, top, x1 + PIER.side, foot), { form: "plane", facing: FACING.side }),
      stain("pier/R/stain0", x + 34, 30, 62),
      stain("pier/R/stain1", x1 - 13, 13, 330),
    ],
  };
}

export const PIER_L = pierHalf("L");
export const PIER_R = pierHalf("R");

/** The hammerhead cap as it forms: `rise` 0..1 lifts it out of the column top, `spread` 0..1 pushes its wings out. */
export function pierCap(rise: number, spread: number): Shape[] {
  const { x, x0, x1, top, cap, side } = PIER;
  if (rise < 0.03) return [];
  const y = top - (top - cap.top) * rise;
  const sh = Math.min(top - 1, y + cap.shoulder);
  const hw = (x1 - x0) / 2 + (cap.half - (x1 - x0) / 2) * Math.max(0, spread);
  const l = x - hw;
  const r = x + hw;
  return [
    shape("cap/face", "concrete", [[l, y], [r, y], [r, sh], [x1, top], [x0, top], [l, sh]], { form: "plane", facing: FACING.front }),
    shape("cap/side", "concrete", [[r, y], [r + side, y], [r + side, sh], [x1 + side, top], [x1, top], [r, sh]], { form: "plane", facing: FACING.side }),
  ];
}

/** One half of the deck, as it lies once the two have met over the pier. */
function deckSegment(sideName: "L" | "R"): Shape[] {
  const d = PIER.deck;
  const x0 = sideName === "L" ? -1000 : PIER.x - 1;
  const x1 = sideName === "L" ? PIER.x + 1 : 2200;
  const id = `deck/${sideName}`;
  const out: Shape[] = [
    shape(`${id}/girder`, "concrete", box(x0, d.parapet, x1, d.bottom), { form: "flat", tone: "deep", ink: 0, paper: false }),
    shape(`${id}/flange`, "concrete", box(x0, d.bottom - 9, x1, d.bottom), { form: "plane", facing: FACING.front }),
    shape(`${id}/parapet`, "concrete", box(x0, d.lip, x1, d.parapet), { form: "plane", facing: FACING.flat }),
    shape(`${id}/lip`, "concrete", box(x0, d.top, x1, d.lip), { form: "plane", facing: FACING.top }),
  ];
  // a lamp standard: post and head as one outline, dark against the sky
  const lx = PIER.lamps[sideName === "L" ? 0 : 1];
  const ly = d.top - PIER.lampH;
  out.push(
    shape(`${id}/lamp`, "steel.tie", [[lx - 2.5, d.top], [lx - 2.5, ly + 7], [lx - 17, ly + 7], [lx - 17, ly], [lx + 17, ly], [lx + 17, ly + 7], [lx + 2.5, ly + 7], [lx + 2.5, d.top]], { form: "flat", tone: "deep", ink: 0, paper: false }),
  );
  // the joints between the precast lengths of parapet, counted out from the pier
  for (let k = 1; k <= 4; k++) {
    const jx = PIER.x + (sideName === "L" ? -1 : 1) * k * 186;
    out.push(shape(`${id}/joint${k}`, "concrete", box(jx - 1.5, d.lip, jx + 1.5, d.parapet), { form: "plane", facing: FACING.front }));
  }
  return out;
}

export const DECK_L = deckSegment("L");
export const DECK_R = deckSegment("R");

/** One storey of the tower frame: a slab with its columns hanging `leg` px below it. `y` is the top of the slab. */
export function towerFloor(id: string, y: number, leg: number, opacity = 1): Shape {
  const { x0, x1, slab, cols, colW, core } = TOWER;
  const pts: Pt[] = [[x0, y], [x1, y], [x1, y + slab]];
  if (leg > 1) {
    for (let i = cols.length - 1; i >= 0; i--) {
      // (the first of them is the wall of the lift core: wider than a column)
      const a = i === 0 ? core[0] : cols[i] - colW / 2;
      const b = i === 0 ? core[1] : cols[i] + colW / 2;
      pts.push([b, y + slab], [b, y + slab + leg], [a, y + slab + leg], [a, y + slab]);
    }
  }
  pts.push([x0, y + slab]);
  return shape(id, "concrete.far", dense(pts, 48), { depth: 5, rim: 0.8, opacity: opacity < 0.995 ? opacity : undefined });
}

/** A lorry seen side-on over the parapet, facing right. `x` is its tail, `base` the road. */
export function truck(id: string, x: number, base: number): Shape[] {
  const plane = (facing: Pt) => ({ form: "plane", facing } as const);
  return [
    shape(`${id}/box`, "truck.box", box(x, base - 52, x + 58, base), plane(FACING.flat)),
    shape(`${id}/tarp`, "truck.box", box(x, base - 52, x + 58, base - 45), plane(FACING.top)),
    shape(`${id}/cab`, "truck.cab", roundedPoly([{ p: [x + 62, base - 40], r: 5 }, { p: [x + 80, base - 40], r: 7 }, { p: [x + 88, base - 20], r: 3 }, { p: [x + 88, base] }, { p: [x + 62, base] }], 2), plane(FACING.flat)),
    shape(`${id}/glass`, "sky.mid", [[x + 72, base - 35], [x + 79, base - 35], [x + 85, base - 21], [x + 72, base - 21]], plane(FACING.side)),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// The furnace walls: two dark masses close to the lens, one down each side of the frame. Their top is the mouth of
// the furnace; the camera climbs out past it. The left one is kept thin, clear of the type.
// ---------------------------------------------------------------------------------------------------------------

export const WALL = { depth: -0.5, mouth: 2520, foot: 7200, course: 46 } as const;

function furnaceWall(side: "L" | "R"): Shape {
  const { mouth, foot, course } = WALL;
  const sg = side === "L" ? 1 : -1;
  const edge = side === "L" ? 0 : SW.W;
  const out = side === "L" ? -600 : SW.W + 600;
  /** how far the wall reaches into the frame at step k: brick laid a little unevenly */
  const reach = (k: number) => (side === "L" ? 12 + 14 * hash(k * 3.1 + 5) : 98 + 24 * hash(k * 4.7 + 9));
  const lip = side === "L" ? 40 : 142;
  const pts: Pt[] = [[out, mouth], [edge + sg * lip, mouth], [edge + sg * lip, mouth + course]];
  let k = 0;
  for (let y = mouth + course; y < foot; y += course * 2, k++) {
    const x = edge + sg * reach(k);
    pts.push([x, y], [x, Math.min(foot, y + course * 2)]);
  }
  pts.push([out, foot]);
  return shape(`wall/${side}`, "furnace.wall", pts, { depth: 12, rim: 1.2 });
}

export const WALL_L = furnaceWall("L");
export const WALL_R = furnaceWall("R");

// ---------------------------------------------------------------------------------------------------------------
// The far city: two veils of roofline, one behind the other. They take the colour of whatever sky is behind them.
// ---------------------------------------------------------------------------------------------------------------

interface Block {
  x0: number;
  x1: number;
  top: number;
}

function skyline(seed: number, x0: number, x1: number, base: number, lo: number, hi: number, towers: readonly Block[]): Pt[] {
  const blocks: Block[] = [];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = 34 + 86 * hash(seed * 3.7 + i);
    const h = lo + (hi - lo) * Math.pow(hash(seed * 9.1 + i * 1.7), 1.6);
    blocks.push({ x0: x, x1: Math.min(x1, x + w), top: base - h });
    x += w;
    i++;
  }
  const all = [...blocks, ...towers];
  const edges = [...new Set(all.flatMap((b) => [b.x0, b.x1]).filter((e) => e >= x0 && e <= x1))].sort((a, b) => a - b);
  const pts: Pt[] = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    const m = (edges[k] + edges[k + 1]) / 2;
    let top = base;
    for (const b of all) if (m > b.x0 && m < b.x1) top = Math.min(top, b.top);
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[1] - top) < 0.01) pts[pts.length - 1] = [edges[k + 1], top];
    else pts.push([edges[k], top], [edges[k + 1], top]);
  }
  // (the foot is far below the frame: haze covers it long before)
  pts.push([x1, 2400], [x0, 2400]);
  return pts;
}

const veil = (opacity: number) => ({ form: "flat", ink: 0, paper: false, opacity } as const);

export const CITY_FAR: Shape[] = [
  shape(
    "city/far",
    "city.veil",
    skyline(11, -300, 1380, 1410, 14, 92, [
      { x0: 318, x1: 366, top: 1236 },
      { x0: 566, x1: 606, top: 1268 },
      { x0: 956, x1: 1026, top: 1206 },
    ]),
    veil(0.17),
  ),
];

export const CITY_MID: Shape[] = [
  shape(
    "city/mid",
    "city.veil",
    skyline(23, -300, 1380, 1436, 10, 66, [
      { x0: 16, x1: 66, top: 1168 },
      { x0: 88, x1: 168, top: 806 },
      { x0: 188, x1: 242, top: 936 },
      { x0: 930, x1: 1004, top: 1122 },
    ]),
    veil(0.3),
  ),
  // a crane on the tallest of them: one outline, mast and jib
  shape("city/crane", "city.veil", [[125, 806], [125, 748], [78, 748], [78, 742], [125, 742], [125, 728], [131, 728], [131, 742], [214, 742], [214, 748], [131, 748], [131, 806]], veil(0.3)),
];

/** Roofs nearer than the tower, far below the deck: a darker veil that gives the foot of the frame some weight. */
export const CITY_NEAR: Shape[] = [
  shape(
    "city/near",
    "roofs",
    skyline(37, -300, 1380, 1716, 8, 74, [
      // water tanks on their stands
      { x0: 98, x1: 142, top: 1598 },
      { x0: 108, x1: 132, top: 1574 },
      { x0: 712, x1: 760, top: 1606 },
      { x0: 724, x1: 748, top: 1584 },
      { x0: 934, x1: 1010, top: 1560 },
    ]),
    veil(0.4),
  ),
];
