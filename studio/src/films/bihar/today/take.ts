// Bihar Mushroom: sequence "today". The village today at sunrise: huts with bags fruiting, white sacks stacked by the
// lane, Sanjeev today (older, glasses) beside them. It opens off the dark door jamb that "lab" ends on. Villagers carry
// grow bags across; a porter brings a sack and sets it down on "600"; Sanjeev pats it on "1000". The sacks go out
// left, one on each state's name, and the last is handed to the Haryana trader, who carries it off. Sanjeev looks to
// the far city, turns his back on it and looks over his village: a held, living frame.
import { CAST } from "../../../assets/cast/cast.ts";
import type { Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Prop } from "../../../engine/motion/prop.ts";
import { Blend, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { crouch, feel, handsOnHips, holdFromStart, lookAt, nod, pat, reach, release } from "../../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { DEPTH, LANE, LANE_PALETTE } from "../s1/lane.ts";
import { VO, WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
export const TODAY = { ...LANE, fps: 30, t0: Math.round(ANCHOR("by") * 100) / 100, end: VO.duration } as const;
export const TODAY_PALETTE: Palette = LANE_PALETTE;
const { U, GY } = TODAY;
const FRAME = { width: TODAY.W, height: TODAY.HGT };
const REF = { cx: TODAY.W / 2, cy: TODAY.HGT / 2 };
/** a sack in someone's arms, and set down on the ground */
export const SACK = { w: 1.0, h: 0.95 };
const BACK_GY = GY - 34;

const WARM: Expression = { lidU: 0.86, lidL: 0.62, browRaise: 0.3, browTilt: -0.3, smile: 0.55, open: 0, wide: 0.1, jaw: 0 };
const PROUD: Expression = { lidU: 0.88, lidL: 0.58, browRaise: 0.45, browTilt: -0.2, smile: 0.8, open: 0, wide: 0.2, jaw: 0 };
const EASY_T: Expression = { lidU: 0.9, lidL: 0.7, browRaise: 0.35, browTilt: -0.3, smile: 0.5, open: 0, wide: 0.1, jaw: 0 };

/** where a man carries a sack in his arms: low against the body, on the side he faces (its middle) */
const armsAt = (a: Actor) => (t: number): Pt => [a.x.value(t) + Math.sin(a.yaw.value(t)) * 0.66 * U, a.groundY - 2.45 * U];
/** the two hands on a sack whose middle is c(t): near hand under the front, far hand over the top */
const sackHands = (a: Actor, c: (t: number) => Pt) => ({
  near: (t: number): Pt => [c(t)[0] + Math.sin(a.yaw.value(t)) * 0.22 * U, c(t)[1] + 0.12 * U],
  far: (t: number): Pt => [c(t)[0] + Math.sin(a.yaw.value(t)) * 0.05 * U, c(t)[1] - 0.36 * U],
});

function build() {
  const W = ANCHOR;
  const t0 = TODAY.t0;
  const cues: Cue[] = [];

  const sanjeev = new Actor({ ch: CAST.sanjeevNow, scale: U, groundY: GY, x: 680, yaw: -1.0, seed: 14 });
  sanjeev.face = new Blend<Expression>(WARM, mixFace);

  // ==== Beat 1. "By his count, he has trained more than 50,000 farmers across Bihar." Villagers carry bags across.
  const c1 = new Actor({ ch: CAST.sonA, scale: U, groundY: BACK_GY, x: -380, yaw: 1.1, seed: 41 });
  const c2 = new Actor({ ch: CAST.sonB, scale: U, groundY: BACK_GY + 8, x: 1500, yaw: -1.1, seed: 43 });
  const bagHang = (a: Actor) => (t: number): Pt => [a.x.value(t) + Math.sin(a.yaw.value(t)) * 0.12 * U, a.groundY - 2.55 * U];
  holdFromStart(c1, "R", bagHang(c1), { hand: HANDS.grip, layer: "front" });
  holdFromStart(c2, "L", bagHang(c2), { hand: HANDS.grip, layer: "front" });
  c1.walkTo(1550, { start: t0 + 0.1, pace: 2.3, step: 1.3 });
  lookAt(sanjeev, [200, GY - 4.0 * U], { at: t0 + 0.4 });
  lookAt(sanjeev, [900, GY - 3.6 * U], { at: W("trained") + 0.1 });
  feel(sanjeev, PROUD, { at: W("50") + 0.1, dur: 0.3 });
  nod(sanjeev, { at: W("farmers", 4) + 0.1, amount: 0.5 });
  cues.push({ t: t0 + 0.1, what: "door.slide" }, { t: t0 + 0.3, what: "birds" });

  // ==== Beat 2. "Today, that village lab makes around 600 kilos of spawn a day." A porter sets a sack down.
  const p1 = new Actor({ ch: CAST.porter, scale: U, groundY: GY - 4, x: 1700, yaw: -1.1, seed: 45 });
  const sack1 = new Prop([0, 0]);
  let carry1: (t: number) => Pt = armsAt(p1);
  sack1.held = new Track(1);
  // (sack1.carry is set below, once the second porter who takes it away exists)
  sack1.carry = (t) => carry1(t);
  const s1c = (t: number) => sack1.at(t);
  const h1 = sackHands(p1, s1c);
  holdFromStart(p1, "L", h1.near, { hand: HANDS.cup, layer: "front" });
  holdFromStart(p1, "R", h1.far, { hand: HANDS.grip, layer: "back" });
  const XP = 560;
  const DOWN: Pt = [XP - 0.62 * U, GY - SACK.h * 0.5 * U + 2];
  const w1 = p1.walkTo(XP, { arrive: W("600") - 0.35, pace: 1.5, step: 1.0 });
  sack1.pos = sack1.pos.to(DOWN, { at: W("600") - 0.4, dur: 0.02 });
  crouch(p1, 1.0, 0.75, { at: W("600"), dur: 0.38 });
  sack1.held.to(0, { at: W("600"), dur: 0.38, w: WEIGHT.heavy, windup: 0 });
  cues.push({ t: W("600"), what: "thud.sack", x: DOWN[0] });
  release(p1, "L", { at: W("600") - 0.02, dur: 0.3 });
  release(p1, "R", { at: W("600") + 0.08, dur: 0.3 });
  crouch(p1, 0, 0, { at: W("kilos") + 0.4, dur: 0.42 });
  p1.walkTo(-560, { start: W("kilos") + 0.75, pace: 2.4, step: 1.35 });
  lookAt(sanjeev, [DOWN[0], DOWN[1]], { at: W("600") - 0.5 });
  lookAt(p1, [sanjeev.x.value(95), GY - 4.4 * U], { at: W("day") });

  // ==== Beat 3. "And he wants to take it to 1000." Sanjeev steps up and pats the new sack.
  const ws = sanjeev.walkTo(DOWN[0] + 0.5 * U, { start: W("1000") - 1.3, pace: 1.5, step: 0.85 });
  crouch(sanjeev, 1.1, 0.8, { at: Math.max(ws.arrive + 0.15, W("1000") - 0.12), dur: 0.38 });
  const hits = pat(sanjeev, "L", [DOWN[0] + 0.22 * U, DOWN[1] - 0.47 * U], { at: W("1000"), times: 2, every: 0.24 });
  cues.push({ t: W("1000"), what: "pat", x: DOWN[0] });
  feel(sanjeev, PROUD, { at: W("1000") + 0.1, dur: 0.3 });
  release(sanjeev, "L", { at: hits + 0.2, dur: 0.35 });
  crouch(sanjeev, 0, 0, { at: hits + 0.35, dur: 0.4 });
  nod(p1, { at: W("1000") + 0.3, amount: 0.6 });

  // ==== Beat 4. "And the spawn goes out to Jharkhand, Uttar Pradesh, Odisha and yes, Haryana." Sacks go out left.
  // a second porter comes in from the left, takes it up and carries it out
  const tLift = W("goes", 2) + 0.05;
  const p2 = new Actor({ ch: CAST.sonA, scale: U, groundY: GY - 4, x: -540, yaw: 1.1, seed: 47 });
  carry1 = (t) => (t < W("600") + 1 ? armsAt(p1)(t) : armsAt(p2)(t));
  const h2 = sackHands(p2, s1c);
  const h2top = (t: number): Pt => [s1c(t)[0] - Math.sin(p2.yaw.value(t)) * 0.12 * U, s1c(t)[1] - 0.36 * U];
  p2.walkTo(DOWN[0] - 0.5 * U, { arrive: tLift - 0.2, pace: 2.0, step: 1.25 });
  lookAt(p2, [DOWN[0], DOWN[1]], { at: tLift - 0.6 });
  crouch(p2, 1.1, 0.8, { at: tLift, dur: 0.36 });
  reach(p2, "R", h2top(tLift), { at: tLift, dur: 0.3, hand: HANDS.grip, pin: h2top, look: true, layer: "front", contact: true });
  const h2topF = (t: number): Pt => [s1c(t)[0] - Math.sin(p2.yaw.value(t)) * 0.02 * U, s1c(t)[1] - 0.38 * U];
  reach(p2, "L", h2topF(tLift + 0.04), { at: tLift + 0.04, dur: 0.3, hand: HANDS.grip, pin: h2topF, look: false, layer: "back", contact: true });
  reach(p2, "L", h2.far(W("jharkhand") - 0.05), { at: W("jharkhand") - 0.05, dur: 0.3, hand: HANDS.grip, pin: h2.far, look: false, layer: "back" });
  sack1.held.to(1, { at: tLift + 0.45, dur: 0.38, w: WEIGHT.heavy, windup: 0 });
  crouch(p2, 0, 0, { at: tLift + 0.48, dur: 0.38 });
  cues.push({ t: tLift + 0.1, what: "heave", x: DOWN[0] });
  reach(p2, "R", h2.near(W("jharkhand") - 0.1), { at: W("jharkhand") - 0.1, dur: 0.3, hand: HANDS.cup, pin: h2.near, look: false, layer: "front" });
  p2.walkTo(1500, { start: W("jharkhand") + 0.2, pace: 2.4, step: 1.35 });
  lookAt(sanjeev, [DOWN[0] - 0.6 * U, GY - 4.0 * U], { at: tLift - 0.5 });
  lookAt(sanjeev, [1300, GY - 4.0 * U], { at: W("jharkhand") + 0.6 });
  // one more comes through with his
  const p3 = new Actor({ ch: CAST.sonB, scale: U, groundY: BACK_GY + 6, x: 1420, yaw: -1.1, seed: 49 });
  const sack3 = new Prop([0, 0]);
  sack3.held = new Track(1);
  const tHand = W("haryana", 4) + 0.05;
  const trader = new Actor({ ch: CAST.iraki, scale: U, groundY: GY - 2, x: -420, yaw: 1.05, seed: 4 });
  trader.face = new Blend<Expression>(EASY_T, mixFace);
  sack3.carry = (t) => (t < tHand ? armsAt(p3)(t) : armsAt(trader)(t));
  const s3c = (t: number) => sack3.at(t);
  const h3 = sackHands(p3, s3c);
  holdFromStart(p3, "L", h3.near, { hand: HANDS.cup, layer: "front" });
  holdFromStart(p3, "R", h3.far, { hand: HANDS.grip, layer: "back" });
  const XP3 = 400;
  const w3 = p3.walkTo(XP3, { arrive: tHand - 0.25, pace: 1.8, step: 1.15 });
  // the trader walks in from the left and takes it from him on "Haryana"
  const XT = XP3 - 1.55 * U;
  trader.walkTo(XT, { arrive: tHand - 0.35, pace: 1.4, step: 0.95 });
  const MID: Pt = [(armsAt(p3)(tHand)[0] + armsAt(trader)(tHand + 0.4)[0]) / 2, GY - 2.5 * U];
  sack3.pos = sack3.pos.to(MID, { at: tHand - 0.3, dur: 0.02 });
  sack3.held.to(0, { at: tHand, dur: 0.3, w: WEIGHT.body, windup: 0 });
  sack3.held.to(1, { at: tHand + 0.55, dur: 0.4, w: WEIGHT.heavy, windup: 0 });
  const ht = sackHands(trader, s3c);
  reach(trader, "R", ht.near(tHand + 0.05), { at: tHand + 0.05, dur: 0.3, hand: HANDS.cup, pin: ht.near, look: true, layer: "front", contact: true });
  reach(trader, "L", ht.far(tHand + 0.1), { at: tHand + 0.1, dur: 0.3, hand: HANDS.grip, pin: ht.far, look: false, layer: "back", contact: true });
  release(p3, "L", { at: tHand + 0.3, dur: 0.35 });
  release(p3, "R", { at: tHand + 0.35, dur: 0.35 });
  cues.push({ t: tHand + 0.05, what: "heave", x: MID[0] });
  feel(trader, EASY_T, { at: tHand + 0.4, dur: 0.3 });
  nod(trader, { at: tHand + 0.7, amount: 0.6 });
  lookAt(trader, [sanjeev.x.value(101), GY - 4.5 * U], { at: tHand + 0.5 });
  lookAt(sanjeev, [XT, GY - 4.5 * U], { at: W("yes") });
  nod(sanjeev, { at: tHand + 0.85, amount: 0.6 });
  feel(sanjeev, PROUD, { at: tHand + 0.5, dur: 0.3 });
  p3.turnTo(1.1, { at: tHand + 0.75, dur: 0.4 });
  p3.walkTo(1500, { start: tHand + 0.95, pace: 1.7, step: 1.1 });

  // ==== Beat 5. "So the state that once couldn't trust its own seed is now supplying the state it used to buy from."
  trader.turnTo(-1.05, { at: W("so", 3) + 0.25, dur: 0.45 });
  const wt = trader.walkTo(-600, { start: W("so", 3) + 0.45, pace: 1.5, step: 1.0 });
  lookAt(sanjeev, [-300, GY - 4.2 * U], { at: W("once") });
  lookAt(sanjeev, [-900, GY - 4.0 * U], { at: W("supplying") - 0.2 });
  handsOnHips(sanjeev, { at: W("supplying") + 0.3, dur: 0.45 });
  feel(sanjeev, WARM, { at: W("used") + 0.1, dur: 0.3 });

  // ==== Beat 6. "All because one engineer chose the village over the city." He looks to the far city, then turns
  // his back on it and looks out over his village.
  sanjeev.turnTo(1.0, { at: W("because", 2), dur: 0.5 });
  lookAt(sanjeev, [2600, 760], { at: W("because", 2) + 0.1 });
  feel(sanjeev, WARM, { at: W("engineer", 2), dur: 0.3 });
  sanjeev.turnTo(-1.05, { at: W("chose") + 0.3, dur: 0.6 });
  lookAt(sanjeev, [-1200, 900], { at: W("chose") + 0.2 });
  feel(sanjeev, PROUD, { at: W("village", 6) + 0.1, dur: 0.35 });
  cues.push({ t: 104.6, what: "birds" });

  const cam = new Camera(560, 950, 0.95);
  cam.keys([
    { t: t0 - 0.3, cx: 560, cy: 950, zoom: 0.92 },
    { t: 91.5, cx: 580, cy: 940, zoom: 0.94 },
    { t: W("600") - 0.2, cx: 560, cy: 950, zoom: 1.02 },
    { t: W("1000") + 0.2, cx: 540, cy: 955, zoom: 1.06 },
    { t: W("jharkhand") + 0.4, cx: 470, cy: 950, zoom: 1.0 },
    { t: tHand + 0.2, cx: 360, cy: 950, zoom: 1.02 },
    { t: wt.start + 1.6, cx: 300, cy: 950, zoom: 0.98 },
    { t: W("supplying"), cx: 420, cy: 950, zoom: 1.0 },
    { t: W("because", 2), cx: 560, cy: 945, zoom: 1.02 },
    { t: TODAY.end + 0.3, cx: 600, cy: 940, zoom: 0.96 },
  ]);
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };

  const tLand: [string, string, number, number][] = [
    ["n50", "50,000", W("50"), W("today", 2) - 0.3],
    ["kilos", "600 KILOS", W("600"), W("1000") - 0.6],
    ["k1000", "1000", W("1000"), W("jharkhand") - 0.4],
    ["jh", "JHARKHAND", W("jharkhand"), W("uttar pradesh") - 0.12],
    ["up", "UTTAR PRADESH", W("uttar pradesh"), W("odisha") - 0.12],
    ["od", "ODISHA", W("odisha"), W("yes") + 0.2],
    ["hr", "HARYANA", W("yes haryana") + 0.41, W("so the state") + 0.6],
    ["vil", "THE VILLAGE", W("village over"), TODAY.end + 0.6],
  ];
  const type: Record<string, PhraseCue> = {};
  for (const [id, text, at, out] of tLand) {
    const p = under(at, DEPTH.type, 92, 430);
    type[id] = { x: p[0], y: p[1], size: 150, maxW: 790, lines: [{ lead: text, text: "", at }], out };
    if (id === "up") {
      const q = under(at, DEPTH.type, 92, 336);
      type[id] = { x: q[0], y: q[1], size: 104, maxW: 790, leading: 1.4, lines: [{ text: "UTTAR", at }, { lead: "PRADESH", text: "", at: W("pradesh") }], out };
    }
  }
  const birds = [0, 1, 2].map((i) => ({ t0: 104.6 + 0.4 * i, y: 200 + 36 * i, speed: 230 + 30 * i, x0: 1180 + 60 * i, size: 22 - 3 * i }));
  return {
    cam,
    sanjeev,
    c1,
    c2,
    p1,
    p2,
    p3,
    trader,
    sack1,
    sack3,
    type,
    birds,
    cues,
    marks: { jambOff: t0 + 0.43, tSet: w1.arrive, tLift, tHand, tP3: w3.arrive },
  };
}

export type TodayTake = ReturnType<typeof build>;
let take: TodayTake | null = null;
export function todayTake(): TodayTake {
  if (!take) take = build();
  return take;
}
