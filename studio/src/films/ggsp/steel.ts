// Demo 2, GGSP, the second world: "that turns that same scrap into the steel rods inside India's highways and high-rises."
// The yard (take.ts) hands over to this file under a glow that rises up the frame. From there it is one move:
// down onto the melt, then up with the rods that are drawn out of it, out of the furnace dark into a dawn sky,
// where concrete closes round them. This file is the whole performance as data, so it runs and is checked in Node
// (node tools/check.ts ggsp); the generic view only draws the list of things that `frame(t)` returns.
import { drum, gear, pipe, plate, rim, sheet } from "../../assets/props/scrap.ts";
import { crow } from "../../assets/props/yardlife.ts";
import {
  CITY_FAR,
  CITY_MID,
  CITY_NEAR,
  DECK_L,
  DECK_R,
  PIER,
  PIER_L,
  PIER_R,
  SKY,
  STEEL_PALETTE,
  SUN,
  SW,
  TOWER,
  WALL,
  WALL_L,
  WALL_R,
  box,
  crestStrip,
  lerpHex,
  meltBand,
  pierCap,
  rodOutline,
  skyAt,
  skyVeil,
  tieShape,
  towerFloor,
  truck,
  type Fill,
  type FillItem,
  type Item,
  type PaintItem,
  type Stop,
} from "../../assets/sets/steel.ts";
import { shape, type Shape } from "../../engine/draw/shape.ts";
import { moveShapes } from "../../engine/draw/xform.ts";
import { dustPuff } from "../../engine/fx/dust.ts";
import { ellipse, stroke } from "../../engine/geom/outline.ts";
import { bounds, clamp, smoothstep, type Pt } from "../../engine/geom/vec.ts";
import { mixHex } from "../../engine/look/color.ts";
import { Track, WEIGHT, hash, type Weight } from "../../engine/motion/track.ts";
import { Camera, layerTransform, type View } from "../../engine/stage/camera.ts";
import { makeAnchors } from "../../engine/time/clock.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { layout, type FaceName, type Line } from "../../engine/type/layout.ts";
import { VO, WORDS } from "./words.ts";

const ANCHOR = makeAnchors(WORDS);
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Times are seconds in the tightened voice (see words.ts).
 * t0: from here the view draws (on top of the yard). tFull: from here on it covers the whole frame, so the yard
 * is no longer drawn underneath.
 */
export const STEEL = { W: 1080, HGT: 1920, fps: 30, t0: r2(ANCHOR("scrap", 2) - 0.14), tFull: r2(ANCHOR.end("scrap", 2) + 0.15), end: VO.duration } as const;

const P = SW.POOL;
/** where the camera rests over the melt: its near crest 540 px below the middle of the frame */
const REST = P - 540;
/** where it ends: every layer is drawn in the pixels of this framing */
const LAST = 960;
const FRAME = { width: STEEL.W, height: STEEL.HGT };
const REF = { cx: STEEL.W / 2, cy: STEEL.HGT / 2 };
/** the melt is drawn this wide (the frame at its widest, with room for the camera's sway) */
const PX0 = -150;
const PX1 = 1230;

const C = {
  core: STEEL_PALETTE["melt.core"],
  gold: STEEL_PALETTE["melt.gold"],
  orange: STEEL_PALETTE["melt.orange"],
  deep: STEEL_PALETTE["melt.deep"],
  warm: STEEL_PALETTE["furnace.warm"],
  dark: STEEL_PALETTE["furnace.dark"],
  cream: STEEL_PALETTE.cream,
  sunGlow: STEEL_PALETTE["sun.glow"],
  haze: STEEL_PALETTE.haze,
};

/** two masses of concrete meeting: still travelling fast at contact, stopped inside two frames, one short rebound */
const SLAM: Weight = { overshoot: 0.014, settle: 0.16, zeta: 0.5, windup: 0, windupTime: 0 };
/** the cap squeezed out by that meeting: quick, a little soft */
const SQUEEZE: Weight = { overshoot: 0.05, settle: 0.35, zeta: 0.55, windup: 0, windupTime: 0 };
/** a floor slab jacked up into place */
const TICK: Weight = { overshoot: 0.04, settle: 0.25, zeta: 0.5, windup: 0, windupTime: 0 };

interface Lay {
  tx: number;
  ty: number;
  s: number;
}
const lay = (v: View, depth: number): Lay => layerTransform(v, FRAME, depth, REF);

interface Rod {
  id: string;
  x: number;
  r: number;
  /** y of the tip, in the rod's own layer */
  tip: Track;
  /** when it starts to rise, and when it breaks the surface */
  start: number;
  te: number;
  arrive: number;
  pitch: number;
}

interface Piece {
  id: string;
  kind: "plate" | "gear" | "pipe" | "drum" | "rim" | "sheet";
  mat: string;
  x: number;
  /** when it meets the melt, how long it has been falling, and from how high */
  T: number;
  D: number;
  H: number;
  a0: number;
  spin: number;
  drift: number;
}

export interface TypeWordState {
  from: number;
  to: number;
  color: string;
  /** one entry per glyph of the word */
  each: { dy: number; opacity: number }[];
}

export interface SteelFrame {
  t: number;
  view: View;
  items: Item[];
  type: { line: Line; x: number; y: number; words: TypeWordState[] } | null;
}

function build() {
  const W = makeAnchors(WORDS);
  const tScrap = W("scrap", 2);
  const tSteel = W("steel");
  const tRods = W("rods");
  const tHigh = W("highways");
  const tRise = W("high-rises");
  const tLast = W.end("high-rises");
  const { t0, tFull, end } = STEEL;
  const cues: { t: number; what: string; x?: number }[] = [];

  // ------------------------------------------------------------------------------------------------------------
  // The camera. It arrives still pushing in and down, as the yard's camera was; rests over the melt; rides up with
  // the rods; slows as the concrete closes; and never quite stops.
  // ------------------------------------------------------------------------------------------------------------
  const cam = new Camera(540, REST, 1, 21);
  cam.keys([
    { t: t0, cx: 540, cy: REST - 1100, zoom: 0.88 },
    { t: tScrap + 0.36, cx: 540, cy: REST - 420, zoom: 0.955 },
    { t: tSteel - 0.06, cx: 540, cy: REST, zoom: 1 },
    { t: tSteel + 0.16, cx: 540, cy: REST - 14, zoom: 1 },
    // up with the rods: each of these puts the leading tip where it should sit in the frame
    { t: tRods + 0.24, cx: 540, cy: LAST + 1359, zoom: 1 },
    { t: tRods + 0.64, cx: 540, cy: LAST + 918, zoom: 1 },
    { t: tHigh - 0.53, cx: 540, cy: LAST + 387, zoom: 1 },
    { t: tHigh - 0.23, cx: 540, cy: LAST + 165, zoom: 1 },
    // slowing as the concrete closes, easing to the last framing, and a drift that never quite ends
    { t: tHigh + 0.27, cx: 540, cy: LAST + 62, zoom: 1 },
    { t: tRise + 0.03, cx: 540, cy: LAST + 15, zoom: 1 },
    { t: tLast, cx: 540, cy: LAST + 2, zoom: 1.006 },
    { t: end + 0.1, cx: 540, cy: LAST - 6, zoom: 1.02 },
  ]);

  // ------------------------------------------------------------------------------------------------------------
  // The glow. It spreads from a point far under the melt: inside radius R the furnace is solid, and it thins to
  // nothing over the next S px. R grows on "scrap" until it has passed the top of the frame (the join with the
  // yard), holds, and shrinks again as the camera climbs out into the dawn.
  // ------------------------------------------------------------------------------------------------------------
  /** when the last of the furnace has thinned away */
  const tOut = tHigh - 0.42;
  const R = new Track(1290);
  R.cruise(3400, { start: t0, speed: 2950, ramp: 0.3 });
  R.to(900, { at: tOut, dur: 0.85, w: WEIGHT.mech });
  const S = new Track(460);
  S.to(800, { at: tOut - 0.72, dur: 0.5, w: WEIGHT.mech });
  /** 1 = the flare that fills the frame; 0 = the furnace as the eye finds it a moment later */
  const heat = new Track(1);
  heat.to(0, { at: tFull + 0.24, dur: 0.3, w: WEIGHT.mech });
  /** from here the dawn is drawn behind the furnace */
  const tDawn = tOut - 0.85 - 0.03;
  cues.push({ t: tScrap, what: "roar", x: 540 });

  const flare = mixHex(C.dark, C.deep, 0.72);
  const furnace = (t: number) => {
    const h = heat.value(t);
    // the glow over the melt breathes
    const fl = 26 * Math.sin(5.3 * t) + 16 * Math.sin(8.9 * t + 1.3);
    const top = mixHex(C.dark, flare, h);
    const cols = [
      { r: 0, c: C.core },
      { r: 700, c: C.core },
      { r: 950, c: C.gold },
      { r: 1150, c: C.orange },
      { r: 1330 + fl, c: C.deep },
      { r: 1950 + 1.4 * fl, c: mixHex(C.warm, C.deep, 0.85 * h) },
      { r: 2600, c: top },
      { r: 7000, c: top },
    ];
    return { R: R.value(t), S: S.value(t), cols };
  };
  type Furnace = ReturnType<typeof furnace>;
  const colorAtR = (f: Furnace, r: number): string => {
    const k = f.cols;
    if (r <= k[0].r) return k[0].c;
    for (let i = 1; i < k.length; i++) if (r <= k[i].r) return lerpHex(k[i - 1].c, k[i].c, (r - k[i - 1].r) / (k[i].r - k[i - 1].r));
    return k[k.length - 1].c;
  };
  const furnaceFill = (f: Furnace): Fill => {
    const out = f.R + f.S;
    const alpha = (r: number) => clamp((out - r) / f.S, 0, 1);
    const stops: Stop[] = [];
    for (const k of f.cols) if (k.r < out) stops.push({ at: k.r / out, color: k.c, a: alpha(k.r) });
    stops.push({ at: Math.max(0, f.R) / out, color: colorAtR(f, f.R), a: 1 });
    stops.push({ at: 1, color: colorAtR(f, out), a: 0 });
    stops.sort((a, b) => a.at - b.at);
    return { kind: "radial", cx: SW.GLOW[0], cy: SW.GLOW[1], r: out, stops };
  };

  // ------------------------------------------------------------------------------------------------------------
  // The scrap that falls through the glow. Each piece comes down turning, takes the colour of the heat as it nears
  // the melt, goes under, and throws a few sparks.
  // ------------------------------------------------------------------------------------------------------------
  const pieces: Piece[] = [
    { id: "fall0", kind: "plate", mat: "scrapN.rust", x: 236, T: tScrap + 0.46, D: 0.56, H: 980, a0: -0.5, spin: 2.6, drift: 30 },
    { id: "fall1", kind: "gear", mat: "scrapN.steel", x: 634, T: tScrap + 0.53, D: 0.6, H: 1080, a0: 0.3, spin: -3.1, drift: -22 },
    { id: "fall2", kind: "pipe", mat: "scrapN.rust2", x: 842, T: tScrap + 0.61, D: 0.62, H: 1180, a0: 0.9, spin: 3.4, drift: 26 },
    { id: "fall3", kind: "drum", mat: "scrapN.ochre", x: 432, T: tScrap + 0.68, D: 0.66, H: 1300, a0: -0.2, spin: -2.2, drift: -34 },
    { id: "fall4", kind: "rim", mat: "scrapN.steel2", x: 118, T: tScrap + 0.76, D: 0.68, H: 1380, a0: 0.4, spin: 2.9, drift: 18 },
    { id: "fall5", kind: "sheet", mat: "scrapN.rust", x: 716, T: tScrap + 0.85, D: 0.72, H: 1480, a0: 0.7, spin: -2.5, drift: -28 },
  ];
  const SURFACE = P + 8;
  const pieceAt = (pc: Piece, t: number): { c: Pt; a: number; heat: number } | null => {
    const start = pc.T - pc.D;
    if (t < start || t > pc.T + 0.5) return null;
    const u = clamp((t - start) / pc.D, 0, 1);
    // a fall: it comes into view already moving and gathers speed; in the melt it is stopped short
    const y = t <= pc.T ? SURFACE - pc.H * (1 - (0.45 * u + 0.55 * u * u)) : SURFACE + 175 * (1 - Math.exp(-(t - pc.T) / 0.1));
    return { c: [pc.x + pc.drift * (u - 1), y], a: pc.a0 + pc.spin * (t - start), heat: smoothstep(0.2, 1, u) };
  };
  const pieceShapes = (pc: Piece, c: Pt, a: number): Shape[] => {
    const hole = "scrapN.hole";
    if (pc.kind === "plate") return plate(pc.id, c, 172, 92, a, pc.mat);
    if (pc.kind === "gear") return gear(pc.id, c, 62, 9, a, pc.mat, hole);
    if (pc.kind === "pipe") return pipe(pc.id, c, 214, 25, a, pc.mat, hole);
    if (pc.kind === "drum") return drum(pc.id, c, 98, 144, a, pc.mat, hole);
    if (pc.kind === "rim") return rim(pc.id, c, 70, 0.74, a, pc.mat, hole);
    return sheet(pc.id, c, 184, 116, a, pc.mat);
  };
  /** dark rust at the top of the fall, the furnace's own orange by the bottom of it */
  const heated = (base: string, h: number, isHole: boolean): string => {
    const k = isHole ? 0.5 : 1;
    const a = mixHex(base, C.deep, Math.min(1, 1.5 * h) * 0.92 * k);
    return mixHex(a, C.orange, (Math.max(0, h - 0.5) / 0.5) * 0.8 * k);
  };
  for (const pc of pieces) cues.push({ t: pc.T, what: "sparks", x: pc.x });

  // ------------------------------------------------------------------------------------------------------------
  // The rods. The main bundle (it will stand inside the pier) rises from the near crest of the melt on "steel",
  // the middle one first. A second, thinner group rises farther back and to the right: the bars of the tower.
  // ------------------------------------------------------------------------------------------------------------
  const mainOrder = [2, 1, 3, 0, 4];
  const mainTips = [1023, 1008, 1015, 1005, 1021];
  const mainRods: Rod[] = PIER.bars.map((x, i) => {
    const rank = mainOrder.indexOf(i);
    const te = tSteel + 0.07 * rank;
    const start = te - 0.16;
    const arrive = tHigh - 0.31 + 0.025 * rank;
    const from = P + 70;
    const tip = new Track(from);
    tip.cruise(mainTips[i], { start, speed: (from - mainTips[i]) / (arrive - start - 0.2), ramp: 0.2 });
    return { id: `rod/m${i}`, x, r: PIER.barR, tip, start, te, arrive, pitch: 34 };
  });
  const backOrder = [2, 5, 0, 7, 3, 1, 6, 4];
  const backRods: Rod[] = backOrder.map((rank, j) => {
    const x = TOWER.cols[Math.floor(j / 2)] + (j % 2 ? TOWER.barOff : -TOWER.barOff);
    const start = tSteel + 0.12 + 0.045 * rank;
    const arrive = tHigh + 0.22 + 0.05 * rank;
    const final = TOWER.top - 38 - 18 * hash(j * 3.7 + 1);
    // it starts 80 px under the middle crest, wherever the camera has put that crest in this layer by then
    const v = cam.view(start);
    const l0 = lay(v, 0);
    const lb = lay(v, SW.BACK);
    const from = (l0.ty + (P - SW.MID) * l0.s + 80 - lb.ty) / lb.s;
    const tip = new Track(from);
    tip.cruise(final, { start, speed: (from - final) / (arrive - start - 0.25), ramp: 0.25 });
    return { id: `rod/b${j}`, x, r: TOWER.barR, tip, start, te: start + 0.2, arrive, pitch: 13 };
  });
  cues.push({ t: tSteel, what: "rolling mill", x: PIER.x }, { t: tRods, what: "metal ring", x: PIER.x });

  // the melt's three crests, each a slow swell with shorter ones riding on it; it lifts where a rod is about to
  // come through, clings to the rod as it rises, and rings where a piece went in
  const swell = (dt: number, grow: number, cling: number) => (dt < 0 ? grow * smoothstep(-0.24, 0, dt) : cling + (grow - cling) * Math.exp(-dt / 0.2));
  const crestF = (x: number, t: number) => {
    let b = 0;
    for (const rod of mainRods) {
      const dt = t - rod.te;
      if (dt < -0.24) continue;
      const d = (x - rod.x) / 30;
      b += swell(dt, 34, 12) * Math.exp(-d * d);
    }
    for (const pc of pieces) {
      const dt = t - pc.T;
      if (dt < 0 || dt > 1.3) continue;
      const d = (x - pc.x) / 66;
      b += 26 * Math.exp(-dt / 0.22) * Math.sin(15 * dt) * Math.exp(-d * d);
    }
    return P + 10 * Math.sin(0.011 * x + 2.1 * t) + 6 * Math.sin(0.023 * x - 3.3 * t + 1.2) + 3.5 * Math.sin(0.047 * x + 4.9 * t + 0.4) - b;
  };
  const crestM = (x: number, t: number) => {
    let b = 0;
    for (const rod of backRods) {
      const dt = t - rod.te;
      if (dt < -0.24) continue;
      const d = (x - rod.x) / 15;
      b += swell(dt, 15, 5) * Math.exp(-d * d);
    }
    return P - SW.MID + 8 * Math.sin(0.013 * x - 1.7 * t + 2.0) + 5 * Math.sin(0.029 * x + 2.6 * t + 0.7) - b;
  };
  const crestR = (x: number, t: number) => P - SW.REAR + 6 * Math.sin(0.016 * x + 1.3 * t + 4.0) + 4 * Math.sin(0.035 * x - 2.2 * t + 2.2);

  // ------------------------------------------------------------------------------------------------------------
  // "highways": ring ties snap round the bundle, the two halves of the column close on it, the cap is squeezed out
  // of their meeting, and the deck comes in from both sides and meets over the cap.
  // ------------------------------------------------------------------------------------------------------------
  const tCol = tHigh - 0.06;
  const tDeck = tHigh + 0.14;
  const ties = PIER.ties.map((y, k) => {
    const grow = new Track(0);
    grow.to(1, { at: tHigh - 0.27 + 0.035 * k, dur: 0.12, w: WEIGHT.hand, windup: 0 });
    return { y, grow };
  });
  const colL = new Track(-580);
  colL.to(0, { at: tCol, dur: 0.3, w: SLAM });
  const colR = new Track(780);
  colR.to(0, { at: tCol, dur: 0.36, w: SLAM });
  // (the cap starts out of the joint as it shuts, and has its full spread just before the deck lands on it)
  const capRise = new Track(0);
  capRise.to(1, { at: tCol + 0.15, dur: 0.16, w: SQUEEZE });
  const capSpread = new Track(0);
  capSpread.to(1, { at: tCol + 0.19, dur: 0.17, w: SQUEEZE });
  const deckL = new Track(-1000);
  deckL.to(0, { at: tDeck, dur: 0.42, w: SLAM });
  const deckR = new Track(1160);
  deckR.to(0, { at: tDeck, dur: 0.48, w: SLAM });
  cam.shake(tCol, 7, 0.35);
  cam.shake(tDeck, 5, 0.3);
  cues.push({ t: tCol, what: "concrete thud", x: PIER.x }, { t: tDeck, what: "deck thud", x: PIER.x });

  // ------------------------------------------------------------------------------------------------------------
  // "high-rises": the tower goes up the bars floor by floor, each slab jacked up off the one below it.
  // ------------------------------------------------------------------------------------------------------------
  const lifts = Array.from({ length: TOWER.floors }, (_, k) => {
    const lift = new Track(0);
    const land = tRise + 0.068 * k;
    lift.to(1, { at: land, dur: 0.2, w: TICK });
    cues.push({ t: land, what: "slab tick", x: (TOWER.x0 + TOWER.x1) / 2 });
    return lift;
  });
  cues.push({ t: tRise, what: "rising chord", x: (TOWER.x0 + TOWER.x1) / 2 });
  const floorsAt = (t: number): Shape[] => {
    const out: Shape[] = [];
    // each floor starts lying on the one below and is pushed up one storey from wherever that one is now
    let below = TOWER.top + TOWER.storey * TOWER.floors;
    for (let k = 0; k < TOWER.floors; k++) {
      const lam = lifts[k].value(t);
      if (lam < 0.004) break;
      const y = below - TOWER.storey * lam;
      // (the lowest one has nothing to rise from: it comes up out of the haze)
      out.push(towerFloor(`tower/f${k}`, y, below - y - TOWER.slab, k === 0 ? smoothstep(0, 0.5, lam) : 1));
      below = y;
    }
    return out;
  };

  // ------------------------------------------------------------------------------------------------------------
  // The hold: a lorry on the deck, crows across the low sky, haze that drifts, a sun that breathes.
  // ------------------------------------------------------------------------------------------------------------
  const truckX = new Track(-150);
  truckX.cruise(1400, { start: tLast - 0.5, speed: 300, ramp: 0.3 });
  const crows = [
    { tb: tRise + 0.15, v: 272, y: 1196, climb: -38, ph: 0.3 },
    { tb: tRise + 0.42, v: 250, y: 1128, climb: -30, ph: 1.9 },
    { tb: tRise + 0.66, v: 286, y: 1248, climb: -44, ph: 3.4 },
  ];
  const CLOUDS = [
    { x: 236, y: 646, rx: 268, ry: 8, v: 9, a: 0.2 },
    { x: 96, y: 694, rx: 180, ry: 6, v: 13, a: 0.17 },
    { x: 452, y: 782, rx: 236, ry: 9, v: 7, a: 0.2 },
    { x: 980, y: 716, rx: 210, ry: 7, v: 10, a: 0.16 },
    { x: 760, y: 846, rx: 300, ry: 8, v: 6, a: 0.15 },
  ];
  const HAZE_BANDS = [
    { x: 300, y: 1304, rx: 430, ry: 34, v: 13, a: 0.3 },
    { x: 760, y: 1382, rx: 470, ry: 40, v: -9, a: 0.34 },
    { x: 180, y: 1462, rx: 520, ry: 46, v: 17, a: 0.3 },
  ];

  // ------------------------------------------------------------------------------------------------------------
  // What is written on the frame: the two words, each rising into place on its own word, glowing as it lands and
  // cooling to cream as the rods cool. (Set in screen pixels: the type does not ride with the camera.)
  // ------------------------------------------------------------------------------------------------------------
  const face: FaceName = TYPE_LOOKS.A.name;
  const TYPE = { text: "steel rods", size: 192, x: 72, y: 440, rise: 70, each: 0.028, dur: 0.26 };
  const line = layout(TYPE.text, face, TYPE.size);
  const typeWords = [
    { text: "steel", from: 0, to: 5, at: tSteel },
    { text: "rods", from: 6, to: 10, at: tRods },
  ].map((w) => {
    const glyphs = line.glyphs.slice(w.from, w.to).map((_, n) => {
      const land = w.at + n * TYPE.each;
      const tr = new Track(0);
      tr.to(1, { at: land, dur: TYPE.dur, w: WEIGHT.hand, windup: 0 });
      return { start: land - TYPE.dur, land, tr };
    });
    const g0 = line.glyphs[w.from];
    const g1 = line.glyphs[w.to - 1];
    return { ...w, glyphs, box: { x0: TYPE.x + g0.x, y0: TYPE.y - 0.78 * TYPE.size, x1: TYPE.x + g1.x + g1.w, y1: TYPE.y + 0.02 * TYPE.size } };
  });
  const typeAt = (t: number): SteelFrame["type"] => {
    if (t < typeWords[0].glyphs[0].start) return null;
    const words: TypeWordState[] = [];
    for (const w of typeWords) {
      if (t < w.glyphs[0].start) continue;
      const each = w.glyphs.map((g) => ({ dy: (1 - g.tr.value(t)) * TYPE.rise, opacity: smoothstep(g.start, g.start + TYPE.dur * 0.5, t) }));
      words.push({ from: w.from, to: w.to, color: lerpHex(C.gold, C.cream, smoothstep(w.at + 0.05, w.at + 0.7, t)), each });
    }
    return { line, x: TYPE.x, y: TYPE.y, words };
  };
  const type = {
    text: TYPE.text,
    face,
    size: TYPE.size,
    cap: line.capHeight,
    x: TYPE.x,
    y: TYPE.y,
    box: { x0: TYPE.x, y0: TYPE.y - 0.78 * TYPE.size, x1: TYPE.x + line.width, y1: TYPE.y + 0.02 * TYPE.size },
    words: typeWords.map((w) => ({ text: w.text, at: w.at, from: w.from, to: w.to, landed: w.glyphs[w.glyphs.length - 1].land, box: w.box })),
    from: typeWords[0].glyphs[0].start,
  };

  // ------------------------------------------------------------------------------------------------------------
  // Things that never change, built once
  // ------------------------------------------------------------------------------------------------------------
  const SKY_STOPS: Stop[] = SKY.map((s) => ({ at: s.y / STEEL.HGT, color: s.color, a: 1 }));
  const CITY_HAZE: Stop[] = skyVeil(1385, STEEL.HGT, (y) => smoothstep(1385, 1485, y), [1410, 1435, 1460, 1485]);
  const TOWER_HAZE: Stop[] = skyVeil(1250, STEEL.HGT, (y) => 0.85 * smoothstep(1390, 1720, y), [1390, 1470, 1555, 1640, 1720]);
  const SUN_DISC = shape("sun", "sun", ellipse([SUN.x, SUN.y], SUN.r, SUN.r, 0, 3), { form: "flat", ink: 0, paper: false });
  const SLAG = Array.from({ length: 17 }, (_, i) => ({
    x: hash(i * 3.1 + 2) * 1700,
    y: 58 + 330 * hash(i * 5.3 + 1),
    rx: 54 + 120 * hash(i * 2.3 + 4),
    v: (i % 2 ? 1 : -1) * (26 + 30 * hash(i * 7.9 + 3)),
    kind: i % 3,
  }));
  /** streaks on the two crests behind: `band` 0 = middle, 1 = far */
  const STREAKS = Array.from({ length: 9 }, (_, i) => ({
    band: i % 3 === 2 ? 1 : 0,
    x: hash(i * 4.3 + 7) * 1700,
    y: 30 + 56 * hash(i * 6.1 + 3),
    rx: 44 + 80 * hash(i * 3.7 + 5),
    v: (i % 2 ? -1 : 1) * (18 + 22 * hash(i * 5.9 + 1)),
  }));
  const streaks = (band: number, t: number): Shape[] =>
    STREAKS.flatMap((k, i) => {
      if (k.band !== band) return [];
      const x = ((((k.x + k.v * t) % 1700) + 1700) % 1700) - 310;
      const y = P - (band ? SW.REAR : SW.MID) + k.y + 4 * Math.sin(1.9 * t + i * 1.3);
      return [shape(`melt/streak${i}`, band ? "melt.orange" : "melt.gold", ellipse([x, y], k.rx, k.rx * 0.05 + 2.5, 0, 6), { form: "flat", ink: 0, paper: false, opacity: 0.5 })];
    });

  // ------------------------------------------------------------------------------------------------------------
  // One frame: everything that is drawn at time t, back to front
  // ------------------------------------------------------------------------------------------------------------
  const frame = (t: number): SteelFrame => {
    const view = cam.view(t);
    const L0 = lay(view, 0);
    const LB = lay(view, SW.BACK);
    const items: Item[] = [];
    const push = (it: PaintItem | FillItem) => {
      if (it.kind === "paint" ? it.shapes.length : it.paths.length) items.push(it);
    };
    // what the frame sees of the main plane, with a margin
    const wx0 = (-70 - L0.tx) / L0.s;
    const wx1 = (STEEL.W + 70 - L0.tx) / L0.s;
    const wy0 = (-70 - L0.ty) / L0.s;
    const wy1 = (STEEL.HGT + 70 - L0.ty) / L0.s;
    const seen = (s: Shape, l: Lay): boolean => {
      const b = bounds(s.pts);
      return l.tx + b.x1 * l.s > -50 && l.tx + b.x0 * l.s < STEEL.W + 50 && l.ty + b.y1 * l.s > -50 && l.ty + b.y0 * l.s < STEEL.HGT + 50;
    };
    const f = furnace(t);
    const fOut = f.R + f.S;
    const furnaceOn = fOut > SW.GLOW[1] - wy1;
    /** how solid the furnace is at a point of the main plane */
    const fAlpha = (p: Pt) => clamp((fOut - Math.hypot(p[0] - SW.GLOW[0], p[1] - SW.GLOW[1])) / f.S, 0, 1);
    const poolOn = furnaceOn && P - SW.REAR - 30 < wy1;

    // ---- the dawn, behind the furnace until the furnace thins
    if (t >= tDawn) {
      const breath = Math.sin(2.4 * t);
      const gr = SUN.glow * (1 + 0.05 * breath);
      push({ kind: "fill", id: "sky", space: "screen", fill: { kind: "linear", x1: 0, y1: 0, x2: 0, y2: STEEL.HGT, stops: SKY_STOPS }, paths: [box(-90, -90, STEEL.W + 90, STEEL.HGT + 90)] });
      push({
        kind: "fill",
        id: "sun.glow",
        space: "screen",
        fill: {
          kind: "radial",
          cx: SUN.x,
          cy: SUN.y,
          r: gr,
          stops: [
            { at: 0, color: STEEL_PALETTE.sun, a: 0.92 + 0.06 * breath },
            { at: 0.14, color: C.sunGlow, a: 0.82 + 0.07 * breath },
            { at: 0.5, color: C.sunGlow, a: 0.36 + 0.03 * breath },
            { at: 1, color: C.sunGlow, a: 0 },
          ],
        },
        paths: [box(SUN.x - gr, SUN.y - gr, SUN.x + gr, SUN.y + gr)],
      });
      push({ kind: "paint", id: "sun", space: "screen", light: "dawn", shapes: [SUN_DISC] });
      push({
        kind: "paint",
        id: "cloud",
        space: SW.CLOUD,
        light: "dawn",
        shapes: CLOUDS.map((c, i) => shape(`cloud/${i}`, "sky.horizon", ellipse([c.x + c.v * (t - tHigh), c.y], c.rx, c.ry, -0.012, 8), { form: "flat", ink: 0, paper: false, opacity: c.a })),
      });
      push({ kind: "paint", id: "city.far", space: SW.CITY, light: "dawn", shapes: CITY_FAR });
      push({ kind: "paint", id: "city.mid", space: SW.CITY, light: "dawn", shapes: CITY_MID });
      push({ kind: "fill", id: "city.haze", space: "screen", fill: { kind: "linear", x1: 0, y1: 1385, x2: 0, y2: STEEL.HGT, stops: CITY_HAZE }, paths: [box(-90, 1385, STEEL.W + 90, STEEL.HGT + 90)] });
    }

    // ---- the furnace: one glow, solid out to R
    if (furnaceOn) push({ kind: "fill", id: "furnace", space: 0, fill: furnaceFill(f), paths: [box(wx0 - 40, wy0 - 40, wx1 + 40, wy1 + 40)] });

    // ---- the far crest of the melt
    if (poolOn) {
      push({
        kind: "paint",
        id: "melt.rear",
        space: 0,
        light: "furnace",
        shapes: [
          meltBand("melt/rear", "melt.deep", (x) => crestR(x, t), PX0, PX1, P + 70),
          crestStrip("melt/rear.skin", "melt.orange", (x) => crestR(x, t), (x) => 3 + 3.5 * (1 + Math.sin(0.017 * x + 2.1 * t + 1)), PX0, PX1),
          ...streaks(1, t),
        ],
      });
    }

    // ---- the tower's bars, behind the middle crest
    {
      const frameBottom = (STEEL.HGT + 60 - LB.ty) / LB.s;
      const crestScreen = L0.ty + (P - SW.MID) * L0.s;
      const hide = poolOn ? (crestScreen + 64 - LB.ty) / LB.s : Infinity;
      const shapes: Shape[] = [];
      const paths: Pt[][] = [];
      const ribs: FillItem[] = [];
      for (const rod of backRods) {
        if (t < rod.start) continue;
        const tip = rod.tip.value(t);
        const bottom = Math.min(hide, frameBottom);
        if (bottom - tip < 10) continue;
        const pts = rodOutline(rod.x, rod.r, tip, bottom);
        shapes.push(shape(rod.id, "steel.far", pts, { depth: 3.4, rim: 0.5 }));
        paths.push(pts);
        ribs.push({ kind: "fill", id: `${rod.id}.ribs`, space: SW.BACK, fill: { kind: "ribs", x: rod.x - rod.r, y: tip, w: rod.r * 2, pitch: rod.pitch, lean: 4, thick: 3.2, mat: "steel.far" }, paths: [pts] });
      }
      push({ kind: "paint", id: "rods.back", space: SW.BACK, light: "dawn", shapes });
      for (const r of ribs) push(r);
      const hotLen = 560 / LB.s;
      const y1 = (crestScreen - LB.ty) / LB.s;
      if (crestScreen - 560 < STEEL.HGT + 40 && paths.length) push({ kind: "fill", id: "rods.back.heat", space: SW.BACK, fill: heatFill(y1, hotLen), paths });
    }

    // ---- the tower frame, climbing its bars. Above the deck it catches the sky; below, it stands against the sun.
    {
      const floors = floorsAt(t);
      push({ kind: "paint", id: "tower", space: SW.BACK, light: "dawn", shapes: floors });
      push({
        kind: "fill",
        id: "tower.against",
        space: SW.BACK,
        fill: { kind: "linear", x1: 0, y1: 900, x2: 0, y2: 1080, stops: [{ at: 0, color: STEEL_PALETTE["city.veil"], a: 0 }, { at: 1, color: STEEL_PALETTE["city.veil"], a: 0.72 }] },
        paths: floors.filter((s) => bounds(s.pts).y1 > 900).map((s) => s.pts),
      });
    }

    // ---- haze over the foot of the tower and the far city, drifting
    const hazeOn = smoothstep(tOut - 0.3, tOut + 0.12, t);
    if (hazeOn > 0.01) {
      push({ kind: "fill", id: "tower.haze", space: "screen", opacity: hazeOn, fill: { kind: "linear", x1: 0, y1: 1250, x2: 0, y2: STEEL.HGT, stops: TOWER_HAZE }, paths: [box(-90, 1250, STEEL.W + 90, STEEL.HGT + 90)] });
      push({ kind: "paint", id: "city.near", space: SW.ROOFS, light: "dawn", shapes: CITY_NEAR, opacity: hazeOn });
      HAZE_BANDS.forEach((b, i) => {
        const cx = b.x + b.v * (t - tHigh) + 26 * Math.sin(0.5 * t + i * 2.1);
        push({
          kind: "fill",
          id: `haze${i}`,
          space: "screen",
          opacity: hazeOn * (0.82 + 0.18 * Math.sin(0.9 * t + i * 1.7)),
          fill: { kind: "radial", cx, cy: b.y, r: b.rx, sy: b.ry / b.rx, stops: [{ at: 0, color: C.haze, a: b.a }, { at: 0.55, color: C.haze, a: b.a * 0.45 }, { at: 1, color: C.haze, a: 0 }] },
          paths: [box(cx - b.rx, b.y - b.ry, cx + b.rx, b.y + b.ry)],
        });
      });
    }

    // ---- crows, low across the bright part of the sky
    {
      const shapes: Shape[] = [];
      crows.forEach((b, i) => {
        const dt = t - b.tb;
        if (dt < 0) return;
        const c: Pt = [-44 + b.v * dt, b.y + b.climb * dt + 5 * Math.sin(2.3 * dt + b.ph)];
        shapes.push(...crow(`crow${i}`, c, 23, { dir: 1, tilt: -0.13, flap: Math.sin(2 * Math.PI * 3.1 * dt + b.ph) }));
      });
      push({ kind: "paint", id: "crows", space: SW.BIRD, light: "dawn", shapes });
    }

    // ---- the middle crest
    if (poolOn) {
      push({
        kind: "paint",
        id: "melt.mid",
        space: 0,
        light: "furnace",
        shapes: [
          meltBand("melt/mid", "melt.orange", (x) => crestM(x, t), PX0, PX1, P + 70),
          crestStrip("melt/mid.skin", "melt.gold", (x) => crestM(x, t), (x) => 3 + 4 * (1 + Math.sin(0.019 * x - 2.4 * t + 0.6)), PX0, PX1),
          ...streaks(0, t),
        ],
      });
    }

    // ---- scrap, falling through the glow into the near crest
    for (const pc of pieces) {
      const at = pieceAt(pc, t);
      if (!at) continue;
      const shapes = pieceShapes(pc, at.c, at.a).map((s) => ({ ...s, color: heated(STEEL_PALETTE[s.mat], at.heat, /hole/.test(s.mat)) }));
      const bs = shapes.map((s) => bounds(s.pts));
      const top = Math.min(...bs.map((b) => b.y0));
      // (once all of it is below the lowest the near crest ever dips, the melt in front hides it)
      if (top > P + 30) continue;
      // it shows only as far as the glow has reached: no more solid than the glow is at its highest point
      const solid = Math.min(fAlpha([Math.min(...bs.map((b) => b.x0)), top]), fAlpha([Math.max(...bs.map((b) => b.x1)), top]), fAlpha([at.c[0], top]));
      if (solid < 0.02) continue;
      push({ kind: "paint", id: pc.id, space: 0, light: "furnace", shapes, opacity: solid < 0.995 ? solid : undefined });
    }

    // ---- the pier: the inside of the cut-away, the bars, their ties, then the concrete itself
    const dL = colL.value(t);
    const dR = colR.value(t);
    const onL = PIER.x + 1 + dL > wx0;
    const onR = PIER.x - 1 + dR < wx1;
    const half = (h: Shape[], d: number, on: boolean) => (on ? moveShapes(h, [d, 0]).filter((s) => seen(s, L0)) : []);
    push({ kind: "paint", id: "pier.back", space: 0, light: "dawn", shapes: [...half(PIER_L.back, dL, onL), ...half(PIER_R.back, dR, onR)] });
    {
      const bottom = Math.min(poolOn ? P + 96 : Infinity, wy1);
      const shapes: Shape[] = [];
      const paths: Pt[][] = [];
      const ribs: FillItem[] = [];
      for (const rod of mainRods) {
        if (t < rod.start) continue;
        const tip = rod.tip.value(t);
        if (bottom - tip < 10) continue;
        const pts = rodOutline(rod.x, rod.r, tip, bottom);
        shapes.push(shape(rod.id, "steel", pts, { depth: 10 }));
        paths.push(pts);
        ribs.push({ kind: "fill", id: `${rod.id}.ribs`, space: 0, fill: { kind: "ribs", x: rod.x - rod.r, y: tip, w: rod.r * 2, pitch: rod.pitch, lean: 11, thick: 7, mat: "steel" }, paths: [pts] });
      }
      // (a glow in the air round the place the rods come out of)
      const halo = smoothstep(tSteel - 0.2, tSteel + 0.35, t);
      if (poolOn && halo > 0.01) {
        push({
          kind: "fill",
          id: "rods.halo",
          space: 0,
          opacity: halo * (0.86 + 0.14 * Math.sin(7.1 * t)),
          fill: { kind: "radial", cx: PIER.x, cy: P - 60, r: 360, stops: [{ at: 0, color: C.gold, a: 0.5 }, { at: 0.4, color: C.orange, a: 0.26 }, { at: 1, color: C.deep, a: 0 }] },
          paths: [box(PIER.x - 360, P - 420, PIER.x + 360, P + 40)],
        });
      }
      push({ kind: "paint", id: "rods.main", space: 0, light: "dawn", shapes });
      for (const r of ribs) push(r);
      if (P - 820 < wy1 && paths.length) push({ kind: "fill", id: "rods.main.heat", space: 0, fill: heatFill(P, 820), paths });
    }
    push({
      kind: "paint",
      id: "ties",
      space: 0,
      light: "dawn",
      shapes: ties.flatMap((tie, k) => {
        const g = tie.grow.value(t);
        return g > 0.06 ? [tieShape(`tie${k}`, tie.y, 106 * g)] : [];
      }),
    });
    push({ kind: "paint", id: "pier", space: 0, light: "dawn", shapes: [...half(PIER_L.bevel, dL, onL), ...half(PIER_R.bevel, dR, onR), ...half(PIER_L.face, dL, onL), ...half(PIER_R.face, dR, onR)] });
    {
      const on = smoothstep(tCol + 0.05, tCol + 0.6, t);
      if (on > 0.01) {
        const col = [box(PIER.x0, PIER.top, PIER.x1, PIER.foot)];
        push({ kind: "fill", id: "pier.warm", space: 0, opacity: on, fill: { kind: "linear", x1: PIER.x0, y1: 0, x2: PIER.x1, y2: 0, stops: [{ at: 0, color: C.sunGlow, a: 0 }, { at: 0.55, color: C.sunGlow, a: 0.05 }, { at: 1, color: C.sunGlow, a: 0.22 }] }, paths: col });
        push({ kind: "fill", id: "pier.foot", space: 0, opacity: on, fill: { kind: "linear", x1: 0, y1: 1470, x2: 0, y2: 2000, stops: [{ at: 0, color: skyAt(1600), a: 0 }, { at: 1, color: skyAt(1800), a: 0.5 }] }, paths: [box(PIER.x0, 1470, PIER.x1 + PIER.side, PIER.foot)] });
      }
    }
    {
      const capOn = clamp(capSpread.value(t), 0, 1);
      const shadow = (y0: number, len: number, a: number): Fill => ({
        kind: "linear",
        x1: 0,
        y1: y0,
        x2: 0,
        y2: y0 + len,
        stops: [{ at: 0, color: C.dark, a, tone: { mat: "concrete", tone: "deep" } }, { at: 1, color: C.dark, a: 0, tone: { mat: "concrete", tone: "deep" } }],
      });
      if (capOn > 0.02) push({ kind: "fill", id: "pier.shadow", space: 0, opacity: capOn, fill: shadow(PIER.top, 64, 0.62), paths: [box(PIER.x0, PIER.top, PIER.x1, PIER.top + 64)] });
      push({ kind: "paint", id: "cap", space: 0, light: "dawn", shapes: pierCap(capRise.value(t), capSpread.value(t)) });
      const deckOn = smoothstep(tDeck - 0.1, tDeck + 0.04, t);
      if (deckOn > 0.02) push({ kind: "fill", id: "cap.shadow", space: 0, opacity: deckOn, fill: shadow(PIER.cap.top, 44, 0.66), paths: [box(PIER.x - PIER.cap.half, PIER.cap.top, PIER.x + PIER.cap.half, PIER.cap.top + 44)] });
    }

    // ---- the deck, and what crosses it (the lorry runs behind the parapet)
    {
      const x = truckX.value(t);
      if (x > -148 && x < 1200) push({ kind: "paint", id: "truck", space: 0, light: "dawn", shapes: truck("truck", x, PIER.deck.lip + 2) });
      const a = deckL.value(t);
      const b = deckR.value(t);
      push({ kind: "paint", id: "deck", space: 0, light: "dawn", shapes: [...moveShapes(DECK_L, [a, 0]), ...moveShapes(DECK_R, [b, 0])].filter((s) => seen(s, L0)) });
      [a, b].forEach((off, i) => {
        const lx = PIER.lamps[i] + off;
        const ly = PIER.deck.top - PIER.lampH + 6;
        if (lx < wx0 - 40 || lx > wx1 + 40) return;
        const glow = 0.82 + 0.18 * Math.sin(3.1 * t + i * 2.4);
        push({ kind: "fill", id: `lamp${i}`, space: 0, opacity: glow, fill: { kind: "radial", cx: lx, cy: ly, r: 30, stops: [{ at: 0, color: STEEL_PALETTE.sun, a: 0.95 }, { at: 0.22, color: C.sunGlow, a: 0.7 }, { at: 1, color: C.sunGlow, a: 0 }] }, paths: [box(lx - 30, ly - 30, lx + 30, ly + 30)] });
      });
    }

    // ---- dust where the concrete met
    {
      const puff = (id: string, at: Pt, size: number, dir: 1 | -1, from: number, life: number, seed: number): Shape[] => {
        const age = (t - from) / life;
        return age < 0 || age >= 1 ? [] : dustPuff(id, [at[0], at[1] - 26 * age], size, dir, age, seed);
      };
      const motes = (id: string, n: number, from: number, seed: number): Shape[] => {
        const out: Shape[] = [];
        const dt = t - from;
        if (dt < 0) return out;
        for (let k = 0; k < n; k++) {
          const life = 0.42 + 0.42 * hash(seed * 3.1 + k);
          if (dt >= life) continue;
          const u = dt / life;
          // out of the joint at the head of the column, up and to both sides, slowing as it goes
          const ang = -Math.PI / 2 + (hash(seed * 7.7 + k * 1.3) - 0.5) * 2.5;
          const sp = 130 + 300 * hash(seed * 5.3 + k * 2.9);
          const go = sp * dt * (1 - 0.45 * u);
          const c: Pt = [PIER.x + (hash(seed + k * 4.1) - 0.5) * 36 + Math.cos(ang) * go, PIER.top + 60 * hash(seed * 2.3 + k) + Math.sin(ang) * go + 110 * dt * dt];
          const r = (3.5 + 7 * hash(seed * 9.7 + k)) * (1 + 1.3 * u);
          out.push(shape(`${id}${k}`, "dust", ellipse(c, r * 1.2, r, 0, 4), { form: "flat", ink: 0, paper: false, opacity: 0.62 * Math.pow(1 - u, 1.3) }));
        }
        return out;
      };
      push({
        kind: "paint",
        id: "dust",
        space: 0,
        light: "dawn",
        shapes: [
          ...motes("dust/c", 12, tCol, 4),
          ...puff("dust/d0", [PIER.x - 10, PIER.deck.top], 150, -1, tDeck, 0.6, 7),
          ...puff("dust/d1", [PIER.x + 10, PIER.deck.top], 176, 1, tDeck, 0.64, 9),
        ],
      });
    }

    // ---- the near crest, in front of the foot of every rod, white-hot lower down
    if (poolOn) {
      const shapes: Shape[] = [
        meltBand("melt/front", "melt.gold", (x) => crestF(x, t), PX0, PX1, P + 1700),
        crestStrip("melt/front.skin", "melt.core", (x) => crestF(x, t), (x) => 4 + 4.5 * (1 + Math.sin(0.021 * x + 2.8 * t + 2.4)), PX0, PX1),
      ];
      SLAG.forEach((s, i) => {
        // skins of cooler metal that drift on the surface (they wrap round well outside the frame)
        const x = ((((s.x + s.v * t) % 1700) + 1700) % 1700) - 310;
        const y = P + s.y + 7 * Math.sin(1.7 * t + i * 2.2);
        shapes.push(shape(`melt/slag${i}`, s.kind === 0 ? "melt.core" : s.kind === 1 ? "melt.orange" : "melt.deep", ellipse([x, y], s.rx, s.rx * 0.085 + 3, 0, 6), { form: "flat", ink: 0, paper: false, opacity: s.kind === 0 ? 0.55 : s.kind === 1 ? 0.5 : 0.26 }));
      });
      // rings spreading on the surface from the foot of each rod, as long as it is being drawn out
      mainRods.forEach((rod, i) => {
        const dt = t - rod.te;
        if (dt < 0) return;
        for (let k = 0; k < 2; k++) {
          const u = (((dt * 1.5 + k * 0.5 + i * 0.17) % 1) + 1) % 1;
          const rx = 24 + 70 * u;
          const yc = crestF(rod.x, t) + 16 + 10 * u;
          const arc: Pt[] = [];
          for (let a = 0.12; a <= 0.881; a += 0.076) arc.push([rod.x + rx * Math.cos(a * Math.PI), yc + rx * 0.3 * Math.sin(a * Math.PI)]);
          const ring = stroke(arc, () => 1.2 + 2.2 * (1 - u), true, 3);
          if (ring.length >= 3) shapes.push(shape(`melt/ring${i}.${k}`, "melt.core", ring, { form: "flat", ink: 0, paper: false, opacity: 0.7 * Math.sin(Math.PI * u) * Math.min(1, dt / 0.2) }));
        }
      });
      push({ kind: "paint", id: "melt.front", space: 0, light: "furnace", shapes });
      push({
        kind: "fill",
        id: "melt.white",
        space: 0,
        fill: { kind: "linear", x1: 0, y1: P + 190, x2: 0, y2: P + 600, stops: [{ at: 0, color: C.core, a: 0 }, { at: 1, color: C.core, a: 1 }] },
        paths: [box(PX0, P + 190, PX1, P + 1700)],
      });
    }

    // ---- sparks: a steady few rising off the melt, and a burst where each piece went in
    {
      const shapes: Shape[] = [];
      const gate = smoothstep(tScrap + 0.4, tScrap + 0.85, t);
      if (furnaceOn && gate > 0) {
        for (let i = 0; i < 18; i++) {
          const period = 0.9 + 0.8 * hash(i * 5.1 + 2);
          const u = (((t / period + hash(i * 7.7 + 3)) % 1) + 1) % 1;
          const x0 = 40 + 1000 * hash(i * 3.3 + 1);
          const x = x0 + (14 + 22 * hash(i * 4.3 + 5)) * Math.sin(6 * u + i);
          const y = crestM(x0, t) + 30 - (300 + 380 * hash(i * 1.9 + 4)) * (1 - (1 - u) * (1 - u));
          const o = Math.min(1, u / 0.1) * Math.pow(1 - u, 1.4) * gate * fAlpha([x, y]);
          if (o < 0.03) continue;
          const k = 3 + 3 * hash(i * 2.7 + 6);
          shapes.push(shape(`spark/${i}`, i % 3 ? "melt.gold" : "melt.core", [[x, y - 2.4 * k], [x + 0.8 * k, y], [x, y + 2.4 * k], [x - 0.8 * k, y]], { form: "flat", ink: 0, paper: false, opacity: o }));
        }
      }
      pieces.forEach((pc, j) => {
        const dt = t - pc.T;
        if (dt < 0) return;
        for (let k = 0; k < 7; k++) {
          const life = 0.36 + 0.24 * hash(j * 9.1 + k * 3.3);
          if (dt >= life) continue;
          const ang = -Math.PI / 2 + (k - 3) * 0.27 + 0.2 * (hash(j * 5.7 + k) - 0.5);
          const sp = 560 + 520 * hash(j * 2.3 + k * 7.1);
          const vx = Math.cos(ang) * sp;
          const vy = Math.sin(ang) * sp + 2400 * dt;
          const p: Pt = [pc.x + Math.cos(ang) * sp * dt, P - 6 + Math.sin(ang) * sp * dt + 1200 * dt * dt];
          const v = Math.hypot(vx, vy) || 1;
          const d: Pt = [vx / v, vy / v];
          const len = 7 + v * 0.013;
          const o = Math.pow(1 - dt / life, 1.2) * fAlpha(p);
          if (o < 0.03) continue;
          shapes.push(shape(`splash/${j}.${k}`, k % 2 ? "melt.core" : "melt.gold", [[p[0] + d[0] * len, p[1] + d[1] * len], [p[0] - d[1] * 2.6, p[1] + d[0] * 2.6], [p[0] - d[0] * len, p[1] - d[1] * len], [p[0] + d[1] * 2.6, p[1] - d[0] * 2.6]], { form: "flat", ink: 0, paper: false, opacity: o }));
        }
      });
      push({ kind: "paint", id: "sparks", space: 0, light: "furnace", shapes: shapes.filter((s) => seen(s, L0)) });
    }

    // ---- the furnace walls, close to the lens. They come out of the glare as it dies down, and the camera
    //      leaves them behind when it climbs out past the mouth.
    {
      const on = Math.pow(1 - heat.value(t), 1.6);
      const LW = lay(view, WALL.depth);
      if (on > 0.02 && LW.ty + WALL.mouth * LW.s < STEEL.HGT + 40) {
        const courses = (x: number): Fill => ({ kind: "ribs", x, y: WALL.mouth - WALL.course / 2, w: 400, pitch: WALL.course, lean: 0, thick: 4, mat: "furnace.wall" });
        // the melt lights them: most where they stand in it, less and less up toward the mouth
        const mx = (L0.tx + 540 * L0.s - LW.tx) / LW.s;
        const my = (L0.ty + (P + 80) * L0.s - LW.ty) / LW.s;
        const lit: Fill = { kind: "radial", cx: mx, cy: my, r: 1500, stops: [{ at: 0, color: C.orange, a: 0.62 }, { at: 0.42, color: C.orange, a: 0.5 }, { at: 0.7, color: C.deep, a: 0.24 }, { at: 1, color: C.deep, a: 0 }] };
        push({ kind: "paint", id: "wall.L", space: WALL.depth, light: "furnaceL", shapes: [WALL_L], opacity: on });
        push({ kind: "fill", id: "wall.L.lit", space: WALL.depth, opacity: on, fill: lit, paths: [WALL_L.pts] });
        push({ kind: "fill", id: "wall.L.courses", space: WALL.depth, opacity: on * 0.6, fill: courses(0), paths: [WALL_L.pts] });
        push({ kind: "paint", id: "wall.R", space: WALL.depth, light: "furnaceR", shapes: [WALL_R], opacity: on });
        push({ kind: "fill", id: "wall.R.lit", space: WALL.depth, opacity: on, fill: lit, paths: [WALL_R.pts] });
        push({ kind: "fill", id: "wall.R.courses", space: WALL.depth, opacity: on * 0.6, fill: courses(SW.W - 400), paths: [WALL_R.pts] });
      }
    }

    return { t, view, items, type: typeAt(t) };
  };

  /** What a point of the screen shows from the full-frame fills alone (sky, sun, furnace): colour, and how solid. */
  const backdrop = (t: number, p: Pt): { color: string | null; alpha: number } => {
    const L0 = lay(cam.view(t), 0);
    const w: Pt = [(p[0] - L0.tx) / L0.s, (p[1] - L0.ty) / L0.s];
    const f = furnace(t);
    const r = Math.hypot(w[0] - SW.GLOW[0], w[1] - SW.GLOW[1]);
    const a = clamp((f.R + f.S - r) / f.S, 0, 1);
    let color: string | null = null;
    if (t >= tDawn) {
      color = skyAt(p[1]);
      const d = Math.hypot(p[0] - SUN.x, p[1] - SUN.y) / SUN.glow;
      if (d < 1) color = lerpHex(color, C.sunGlow, d < 0.14 ? 0.84 : d < 0.5 ? 0.78 - ((d - 0.14) / 0.36) * 0.48 : 0.3 * (1 - (d - 0.5) / 0.5));
    }
    if (a <= 0) return { color, alpha: color ? 1 : 0 };
    const fc = colorAtR(f, r);
    return color ? { color: lerpHex(color, fc, a), alpha: 1 } : { color: fc, alpha: a };
  };

  // a cue's x was noted where the thing is in its own layer; the sound mix wants where it is on screen as it sounds
  const TOWER_MID = (TOWER.x0 + TOWER.x1) / 2;
  const cueList = cues
    .map((c) => {
      if (c.x === undefined) return c;
      const l = lay(cam.view(c.t), c.x === TOWER_MID ? SW.BACK : 0);
      return { ...c, x: Math.round(clamp(l.tx + c.x * l.s, 0, STEEL.W)) };
    })
    .sort((a, b) => a.t - b.t);

  return {
    cam,
    cues: cueList,
    duration: STEEL.end,
    type,
    frame,
    backdrop,
    furnace,
    mainRods,
    backRods,
    crests: { front: crestF, mid: crestM, rear: crestR },
    /** every keyed value of the take, by name, for the dry run's dead-air check */
    authored: (t: number): Record<string, number> => {
      const v: Record<string, number> = { glow: R.value(t), "glow.edge": S.value(t), flare: heat.value(t), "column.L": colL.value(t), "column.R": colR.value(t), "cap.rise": capRise.value(t), "cap.spread": capSpread.value(t), "deck.L": deckL.value(t), "deck.R": deckR.value(t), lorry: truckX.value(t) };
      mainRods.forEach((r, i) => (v[`rod.m${i}`] = r.tip.value(t)));
      backRods.forEach((r, i) => (v[`rod.b${i}`] = r.tip.value(t)));
      ties.forEach((k, i) => (v[`tie${i}`] = k.grow.value(t)));
      lifts.forEach((k, i) => (v[`floor${i}`] = k.value(t)));
      typeWords.forEach((w) => w.glyphs.forEach((g, i) => (v[`type.${w.text}.${i}`] = g.tr.value(t))));
      pieces.forEach((pc) => (v[pc.id] = pieceAt(pc, t)?.c[1] ?? 0));
      crows.forEach((b, i) => (v[`crow${i}`] = t < b.tb ? 0 : t - b.tb));
      return v;
    },
    marks: { t0, tFull, tScrap, tSteel, tRods, tHigh, tRise, tLast, tDawn, tCol, tDeck },
  };
}

/** The heat left in a rod: white where it leaves the melt at y0, through orange, to nothing `len` px higher. */
function heatFill(y0: number, len: number): Fill {
  return {
    kind: "linear",
    x1: 0,
    y1: y0,
    x2: 0,
    y2: y0 - len,
    stops: [
      { at: 0, color: C.core, a: 0.94 },
      { at: 0.12, color: C.gold, a: 0.92 },
      { at: 0.26, color: C.orange, a: 0.9 },
      { at: 0.45, color: C.deep, a: 0.86 },
      { at: 0.66, color: DULL[0], a: 0.58 },
      { at: 0.84, color: DULL[1], a: 0.26 },
      { at: 1, color: DULL[2], a: 0 },
    ],
  };
}
/** the dull reds steel passes through as it stops glowing: the furnace's orange sinking toward its dark */
const DULL = [mixHex(C.deep, C.dark, 0.3), mixHex(C.deep, C.dark, 0.58), mixHex(C.deep, C.dark, 0.7)];

export type SteelTake = ReturnType<typeof build>;
let take: SteelTake | null = null;
export function steelTake(): SteelTake {
  if (!take) take = build();
  return take;
}
