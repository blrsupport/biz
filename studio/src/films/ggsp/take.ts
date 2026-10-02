// Demo 2, GGSP: "It is 1976, and you are standing in a scrapyard in Ahmedabad ... but his sons will one day take a
// company public that turns that same scrap" - the yard, one continuous take. (What the scrap turns into is steel.ts.)
// This file is the whole performance as data: who does what and when, where the camera is, what is written across
// the sky. Nothing is drawn here, so it runs and is checked in Node.
import { CAST, CAST_PALETTE } from "../../assets/cast/cast.ts";
import { SCALE_PALETTE, scalePoints } from "../../assets/props/scale.ts";
import { SCRAP_PALETTE, drumStack, gear, plate, scrapHeap } from "../../assets/props/scrap.ts";
import { TIN_PALETTE } from "../../assets/props/tin.ts";
import { YARDLIFE_PALETTE } from "../../assets/props/yardlife.ts";
import { YARD_PALETTE, buildYard } from "../../assets/sets/yard.ts";
import type { Palette, Shape } from "../../engine/draw/shape.ts";
import { HANDS, mixHand, type HandPose } from "../../engine/figure/hand.ts";
import { FACES, mixFace, type Expression } from "../../engine/figure/head.ts";
import { buildArm } from "../../engine/figure/limbs.ts";
import { add, clamp, lerpPt, mix, smoothstep, type Pt } from "../../engine/geom/vec.ts";
import { Actor } from "../../engine/motion/actor.ts";
import { Foot } from "../../engine/motion/feet.ts";
import { Blend, Path2, Track, WEIGHT, type Weight } from "../../engine/motion/track.ts";
import { callOut, eyesOf, feel, holdFromStart, lookAt, lookToCamera, nod, reach, release } from "../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../engine/stage/camera.ts";
import { makeAnchors } from "../../engine/time/clock.ts";
import type { NameCue, PhraseCue, YearCue } from "../../engine/type/blockspec.ts";
import { STEEL } from "./steel.ts";
import { VO, WORDS } from "./words.ts";

export const GGT = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, seconds: VO.duration } as const;
export const GG_TAKE_PALETTE: Palette = { ...CAST_PALETTE, ...YARD_PALETTE, ...SCRAP_PALETTE, ...SCALE_PALETTE, ...TIN_PALETTE, ...YARDLIFE_PALETTE };

const { U, GY } = GGT;
const FRAME = { width: GGT.W, height: GGT.HGT };
const REF = { cx: GGT.W / 2, cy: GGT.HGT / 2 };

/**
 * How far behind (or in front of) the actors each layer is, for the camera's parallax.
 * What is written across the sky is so far away that it hardly moves as we travel.
 */
export const DEPTH = { far: 4, mid: 2.2, type: 30, wall: 0.1, porter: -0.12, near: -0.3 } as const;

// ---- the set, built once: a long yard in four stretches (the third is the stretch of the approved style frame)
export const WALL_TOP = 492;
export const JUNCTION = GY - 0.36 * U;
export const YARD = [
  { x0: -2960, x1: -1560, seed: 11 },
  { x0: -1560, x1: -160, seed: 7 },
  { x0: -160, x1: 1240, seed: 3 },
  { x0: 1240, x1: 2640, seed: 5 },
].map((s) => ({ ...s, yard: buildYard({ GY, u: U, x0: s.x0, x1: s.x1 + 4, y0: -400, y1: 2700, wallTop: WALL_TOP, seed: s.seed }) }));
// (each stretch is built a few px wider than its share, so no hairline shows where two of them meet)
export const WALL_BOX = { x0: -2960, x1: 2640, y0: WALL_TOP, y1: JUNCTION };

/** Heaps of scrap against the wall, on the ground the actors stand on. */
export const HEAPS = [
  { id: "heap0", x: -2070, w: 3.3 * U, h: 2.5 * U, seed: 44, count: 40, g: 0.22 },
  { id: "heap1", x: -1190, w: 2.3 * U, h: 1.5 * U, seed: 23, count: 22, g: 0.2 },
  { id: "heap2", x: -560, w: 3.0 * U, h: 2.2 * U, seed: 65, count: 34, g: 0.22 },
  { id: "heapL", x: 150, w: 2.9 * U, h: 2.05 * U, seed: 12, count: 34, g: 0.22 },
  { id: "heapR", x: 1180, w: 2.6 * U, h: 1.9 * U, seed: 31, count: 30, g: 0.2 },
  { id: "heap5", x: 1900, w: 3.1 * U, h: 2.2 * U, seed: 83, count: 34, g: 0.22 },
].map((o) => ({ ...o, x0: o.x - o.w / 2 - 40, x1: o.x + o.w / 2 + 40, shapes: scrapHeap(o.id, { x: o.x, ground: JUNCTION + o.g * U, w: o.w, h: o.h, seed: o.seed, count: o.count }) }));

/** Pieces lying loose on the ground. */
export const LOOSE: Shape[] = [
  ...plate("loose0", [392, GY + 0.36 * U], 62, 30, -0.2, "scrap.rust"),
  ...gear("loose1", [318, GY + 0.1 * U], 24, 9, 0.3, "scrap.steel2", "scrap.hole"),
  ...plate("loose2", [900, GY + 0.62 * U], 80, 34, 0.12, "scrap.steel"),
  ...plate("loose3", [-1480, GY + 0.5 * U], 74, 30, 0.16, "scrap.rust2"),
  ...gear("loose4", [-1760, GY + 0.2 * U], 30, 9, 0.1, "scrap.rust", "scrap.hole"),
  ...plate("loose5", [-820, GY + 0.44 * U], 70, 32, -0.12, "scrap.steel"),
  ...gear("loose6", [-240, GY + 0.66 * U], 26, 9, 0.5, "scrap.ochre", "scrap.hole"),
  ...plate("loose7", [1530, GY + 0.5 * U], 76, 30, -0.1, "scrap.rust"),
];

/** Shafts of low sun in the dusty air: where each lies, in the actors' plane. */
export const SHAFTS: { c: Pt; rx: number; ry: number }[] = [
  { c: [-1730, 1070], rx: 720, ry: 105 },
  { c: [-930, 1080], rx: 640, ry: 90 },
  { c: [-270, 1075], rx: 700, ry: 110 },
  { c: [350, 1060], rx: 660, ry: 95 },
];
export const SHAFT_TILT = 0.6;
/** 0..1: how much of the light of the shafts reaches the point p. */
export function inShaft(p: Pt): number {
  let best = 0;
  const cs = Math.cos(SHAFT_TILT);
  const sn = Math.sin(SHAFT_TILT);
  for (const s of SHAFTS) {
    const dx = p[0] - s.c[0];
    const dy = p[1] - s.c[1];
    const a = (dx * cs + dy * sn) / s.rx;
    const b = (-dx * sn + dy * cs) / s.ry;
    best = Math.max(best, clamp(1 - (a * a + b * b), 0, 1));
  }
  return best;
}

// ---- the faces of this take
const EASY_I: Expression = { lidU: 0.92, lidL: 0.9, browRaise: 0.25, browTilt: -0.3, smile: 0.4, open: 0, wide: 0.05, jaw: 0 };
/** he has seen us */
const WARM: Expression = { lidU: 0.9, lidL: 0.55, browRaise: 0.45, browTilt: -0.3, smile: 0.85, open: 0, wide: 0.25, jaw: 0 };
/** eyes on the work */
const FOCUS: Expression = { lidU: 0.8, lidL: 0.84, browRaise: 0.1, browTilt: -0.1, smile: 0.1, open: 0, wide: 0, jaw: 0 };
/** taking the weight */
const HEAVE: Expression = { lidU: 0.58, lidL: 0.5, browRaise: 0.1, browTilt: -0.3, smile: -0.15, open: 0.26, wide: 0.5, jaw: 0.14 };
/** the beam is level */
const PLEASED: Expression = { lidU: 0.88, lidL: 0.6, browRaise: 0.4, browTilt: -0.25, smile: 0.7, open: 0, wide: 0.2, jaw: 0 };
/** looking into the low sun */
const SUNWARD: Expression = { lidU: 0.68, lidL: 0.6, browRaise: 0.2, browTilt: -0.35, smile: 0.34, open: 0, wide: 0.1, jaw: 0 };
const EASY_B: Expression = { lidU: 0.95, lidL: 0.9, browRaise: 0.3, browTilt: -0.2, smile: 0.3, open: 0, wide: 0.05, jaw: 0 };
const AGREED: Expression = { lidU: 0.9, lidL: 0.55, browRaise: 0.5, browTilt: -0.15, smile: 0.8, open: 0, wide: 0.25, jaw: 0 };

function build() {
  const W = makeAnchors(WORDS);
  const cues: { t: number; what: string; x?: number }[] = [];

  // ------------------------------------------------------------------------------------------------------------
  // Camera first: much of what follows is placed by where the camera will be.
  // A long travel to the right through the yard, arriving on the framing of the style frame; then it stays with him.
  // ------------------------------------------------------------------------------------------------------------
  const cam = new Camera(-1560, 760, 0.8, 4);
  cam.keys([
    // 1. the year, high over the yard: drifting forward
    { t: -0.3, cx: -1560, cy: 760, zoom: 0.8 },
    { t: 1.75, cx: -1500, cy: 757, zoom: 0.84 },
    // 2. forward and to the right, between the heaps
    { t: 3.0, cx: -1310, cy: 750, zoom: 0.9 },
    { t: 4.4, cx: -1010, cy: 742, zoom: 0.97 },
    // 3. faster, past the porter and the hand that throws; down to eye height
    { t: 5.4, cx: -430, cy: 850, zoom: 1.0 },
    { t: 6.4, cx: 190, cy: 930, zoom: 1.0 },
    // 4. arriving on him (the framing of the style frame)
    { t: 7.3, cx: 515, cy: 957, zoom: 1.0 },
    { t: 7.9, cx: 540, cy: 960, zoom: 1.0 },
    // 5. a small push toward the beam
    { t: 9.3, cx: 546, cy: 952, zoom: 1.04 },
    { t: 11.1, cx: 566, cy: 905, zoom: 1.15 },
    // 6. left and back a little, to hold the buyer too
    { t: 12.2, cx: 436, cy: 925, zoom: 1.03 },
    { t: 13.9, cx: 446, cy: 930, zoom: 1.05 },
    // 7. in to his face as he looks toward the sun
    { t: 15.25, cx: 706, cy: 748, zoom: 2.25 },
    { t: 15.75, cx: 710, cy: 746, zoom: 2.3 },
    // 8. right, along the wall, to his shadow
    { t: 16.95, cx: 1150, cy: 902, zoom: 1.0 },
    { t: 18.55, cx: 1178, cy: 906, zoom: 1.02 },
    // 9. down the wall to the heap at its foot, and into the glow
    { t: 19.35, cx: 1250, cy: 1240, zoom: 1.7 },
    { t: 20.2, cx: 1254, cy: 1420, zoom: 2.0 },
  ]);
  /** the stage point (at depth k) that is at screen (sx, sy) at time t */
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };
  /** where a stage point at depth k is on screen at time t */
  const onScreen = (t: number, k: number, p: Pt): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [lt.tx + p[0] * lt.s, lt.ty + p[1] * lt.s];
  };

  // ------------------------------------------------------------------------------------------------------------
  // Beat 1. "It is 1976," A crow lifts off the wall; dust drifts through a shaft of sun.
  // ------------------------------------------------------------------------------------------------------------
  const tYear = W("1976");
  const perch: Pt = [-1010, WALL_TOP - 0.09 * U - 30];
  const tFly = 0.34;
  const crowAt = new Path2(perch);
  // a hop, then away up over the yard (it is still fast when it leaves the frame)
  crowAt.to([perch[0] + 34, perch[1] - 42], { at: tFly + 0.12, dur: 0.14, w: WEIGHT.mech });
  crowAt.to([-560, -760], { at: tFly + 2.3, dur: 2.2, w: WEIGHT.mech, bow: 0.1, pivot: [perch[0] - 600, 2600] });
  const crowState = (t: number) => {
    const p = crowAt.value(t);
    const v = crowAt.velocity(t);
    const fold = 1 - smoothstep(tFly - 0.04, tFly + 0.1, t);
    const flying = t > tFly;
    // quick beats at the take-off, slower as it climbs
    const beats = flying ? 6.4 * (t - tFly) - 0.9 * Math.pow(Math.min(t - tFly, 1.6), 2) : 0;
    const bob = flying ? 0 : 3 * Math.sin(t * 9) * (t > tFly - 0.2 ? 0 : 1) + 7 * smoothstep(tFly - 0.16, tFly - 0.04, t);
    return { p: [p[0], p[1] + bob] as Pt, fold, flap: flying ? Math.sin(2 * Math.PI * beats + 0.6) : 0, tilt: flying ? clamp(Math.atan2(-v[1], Math.max(60, v[0])), -0.2, 0.9) : 0 };
  };
  cues.push({ t: 0.06, what: "clang.far" }, { t: tFly - 0.04, what: "crow" }, { t: tFly + 0.02, what: "wings" });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 2. "and you are standing in a scrapyard in Ahmedabad." Forward between the heaps; a stack of drums close
  // to the lens crosses the frame and the year goes behind it.
  // ------------------------------------------------------------------------------------------------------------
  const tPlace = W("Ahmedabad");
  /** when the middle of the drum stack reaches the right-hand end of the writing */
  const tWipe = tPlace + 1.02;
  const STACK = { w: 300, h: 420, cols: 2, rows: 5, ground: 2060 };
  const stackX = under(tWipe, DEPTH.near, 905, 0)[0];
  const near: { x0: number; x1: number; shapes: Shape[] }[] = [
    { x: -3050, w: 3.4 * U, h: 1.9 * U, seed: 91, ground: 2010, count: 14 },
    { x: -2030, w: 3.0 * U, h: 2.2 * U, seed: 37, ground: 2020, count: 14 },
    { x: -330, w: 3.0 * U, h: 1.5 * U, seed: 19, ground: 2010, count: 12 },
    { x: 70, w: 3.6 * U, h: 1.9 * U, seed: 57, ground: 1990, count: 16 },
    { x: 1040, w: 2.6 * U, h: 1.35 * U, seed: 71, ground: 2000, count: 10 },
    { x: 1790, w: 3.2 * U, h: 1.7 * U, seed: 29, ground: 2010, count: 14 },
  ].map((o, i) => ({ x0: o.x - o.w / 2 - 90, x1: o.x + o.w / 2 + 90, shapes: scrapHeap(`near${i}`, { x: o.x, ground: o.ground, w: o.w, h: o.h, seed: o.seed, near: true, scale: 1.7, count: o.count }) }));
  near.push({ x0: stackX - STACK.w * 1.5, x1: stackX + STACK.w * 1.5, shapes: drumStack("stack", { x: stackX, ground: STACK.ground, cols: STACK.cols, rows: STACK.rows, w: STACK.w, h: STACK.h, seed: 5, near: true }) });
  /** screen x of the middle of the drum stack */
  const stackScreenX = (t: number) => onScreen(t, DEPTH.near, [stackX, 0])[0];
  cues.push({ t: tWipe - 0.5, what: "pass" });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 3. "The air smells of metal and dust," A porter crosses close to us with a bundle on his head;
  // a hand throws a rusted piece onto a heap, and the dust it raises hangs in the light.
  // ------------------------------------------------------------------------------------------------------------
  const PU = 1.08 * U;
  const PGY = 1612;
  const tIn = W("air") + 0.28;
  const tOut = W("metal") + 0.58;
  const pIn = under(tIn, DEPTH.porter, 1180, 0)[0];
  const pOut = under(tOut, DEPTH.porter, -110, 0)[0];
  const pSpeed = (pIn - pOut) / (tOut - tIn);
  const pStep = 1.45;
  const pStepLen = pStep * PU * ((CAST.porter.build.thigh + CAST.porter.build.shin) / 2.5);
  const porter = new Actor({ ch: CAST.porter, scale: PU, groundY: PGY, x: pIn + pSpeed * 0.6, yaw: -1.22, seed: 31 });
  porter.walkTo(pOut - pSpeed * 0.9, { start: tIn - 0.6 - 0.21, pace: pSpeed / pStepLen, step: pStep });
  porter.lean = new Track(-0.03);
  /** the middle of the underside of his bundle: on top of his head, from the pelvis so that nothing goes in a circle */
  const BUNDLE = { w: 1.3 * PU, h: 0.86 * PU };
  const bundleAt = (t: number): Pt => {
    const p = porter.pelvis(t);
    return [p[0] - 0.13 * PU, p[1] - (CAST.porter.build.torso + CAST.porter.build.neck + 0.86) * PU];
  };
  // his far arm is up, steadying the load; the near one swings
  holdFromStart(porter, "R", (t) => add(bundleAt(t), [-0.56 * BUNDLE.w, -0.34 * BUNDLE.h]), { hand: HANDS.flat, palm: 1, layer: "front", wrist: 0.2 });
  for (const side of ["L", "R"] as const) {
    const P = porter.feet[side].plants;
    for (let i = 1; i < P.length; i++) if (P[i].t0 > tIn + 0.05 && P[i].t0 < tOut - 0.05) cues.push({ t: P[i].t0, what: "step.porter", x: onScreen(P[i].t0, DEPTH.porter, [P[i].x, PGY])[0] });
  }

  // the throw: an arm comes up from below the frame, close to the lens, and lets a gear go toward the heap ahead
  const HN = 1.7 * U;
  const tRel = W("metal") + 0.2;
  const tLand = W("dust") - 0.04;
  const shoulder = under(tRel, DEPTH.near, 664, 2046);
  // it comes up with the piece in its fist and is drawn back; then the swing, the let-go, the follow-through
  const hand = new Path2([-0.1, 0.5]);
  hand.to([-0.5, -0.62], { at: tRel - 0.2, dur: 0.34, w: WEIGHT.hand, windup: 0, overshoot: 0.03 });
  hand.to([0.5, -1.64], { at: tRel + 0.01, dur: 0.17, w: WEIGHT.hand, windup: 0.1, overshoot: 0, bow: 0.3 });
  hand.to([1.22, -1.2], { at: tRel + 0.19, dur: 0.18, w: WEIGHT.hand, windup: 0, overshoot: 0.04, bow: 0.22 });
  hand.to([0.6, 0.5], { at: tRel + 0.8, dur: 0.5, w: WEIGHT.body, windup: 0, bow: 0.1 });
  const grip = new Blend<HandPose>(HANDS.grip, mixHand);
  grip.to(HANDS.splay, tRel + 0.08, 0.1);
  grip.to(HANDS.relaxed, tRel + 0.55, 0.3);
  const thrower = (t: number) => {
    const wrist = add(shoulder, [hand.value(t)[0] * HN, hand.value(t)[1] * HN]) as Pt;
    return {
      shown: t > tRel - 0.66 && t < tRel + 0.86,
      arm: buildArm({ id: "thrower", S: shoulder, target: wrist, upper: 1.0 * HN, fore: 0.9 * HN, swivel: 0.8, half: [0.16 * HN, 0.13 * HN, 0.1 * HN], sleeve: 0.7, matSleeve: "sil.cloth", matSkin: "sil", hand: { pose: grip.value(t), bend: -0.15, palmSide: -1, size: 0.62 * HN } }),
    };
  };
  // the piece: in the hand, then through the air to the heap (in the actors' plane), where it stays
  const heapL = HEAPS[3];
  const land: Pt = [heapL.x + 64, JUNCTION + heapL.g * U - heapL.h * 0.84];
  const relScreen = onScreen(tRel, DEPTH.near, thrower(tRel).arm.hand.hold);
  const relWorld = under(tRel, 0, relScreen[0], relScreen[1]);
  const piece = (t: number): { p: Pt; spin: number; held: boolean; lying: boolean } => {
    if (t < tRel) return { p: relWorld, spin: 0, held: true, lying: false };
    if (t >= tLand) {
      const b = t - tLand;
      return { p: [land[0] + 14 * (1 - Math.exp(-b / 0.12)), land[1] - 16 * Math.exp(-b / 0.09) * Math.abs(Math.sin(b * 22))], spin: 3.6 + 0.5 * Math.exp(-b / 0.1), held: false, lying: true };
    }
    const u = (t - tRel) / (tLand - tRel);
    // (a high lob: for most of its flight it is seen against the plain wall, not against the heap)
    return { p: [mix(relWorld[0], land[0], u), mix(relWorld[1], land[1], u) - 300 * 4 * u * (1 - u)], spin: 4.1 * u * 2.2, held: false, lying: false };
  };
  cues.push({ t: tRel - 0.04, what: "throw", x: relScreen[0] }, { t: tLand, what: "clank", x: onScreen(tLand, 0, land)[0] }, { t: tLand + 0.03, what: "dust", x: onScreen(tLand, 0, land)[0] });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 4. "and a man named Shamsulhaq Iraki" He is stooped over a sack, hooking it to the scale. He looks up at us.
  // ------------------------------------------------------------------------------------------------------------
  const iraki = new Actor({ ch: CAST.iraki, scale: U, groundY: GY, x: 742 + 0.07 * U, yaw: -1.0, seed: 4 });
  // feet apart, the far one forward (the stance of the style frame)
  iraki.feet.L = new Foot(825);
  iraki.feet.R = new Foot(660);
  iraki.face = new Blend<Expression>(FOCUS, mixFace);
  iraki.drop = new Track(0.46);
  iraki.bend = new Track(-0.4);
  iraki.lean = new Track(-0.1);

  // the scale: where its pivot is, how the beam lies, where the poise hangs, how the load swings
  const SACK = { x: 610, ground: GY + 6, hRest: 1.5 * U, hFull: 1.66 * U, wRest: 1.42 * U, wFull: 1.3 * U };
  const restNeck: Pt = [SACK.x, SACK.ground - SACK.hRest];
  /** pivot for which the hook hangs exactly at the neck of the resting sack */
  const P_DOWN: Pt = [SACK.x - 0.5 * U, restNeck[1] - 0.66 * U];
  const P_PRE: Pt = [P_DOWN[0] + 0.03 * U, P_DOWN[1] - 0.3 * U];
  const P_UP: Pt = [524, GY - 3.5 * U];
  const P_SIDE: Pt = [802, 1166];
  const tHook = W("man") + 0.24;
  const tName = W("Shamsulhaq");
  const tLiftGo = W("weighing") - 0.08;
  const tUp = W("sack") - 0.1;
  const tOff = tLiftGo + 0.2;
  const tLevel = W("by");
  const tCall = W("calling");
  const tNod = W("buyer");
  const tSet = tNod + 0.5;
  const tFree = tSet + 0.15;
  const scaleP = new Path2(P_PRE);
  scaleP.to(P_DOWN, { at: tHook, dur: 0.28, w: WEIGHT.hand, windup: 0, overshoot: 0, bow: 0.1 });
  scaleP.to(P_UP, { at: tUp, dur: tUp - tLiftGo, w: WEIGHT.heavy, windup: 0, overshoot: 0.012, bow: 0.05, pivot: [900, 900] });
  scaleP.to([P_DOWN[0], P_DOWN[1] + 5], { at: tSet, dur: 0.5, w: WEIGHT.heavy, windup: 0, overshoot: 0, bow: 0.04, pivot: [900, 900] });
  scaleP.to([P_DOWN[0] - 0.16 * U, P_DOWN[1] + 0.12 * U], { at: tFree, dur: 0.15, w: WEIGHT.hand, windup: 0, overshoot: 0 });
  scaleP.to(P_SIDE, { at: tFree + 0.56, dur: 0.5, w: WEIGHT.body, windup: 0, bow: 0.22, pivot: [900, 1500] });
  /** beam: + = the long arm down. Light, it hangs long arm down; the sack tips it up; the poise brings it level. */
  const KICK: Weight = { overshoot: 0.22, settle: 0.5, zeta: 0.38, windup: 0, windupTime: 0 };
  const FIND: Weight = { overshoot: 0.34, settle: 1.15, zeta: 0.28, windup: 0, windupTime: 0 };
  const beam = new Track(0.3);
  beam.to(-0.2, { at: tOff + 0.12, dur: 0.18, w: KICK });
  beam.to(0.02, { at: tLevel, dur: 0.62, w: FIND });
  beam.to(0.34, { at: tSet + 0.1, dur: 0.22, w: KICK });
  beam.to(0.42, { at: tFree + 0.6, dur: 0.4, w: { ...KICK, overshoot: 0.3, settle: 0.9 } });
  const poise = new Track(0.2);
  const tSlide = tLevel - 0.1;
  poise.to(0.52, { at: tSlide, dur: 0.56, w: WEIGHT.hand, windup: 0, overshoot: 0.03 });
  /** the chain and the sack swing as a pendulum from the moment the sack leaves the ground */
  const swing = (t: number): number => {
    let s = 0;
    if (t > tOff) s += 0.105 * Math.exp(-(t - tOff) / 0.85) * Math.sin((2 * Math.PI * (t - tOff)) / 1.18);
    if (t > tSlide - 0.5) s += 0.03 * Math.exp(-(t - tSlide + 0.5) / 0.6) * Math.sin((2 * Math.PI * (t - tSlide + 0.5)) / 1.18);
    if (t > tSet) s *= Math.exp(-(t - tSet) / 0.05);
    // the empty hook dangles as he carries the scale to his side
    if (t > tFree) s += 0.3 * Math.exp(-(t - tFree) / 0.7) * Math.sin((2 * Math.PI * (t - tFree)) / 0.62);
    return s;
  };
  const scaleState = (t: number) => ({ pivot: scaleP.value(t), u: U, dir: -1 as const, ang: beam.value(t), poiseAt: poise.value(t), swing: swing(t) });
  const scaleAt = (t: number) => scalePoints(scaleState(t));
  /** the sack: on the ground until the hook has taken up its slack, then hanging; it stretches as it takes its weight */
  const sackState = (t: number) => {
    const hooked = t >= tHook && t < tFree - 0.02;
    const hook = scaleAt(t).hook;
    if (!hooked || hook[1] >= restNeck[1]) return { neck: restNeck, w: SACK.wRest, h: SACK.hRest, swing: 0, up: 0 };
    const h = clamp(SACK.ground - hook[1], SACK.hRest, SACK.hFull);
    const k = (h - SACK.hRest) / (SACK.hFull - SACK.hRest);
    const up = Math.max(0, SACK.ground - SACK.hFull - hook[1]);
    return { neck: [mix(restNeck[0], hook[0], smoothstep(0, 40, up)), hook[1]] as Pt, w: mix(SACK.wRest, SACK.wFull, k), h, swing: up > 0 ? swing(t) : 0, up };
  };
  cues.push({ t: tHook, what: "hook", x: 600 }, { t: tOff - 0.12, what: "heave", x: 620 }, { t: tOff, what: "chain", x: 600 }, { t: tLevel, what: "tick", x: 520 }, { t: tLevel + 0.36, what: "tick", x: 520 });

  // both hands on the stirrup: the near one takes the weight throughout; as the scale comes to his side it hangs from it
  const side = new Track(0);
  side.to(1, { at: tFree + 0.5, dur: 0.44, w: WEIGHT.mech });
  const onStirrupL = (t: number): Pt => add(scaleAt(t).handle, lerpPt([0.2 * U, 0.17 * U], [0.02 * U, -0.27 * U], side.value(t)));
  const onStirrupR = (t: number): Pt => add(scaleAt(t).handle, [0.12 * U, 0.3 * U]);
  holdFromStart(iraki, "L", onStirrupL, { hand: HANDS.fist, layer: "front" });
  holdFromStart(iraki, "R", onStirrupR, { hand: HANDS.fist, layer: "back" });
  iraki.arms.L.shrug = new Track(0.05);
  iraki.arms.R.shrug = new Track(0.05);
  lookAt(iraki, restNeck, { at: 6.2 });

  // the hook is in; he comes half upright and finds us looking
  iraki.drop.to(0.3, { at: tName + 0.16, dur: 0.5, w: WEIGHT.body });
  iraki.bend.to(-0.24, { at: tName + 0.18, dur: 0.5, w: WEIGHT.body });
  lookToCamera(iraki, { at: tName + 0.14, dur: 0.42, yaw: -0.3, pitch: 0.02 });
  feel(iraki, WARM, { at: tName + 0.34, dur: 0.3 });
  nod(iraki, { at: W("Iraki") + 0.16, amount: 0.11 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 5. "is weighing a sack of iron scrap by hand," Knees dip, the back lifts; the sack swings; the beam finds level.
  // ------------------------------------------------------------------------------------------------------------
  lookAt(iraki, [P_DOWN[0] + 40, P_DOWN[1]], { at: tLiftGo - 0.34, dur: 0.3 });
  feel(iraki, FOCUS, { at: tLiftGo - 0.3, dur: 0.24 });
  iraki.drop.to(0.5, { at: tLiftGo, dur: 0.26, w: WEIGHT.body, windup: 0 });
  iraki.bend.to(-0.43, { at: tLiftGo + 0.02, dur: 0.26, w: WEIGHT.body, windup: 0 });
  feel(iraki, HEAVE, { at: tLiftGo + 0.08, dur: 0.16 });
  iraki.drop.to(0.06, { at: tUp + 0.02, dur: tUp - tLiftGo, w: WEIGHT.heavy, windup: 0 });
  iraki.bend.to(0.02, { at: tUp + 0.05, dur: tUp - tLiftGo, w: WEIGHT.heavy, windup: 0 });
  iraki.lean.to(0.1, { at: tUp + 0.02, dur: tUp - tLiftGo, w: WEIGHT.heavy, windup: 0 });
  lookAt(iraki, P_UP, { at: tUp + 0.2, dur: 0.3 });
  feel(iraki, FOCUS, { at: tUp + 0.34, dur: 0.26 });
  // the far hand goes out along the beam to the poise and slides it until the beam comes down
  const onPoise = (t: number): Pt => add(scaleAt(t).poise, [0.3 * U, 0.1 * U]);
  reach(iraki, "R", onPoise(tSlide - 0.62), { at: tSlide - 0.62, dur: 0.3, hand: HANDS.pinch, palm: -1, pin: onPoise, contact: true, look: false, layer: "back", body: false });
  feel(iraki, PLEASED, { at: tLevel + 0.5, dur: 0.3 });
  nod(iraki, { at: tLevel + 0.62, amount: 0.09 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 6. "and calling out the number to a buyer." The buyer has come up while he weighed. He calls it out
  // across the beam; the buyer nods and counts out notes. (No number is shown: the narration gives none.)
  // ------------------------------------------------------------------------------------------------------------
  const BX = 205;
  const buyer = new Actor({ ch: CAST.buyer, scale: U, groundY: GY - 12, x: -340, yaw: 1.22, seed: 8 });
  buyer.face = new Blend<Expression>(EASY_B, mixFace);
  const bw = buyer.walkTo(BX, { arrive: tLevel + 0.5, pace: 1.9, step: 1.4 });
  buyer.turnTo(1.05, { at: bw.arrive + 0.5, dur: 0.45 });
  lookAt(buyer, P_UP, { at: bw.arrive - 0.4 });
  // (he is only drawn from here: until then he would be in the frames the camera has already left)
  const tBuyerOn = bw.start - 0.1;

  lookAt(iraki, [BX + 20, GY - 4.5 * U], { at: tCall - 0.04, dur: 0.3 });
  const callEnd = callOut(iraki, "R", { at: tCall + 0.08, hold: 0.84, then: "hold" });
  cues.push({ t: tCall + 0.08, what: "call", x: 700 });
  lookAt(buyer, [700, GY - 4.5 * U], { at: tCall + 0.3 });
  feel(buyer, mixFace(EASY_B, FACES.surprise, 0.25), { at: tCall + 0.4, dur: 0.2 });
  // the notes come out of his shirt pocket; he counts them off with the other hand, and nods
  const tPocket = W("number") - 0.05;
  const bs = buyer.solve(tPocket);
  const pocket: Pt = [bs.shoulders.R[0] + 0.5 * U, bs.shoulders.R[1] + 0.42 * U];
  reach(buyer, "R", pocket, { at: tPocket, dur: 0.32, hand: HANDS.pinch, look: false, body: false, contact: true, layer: "front" });
  const count: Pt = [BX + 0.62 * U, GY - 12 - 2.62 * U];
  reach(buyer, "R", count, { at: tPocket + 0.36, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, body: false, pin: true, layer: "front" });
  lookAt(buyer, [count[0] + 40, count[1]], { at: tPocket + 0.4 });
  const thumbAt = (t: number): Pt => {
    const u = t - (tPocket + 0.62);
    const k = u < 0 ? 0 : Math.sin(Math.PI * Math.min(1, (u % 0.24) / 0.2));
    return [count[0] + 0.52 * U + 0.12 * U * k, count[1] - 0.02 * U - 0.07 * U * k];
  };
  reach(buyer, "L", thumbAt(tPocket + 0.6), { at: tPocket + 0.6, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, body: false, pin: thumbAt, layer: "back" });
  for (let i = 0; i < 3; i++) cues.push({ t: tPocket + 0.62 + i * 0.24 + 0.1, what: "notes", x: 390 });
  nod(buyer, { at: tNod + 0.04, amount: 0.15 });
  feel(buyer, AGREED, { at: tNod + 0.1, dur: 0.24 });

  // the far hand comes back to the stirrup and he sets the sack down
  reach(iraki, "R", onStirrupR(callEnd - 0.14), { at: Math.max(callEnd - 0.14, tSet - 0.58), dur: 0.32, hand: HANDS.fist, pin: onStirrupR, contact: true, look: false, layer: "back", body: false });
  lookAt(iraki, restNeck, { at: tSet - 0.42, dur: 0.28 });
  feel(iraki, FOCUS, { at: tSet - 0.4, dur: 0.2 });
  iraki.drop.to(0.44, { at: tSet, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  iraki.bend.to(-0.38, { at: tSet + 0.02, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  iraki.lean.to(-0.08, { at: tSet, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  cues.push({ t: tSet - 0.03, what: "set", x: 600 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 7. "Now, he doesn't know it yet," The buyer pays and goes. He looks toward the low sun.
  // ------------------------------------------------------------------------------------------------------------
  // up again, the scale hanging from his near hand; the far hand takes the notes
  iraki.drop.to(0.06, { at: tFree + 0.5, dur: 0.46, w: WEIGHT.body });
  iraki.bend.to(0.02, { at: tFree + 0.52, dur: 0.46, w: WEIGHT.body });
  iraki.lean.to(0.03, { at: tFree + 0.5, dur: 0.46, w: WEIGHT.body });
  feel(iraki, EASY_I, { at: tFree + 0.4, dur: 0.3 });
  const give: Pt = [BX + 0.78 * U, GY - 3.44 * U];
  const tGive = tFree + 0.2;
  reach(buyer, "L", [BX + 0.5 * U, GY - 2.4 * U], { at: tGive - 0.1, dur: 0.3, hand: HANDS.relaxed, look: false, body: false });
  release(buyer, "L", { at: tGive + 0.5, dur: 0.4 });
  reach(buyer, "R", give, { at: tGive, dur: 0.34, hand: HANDS.pinch, palm: -1, look: false, bow: 0.18, layer: "front" });
  lookAt(buyer, [700, GY - 4.5 * U], { at: tGive - 0.05 });
  const tTaken = tGive + 0.2;
  const take: Pt = [give[0] + 0.92 * U, give[1] - 0.02 * U];
  reach(iraki, "R", take, { at: tTaken, dur: 0.3, hand: HANDS.pinch, palm: 1, look: false, body: false, contact: true, layer: "back" });
  lookAt(iraki, give, { at: tTaken - 0.12, dur: 0.26 });
  cues.push({ t: tTaken, what: "notes.take", x: 560 });
  // into the pocket of his waistcoat, then the arm hangs
  const tPut = tTaken + 0.5;
  const is = iraki.solve(tPut);
  reach(iraki, "R", [is.shoulders.R[0] + 0.3 * U, is.shoulders.R[1] + 0.95 * U], { at: tPut, dur: 0.36, hand: HANDS.pinch, look: false, body: false, bow: 0.14, layer: "back" });
  release(iraki, "R", { at: tPut + 0.62, dur: 0.44 });
  nod(iraki, { at: tTaken + 0.2, amount: 0.1 });
  // the buyer: a nod, and away the way he came
  release(buyer, "R", { at: tTaken + 0.5, dur: 0.4 });
  nod(buyer, { at: tTaken + 0.16, amount: 0.12 });
  const bl = buyer.walkTo(-420, { start: tTaken + 0.36, pace: 1.95, step: 1.4 });
  const tBuyerOff = bl.arrive;
  // he watches him go, then lifts his eyes to the sun, low over the wall
  const tSun = W("yet");
  lookAt(iraki, [80, GY - 4.4 * U], { at: tTaken + 0.44, dur: 0.3 });
  lookAt(iraki, [-900, 120], { at: tSun, dur: 0.44 });
  iraki.headTurn.to(0.34, { at: tSun, dur: 0.44, w: WEIGHT.head });
  iraki.headPitch.to(-0.1, { at: tSun + 0.03, dur: 0.44, w: WEIGHT.head });
  iraki.gazeX.to(-0.5, { at: tSun + 0.14, dur: 0.2, w: WEIGHT.eye });
  iraki.gazeY.to(-0.25, { at: tSun + 0.14, dur: 0.2, w: WEIGHT.eye });
  feel(iraki, SUNWARD, { at: tSun + 0.16, dur: 0.34 });
  iraki.blinks.push(tSun + 0.9, tSun + 2.4);
  iraki.bend.to(0.045, { at: tSun + 0.5, dur: 0.6, w: WEIGHT.body, windup: 0 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 8. "but his sons will one day take a company public" Behind him, on the wall, his shadow parts into two
  // taller men; they take hold of a bell rope and pull; the bell swings.
  // ------------------------------------------------------------------------------------------------------------
  const tSplit = W("his") + 0.02;
  const tTake = W("take");
  const tPublic = W("public");
  const SHX = iraki.x.value(0) + 230;
  const ROPE_X = 1208;
  const BELL: Pt = [ROPE_X, WALL_TOP + 12];
  /** the bell is drawn larger than life: it is the point of the picture */
  const BELL_U = 1.3 * U;
  /** it is let down into the picture from behind the top of the wall */
  const bellDown = new Track(0);
  bellDown.to(1, { at: tSplit + 0.86, dur: 0.56, w: { overshoot: 0.05, settle: 0.5, zeta: 0.5, windup: 0, windupTime: 0 } });
  const sonA = new Actor({ ch: CAST.sonA, scale: U, groundY: GY + 14, x: SHX + 16, yaw: -1.0, seed: 21, life: 0.5 });
  const sonB = new Actor({ ch: CAST.sonB, scale: U, groundY: GY + 14, x: SHX, yaw: -1.0, seed: 23, life: 0.5 });
  // the elder turns about where he stands; the younger backs away along the wall, and they face each other
  sonA.turnTo(1.1, { at: tSplit + 0.78, dur: 0.66 });
  const wb = sonB.walkTo(1412, { start: tSplit, pace: 2.25, step: 1.35, face: -1.1 });
  sonA.headPitch.to(-0.2, { at: tSplit + 1.0, dur: 0.4, w: WEIGHT.head });
  sonB.headPitch.to(-0.22, { at: wb.arrive, dur: 0.4, w: WEIGHT.head });
  // the rope comes down from the bell; hands go up to it, then two pulls
  const pull = new Track(0);
  const PULL: Weight = { overshoot: 0.05, settle: 0.4, zeta: 0.6, windup: 0.1, windupTime: 0.14 };
  pull.to(1, { at: tTake + 0.14, dur: 0.2, w: PULL });
  pull.to(0.12, { at: tPublic - 0.24, dur: 0.3, w: WEIGHT.body, windup: 0 });
  pull.to(1, { at: tPublic + 0.02, dur: 0.18, w: PULL });
  pull.to(0.2, { at: tPublic + 0.62, dur: 0.44, w: WEIGHT.body, windup: 0 });
  const ropeY = (t: number, base: number) => base + 0.9 * U * pull.value(t);
  const onRope = (dx: number, base: number) => (t: number): Pt => [ROPE_X + dx, ropeY(t, base)];
  const tGrab = Math.max(wb.arrive + 0.04, tTake - 0.22);
  reach(sonA, "R", onRope(-8, GY - 4.5 * U)(tGrab - 0.06), { at: tGrab - 0.06, dur: 0.34, hand: HANDS.grip, pin: onRope(-8, GY - 4.5 * U), contact: true, look: false, layer: "front" });
  reach(sonA, "L", onRope(-8, GY - 4.18 * U)(tGrab - 0.02), { at: tGrab - 0.02, dur: 0.34, hand: HANDS.grip, pin: onRope(-8, GY - 4.18 * U), contact: true, look: false, layer: "front" });
  reach(sonB, "L", onRope(8, GY - 3.84 * U)(tGrab), { at: tGrab, dur: 0.3, hand: HANDS.grip, pin: onRope(8, GY - 3.84 * U), contact: true, look: false, layer: "front" });
  reach(sonB, "R", onRope(8, GY - 3.52 * U)(tGrab + 0.03), { at: tGrab + 0.03, dur: 0.3, hand: HANDS.grip, pin: onRope(8, GY - 3.52 * U), contact: true, look: false, layer: "front" });
  for (const [s, f] of [[sonA, 1], [sonB, -1]] as const) {
    for (const [at, k] of [[tTake + 0.14, 1], [tPublic + 0.02, 1.1]] as const) {
      s.drop.to(0.3 * k, { at, dur: 0.2, w: WEIGHT.body, windup: 0 });
      s.bend.to(-f * 0.16 * k, { at: at + 0.02, dur: 0.2, w: WEIGHT.body, windup: 0 });
      s.drop.to(0.02, { at: at + 0.44, dur: 0.3, w: WEIGHT.body, windup: 0 });
      s.bend.to(0, { at: at + 0.46, dur: 0.3, w: WEIGHT.body, windup: 0 });
    }
  }
  /** the bell: each pull sets it swinging; the clapper lags behind it */
  const kicks: [number, number][] = [[tTake + 0.1, 0.4], [tPublic - 0.03, 0.52]];
  const bellSwing = (t: number) => {
    let s = 0;
    for (const [tk, a] of kicks) if (t > tk) s += a * Math.exp(-(t - tk) / 1.2) * Math.sin(2 * Math.PI * 1.3 * (t - tk));
    return s;
  };
  const bellState = (t: number) => {
    const sw = bellSwing(t);
    const pivot: Pt = [BELL[0], BELL[1] - (1 - bellDown.value(t)) * 1.5 * BELL_U];
    const hands: Pt = [ROPE_X, ropeY(t, GY - 4.5 * U) + pivot[1] - BELL[1]];
    const from: Pt = [pivot[0] + 0.86 * BELL_U * Math.sin(-sw), pivot[1] + 0.86 * BELL_U * Math.cos(sw)];
    const sway = (k: number) => (9 + 7 * k) * Math.sin(t * 3.1 - 0.5 * k) + 60 * k * sw;
    const rope: Pt[] = [from, lerpPt(from, hands, 0.55), hands, [ROPE_X + sway(0.3), hands[1] + 1.1 * U], [ROPE_X + sway(0.7), hands[1] + 1.9 * U], [ROPE_X + sway(1), hands[1] + 2.4 * U]];
    return { pivot, u: BELL_U, swing: sw + 0.16 * Math.sin(8 * (t - tSplit)) * (1 - bellDown.value(t)), clap: -0.8 * bellSwing(t - 0.11), rope, tassel: rope[rope.length - 1] };
  };
  /** how much of his own shadow is still his: it fades as the two step out of it */
  const ownShadow = (t: number) => 1 - smoothstep(tSplit + 0.08, tSplit + 0.62, t);
  /** the two come out of his shadow a little smaller than they will be, and grow */
  const sonScale = (t: number) => mix(0.94, 1, smoothstep(tSplit, tSplit + 0.7, t));
  const sonsOn = (t: number) => smoothstep(tSplit - 0.12, tSplit + 0.06, t);
  cues.push({ t: tTake + 0.12, what: "bell.soft", x: 640 }, { t: tPublic, what: "bell", x: 640 }, { t: tGrab, what: "rope", x: 640 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 9. "that turns that same scrap" Down the wall to the heap at its foot. Pieces lift off it, hang, and fall
  // into the glow that is rising under them (the glow, and everything after it, is steel.ts).
  // ------------------------------------------------------------------------------------------------------------
  const tScrap = W("scrap", 2);
  const heapR = HEAPS[4];
  const liftIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29];
  const lifts = liftIds.map((i, k) => {
    const y = new Track(0);
    const t0 = tScrap - 0.4 + 0.022 * k;
    const high = 170 + 250 * ((k * 0.37) % 1);
    y.to(-high, { at: t0 + 0.4, dur: 0.38, w: WEIGHT.hand, windup: 0.06, overshoot: 0.02 });
    y.to(-high * 1.06, { at: t0 + 0.56, dur: 0.16, w: WEIGHT.mech });
    y.to(1900, { at: t0 + 1.36, dur: 0.78, w: WEIGHT.mech });
    const x = new Track(0);
    x.to((k % 2 ? 1 : -1) * (20 + 11 * k), { at: t0 + 1.0, dur: 0.96, w: WEIGHT.mech });
    return { prefix: `heapR/p${i}/`, y, x, spin: (k % 2 ? 1 : -1) * (0.5 + 0.16 * k), t0 };
  });
  cues.push({ t: tScrap - 0.36, what: "lift", x: 540 });

  // ------------------------------------------------------------------------------------------------------------
  // What is written across the sky (in the type layer's own coordinates), each piece landing on its word
  // ------------------------------------------------------------------------------------------------------------
  const yearAt = under(2.4, DEPTH.type, 92, 548);
  const nameAt = under(8.6, DEPTH.type, 80, 300);
  const phraseAt = under(17.6, DEPTH.type, 80, 350);
  const type = {
    year: { x: yearAt[0], y: yearAt[1], cap: 252, maxW: 780, year: { text: "1976", at: tYear }, place: { text: "AHMEDABAD", at: tPlace, size: 62 }, out: tWipe + 0.95 } as YearCue,
    name: {
      x: nameAt[0],
      y: nameAt[1],
      cap: 84,
      maxW: 800,
      label: { text: "A MAN NAMED", at: W("man") },
      parts: [
        { text: "Shamsulhaq", at: tName },
        { text: " Iraki", at: W("Iraki") },
      ],
      out: tLevel - 0.25,
    } as NameCue,
    phrase: {
      x: phraseAt[0],
      y: phraseAt[1],
      size: 150,
      maxW: 790,
      lines: [
        { text: "take a company", at: tTake },
        { lead: "public", text: "", at: tPublic },
      ],
      out: tPublic + 0.62,
    } as PhraseCue,
  };

  return {
    cam,
    iraki,
    buyer,
    porter,
    sonA,
    sonB,
    near,
    crowState,
    stackScreenX,
    bundleAt,
    BUNDLE,
    thrower,
    piece,
    scaleState,
    sackState,
    bellState,
    ownShadow,
    sonScale,
    sonsOn,
    lifts,
    type,
    cues,
    duration: GGT.seconds,
    /** the yard is drawn until the glow has covered it */
    yardUntil: STEEL.tFull + 0.05,
    HN,
    PU,
    PGY,
    heapR,
    land,
    marks: { tYear, tFly, tPlace, tWipe, tIn, tOut, tRel, tLand, tHook, tName, tLiftGo, tOff, tUp, tLevel, tCall, tPocket, tNod, tSet, tFree, tGive, tTaken, tPut, tSun, tSplit, tGrab, tTake, tPublic, tScrap, tBuyerOn, tBuyerOff, buyerIn: bw.arrive, sonBIn: wb.arrive },
  };
}

export type GgTake = ReturnType<typeof build>;
let take: GgTake | null = null;
export function ggTake(): GgTake {
  if (!take) take = build();
  return take;
}
