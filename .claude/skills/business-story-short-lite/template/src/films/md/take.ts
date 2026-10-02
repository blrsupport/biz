// Demo 1, Minus Degre: "So they start with almost nothing ... revenue was just 5,000 rupees."
// One room, one continuous take. This file is the whole performance as data: who does what and when,
// where the camera is, what is written on the wall. Nothing is drawn here, so it runs and is checked in Node.
// frame.ts lists what is drawn at each moment; film.ts declares the sequence.
import { CAST, CAST_PALETTE } from "../../assets/cast/cast.ts";
import { MD_PROP_PALETTE, buildTable } from "../../assets/props/md.ts";
import { PRESS_PALETTE, pressPoints, type PressState } from "../../assets/props/press.ts";
import { TIN_PALETTE, tinPoints } from "../../assets/props/tin.ts";
import { DOOR_PALETTE, buildDoor } from "../../assets/sets/door.ts";
import { ROOM_PALETTE, buildRoom } from "../../assets/sets/room.ts";
import type { Palette } from "../../engine/draw/shape.ts";
import type { Cue } from "../../engine/film.ts";
import { HANDS } from "../../engine/figure/hand.ts";
import { FACES, mixFace, type Expression } from "../../engine/figure/head.ts";
import { lerpPt, type Pt } from "../../engine/geom/vec.ts";
import { Actor } from "../../engine/motion/actor.ts";
import { Prop } from "../../engine/motion/prop.ts";
import { Blend, Track, WEIGHT, type Weight } from "../../engine/motion/track.ts";
import { armTo, crouch, dustHands, eyesOf, feel, handsOnHips, holdFromStart, lookAt, pat, pushGlasses, reach, release, shiftWeight, shrug } from "../../engine/motion/verbs.ts";
import { Camera } from "../../engine/stage/camera.ts";
import { makeAnchors } from "../../engine/time/clock.ts";
import type { NumberCue, PhraseCue } from "../../engine/type/blockspec.ts";
import { VO, WORDS } from "./words.ts";

export const MD = { W: 1080, HGT: 1920, U: 178, GY: 1505, fps: 30, seconds: VO.duration } as const;
export const MD_TAKE_PALETTE: Palette = { ...CAST_PALETTE, ...ROOM_PALETTE, ...DOOR_PALETTE, ...MD_PROP_PALETTE, ...PRESS_PALETTE, ...TIN_PALETTE };

const { U, GY } = MD;
const RUPEE = "₹";
const CORNER = -420;
const SLOPE = 0.45;
/** how far behind the actors the back wall is, for the camera's parallax */
export const WALL_DEPTH = 0.1;

// ---- the set, built once
export const ROOM = buildRoom({ GY, u: U, x0: -2000, x1: 2400, y0: -1400, y1: 2800, corner: CORNER, sunSlope: SLOPE, sunDepth: 2.75, sunAt: 4.8, boardX: -330, bulbX: 1150, bulbY: 180 });
export const DOOR = buildDoor({ corner: CORNER, junction: ROOM.junction, u: U, x0: -2000, y0: -1400, y1: 2800 });
export const TABLE = buildTable("table", { x: 600, ground: GY - 8, w: 2.7 * U, h: 2.28 * U, u: U });
export const OVEN = { w: 1.5 * U, h: 0.92 * U, at: [590, TABLE.topY - 0.07 * U] as Pt };
export const PRESS_AT = { x: -70, ground: GY - 8, u: U };
export const TIN_AT = { x: 786, base: TABLE.topY - 0.05 * U, u: U };
export const CAL = { x: 985, y: 268, w: 132, h: 196 };

/** Height of the sun's edge on the wall (as buildRoom wants it) for a shutter that is `open` (0..1). */
export const sunFor = (open: number) => (Math.max(0, Math.min(1, open)) * (DOOR.H - 0.04 * U) + SLOPE * CORNER) / U;
/** y of the sun's edge at x: below it the light reaches, above it the room is in shade. */
export const sunEdgeY = (open: number, x: number) => ROOM.junction - sunFor(open) * U + SLOPE * x;

// ---- the faces of this take. (A brow left level reads as a frown once the head is turned and tipped down,
// so the resting faces carry the inner ends of the brows a little high.)
const EASY_R: Expression = { lidU: 0.96, lidL: 0.9, browRaise: 0.3, browTilt: -0.45, smile: 0.34, open: 0, wide: 0.05, jaw: 0 };
const EASY_V: Expression = { lidU: 0.96, lidL: 0.9, browRaise: 0.3, browTilt: -0.15, smile: 0.3, open: 0, wide: 0.05, jaw: 0 };
/** carrying something heavy: brows up in the middle, mouth pulled wide */
const STRAIN: Expression = { lidU: 0.6, lidL: 0.55, browRaise: 0.2, browTilt: -0.45, smile: -0.25, open: 0.34, wide: 0.6, jaw: 0.18 };
/** working at something with the hands */
const FOCUS: Expression = { lidU: 0.8, lidL: 0.82, browRaise: 0.05, browTilt: 0.05, smile: 0.06, open: 0, wide: 0, jaw: 0 };
/** putting the back into it */
const HEAVE: Expression = { lidU: 0.56, lidL: 0.5, browRaise: 0, browTilt: 0.12, smile: -0.12, open: 0.3, wide: 0.55, jaw: 0.16 };
const PROUD: Expression = { lidU: 0.9, lidL: 0.5, browRaise: 0.55, browTilt: -0.25, smile: 0.9, open: 0, wide: 0.3, jaw: 0 };
/** "well, that's what there is" */
const WELL: Expression = { lidU: 0.9, lidL: 0.85, browRaise: 1, browTilt: -0.5, smile: -0.3, open: 0, wide: 0.42, jaw: 0 };
/** the number lands */
const SUNK: Expression = { lidU: 0.78, lidL: 0.95, browRaise: 0.55, browTilt: -0.85, smile: -0.36, open: 0, wide: 0.1, jaw: 0 };
const WRY: Expression = { lidU: 0.86, lidL: 0.6, browRaise: 0.6, browTilt: -0.55, smile: 0.5, open: 0, wide: 0.34, jaw: 0 };

function build() {
  const W = makeAnchors(WORDS);
  // Rahul walks the lane nearer the camera; Vikas, with the oven, the one nearer the wall
  const rahul = new Actor({ ch: CAST.rahul, scale: U, groundY: GY + 14, x: -640, yaw: 1.22, seed: 3 });
  const vikas = new Actor({ ch: CAST.vikas, scale: U, groundY: GY - 4, x: -960, yaw: 1.22, seed: 5 });
  rahul.face = new Blend<Expression>(EASY_R, mixFace);
  const cam = new Camera(-335, 1000, 0.86);
  const cues: Cue[] = [];

  // ------------------------------------------------------------------------------------------------------------
  // Beat 1. "So they start with almost nothing." The shutter goes up, light comes in, they walk in.
  // ------------------------------------------------------------------------------------------------------------
  const RATTLE: Weight = { overshoot: 0.016, settle: 0.45, zeta: 0.3, windup: 0, windupTime: 0 };
  const shutter = new Track(0);
  shutter.to(0.984, { at: 0.32, dur: 0.62, w: RATTLE });
  cues.push({ t: 0, what: "shutter", x: -620 });

  const rw = rahul.walkTo(890, { start: -0.1, pace: 2.4, step: 1.6 });
  lookAt(rahul, [rahul.x.value(0.85) + 520, 220], { at: 0.85 });
  feel(rahul, mixFace(FACES.smile, FACES.surprise, 0.3), { at: 1.0, dur: 0.3 });
  lookAt(rahul, [rahul.x.value(1.55) - 700, 760], { at: 1.55 });
  feel(rahul, "grin", { at: 1.6, dur: 0.25 });
  lookAt(rahul, [640, 1050], { at: 2.2 });
  feel(rahul, "smile", { at: 2.3 });
  rahul.turnTo(-0.95, { at: rw.arrive + 0.5, dur: 0.52 });

  // the oven: carried in low against the body, one arm under it and one over it; set down on the table on "10,000"
  const oven = new Prop(OVEN.at, {
    under: [-0.6 * U, 0.03 * U],
    near: [-0.95 * U, -0.22 * U],
    far: [-0.35 * U, -1.14 * U],
    pat: [0.56 * U, -1.07 * U],
  });
  oven.held = new Track(1);
  oven.tilt = new Track(-0.05);
  oven.carry = (t: number): Pt => {
    const p = vikas.pelvis(t);
    return [p[0] + 1.0 * U, p[1] - 0.15 * U];
  };
  /** 0 = the near hand is under the oven, carrying it; 1 = it is on the side, steadying it onto the table */
  const regrip = new Track(0);
  const nearGrip = (t: number): Pt => lerpPt(oven.grip("under", t), oven.grip("near", t), regrip.value(t));
  holdFromStart(vikas, "R", nearGrip, { hand: HANDS.cup, palm: -1, layer: "front", wrist: -1.05 });
  holdFromStart(vikas, "L", (t) => oven.grip("far", t), { hand: HANDS.relaxed, palm: 1, layer: "back", wrist: 0.25 });
  vikas.lean = new Track(-0.1);
  vikas.bend = new Track(-0.06);
  vikas.face = new Blend<Expression>(mixFace(STRAIN, EASY_V, 0.4), mixFace);
  const vw = vikas.walkTo(282, { arrive: 2.92, pace: 2.0, step: 1.3 });
  lookAt(vikas, [600, 1090], { at: 1.9 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 2. "An oven for about 10,000 rupees": knees bend, the table takes the weight, Rahul pats it.
  // ------------------------------------------------------------------------------------------------------------
  const tPut = W("10,000");
  const tGo = tPut - 0.44;
  crouch(vikas, 0.3, 0.44, { at: tPut, dur: 0.42, w: WEIGHT.heavy });
  oven.pos.reset(tGo - 0.06, oven.carry(tGo));
  oven.held.to(0, { at: tGo + 0.12, dur: 0.12, w: WEIGHT.mech });
  oven.pos.to(OVEN.at, { at: tPut, dur: 0.44, w: WEIGHT.heavy, windup: 0, overshoot: 0, bow: 0.2, pivot: [282, GY] });
  oven.tilt.to(0.045, { at: tPut - 0.18, dur: 0.24, w: WEIGHT.heavy, windup: 0 });
  oven.tilt.to(0, { at: tPut + 0.06, dur: 0.2, w: WEIGHT.heavy, windup: 0, overshoot: 0 });
  regrip.to(1, { at: tPut - 0.08, dur: 0.34, w: WEIGHT.mech });
  vikas.arms.R.wrist.to(-0.35, { at: tPut - 0.06, dur: 0.34, w: WEIGHT.hand });
  feel(vikas, STRAIN, { at: tPut - 0.25, dur: 0.2 });
  feel(vikas, "exhale", { at: tPut + 0.32, dur: 0.22 });
  feel(vikas, mixFace(FACES.smile, EASY_V, 0.4), { at: tPut + 0.8, dur: 0.3 });
  cam.shake(tPut, 7, 0.35);
  cues.push({ t: tPut, what: "thud", x: OVEN.at[0] });
  /** the table and what stands on it give under the weight and ring a little */
  const thud = (t: number) => (t < tPut ? 0 : 3.4 * Math.exp(-(t - tPut) / 0.075) * Math.cos((t - tPut) * 58));
  // he lets go and straightens (late, as he turns away: the amount on the wall behind him must stay clear)
  const tUp = tPut + 1.36;
  release(vikas, "R", { at: tUp, dur: 0.46 });
  release(vikas, "L", { at: tUp + 0.08, dur: 0.46 });
  vikas.drop.to(0, { at: tUp, dur: 0.46, w: WEIGHT.body });
  vikas.bend.to(0, { at: tUp + 0.04, dur: 0.46, w: WEIGHT.body });
  vikas.lean.to(0, { at: tUp, dur: 0.46, w: WEIGHT.body });
  lookAt(vikas, [900, 640], { at: tPut + 0.66 });
  /** until here the fingers of his near hand are round the far side of the oven, behind it */
  const tFree = tUp - 0.46 * 0.75;

  lookAt(rahul, oven.grip("pat", tPut), { at: rw.arrive + 0.6 });
  feel(rahul, "grin", { at: tPut + 0.22, dur: 0.2 });
  const tPat = W("rupees") - 0.06;
  const patEnd = pat(rahul, "L", oven.grip("pat", tPat), { at: tPat, times: 2, every: 0.24, palm: -1, wrist: -0.42, layer: "front" });
  armTo(rahul, "R", [-0.12, 0.16, 1.36], { at: tPat - 0.05, dur: 0.4, hand: HANDS.fist, layer: "back" });
  release(rahul, "L", { at: patEnd + 0.62, dur: 0.5 });
  cues.push({ t: tPat, what: "pat", x: OVEN.at[0] + 90 }, { t: tPat + 0.24, what: "pat", x: OVEN.at[0] + 90 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 3. "and a machine they build for 15 to 20,000 rupees": Vikas turns to the half-built press.
  // ------------------------------------------------------------------------------------------------------------
  const beam = new Track(1);
  const platen = new Track(1);
  const boxTilt = new Track(0.42);
  const spanner = new Track(Math.PI / 2);
  const tBeam = W("build");
  const t1 = W("15");
  const t2 = W("20,000");
  const jolts = [tBeam, t1, t2];
  const shake = (t: number) => {
    let s = 0;
    for (const j of jolts) if (t >= j) s += 4.5 * Math.exp(-(t - j) / 0.08) * Math.sin((t - j) * 66);
    return s;
  };
  const pressState = (t: number): PressState => ({ beam: beam.value(t), platen: platen.value(t), box: boxTilt.value(t), spanner: spanner.value(t), shake: shake(t) });
  const onBeam = (dx: number, dy = 0) => (t: number): Pt => {
    const p = pressPoints(PRESS_AT, pressState(t)).beamEnd;
    return [p[0] + dx, p[1] + dy];
  };
  const onSpanner = (t: number): Pt => pressPoints(PRESS_AT, pressState(t)).spannerEnd;

  // the head goes first, the body follows it round
  const tTurn = W("machine") + 0.12;
  lookAt(vikas, [40, 830], { at: tTurn - 0.3 });
  vikas.turnTo(-1.08, { at: tTurn, dur: 0.6 });
  lookAt(vikas, [40, 830], { at: tTurn + 0.1, dur: 0.26 });
  feel(vikas, FOCUS, { at: tTurn, dur: 0.3 });
  // both hands on the propped end of the beam; push; it seats
  reach(vikas, "L", onBeam(-0.06 * U)(tBeam - 0.22), { at: tBeam - 0.22, dur: 0.32, hand: HANDS.flat, palm: -1, pin: onBeam(-0.06 * U), contact: true, layer: "front", look: false });
  reach(vikas, "R", onBeam(-0.5 * U, 0.06 * U)(tBeam - 0.18), { at: tBeam - 0.18, dur: 0.32, hand: HANDS.flat, palm: -1, pin: onBeam(-0.5 * U, 0.06 * U), contact: true, layer: "back", look: false });
  beam.to(0, { at: tBeam, dur: 0.2, w: WEIGHT.heavy, windup: 0, overshoot: 0 });
  vikas.bend.to(-0.2, { at: tBeam, dur: 0.3, w: WEIGHT.heavy });
  vikas.drop.to(0.1, { at: tBeam, dur: 0.3, w: WEIGHT.heavy });
  feel(vikas, HEAVE, { at: tBeam - 0.05, dur: 0.18 });
  feel(vikas, FOCUS, { at: tBeam + 0.3, dur: 0.2 });
  cam.shake(tBeam, 5, 0.3);
  cues.push({ t: tBeam, what: "clank", x: PRESS_AT.x + 140 });
  // the spanner: up, pull, up, pull; each pull lands on its number and jolts something else into place
  reach(vikas, "L", onSpanner(tBeam + 0.26), { at: tBeam + 0.26, dur: 0.14, hand: HANDS.grip, pin: onSpanner, contact: true, look: false, layer: "front" });
  // (the other hand comes off the beam and takes hold of the upright, so the two arms read apart)
  const onPost = (t: number): Pt => [PRESS_AT.x + 0.9 * U + shake(t), PRESS_AT.ground - 3.18 * U];
  reach(vikas, "R", onPost(tBeam + 0.4), { at: tBeam + 0.4, dur: 0.24, hand: HANDS.grip, pin: onPost, contact: true, look: false, layer: "back", body: false });
  spanner.to(-0.5, { at: t1 - 0.1, dur: 0.1, w: WEIGHT.mech });
  spanner.to(0.45, { at: t1, dur: 0.1, w: WEIGHT.heavy, windup: 0, overshoot: 0 });
  spanner.to(-0.5, { at: t2 - 0.17, dur: 0.3, w: WEIGHT.hand, windup: 0, overshoot: 0 });
  spanner.to(0.45, { at: t2, dur: 0.15, w: WEIGHT.heavy, windup: 0, overshoot: 0 });
  const SWING: Weight = { overshoot: 0.22, settle: 0.9, zeta: 0.22, windup: 0, windupTime: 0 };
  spanner.to(Math.PI / 2, { at: t2 + 0.36, dur: 0.24, w: SWING });
  boxTilt.to(0, { at: t1 + 0.12, dur: 0.14, w: { ...SWING, overshoot: 0.3, settle: 0.6 } });
  platen.to(0, { at: t2 + 0.05, dur: 0.12, w: { ...WEIGHT.heavy, overshoot: 0.05, zeta: 0.5, settle: 0.3 }, windup: 0 });
  vikas.drop.to(0.17, { at: t1, dur: 0.12, w: WEIGHT.heavy, windup: 0 });
  vikas.drop.to(0.09, { at: t2 - 0.2, dur: 0.3, w: WEIGHT.body, windup: 0 });
  vikas.drop.to(0.17, { at: t2, dur: 0.15, w: WEIGHT.heavy, windup: 0 });
  feel(vikas, HEAVE, { at: t1 - 0.02, dur: 0.12 });
  feel(vikas, FOCUS, { at: t1 + 0.32, dur: 0.2 });
  feel(vikas, HEAVE, { at: t2 - 0.04, dur: 0.14 });
  cam.shake(t1, 3.5, 0.25);
  cam.shake(t2, 4.5, 0.3);
  const px = PRESS_AT.x + 150;
  cues.push({ t: t1 - 0.1, what: "ratchet", x: px }, { t: t1, what: "clank", x: px - 10 }, { t: t2 - 0.15, what: "ratchet", x: px }, { t: t2, what: "clank", x: px - 10 }, { t: t2 + 0.36, what: "spanner", x: px });
  // he lets the spanner swing back, straightens, and turns away from it dusting his hands off: done
  const tDust = t2 + 0.68;
  vikas.bend.to(0, { at: t2 + 0.52, dur: 0.42, w: WEIGHT.body });
  vikas.drop.to(0, { at: t2 + 0.52, dur: 0.42, w: WEIGHT.body });
  vikas.turnTo(0.5, { at: tDust + 0.42, dur: 0.82 });
  const dust = dustHands(vikas, { at: tDust, times: 2, every: 0.3, then: "hold" });
  lookAt(vikas, [vikas.x.value(tDust) + 20, 900], { at: tDust - 0.06, dur: 0.3 });
  feel(vikas, "exhale", { at: t2 + 0.42, dur: 0.2 });
  feel(vikas, PROUD, { at: tDust + 0.22, dur: 0.3 });
  for (const h of dust.hits) cues.push({ t: h, what: "dust", x: 282 });

  // Rahul meanwhile: lets go of the oven, watches his brother work
  lookAt(rahul, [240, 720], { at: 5.05 });
  shiftWeight(rahul, 0.12, { at: 5.7 });
  feel(rahul, "smile", { at: 5.3 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 4. "No investors, no funding." Everything they own in one frame.
  // ------------------------------------------------------------------------------------------------------------
  const tNo1 = W("No");
  const tNo2 = W("no", 2);
  // Vikas, fists on his hips, looks back at the machine, then at the oven: taking stock
  handsOnHips(vikas, { at: tNo1 + 0.4, dur: 0.4 });
  lookAt(vikas, [-70, 900], { at: tNo1 + 0.66 });
  feel(vikas, EASY_V, { at: tNo1 + 0.7, dur: 0.3 });
  lookAt(vikas, [590, 980], { at: tNo2 - 0.1 });
  release(rahul, "R", { at: tNo1 - 0.05, dur: 0.5 });
  rahul.turnTo(-0.8, { at: tNo1 + 0.08, dur: 0.55 });
  feel(rahul, EASY_R, { at: tNo1, dur: 0.3 });
  lookAt(rahul, [282, 600], { at: tNo1 + 0.56 });
  const tShrug = tNo2 + 0.1;
  feel(rahul, WELL, { at: tShrug - 0.04, dur: 0.24 });
  const shrugEnd = shrug(rahul, { at: tShrug, hold: 0.36 });
  lookAt(vikas, [930, 640], { at: tShrug + 0.14 });
  feel(vikas, WRY, { at: tShrug + 0.42, dur: 0.3 });
  const nod = vikas.headPitch.value(tShrug + 0.4);
  vikas.headPitch.to(nod + 0.15, { at: tShrug + 0.52, dur: 0.15, w: WEIGHT.head });
  vikas.headPitch.to(nod, { at: tShrug + 0.78, dur: 0.22, w: WEIGHT.head });
  cues.push({ t: tNo1, what: "knock" }, { t: tNo2, what: "knock" });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 5. "And in 2020, the company's revenue was just 5,000 rupees."
  // ------------------------------------------------------------------------------------------------------------
  const tYear = W("2020");
  const flip = new Track(0);
  flip.to(1, { at: tYear + 0.26, dur: 0.4, w: WEIGHT.mech });
  cues.push({ t: tYear - 0.1, what: "page", x: CAL.x });
  const calPt: Pt = [CAL.x, CAL.y + 110];
  lookAt(rahul, calPt, { at: Math.max(shrugEnd - 0.1, tYear - 0.05) });
  lookAt(vikas, calPt, { at: tYear + 0.02 });
  feel(rahul, EASY_R, { at: tYear + 0.2, dur: 0.3 });
  feel(vikas, EASY_V, { at: tYear + 0.2, dur: 0.3 });

  // Vikas turns back to the table and rests a hand on the oven
  release(vikas, "L", { at: 10.4, dur: 0.45 });
  vikas.turnTo(1.0, { at: 10.55, dur: 0.5 });
  vikas.lean.to(0.07, { at: 11.0, dur: 0.5, w: WEIGHT.body });
  vikas.bend.to(0.13, { at: 11.02, dur: 0.5, w: WEIGHT.body });
  const edge: Pt = [OVEN.at[0] - 0.56 * U, OVEN.at[1] - 1.06 * U];
  reach(vikas, "R", edge, { at: 10.98, dur: 0.4, hand: HANDS.flat, palm: 1, pin: true, contact: true, look: false, layer: "front", body: false });
  const tinPt: Pt = [TIN_AT.x, TIN_AT.base - 0.3 * U];
  lookAt(vikas, tinPt, { at: 11.2 });

  // Rahul opens the tin on "revenue" and brings out what is in it
  const lid = new Track(0);
  const tOpen = W("revenue");
  const lidAt = (t: number): Pt => tinPoints(TIN_AT, lid.value(t)).lidEdge;
  rahul.turnTo(-1.0, { at: 10.42, dur: 0.5 });
  reach(rahul, "L", lidAt(0), { at: tOpen - 0.46, dur: 0.36, hand: HANDS.pinch, palm: -1, pin: lidAt, contact: true, layer: "front" });
  lid.to(1.9, { at: tOpen, dur: 0.4, w: WEIGHT.hand, windup: 0.04 });
  cues.push({ t: tOpen - 0.4, what: "lid", x: TIN_AT.x }, { t: tOpen + 0.12, what: "coin", x: TIN_AT.x });
  const inside = tinPoints(TIN_AT, 1.9).inside;
  const tGrab = tOpen + 0.52;
  reach(rahul, "L", [inside[0] + 0.36 * U, inside[1] - 0.34 * U], { at: tGrab, dur: 0.34, hand: HANDS.pinch, palm: -1, contact: true, look: false, body: false });
  rahul.headPitch.to(0.3, { at: tGrab - 0.05, dur: 0.3, w: WEIGHT.head });
  // he holds them up between the two of them, clear of the oven, against the wall
  const tShow = W("5,000") - 0.2;
  const sh = rahul.solve(tGrab).shoulders.L;
  const show: Pt = [sh[0] - 1.26 * U, sh[1] - 0.06 * U];
  reach(rahul, "L", show, { at: tShow, dur: 0.46, hand: HANDS.pinch, palm: -1, look: false, bow: 0.24, body: false });
  lookAt(rahul, [show[0], show[1] - 0.3 * U], { at: tShow });
  lookAt(vikas, [show[0], show[1] - 0.3 * U], { at: tShow + 0.1 });
  cues.push({ t: tGrab + 0.1, what: "notes", x: TIN_AT.x });

  // the number lands; one breathes out, the other pushes his glasses up; then they look at each other
  const tNum = W("5,000");
  cues.push({ t: tNum, what: "number" });
  feel(rahul, "exhale", { at: tNum + 0.34, dur: 0.26 });
  rahul.bend.to(-0.08, { at: tNum + 0.72, dur: 0.5, w: WEIGHT.body });
  rahul.drop.to(0.035, { at: tNum + 0.72, dur: 0.5, w: WEIGHT.body });
  reach(rahul, "L", [show[0] + 0.1 * U, show[1] + 0.3 * U], { at: tNum + 0.8, dur: 0.55, w: WEIGHT.body, hand: HANDS.pinch, look: false, body: false, bow: 0.06 });
  feel(vikas, SUNK, { at: tNum + 0.3, dur: 0.26 });
  const tGlass = tNum + 0.44;
  pushGlasses(vikas, "R", { at: tGlass });
  reach(vikas, "R", edge, { at: tGlass + 0.6, dur: 0.38, hand: HANDS.flat, palm: 1, pin: true, contact: true, look: false, body: false });
  lookAt(vikas, eyesOf(rahul, tGlass + 0.4), { at: tGlass + 0.5 });
  lookAt(rahul, eyesOf(vikas, tGlass + 0.4), { at: tGlass + 0.62 });
  feel(rahul, WRY, { at: tGlass + 0.78, dur: 0.26 });
  feel(vikas, WRY, { at: tGlass + 0.86, dur: 0.26 });

  // ------------------------------------------------------------------------------------------------------------
  // Camera: never still. Each move starts before the last one has landed, so there is no dead stop between them.
  // (Where there is writing on the wall, the camera tips up as it pushes in, so the writing keeps its place.)
  // ------------------------------------------------------------------------------------------------------------
  cam.keys([
    // 1. with them as they come in, to the framing of the style frame
    { t: -0.3, cx: -335, cy: 1000, zoom: 0.86 },
    { t: 0.5, cx: -300, cy: 998, zoom: 0.87 },
    { t: 1.5, cx: 110, cy: 980, zoom: 0.93 },
    { t: 2.4, cx: 462, cy: 964, zoom: 0.99 },
    { t: 2.95, cx: 528, cy: 958, zoom: 1.0 },
    // 2. a slow push while the oven lands
    { t: 4.2, cx: 540, cy: 918, zoom: 1.07 },
    // 3. left with Vikas to the press, then in on his hands
    { t: 5.0, cx: 100, cy: 790, zoom: 1.24 },
    { t: 6.9, cx: 84, cy: 786, zoom: 1.34 },
    // 4. back: everything they own in one frame
    { t: 7.6, cx: 440, cy: 690, zoom: 0.73 },
    { t: 9.3, cx: 446, cy: 692, zoom: 0.76 },
    // 5. in to the two of them and the tin
    // (it lands, rests a moment, then creeps in: zoom and tilt leave together so the writing holds its place)
    { t: 10.3, cx: 608, cy: 829, zoom: 1.12 },
    { t: 10.6, cx: 608, cy: 829, zoom: 1.12 },
    { t: 14.3, cx: 615, cy: 788, zoom: 1.2 },
  ]);

  // ------------------------------------------------------------------------------------------------------------
  // What is written on the wall (wall coordinates), each piece landing on its word
  // ------------------------------------------------------------------------------------------------------------
  const type = {
    oven: { x: 104, y: 306, cap: 134, maxW: 680, label: { text: "AN OVEN", at: W("oven") }, parts: [{ text: `${RUPEE}10,000`, at: tPut }], out: 4.2 } as NumberCue,
    machine: {
      x: -214,
      y: 304,
      cap: 110,
      maxW: 590,
      labelSize: 42,
      label: { text: "A MACHINE THEY BUILD", at: W("machine") },
      parts: [
        { text: `${RUPEE}15`, at: t1 },
        { text: "–20,000", at: t2 },
      ],
      out: 7.05,
    } as NumberCue,
    phrase: {
      x: -130,
      y: -30,
      size: 220,
      maxW: 1040,
      lines: [
        { lead: "No", text: " investors.", at: tNo1 },
        { lead: "No", text: " funding.", at: tNo2 },
      ],
      out: 9.3,
    } as PhraseCue,
    revenue: { x: 228, y: 250, cap: 142, maxW: 640, stamp: { text: "2020", at: tYear, join: W("company's") - 0.12 }, label: { text: "REVENUE", at: tOpen }, parts: [{ text: `${RUPEE}5,000`, at: tNum }] } as NumberCue,
  };

  return {
    rahul,
    vikas,
    cam,
    oven,
    shutter,
    lid,
    flip,
    pressState,
    thud,
    type,
    cues,
    duration: MD.seconds,
    marks: { arriveR: rw.arrive, arriveV: vw.arrive, tPut, tFree, tUp, tTurn, tBeam, t1, t2, tDust, tNo1, tNo2, tShrug, tYear, tOpen, tGrab, tShow, tNum, tGlass },
  };
}

export type MdTake = ReturnType<typeof build>;
let take: MdTake | null = null;
export function mdTake(): MdTake {
  if (!take) take = build();
  return take;
}
