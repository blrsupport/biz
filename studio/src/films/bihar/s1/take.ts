// Bihar Mushroom: sequence "s1", the hook. A village lane in Nalanda, morning, the sun low at frame left.
// "For years, Bihar's mushroom farmers bought their seed from Haryana." The Bihar farmer walks in counting notes,
// pays the Haryana trader, and the trader swings a white sack into his arms. "Today, because of one man, a village
// in Bihar sells it back to Haryana." The farmer turns to go, turns back, and the sack goes the other way: into the
// trader's arms, and the notes come back. "To understand how we did that, we have to go back to early 2000s." The
// trader walks off with his sack; the farmer swings the last one up and past the lens (the hand-over to "home").
// This file is the performance as data; it never draws.
import { CAST } from "../../../assets/cast/cast.ts";
import type { Palette } from "../../../engine/draw/shape.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import { add, lerpPt, smoothstep, type Pt } from "../../../engine/geom/vec.ts";
import type { Cue } from "../../../engine/film.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Blend, Path2, WEIGHT } from "../../../engine/motion/track.ts";
import { dustHands, feel, handsOnHips, lookAt, nod, reach, release } from "../../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { WORDS } from "../words.ts";
import { DEPTH, LANE, LANE_PALETTE } from "./lane.ts";

const ANCHOR = makeAnchors(WORDS);
/** frame size, px per head-height, the ground line, and the stretch of the film this sequence covers (from word anchors) */
export const S1 = { ...LANE, fps: 30, t0: 0, end: Math.round(ANCHOR("sanjeev") * 100) / 100 + 0.1 } as const;
export const S1_PALETTE: Palette = LANE_PALETTE;

const { U, GY } = S1;
const FRAME = { width: S1.W, height: S1.HGT };
const REF = { cx: S1.W / 2, cy: S1.HGT / 2 };

/** the white sacks: how big (head-heights), and where they rest */
export const SACK = { w: 0.95, h: 1.3 };
const REST_A: Pt = [458, GY - 0.65 * U];
const REST_B: Pt = [232, GY - 0.65 * U];

// ---- the faces of this take
const EASY_F: Expression = { lidU: 0.92, lidL: 0.88, browRaise: 0.3, browTilt: -0.25, smile: 0.25, open: 0, wide: 0.05, jaw: 0 };
const COUNTING: Expression = { lidU: 0.74, lidL: 0.82, browRaise: 0.2, browTilt: -0.2, smile: 0.1, open: 0, wide: 0, jaw: 0 };
const STRAIN: Expression = { lidU: 0.6, lidL: 0.5, browRaise: 0.15, browTilt: -0.35, smile: -0.1, open: 0.24, wide: 0.45, jaw: 0.12 };
const PROUD: Expression = { lidU: 0.88, lidL: 0.58, browRaise: 0.45, browTilt: -0.2, smile: 0.8, open: 0, wide: 0.2, jaw: 0 };
const EASY_T: Expression = { lidU: 0.9, lidL: 0.85, browRaise: 0.22, browTilt: -0.3, smile: 0.35, open: 0, wide: 0.05, jaw: 0 };
const HEAVE: Expression = { lidU: 0.58, lidL: 0.5, browRaise: 0.1, browTilt: -0.3, smile: -0.15, open: 0.26, wide: 0.5, jaw: 0.14 };
const SURPRISED: Expression = { lidU: 1, lidL: 0.9, browRaise: 0.75, browTilt: -0.1, smile: 0.15, open: 0.1, wide: 0.5, jaw: 0.04 };

function build() {
  const W = ANCHOR;
  const cues: Cue[] = [];

  // ------------------------------------------------------------------------------------------------------------
  // Camera first. It comes in from the right with the farmer and pushes in on the two; then it holds the two-shot,
  // drifting; at the end it follows the farmer to the last sack.
  // ------------------------------------------------------------------------------------------------------------
  const cam = new Camera(706, 955, 1.0);
  cam.keys([
    { t: -0.3, cx: 706, cy: 955, zoom: 1.0 },
    { t: 1.0, cx: 662, cy: 952, zoom: 1.02 },
    { t: 2.3, cx: 586, cy: 948, zoom: 1.06 },
    { t: 3.7, cx: 566, cy: 946, zoom: 1.08 },
    { t: 5.2, cx: 598, cy: 946, zoom: 1.08 },
    { t: 6.6, cx: 578, cy: 945, zoom: 1.09 },
    { t: 8.4, cx: 566, cy: 944, zoom: 1.1 },
    { t: 9.6, cx: 524, cy: 946, zoom: 1.1 },
    { t: 10.6, cx: 474, cy: 950, zoom: 1.13 },
    { t: 11.5, cx: 464, cy: 955, zoom: 1.15 },
    { t: S1.end + 0.3, cx: 458, cy: 958, zoom: 1.16 },
  ]);
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };

  // ------------------------------------------------------------------------------------------------------------
  // The two men. The trader waits at left, hands on his hips, beside his sacks. The farmer walks in from the right
  // counting his notes.
  // ------------------------------------------------------------------------------------------------------------
  const TX = 360;
  const trader = new Actor({ ch: CAST.iraki, scale: U, groundY: GY, x: TX, yaw: 1.05, seed: 4 });
  trader.face = new Blend<Expression>(EASY_T, mixFace);
  const FX = 748;
  const farmer = new Actor({ ch: CAST.buyer, scale: U, groundY: GY - 6, x: 1190, yaw: -1.15, seed: 8 });
  farmer.face = new Blend<Expression>(COUNTING, mixFace);
  const fw = farmer.walkTo(FX, { arrive: 1.66, pace: 1.85, step: 1.35 });

  /** where a man carries a sack in his arms: low against the body, on the side he faces */
  const PY_F = farmer.pelvis(-1)[1];
  const PY_T = trader.pelvis(-1)[1];
  const carry = (a: Actor, py0: number) => (t: number): Pt => {
    const p = a.pelvis(t);
    return [p[0] + Math.sin(a.yaw.value(t)) * 0.7 * U, p[1] + (GY - 2.5 * U - py0)];
  };
  const carryF = carry(farmer, PY_F);
  const carryT = carry(trader, PY_T);

  // the notes: held in his near hand at his chest; the far thumb flicks them off one by one
  const notesAt = (t: number): Pt => [farmer.x.value(t) - 0.62 * U, GY - 2.62 * U + 4 * Math.sin(t * 7.5)];
  reach(farmer, "L", notesAt(-0.3), { at: -0.3, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, body: false, pin: notesAt, layer: "front" });
  const flickAt = (t: number): Pt => {
    const u = Math.max(0, t - 0.3);
    const k = Math.sin(Math.PI * Math.min(1, (u % 0.27) / 0.22));
    return add(notesAt(t), [-0.42 * U - 0.1 * U * k, -0.04 * U - 0.06 * U * k]);
  };
  reach(farmer, "R", flickAt(-0.25), { at: -0.25, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, body: false, pin: flickAt, layer: "back" });
  lookAt(farmer, [FX - 0.9 * U, GY - 2.5 * U], { at: -0.2 });
  for (let i = 0; i < 4; i++) cues.push({ t: 0.42 + i * 0.27, what: "notes", x: 1000 - i * 60 });

  // the trader: hands on hips, watching him come
  handsOnHips(trader, { at: 0.25, dur: 0.4 });
  lookAt(trader, [FX, GY - 4.6 * U], { at: 0.5 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 1. "...bought their seed from Haryana." He pays on "bought"; the trader swings a sack into his arms on
  // "seed", and he staggers under it.
  // ------------------------------------------------------------------------------------------------------------
  const tBought = W("bought");
  const tSeed = W("seed");
  const tHaryana = W("haryana");
  release(farmer, "R", { at: fw.arrive + 0.05, dur: 0.35 });
  lookAt(farmer, [TX + 0.4 * U, GY - 4.5 * U], { at: fw.arrive - 0.2 });
  feel(farmer, EASY_F, { at: fw.arrive - 0.1, dur: 0.3 });
  const GIVE: Pt = [572, GY - 2.86 * U];
  reach(farmer, "L", GIVE, { at: tBought, dur: 0.34, hand: HANDS.pinch, palm: -1, look: false, bow: 0.15, pin: true, layer: "front" });
  // the trader takes them a beat later with his far hand
  const TAKE: Pt = [GIVE[0] - 0.62 * U, GIVE[1] + 0.02 * U];
  const tTaken = tBought + 0.16;
  reach(trader, "L", TAKE, { at: tTaken, dur: 0.3, hand: HANDS.pinch, palm: 1, look: false, body: false, contact: true, layer: "back" });
  release(trader, "L", { at: tTaken + 0.26, dur: 0.36 });
  lookAt(trader, GIVE, { at: tTaken - 0.2, dur: 0.2 });
  cues.push({ t: tTaken, what: "notes.take", x: 540 });

  const armsF = { L: [-0.38, 0.1] as Pt, R: [-0.36, -0.26] as Pt };
  const armsT = { R: [0.42, 0.16] as Pt, L: [0.36, -0.26] as Pt };
  let sackA: (t: number) => { c: Pt; tilt: number } = () => ({ c: REST_A, tilt: 0 });
  const onSack = (rel: Pt) => (t: number): Pt => add(sackA(t).c, [rel[0] * SACK.w * U, rel[1] * SACK.h * U]);
  // the trader bends, takes the sack by its ear, and swings it up and across
  const tGrab = tTaken + 0.12;
  trader.drop.to(0.64, { at: tGrab - 0.04, dur: 0.3, w: WEIGHT.body, windup: 0 });
  trader.bend.to(0.5, { at: tGrab + 0.02, dur: 0.3, w: WEIGHT.body, windup: 0 });
  feel(trader, HEAVE, { at: tGrab, dur: 0.16 });
  cues.push({ t: tGrab + 0.06, what: "heave", x: 470 });
  const tLift = tGrab + 0.04;
  // (his near hand takes the ear and stays on it while the sack swings)
  reach(trader, "R", onSack([-0.18, -0.5])(tGrab), { at: tGrab, dur: 0.24, hand: HANDS.grip, look: false, body: false, contact: true, pin: onSack([-0.18, -0.5]), layer: "front" });
  const handOff = carryF(tSeed);
  const pathA = new Path2(REST_A);
  pathA.to(handOff, { at: tSeed, dur: tSeed - tLift, w: WEIGHT.heavy, windup: 0, overshoot: 0, bow: 0.12 });
  trader.drop.to(0.04, { at: tSeed + 0.1, dur: tSeed - tLift + 0.06, w: WEIGHT.heavy, windup: 0 });
  trader.bend.to(0.08, { at: tSeed + 0.12, dur: tSeed - tLift + 0.06, w: WEIGHT.heavy, windup: 0 });
  trader.lean.to(0.08, { at: tSeed, dur: tSeed - tLift, w: WEIGHT.heavy, windup: 0 });

  // the farmer's arms come round it as it arrives; it is heavier than he thought
  reach(farmer, "L", onSack(armsF.L)(tSeed - 0.04), { at: tSeed - 0.04, dur: 0.3, hand: HANDS.cup, look: false, body: false, contact: true, pin: onSack(armsF.L), layer: "front" });
  reach(farmer, "R", onSack(armsF.R)(tSeed - 0.02), { at: tSeed - 0.02, dur: 0.3, hand: HANDS.grip, look: false, body: false, contact: true, pin: onSack(armsF.R), layer: "back" });
  lookAt(farmer, handOff, { at: tSeed - 0.3, dur: 0.2 });
  release(trader, "R", { at: tSeed + 0.32, dur: 0.4 });
  feel(trader, EASY_T, { at: tSeed + 0.3, dur: 0.3 });
  cues.push({ t: tSeed, what: "thud.sack", x: 640 });
  // the stagger: knees give, he rocks back, the face strains, then he finds his feet
  farmer.drop.to(0.26, { at: tSeed + 0.16, dur: 0.18, w: WEIGHT.body, windup: 0 });
  farmer.lean.to(0.12, { at: tSeed + 0.2, dur: 0.22, w: WEIGHT.body, windup: 0 });
  farmer.bend.to(0.08, { at: tSeed + 0.2, dur: 0.22, w: WEIGHT.body, windup: 0 });
  feel(farmer, STRAIN, { at: tSeed + 0.06, dur: 0.14 });
  farmer.drop.to(0.07, { at: tHaryana + 0.4, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  farmer.lean.to(0.05, { at: tHaryana + 0.45, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  farmer.bend.to(0.02, { at: tHaryana + 0.45, dur: 0.5, w: WEIGHT.heavy, windup: 0 });
  feel(farmer, PROUD, { at: tHaryana + 0.4, dur: 0.3 });
  /** how far the sack sinks in his arms when it lands, and comes back */
  const sink = (t: number, t0: number, amp: number) => (t <= t0 ? 0 : amp * U * (1 - Math.exp(-(t - t0) / 0.06)) * Math.exp(-(t - t0) / 0.45));

  // the trader pockets the notes and dusts his hands
  const ts = trader.solve(tHaryana);
  const pocketT: Pt = [ts.shoulders.L[0] + 0.32 * U, ts.shoulders.L[1] + 1.0 * U];
  const tPocket = tHaryana + 0.05;
  reach(trader, "L", pocketT, { at: tPocket, dur: 0.36, hand: HANDS.pinch, look: false, body: false, bow: 0.14, layer: "back" });
  trader.lean.to(0, { at: tPocket + 0.3, dur: 0.45, w: WEIGHT.body, windup: 0 });
  trader.bend.to(0, { at: tPocket + 0.3, dur: 0.45, w: WEIGHT.body, windup: 0 });
  const dh = dustHands(trader, { at: tPocket + 0.9, times: 2, then: "hold" });
  for (const h of dh.hits) cues.push({ t: h, what: "pat", x: 380 });
  handsOnHips(trader, { at: dh.end + 0.45, dur: 0.4, sides: ["L"] });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 2. "Today, because of one man, a village in Bihar sells it back to Haryana." He turns to go home with his
  // sack, stops, turns back; the sack goes the other way, and the notes come back.
  // ------------------------------------------------------------------------------------------------------------
  const tToday = W("today");
  const tOne = W("one man");
  const tVillage = W("village");
  const tSells = W("sells");
  const tBack = W("back");
  const tHaryana2 = W("haryana", 2);
  farmer.turnTo(1.1, { at: tToday + 0.42, dur: 0.5 });
  lookAt(farmer, [1500, GY - 4.4 * U], { at: tToday + 0.2 });
  feel(farmer, EASY_F, { at: tToday + 0.3, dur: 0.3 });
  const fo = farmer.walkTo(880, { start: tToday + 0.5, pace: 1.6, step: 1.0 });
  lookAt(farmer, [TX, GY - 4.6 * U], { at: Math.max(tOne + 0.15, fo.arrive) });
  feel(farmer, SURPRISED, { at: tOne + 0.3, dur: 0.24 });
  farmer.turnTo(-1.15, { at: tVillage + 0.45, dur: 0.5 });
  const fb = farmer.walkTo(712, { start: tVillage + 0.55, pace: 1.7, step: 1.05 });
  lookAt(trader, [880, GY - 4.5 * U], { at: tToday + 0.5 });
  lookAt(trader, [740, GY - 3.0 * U], { at: tVillage + 0.4 });
  // he knows the deal: the notes are out of his pocket before the sack comes
  const tNotesOut = tVillage + 0.2;
  const tu = trader.solve(tNotesOut);
  const pocketR: Pt = [tu.shoulders.R[0] + 0.12 * U, tu.shoulders.R[1] + 1.05 * U];
  reach(trader, "R", pocketR, { at: tNotesOut, dur: 0.3, hand: HANDS.pinch, look: false, body: false, layer: "front" });
  // the trader's arms come up to take it; it lands on "sells"
  const tPass = tSells - 0.34;
  reach(trader, "R", onSack(armsT.R)(tSells - 0.04), { at: tSells - 0.04, dur: 0.32, hand: HANDS.cup, look: false, body: false, contact: true, pin: onSack(armsT.R), layer: "front" });
  reach(trader, "L", onSack(armsT.L)(tSells - 0.02), { at: tSells - 0.02, dur: 0.32, hand: HANDS.grip, look: false, body: false, contact: true, pin: onSack(armsT.L), layer: "back" });
  feel(trader, HEAVE, { at: tSells + 0.04, dur: 0.14 });
  trader.drop.to(0.16, { at: tSells + 0.16, dur: 0.18, w: WEIGHT.body, windup: 0 });
  trader.lean.to(-0.08, { at: tSells + 0.2, dur: 0.22, w: WEIGHT.body, windup: 0 });
  trader.drop.to(0.04, { at: tSells + 0.75, dur: 0.4, w: WEIGHT.heavy, windup: 0 });
  trader.lean.to(-0.03, { at: tSells + 0.8, dur: 0.4, w: WEIGHT.heavy, windup: 0 });
  cues.push({ t: tSells, what: "thud.sack", x: 560 });
  release(farmer, "L", { at: tSells + 0.16, dur: 0.36 });
  release(farmer, "R", { at: tSells + 0.12, dur: 0.36 });
  feel(farmer, EASY_F, { at: tSells + 0.2, dur: 0.3 });
  // the near hand, notes in it, comes out from under the sack and holds them out on "Haryana"
  const GIVE2: Pt = [560, GY - 2.9 * U];
  const tOut = tHaryana2 + 0.06;
  reach(trader, "R", GIVE2, { at: tOut, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, bow: 0.16, pin: true, layer: "front" });
  const TAKE2: Pt = [GIVE2[0] + 0.62 * U, GIVE2[1] + 0.02 * U];
  const tTaken2 = tOut + 0.18;
  reach(farmer, "L", TAKE2, { at: tTaken2, dur: 0.3, hand: HANDS.pinch, palm: -1, look: false, body: false, contact: true, pin: true, layer: "front" });
  lookAt(farmer, GIVE2, { at: tTaken2 - 0.24 });
  cues.push({ t: tTaken2, what: "notes.take", x: 600 });
  release(trader, "R", { at: tTaken2 + 0.2, dur: 0.36 });
  lookAt(trader, [712, GY - 4.6 * U], { at: tTaken2 + 0.05 });
  nod(trader, { at: tTaken2 + 0.3, amount: 0.12 });
  feel(trader, PROUD, { at: tTaken2 + 0.2, dur: 0.3 });
  nod(farmer, { at: tTaken2 + 0.44, amount: 0.12 });
  feel(farmer, PROUD, { at: tTaken2 + 0.35, dur: 0.3 });
  // the farmer folds the notes into his shirt pocket
  const tf = farmer.solve(tTaken2 + 0.8);
  reach(farmer, "L", [tf.shoulders.L[0] - 0.22 * U, tf.shoulders.L[1] + 0.5 * U], { at: tTaken2 + 0.8, dur: 0.34, hand: HANDS.pinch, look: false, body: false, bow: 0.12, layer: "front" });
  release(farmer, "L", { at: tTaken2 + 1.3, dur: 0.4 });
  cues.push({ t: tToday + 0.42, what: "turn", x: 760 }, { t: tVillage + 0.45, what: "turn", x: 860 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 3. "To understand how we did that, we have to go back to early 2000s." The trader takes his sack away
  // left. The farmer goes to the last sack, heaves it up, and on "back" swings it at the lens.
  // ------------------------------------------------------------------------------------------------------------
  const tTo = W("to understand");
  const tSwing = W("back", 2);
  const tEarly = W("early");
  const t2000 = W("2000s");
  trader.turnTo(-1.05, { at: tTo + 0.35, dur: 0.45 });
  const tw = trader.walkTo(-430, { start: tTo + 0.5, pace: 1.8, step: 1.3 });
  feel(trader, EASY_T, { at: tTo + 0.3, dur: 0.3 });
  lookAt(farmer, [TX - 1.2 * U, GY - 4.4 * U], { at: tTo + 0.45 });
  nod(farmer, { at: tTo + 0.3, amount: 0.1 });
  const fs = farmer.walkTo(332, { start: tTo + 0.5, pace: 2.0, step: 1.3 });
  let sackB: (t: number) => { c: Pt; tilt: number } = () => ({ c: REST_B, tilt: 0 });
  const onSackB = (rel: Pt) => (t: number): Pt => add(sackB(t).c, [rel[0] * SACK.w * U, rel[1] * SACK.h * U]);
  lookAt(farmer, REST_B, { at: fs.arrive - 0.3 });
  const tGrabB = Math.max(fs.arrive + 0.28, tSwing - 0.5);
  farmer.drop.to(0.74, { at: tGrabB - 0.02, dur: 0.3, w: WEIGHT.body, windup: 0 });
  farmer.bend.to(-0.45, { at: tGrabB, dur: 0.3, w: WEIGHT.body, windup: 0 });
  reach(farmer, "L", onSackB([0.02, -0.34])(tGrabB), { at: tGrabB, dur: 0.28, hand: HANDS.grip, look: false, body: false, contact: true, layer: "front" });
  reach(farmer, "R", onSackB([0.3, -0.46])(tGrabB + 0.03), { at: tGrabB + 0.03, dur: 0.28, hand: HANDS.grip, look: false, body: false, contact: true, pin: onSackB([0.3, -0.46]), layer: "back" });
  feel(farmer, STRAIN, { at: tGrabB + 0.05, dur: 0.14 });
  cues.push({ t: tGrabB + 0.08, what: "heave", x: 330 });
  // up and round: the sack comes off the ground, he rises with it and lets it fly at us
  const tLiftB = tGrabB + 0.06;
  release(farmer, "L", { at: tLiftB + 0.12, dur: 0.25 });
  const HIGH: Pt = [300, GY - 2.5 * U];
  const pathB = new Path2(REST_B);
  pathB.to(HIGH, { at: tSwing, dur: tSwing - tLiftB, w: WEIGHT.heavy, windup: 0, overshoot: 0, bow: 0 });
  farmer.drop.to(0.3, { at: tSwing - 0.02, dur: tSwing - tLiftB, w: WEIGHT.heavy, windup: 0 });
  farmer.bend.to(0.1, { at: tSwing, dur: tSwing - tLiftB, w: WEIGHT.heavy, windup: 0 });
  const tRel = tSwing + 0.08;
  release(farmer, "R", { at: tRel + 0.06, dur: 0.3 });
  farmer.turnTo(-0.45, { at: tRel + 0.3, dur: 0.35 });
  feel(farmer, PROUD, { at: tRel + 0.4, dur: 0.3 });
  cues.push({ t: tRel, what: "whoosh", x: 540 });

  // the sacks' whole journeys, now that both men's moves are written
  sackA = (t: number) => {
    if (t < tLift) return { c: REST_A, tilt: 0 };
    if (t < tSeed + 0.12) {
      const p = pathA.value(t);
      const k = smoothstep(tSeed - 0.12, tSeed + 0.12, t);
      const c = k > 0 ? lerpPt(p, carryF(t), k) : p;
      return { c, tilt: 0.25 * Math.sin(Math.PI * Math.min(1, (t - tLift) / (tSeed - tLift))) };
    }
    if (t < tPass) {
      const c = carryF(t);
      return { c: [c[0], c[1] + sink(t, tSeed, 0.16)], tilt: -0.05 * Math.sin(farmer.yaw.value(t)) };
    }
    const k = smoothstep(tPass, tSells, t);
    const a = carryF(t);
    const b = carryT(t);
    const c = lerpPt(a, b, k);
    if (t < tSells + 0.02) return { c: [c[0], c[1] - 0.28 * U * Math.sin(Math.PI * k)], tilt: 0.2 * Math.sin(Math.PI * k) };
    return { c: [b[0], b[1] + sink(t, tSells, 0.12)], tilt: 0.05 * Math.sin(trader.yaw.value(t)) };
  };
  sackB = (t: number) => {
    if (t < tLiftB) return { c: REST_B, tilt: 0 };
    return { c: pathB.value(Math.min(t, tRel)), tilt: -0.5 * smoothstep(tLiftB, tSwing, t) };
  };
  const sackHolder = (t: number): "ground" | "trader" | "farmer" => (t < tLift ? "ground" : t < tSeed ? "trader" : t < tSells ? "farmer" : "trader");

  // past the lens: from where it leaves his hands it flies at us, fills the frame, and goes off to the right
  // (in screen pixels; "home" draws the end of it over its own first frames)
  const v0 = layerTransform(cam.view(tRel), FRAME, 0, REF);
  const relB = sackB(tRel);
  const p0: Pt = [v0.tx + relB.c[0] * v0.s, v0.ty + relB.c[1] * v0.s];
  const u0 = U * v0.s;
  const tCover = 12.2;
  const tOff = tCover + 0.58;
  const pass = (t: number): { c: Pt; u: number; tilt: number } | null => {
    if (t < tRel || t > tOff) return null;
    if (t <= tCover) {
      const u = (t - tRel) / (tCover - tRel);
      const k = Math.pow(u, 2.4);
      const c = lerpPt(p0, [560, 1010], k);
      return { c: [c[0], c[1] - 240 * Math.sin(Math.PI * u) * (1 - k)], u: u0 * (1 + 11 * Math.pow(k, 1.25)), tilt: relB.tilt * (1 - k) - 0.08 * k };
    }
    const v = smoothstep(tCover, tOff, t);
    return { c: [560 + 2400 * v * v, 1010 - 120 * v], u: u0 * 12 * (1 + 0.25 * v), tilt: -0.08 - 0.2 * v };
  };

  // the notes: whose hand they are in, and how they point
  const notes = (t: number): { who: "farmer" | "trader" | null; side: "L" | "R"; ang: number; size: number } => {
    if (t < tTaken) return { who: "farmer", side: "L", ang: Math.PI - 0.2, size: 0.9 };
    if (t < tPocket) return { who: "trader", side: "L", ang: -0.15, size: 0.9 * (1 - 0.55 * smoothstep(tPocket - 0.2, tPocket, t)) };
    if (t < tNotesOut - 0.05) return { who: null, side: "R", ang: 0, size: 0 };
    if (t < tTaken2) return { who: "trader", side: "R", ang: 0.15, size: 0.9 * smoothstep(tNotesOut - 0.05, tNotesOut + 0.3, t) };
    if (t < tTaken2 + 0.8) return { who: "farmer", side: "L", ang: Math.PI - 0.2, size: 0.9 * (1 - 0.55 * smoothstep(tTaken2 + 0.6, tTaken2 + 0.8, t)) };
    return { who: null, side: "L", ang: 0, size: 0 };
  };

  // life: birds cross the morning sky
  const birds = [0, 1, 2].map((i) => ({ t0: 0.2 + 0.35 * i, y: 186 + 38 * i, speed: 270 + 30 * i, x0: 1180 + 70 * i, size: 22 - 3 * i }));
  cues.push({ t: 0.3, what: "birds" });

  // ------------------------------------------------------------------------------------------------------------
  // What is written across the sky, each piece on its word, one block at a time
  // (the type sits high: the two men's heads come up to about y 480 on screen)
  // ------------------------------------------------------------------------------------------------------------
  const at1 = under(tHaryana, DEPTH.type, 92, 430);
  const at2 = under(tOne, DEPTH.type, 92, 430);
  const at3 = under(tBack, DEPTH.type, 92, 342);
  const at4 = under(tEarly, DEPTH.type, 92, 336);
  const type = {
    haryana: { x: at1[0], y: at1[1], size: 160, maxW: 760, lines: [{ lead: "HARYANA", text: "", at: tHaryana }], out: tToday + 0.25 } as PhraseCue,
    oneMan: { x: at2[0], y: at2[1], size: 160, maxW: 760, lines: [{ lead: "ONE MAN", text: "", at: tOne }], out: tSells - 0.35 } as PhraseCue,
    back: { x: at3[0], y: at3[1], size: 104, maxW: 790, leading: 1.4, lines: [{ text: "BACK TO", at: tBack }, { lead: "HARYANA", text: "", at: tHaryana2 }], out: tHaryana2 + 1.1 } as PhraseCue,
    early: { x: at4[0], y: at4[1], size: 100, maxW: 790, leading: 1.4, lines: [{ text: "EARLY", at: tEarly }, { lead: "2000s", text: "", at: t2000 }], out: tCover - 0.2 } as PhraseCue,
  };

  return {
    cam,
    trader,
    farmer,
    sackA: (t: number) => sackA(t),
    sackB: (t: number) => sackB(t),
    sackHolder,
    pass,
    notes,
    birds,
    type,
    cues,
    REST_B,
    marks: { tBought, tTaken, tGrab, tLift, tSeed, tHaryana, tPocket, tToday, tOne, tVillage, tPass, tSells, tBack, tNotesOut, tOut, tTaken2, tTo, tGrabB, tLiftB, tSwing, tRel, tEarly, t2000, tCover, tOff, farmerIn: fw.arrive, farmerBack: fb.arrive, farmerAtB: fs.arrive, traderOut: tw.arrive },
  };
}

export type S1Take = ReturnType<typeof build>;
let take: S1Take | null = null;
export function s1Take(): S1Take {
  if (!take) take = build();
  return take;
}
