// Bihar Mushroom: sequence "shed". Inside the mud shed, the struggle years: "And you can imagine..." to "...called spawn."
// One continuous take. This file is the whole performance as data; frame.ts draws it.
// The stage: the doorway is in the left wall (back corner at x 330), daylight comes through it from frame left.
// A bamboo pole on two posts carries five ropes of grow bags, two bags to a rope; a fainter row hangs along the wall.
// Crates: at left by the door (spawn bottles on top) and at right (the cash tin). The calendar hangs on the wall at right.
import { CAST, CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { CRATE_PALETTE } from "../../../assets/props/crate.ts";
import { MUSHROOM_PALETTE } from "../../../assets/props/mushroom.ts";
import { TIN_PALETTE, tinPoints } from "../../../assets/props/tin.ts";
import { SHED_PALETTE as SHED_SET_PALETTE, buildShed } from "../../../assets/sets/shed.ts";
import { mergePalettes, type Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import { lerpPt, type Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Blend, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { crouch, feel, handsOnHips, holdFromStart, lookAt, nod, pat, reach, release, shrug } from "../../../engine/motion/verbs.ts";
import { Camera } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { NumberCue, PhraseCue } from "../../../engine/type/blockspec.ts";
import { PALETTE } from "../palette.ts";
import { WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** frame size, px per head-height, the ground line, and the stretch of the film this sequence covers (from word anchors) */
export const SHED = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, t0: r2(ANCHOR("and", 4)), end: r2(ANCHOR("think")) } as const;
// (mergePalettes throws if two palettes give one name two colours; a plain spread would let the later one win)
export const SHED_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE, SHED_SET_PALETTE, MUSHROOM_PALETTE, TIN_PALETTE, CRATE_PALETTE);
/** how far behind the actors the back wall is, for the camera's parallax */
export const WALL_DEPTH = 0.1;
/** the faint row of bags hanging along the wall */
export const BACKROW_DEPTH = 0.09;

const { U, GY } = SHED;

// ---- the set, built once
export const CORNER = 330;
export const SET = buildShed({ GY, u: U, x0: -900, x1: 2100, y0: -900, y1: 2600, corner: CORNER, posts: [590, 1530], thatchAt: 7.75 });
const tierTop = (k: number) => SET.poleY + 0.2 * U + k * 1.3 * U;
export const ROPES = [700, 860, 1020, 1180, 1340];
export const BACK_ROPES = [780, 940, 1100, 1260, 1420];
export const TIERS = [tierTop(0), tierTop(1)];
/** the two crates by the door, with the spawn bottles on top; the two by the right wall, with the tin */
/** the crates by the door (the bench of `seed`): middle x, and the widths of the low and the top crate */
export const CRATES_L = { x: 385, wLow: 1.25 * U, wTop: 1.2 * U };
export const CRATES_R = { x: 1130, wLow: 1.0 * U, wTop: 0.86 * U };
export const CRATE_TOP = GY - 0.1 * U - 1.0 * U - 0.8 * U - 0.1 * U;
export const BOTTLE_DULL: Pt = [372, CRATE_TOP + 4];
export const BOTTLE_GOOD: Pt = [442, CRATE_TOP + 4];
/** the hurricane lamp hangs on the near post, unlit here (it is lit in `seed`); the lota of water stands on the bench */
export const LAMP_AT: Pt = [604, 846];
export const LOTA_AT: Pt = [304, CRATE_TOP + 2];
/** the bottles are drawn a size up from the library default, so the one he holds up reads on a phone */
export const BOTTLE_SCALE = 1.35;
/** the state of the bags when the take ends (seed carries on from it) */
export const FRUITING_AT_END = "bag0_0";
export const FAILED_AT_END = ["bag3_0", "bag4_1", "bag1_1", "bag2_1", "bag4_0"];
export const TIN_AT = { x: 1120, base: CRATE_TOP + 6, u: U };
export const CAL = { x: 1150, y: 360, w: 124, h: 186 };
/** where the dropped bag lies on the floor: its tie, and it lies along the floor to the left of it */
export const LIE: Pt = [900, GY - 0.12 * U - 0.29 * U];

// ---- the faces of this take (resting faces carry the inner brow ends a little high)
const EASY: Expression = { lidU: 0.94, lidL: 0.88, browRaise: 0.3, browTilt: -0.4, smile: 0.2, open: 0, wide: 0.05, jaw: 0 };
const FOCUS: Expression = { lidU: 0.8, lidL: 0.82, browRaise: 0.1, browTilt: -0.05, smile: 0.04, open: 0, wide: 0, jaw: 0 };
const SUNK: Expression = { lidU: 0.78, lidL: 0.95, browRaise: 0.55, browTilt: -0.85, smile: -0.3, open: 0, wide: 0.1, jaw: 0 };
const TIRED: Expression = { lidU: 0.7, lidL: 0.9, browRaise: 0.45, browTilt: -0.7, smile: -0.2, open: 0, wide: 0.05, jaw: 0 };
const WONDER: Expression = { lidU: 1, lidL: 0.7, browRaise: 0.75, browTilt: -0.35, smile: 0.35, open: 0.08, wide: 0.2, jaw: 0.04 };
const JEER: Expression = { lidU: 0.8, lidL: 0.6, browRaise: 0.3, browTilt: 0.2, smile: 0.6, open: 0.2, wide: 0.4, jaw: 0.1 };

export interface BagCue {
  id: string;
  x: number;
  tier: number;
  sprout: Track;
  failed: Track;
  seed: number;
}

function build() {
  const W = ANCHOR;
  const cues: Cue[] = [];
  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: 945, yaw: 1.0, seed: 4 });
  sanjeev.face = new Blend<Expression>(FOCUS, mixFace);
  const sil = SET.junction + 1.0 * U;
  const gossipA = new Actor({ ch: CAST.sonA, scale: U, groundY: sil, x: -290, yaw: 1.1, seed: 7 });
  const gossipB = new Actor({ ch: CAST.porter, scale: 0.97 * U, groundY: sil + 8, x: -470, yaw: 1.1, seed: 9 });
  const cam = new Camera(585, 900, 1.04);

  // ---- the bags, one per rope and tier; and the faint row along the wall
  const bags: BagCue[] = [];
  ROPES.forEach((x, i) => {
    for (let k = 0; k < 2; k++) bags.push({ id: `bag${i}_${k}`, x, tier: k, sprout: new Track(0), failed: new Track(0), seed: 3 + i * 2 + k });
  });
  const bag = (x: number, tier: number) => bags.find((b) => b.x === x && b.tier === tier)!;
  const fruiting = bag(700, 0);
  const hung = bag(1020, 1);
  const dropped = bag(860, 1);

  // ------------------------------------------------------------------------------------------------------------
  // The way in: a dark jamb close to the lens slides off to the left as the camera settles inside
  // ------------------------------------------------------------------------------------------------------------
  const t0 = SHED.t0;
  const jamb = new Track(1180);
  jamb.to(-160, { at: t0 + 0.8, dur: 0.8, w: WEIGHT.body, windup: 0, overshoot: 0 });
  const dim = new Track(0.6);
  dim.to(0, { at: t0 + 1.4, dur: 1.4, w: WEIGHT.body, windup: 0, overshoot: 0 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 1. "And you can imagine what people said." He has just hung a bag; two neighbours lean in at the door.
  // ------------------------------------------------------------------------------------------------------------
  const hangSwing = new Track(0.12);
  hangSwing.to(0, { at: t0 + 0.9, dur: 0.8, w: WEIGHT.hand, windup: 0 });
  const hungGrip = (side: -1 | 1) => (t: number): Pt => {
    const sw = hangSwing.value(t);
    const top: Pt = [hung.x, TIERS[1]];
    const g: Pt = [side * 0.27 * U, 0.42 * U];
    return [top[0] + g[0] * Math.cos(sw) - g[1] * Math.sin(sw), top[1] + g[0] * Math.sin(sw) + g[1] * Math.cos(sw)];
  };
  holdFromStart(sanjeev, "R", hungGrip(-1), { hand: HANDS.grip, palm: -1, layer: "front" });
  holdFromStart(sanjeev, "L", hungGrip(1), { hand: HANDS.grip, palm: 1, layer: "back" });
  // he is bent to the lower bag, so his head stays clear of the writing above him
  crouch(sanjeev, 0.1, 0.3, { at: t0 - 0.1, dur: 0.3, w: WEIGHT.body });
  lookAt(sanjeev, [hung.x, TIERS[1] + 0.4 * U], { at: t0 + 0.1 });
  cues.push({ t: t0 + 0.15, what: "rope", x: hung.x });
  release(sanjeev, "R", { at: t0 + 1.05, dur: 0.45 });
  release(sanjeev, "L", { at: t0 + 1.15, dur: 0.45 });

  const aIn = gossipA.walkTo(190, { arrive: t0 + 0.95, pace: 1.7, step: 1.1 });
  gossipB.walkTo(90, { arrive: t0 + 1.25, pace: 1.6, step: 1.0 });
  gossipA.lean.to(0.1, { at: aIn.arrive + 0.4, dur: 0.45, w: WEIGHT.body });
  lookAt(gossipA, [800, 700], { at: aIn.arrive + 0.2 });
  lookAt(gossipB, [800, 720], { at: t0 + 1.6 });
  cues.push({ t: t0 + 1.2, what: "murmur", x: 100 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 2. "An engineer growing mushrooms?" One points and shakes his head; the other laughs. Sanjeev keeps working.
  // ------------------------------------------------------------------------------------------------------------
  const tEng = W("engineer");
  feel(gossipA, JEER, { at: tEng - 0.1, dur: 0.25 });
  reach(gossipA, "R", [190 + 1.5 * U, 880], { at: tEng + 0.15, dur: 0.38, hand: HANDS.point, look: false, body: false });
  const ht = gossipA.headTurn.value(tEng + 0.5);
  gossipA.headTurn.to(ht + 0.22, { at: tEng + 0.62, dur: 0.18, w: WEIGHT.head });
  gossipA.headTurn.to(ht - 0.22, { at: tEng + 0.84, dur: 0.2, w: WEIGHT.head });
  gossipA.headTurn.to(ht + 0.16, { at: tEng + 1.06, dur: 0.2, w: WEIGHT.head });
  gossipA.headTurn.to(ht, { at: tEng + 1.3, dur: 0.22, w: WEIGHT.head });
  feel(gossipB, JEER, { at: tEng + 0.2, dur: 0.25 });
  shrug(gossipB, { at: tEng + 0.45, hold: 0.08, amount: 0.6 });
  shrug(gossipB, { at: tEng + 1.4, hold: 0.08, amount: 0.6 });
  gossipB.lean.to(-0.08, { at: tEng + 0.5, dur: 0.3, w: WEIGHT.body });
  gossipB.lean.to(0.03, { at: tEng + 1.3, dur: 0.4, w: WEIGHT.body });
  // Sanjeev, his back to them, pats the bag below the one he hung
  feel(sanjeev, EASY, { at: tEng - 0.4, dur: 0.3 });
  const patEnd = pat(sanjeev, "R", [hung.x - 0.3 * U, TIERS[1] + 0.45 * U], { at: tEng + 0.5, times: 2, every: 0.3, palm: -1, layer: "front" });
  release(sanjeev, "R", { at: patEnd + 0.25, dur: 0.4 });
  // they lose interest and go
  release(gossipA, "R", { at: W("mushrooms") + 0.25, dur: 0.4 });
  gossipB.turnTo(-1.1, { at: W("mushrooms") + 0.35, dur: 0.4 });
  gossipB.walkTo(-480, { start: W("mushrooms") + 0.55, pace: 1.7, step: 1.0 });
  gossipA.lean.to(0, { at: W("mushrooms") + 0.4, dur: 0.35, w: WEIGHT.body });
  gossipA.turnTo(-1.1, { at: W("mushrooms") + 0.55, dur: 0.4 });
  gossipA.walkTo(-420, { start: W("mushrooms") + 0.75, pace: 1.7, step: 1.1 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 3. "Money is tight." The tin on the crate: a few notes. Shut.
  // ------------------------------------------------------------------------------------------------------------
  const tMoney = W("money");
  const tTight = W("tight");
  const lid = new Track(0);
  const lidAt = (t: number): Pt => tinPoints(TIN_AT, lid.value(t)).lidEdge;
  sanjeev.drop.to(0, { at: tMoney + 0.1, dur: 0.45, w: WEIGHT.body });
  sanjeev.bend.to(0, { at: tMoney + 0.12, dur: 0.45, w: WEIGHT.body });
  sanjeev.lean.to(0, { at: tMoney + 0.1, dur: 0.45, w: WEIGHT.body });
  const sw = sanjeev.walkTo(1000, { start: tMoney - 0.12, pace: 2.1, step: 1.2 });
  lookAt(sanjeev, [TIN_AT.x, TIN_AT.base - 0.2 * U], { at: tMoney - 0.1 });
  const tLidAt = Math.max(sw.arrive + 0.1, tTight - 0.15);
  sanjeev.bend.to(0.22, { at: tLidAt, dur: 0.36, w: WEIGHT.body });
  reach(sanjeev, "R", lidAt(0), { at: tLidAt, dur: 0.32, hand: HANDS.pinch, palm: -1, pin: lidAt, contact: true, layer: "front", body: false });
  lid.to(1.9, { at: tTight + 0.2, dur: 0.32, w: WEIGHT.hand, windup: 0.04 });
  feel(sanjeev, SUNK, { at: tTight + 0.3, dur: 0.25 });
  cues.push({ t: tTight + 0.05, what: "lid", x: TIN_AT.x });
  const tShut = W("people", 2) + 0.2;
  lid.to(0, { at: tShut, dur: 0.26, w: WEIGHT.hand, windup: 0 });
  cues.push({ t: tShut, what: "lid", x: TIN_AT.x });
  release(sanjeev, "R", { at: tShut + 0.22, dur: 0.4 });
  sanjeev.bend.to(0, { at: tShut + 0.3, dur: 0.4, w: WEIGHT.body });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 4. "People talk and for 6 long years, from 2002 to 2008, he struggles."
  // The calendar turns six pages; the doorlight goes from day to dusk with each; bags go grey; he pulls one down.
  // ------------------------------------------------------------------------------------------------------------
  const tSix = W("6");
  const t2002 = W("2002", 2);
  const t2008 = W("2008");
  const pages = new Track(0);
  pages.to(6, { at: t2008 + 0.35, dur: t2008 + 0.35 - (tSix + 0.05), w: WEIGHT.mech, windup: 0, overshoot: 0 });
  const flipFrom = tSix + 0.05;
  const flipTo = t2008 + 0.35;
  for (let i = 0; i < 6; i++) cues.push({ t: flipFrom + ((i + 0.5) * (flipTo - flipFrom)) / 6, what: "page", x: CAL.x });
  lookAt(sanjeev, [CAL.x, CAL.y + 100], { at: tSix - 0.1 });
  feel(sanjeev, TIRED, { at: tSix + 0.2, dur: 0.4 });
  handsOnHips(sanjeev, { at: tSix + 0.5, dur: 0.45 });
  const greys: [BagCue, number][] = [
    [bag(1180, 0), tSix + 0.3],
    [bag(1340, 1), t2002 + 0.1],
    [dropped, t2002 + 0.45],
    [hung, t2008 - 0.1],
    [bag(1340, 0), t2008 + 0.25],
  ];
  for (const [b, at] of greys) b.failed.to(1, { at, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0 });
  lookAt(sanjeev, [1180, TIERS[0] + 0.5 * U], { at: t2002 - 0.1 });
  lookAt(sanjeev, [dropped.x, TIERS[1] + 0.4 * U], { at: t2008 + 0.2 });
  // he takes hold of the grey bag and pulls it off its rope
  const tPull = W("struggles") + 0.05;
  const dropGrip: Pt = [dropped.x - 0.27 * U, TIERS[1] + 0.4 * U];
  release(sanjeev, "L", { at: tPull - 0.3, dur: 0.4 });
  reach(sanjeev, "R", dropGrip, { at: tPull, dur: 0.4, hand: HANDS.grip, palm: -1, contact: true, layer: "front", look: false });
  const fall = new Track(0);
  const tLand = tPull + 0.45;
  fall.to(1, { at: tLand, dur: 0.32, w: WEIGHT.mech, windup: 0, overshoot: 0 });
  release(sanjeev, "R", { at: tPull + 0.3, dur: 0.35 });
  cues.push({ t: tPull + 0.1, what: "rope", x: dropped.x }, { t: tLand, what: "thud", x: LIE[0] - 0.5 * U });
  cam.shake(tLand, 4, 0.3);
  feel(sanjeev, TIRED, { at: tLand + 0.2, dur: 0.3 });
  /** where the dropped bag is: its tie, and its turn (it ends lying along the floor, tie to the right) */
  const droppedAt = (t: number): { top: Pt; swing: number } => {
    const f = fall.value(t);
    return { top: lerpPt([dropped.x, TIERS[1]], LIE, f), swing: (Math.PI / 2) * Math.min(1, f * 1.15) };
  };

  // ------------------------------------------------------------------------------------------------------------
  // Beat 5. "But during those years, he figures out the real problem." He crouches at it, splits it, feels the grain.
  // ------------------------------------------------------------------------------------------------------------
  const tBut = W("but", 2);
  sanjeev.turnTo(-1.0, { at: tBut + 0.2, dur: 0.45 });
  lookAt(sanjeev, [LIE[0] - 0.5 * U, LIE[1]], { at: tBut + 0.15 });
  sanjeev.walkTo(862, { start: tBut + 0.45, pace: 1.6, step: 0.8 });
  crouch(sanjeev, 1.15, 0.8, { at: tBut + 1.05, dur: 0.55, w: WEIGHT.body });
  feel(sanjeev, FOCUS, { at: tBut + 0.6, dur: 0.3 });
  const tHands = tBut + 1.15;
  const onBag = (dx: number, dy: number): Pt => [LIE[0] + dx * U, LIE[1] + dy * U];
  reach(sanjeev, "L", onBag(-0.5, -0.33), { at: tHands, dur: 0.4, hand: HANDS.grip, palm: -1, contact: true, pin: true, layer: "front", look: false, body: false });
  reach(sanjeev, "R", onBag(-0.72, -0.33), { at: tHands + 0.08, dur: 0.4, hand: HANDS.grip, contact: true, pin: true, layer: "back", look: false, body: false });
  const split = new Track(0);
  const tTear = W("figures");
  split.to(1, { at: tTear + 0.2, dur: 0.36, w: WEIGHT.hand, windup: 0 });
  reach(sanjeev, "L", onBag(-0.5, -0.36), { at: tTear + 0.2, dur: 0.36, hand: HANDS.grip, contact: true, pin: true, layer: "front", look: false, body: false });
  reach(sanjeev, "R", onBag(-0.84, -0.33), { at: tTear + 0.22, dur: 0.36, hand: HANDS.grip, contact: true, pin: true, layer: "back", look: false, body: false });
  cues.push({ t: tTear + 0.05, what: "plastic", x: LIE[0] - 0.6 * U });
  const tRub = W("real");
  // he rubs the grain between his fingers: the hand works along the bag and back, the body stays down
  reach(sanjeev, "L", onBag(-0.44, -0.36), { at: tRub + 0.1, dur: 0.26, hand: HANDS.pinch, palm: -1, contact: true, pin: true, layer: "front", look: false, body: false });
  reach(sanjeev, "L", onBag(-0.5, -0.36), { at: tRub + 0.42, dur: 0.26, hand: HANDS.pinch, palm: -1, contact: true, pin: true, layer: "front", look: false, body: false });
  feel(sanjeev, SUNK, { at: W("problem"), dur: 0.3 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 6. "See, growing mushrooms isn't the hard part. The hard part is the seed, which is called spawn."
  // Behind him one good bag fruits. He stands, takes a spawn bottle and holds it up to the doorlight on "seed".
  // ------------------------------------------------------------------------------------------------------------
  const tSee = W("see");
  fruiting.sprout.to(1, { at: W("part") + 0.2, dur: 1.9, w: WEIGHT.body, windup: 0, overshoot: 0 });
  lookAt(sanjeev, [fruiting.x - 0.3 * U, TIERS[0] + 0.5 * U], { at: tSee + 0.2 });
  feel(sanjeev, WONDER, { at: tSee + 0.4, dur: 0.3 });
  release(sanjeev, "L", { at: tSee + 0.35, dur: 0.4 });
  release(sanjeev, "R", { at: tSee + 0.4, dur: 0.4 });
  const tUp = tSee + 0.8;
  sanjeev.drop.to(0, { at: tUp, dur: 0.5, w: WEIGHT.body });
  sanjeev.bend.to(0, { at: tUp + 0.04, dur: 0.5, w: WEIGHT.body });
  sanjeev.lean.to(0, { at: tUp, dur: 0.5, w: WEIGHT.body });
  const walkB = sanjeev.walkTo(505, { start: tUp + 0.2, pace: 2.0, step: 1.25 });
  lookAt(sanjeev, [BOTTLE_GOOD[0], BOTTLE_GOOD[1] - 0.3 * U], { at: walkB.arrive - 0.35 });
  feel(sanjeev, FOCUS, { at: walkB.arrive - 0.2, dur: 0.3 });
  const tSeed = W("seed", 2);
  const tGrab = Math.min(tSeed - 0.5, walkB.arrive + 0.35);
  const grabAt: Pt = [BOTTLE_GOOD[0], BOTTLE_GOOD[1] - 0.3 * U];
  reach(sanjeev, "R", grabAt, { at: tGrab, dur: 0.4, hand: HANDS.grip, palm: 1, contact: true, look: false, layer: "back" });
  cues.push({ t: tGrab, what: "glass", x: BOTTLE_GOOD[0] });
  // out at arm's length, into the light of the doorway, a little below his eyes
  const RAISE: Pt = [222, 738];
  const tRaise = tSeed + 0.12;
  reach(sanjeev, "R", RAISE, { at: tRaise, dur: 0.5, hand: HANDS.grip, palm: 1, pin: true, look: false, bow: 0.18, layer: "back" });
  lookAt(sanjeev, [RAISE[0], RAISE[1] - 0.25 * U], { at: tRaise - 0.05 });
  feel(sanjeev, WONDER, { at: tRaise + 0.25, dur: 0.35 });
  handsOnHips(sanjeev, { at: tRaise + 0.45, dur: 0.45, sides: ["L"] });
  const tilt = new Track(0);
  tilt.to(-0.14, { at: W("called") + 0.1, dur: 0.4, w: WEIGHT.hand });
  tilt.to(0.06, { at: W("spawn") + 0.35, dur: 0.45, w: WEIGHT.hand });
  nod(sanjeev, { at: W("spawn") + 0.2, amount: 0.5 });
  cues.push({ t: W("spawn"), what: "glint", x: RAISE[0] });
  /** the bottle in his hand: blends from where it stands to his grip as he takes it */
  const glow = new Track(0);
  glow.to(1, { at: tRaise + 0.35, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0 });

  // ------------------------------------------------------------------------------------------------------------
  // The light: the doorlight dims to dusk and back with each page of the calendar; and dusk deepens over the take
  // ------------------------------------------------------------------------------------------------------------
  const dusk = (t: number): number => {
    const base = 0.08 * Math.max(0, Math.min(1, (t - t0) / (SHED.end - t0)));
    if (t <= flipFrom || t >= flipTo) return base;
    const k = (t - flipFrom) / (flipTo - flipFrom);
    return base + 0.16 * (0.5 - 0.5 * Math.cos(k * 6 * 2 * Math.PI));
  };

  // ------------------------------------------------------------------------------------------------------------
  // Camera: never still
  // ------------------------------------------------------------------------------------------------------------
  cam.keys([
    { t: t0 - 0.3, cx: 660, cy: 900, zoom: 1.08 },
    { t: t0 + 0.2, cx: 640, cy: 900, zoom: 1.04 },
    { t: t0 + 1.0, cx: 600, cy: 902, zoom: 1.0 },
    { t: W("mushrooms") + 0.1, cx: 604, cy: 904, zoom: 1.005 },
    { t: tMoney, cx: 610, cy: 905, zoom: 1.01 },
    // in on the tin
    { t: tTight + 0.1, cx: 1010, cy: 1060, zoom: 1.28 },
    { t: W("people", 2) + 0.1, cx: 1015, cy: 1058, zoom: 1.3 },
    // back: the wall, the calendar, the bags
    { t: tSix + 0.3, cx: 700, cy: 900, zoom: 0.98 },
    { t: tBut + 0.1, cx: 716, cy: 905, zoom: 0.99 },
    // in on his hands at the bag
    { t: tTear, cx: 800, cy: 1130, zoom: 1.28 },
    { t: W("problem") + 0.2, cx: 795, cy: 1135, zoom: 1.31 },
    // back out as he rises and the bag behind him fruits, then in to the bottle in the doorlight
    { t: tUp + 0.6, cx: 660, cy: 930, zoom: 1.02 },
    { t: tSeed, cx: 560, cy: 900, zoom: 1.05 },
    { t: W("spawn"), cx: 522, cy: 882, zoom: 1.1 },
    { t: SHED.end + 0.3, cx: 492, cy: 900, zoom: 1.18 },
  ]);

  // ------------------------------------------------------------------------------------------------------------
  // What is written on the wall (wall coordinates), each piece landing on its word
  // ------------------------------------------------------------------------------------------------------------
  const type = {
    engineer: {
      x: 150,
      y: 312,
      size: 136,
      maxW: 740,
      leading: 1.25,
      lines: [
        { text: "AN ENGINEER", at: W("an", 2) },
        { text: "GROWING", at: W("growing", 2) },
        { lead: "MUSHROOMS?", text: "", at: W("mushrooms") },
      ],
      out: W("mushrooms") + 0.25,
    } as PhraseCue,
    years: {
      x: 260,
      y: 330,
      cap: 136,
      maxW: 770,
      label: { text: "6 LONG YEARS", at: tSix },
      parts: [
        { text: "2002", at: t2002 },
        { text: "–2008", at: t2008 },
      ],
      out: tBut,
    } as NumberCue,
    spawn: { x: 118, y: 448, size: 170, maxW: 520, lines: [{ lead: "SPAWN", text: "", at: W("spawn") }], out: SHED.end - 0.1 } as PhraseCue,
  };

  return {
    sanjeev,
    gossipA,
    gossipB,
    cam,
    bags,
    hangSwing,
    hung,
    dropped,
    droppedAt,
    split,
    lid,
    pages,
    tilt,
    glow,
    jamb,
    dim,
    dusk,
    type,
    cues,
    raise: RAISE,
    marks: { t0, tEng, tMoney, tTight, tShut, tSix, t2002, t2008, tPull, tLand, tBut, tHands, tTear, tSee, tUp, tGrab, tSeed, tRaise, walkArrive: walkB.arrive },
  };
}

export type ShedTake = ReturnType<typeof build>;
let take: ShedTake | null = null;
export function shedTake(): ShedTake {
  if (!take) take = build();
  return take;
}
