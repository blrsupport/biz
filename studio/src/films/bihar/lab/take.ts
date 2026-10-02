// Bihar Mushroom: sequence "lab". The shed made into the spawn lab, morning: "So Sanjeev decides..." to "...a little each."
// The sack close to the lens lifts away (Pass in from `seed`) on the whitewashed room: racks of bottles, the steaming
// drum. Sanjeev lifts the drum's lid, takes a bottle of spawn out of the steam and sets it in the rack on "Lab".
// Farmers come to the door and will not come in; he takes them a bottle and one of them tries it. He shows them how a
// grow bag is made, hands one over, and they go off carrying what he gave them while he watches from the door.
// Out to `today` by Pass: from about 87.9 a dark jamb slides across the lens and covers the frame by 88.47.
import { CAST, CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { MUSHROOM_PALETTE, bottleRack, steamDrum } from "../../../assets/props/mushroom.ts";
import { LAB_PALETTE as LAB_SET_PALETTE, buildShed } from "../../../assets/sets/shed.ts";
import { mergePalettes, type Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Prop } from "../../../engine/motion/prop.ts";
import { Blend, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { crouch, feel, handsOnHips, lookAt, nod, pat, reach, release } from "../../../engine/motion/verbs.ts";
import { Camera } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { PALETTE } from "../palette.ts";
import { WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
const r2 = (v: number) => Math.round(v * 100) / 100;
export const LAB = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, t0: r2(ANCHOR("so", 2)), end: r2(ANCHOR("by")) } as const;
export const LAB_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE, LAB_SET_PALETTE, MUSHROOM_PALETTE);
export const WALL_DEPTH = 0.1;

const { U, GY } = LAB;
/** the same room as the shed (same corner, door and thatch), whitewashed, with a window in the back wall at right */
export const SET = buildShed({ GY, u: U, x0: -900, x1: 2100, y0: -900, y1: 2600, corner: 330, posts: [590, 1530], thatchAt: 7.75, lab: true, windowX: 1420 });
export const RACKS = [800, 1180];
export const DRUM_AT: [number, number] = [500, GY - 0.1 * U];
const DOOR_GROUND = SET.junction + 1.0 * U;
/** rack 0: the shelf and the two places on it that start empty / are emptied */
const RACK0 = bottleRack("probe", { x: RACKS[0], ground: GY - 0.1 * U, u: U });
export const SHELF = 2;
const slotX = (i: number) => RACK0.x0 + ((i + 0.5) / 6) * (RACK0.x1 - RACK0.x0);
export const SLOT_PUT = 2;
export const SLOT_TAKE = 1;
export const SHELF_Y = RACK0.shelfY[SHELF];
/** the bottle's grip, from its base, and the grow bag's tie from its base */
const BOT_GRIP = 0.62 * U;
export const BAG_SC = 0.9;
const BAG_H = 1.06 * U * BAG_SC;

const EASY: Expression = { lidU: 0.94, lidL: 0.88, browRaise: 0.3, browTilt: -0.4, smile: 0.3, open: 0, wide: 0.05, jaw: 0 };
const PROUD: Expression = { lidU: 0.9, lidL: 0.55, browRaise: 0.5, browTilt: -0.3, smile: 0.75, open: 0, wide: 0.25, jaw: 0 };
const KEEN: Expression = { lidU: 0.96, lidL: 0.8, browRaise: 0.55, browTilt: -0.2, smile: 0.55, open: 0.12, wide: 0.3, jaw: 0.05 };

function build() {
  const W = ANCHOR;
  const t0 = LAB.t0;
  const cues: Cue[] = [];
  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: 1010, yaw: -1.05, seed: 4 });
  sanjeev.face = new Blend<Expression>(EASY, mixFace);
  const f1 = new Actor({ ch: CAST.sonB, scale: U, groundY: DOOR_GROUND, x: -420, yaw: 1.1, seed: 21 });
  const f2 = new Actor({ ch: CAST.porter, scale: U, groundY: DOOR_GROUND + 8, x: -560, yaw: 1.1, seed: 23 });
  const f3 = new Actor({ ch: CAST.sonA, scale: U, groundY: DOOR_GROUND - 6, x: -620, yaw: 1.1, seed: 27 });

  // ---- the sack close to the lens (from `seed`) lifts away: the room is the lab now
  const near = new Track(LAB.HGT / 2);
  near.to(-1700, { at: t0 + 0.75, dur: 0.75, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: t0 + 0.1, what: "lift", x: 540 });

  // ==== Beat 1. "So Sanjeev decides to fix that himself." He goes to the drum.
  const XD = 645;
  lookAt(sanjeev, [DRUM_AT[0], GY - 1.9 * U], { at: t0 + 0.5 });
  sanjeev.walkTo(XD, { arrive: W("himself") + 0.1, pace: 1.5, step: 1.0 });
  feel(sanjeev, KEEN, { at: W("fix"), dur: 0.3 });

  // ==== Beat 2. "He sets up a spawn lab right in his village, the Sabri Spawn Lab."
  // The lid comes up in his near hand, steam rolls out; his other hand lifts a bottle out of the drum.
  const lid = new Track(0);
  const steam = new Track(0.25);
  const lidGrip = (t: number): Pt => steamDrum("p", { at: DRUM_AT, u: U, lid: lid.value(t), steam: 0, phase: 0 }).lidGrip;
  const tLid = W("sets") + 0.12;
  reach(sanjeev, "L", lidGrip(tLid), { at: tLid, dur: 0.3, hand: HANDS.grip, pin: lidGrip, look: true, layer: "front", contact: true });
  lid.to(1, { at: tLid + 0.5, dur: 0.42, w: WEIGHT.body, windup: 0, overshoot: 0 });
  steam.to(1, { at: tLid + 0.75, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: tLid + 0.1, what: "lid", x: DRUM_AT[0] }, { t: tLid + 0.45, what: "steam", x: DRUM_AT[0] });
  feel(sanjeev, PROUD, { at: tLid + 0.6, dur: 0.3 });
  // the bottle: a prop on its own path (in the drum, in his hand, on the shelf, in his hand again)
  const bottle = new Prop([DRUM_AT[0] + 0.12 * U, GY - 1.45 * U]);
  const grip1 = (t: number): Pt => [bottle.at(t)[0], bottle.at(t)[1] - BOT_GRIP];
  const tIn = W("lab") + 0.12;
  reach(sanjeev, "R", grip1(tIn), { at: tIn, dur: 0.32, hand: HANDS.grip, pin: grip1, look: true, layer: "back", contact: true });
  const UPB: Pt = [XD - 0.95 * U, GY - 2.4 * U];
  bottle.pos.to(UPB, { at: tIn + 0.6, dur: 0.55, w: WEIGHT.body, windup: 0, overshoot: 0, bow: 0.1 });
  lookAt(sanjeev, [UPB[0], UPB[1] - 0.6 * U], { at: tIn + 0.5 });
  lid.to(0, { at: W("village", 4) + 0.35, dur: 0.38, w: WEIGHT.body, windup: 0, overshoot: 0 });
  steam.to(0.3, { at: W("village", 4) + 0.7, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: W("village", 4) + 0.35, what: "lid", x: DRUM_AT[0] });
  release(sanjeev, "L", { at: W("village", 4) + 0.5, dur: 0.35 });
  // he turns to the rack and sets the bottle in its place on "Lab"
  const tTurn = W("sabri") - 0.15;
  sanjeev.turnTo(1.05, { at: tTurn, dur: 0.45 });
  const tPut = W("lab", 2);
  const SPOT: Pt = [slotX(SLOT_PUT), SHELF_Y];
  lookAt(sanjeev, [SPOT[0], SPOT[1] - 0.5 * U], { at: tPut - 0.6 });
  bottle.pos.to([SPOT[0], SPOT[1] - 0.25 * U], { at: tPut - 0.15, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0, bow: 0.12 });
  bottle.pos.to(SPOT, { at: tPut, dur: 0.15, w: WEIGHT.mech, windup: 0, overshoot: 0 });
  cues.push({ t: tPut, what: "glass", x: SPOT[0] });
  release(sanjeev, "R", { at: tPut + 0.2, dur: 0.35 });
  nod(sanjeev, { at: tPut + 0.35, amount: 0.5 });

  // ==== Beat 3. "At first, nobody trusts it." Two farmers come to the door and stand there.
  const tAt = W("at", 2);
  const XF1 = 215;
  const XF2 = 85;
  f1.walkTo(XF1, { arrive: tAt + 0.35, pace: 1.6, step: 1.0 });
  f2.walkTo(XF2, { arrive: tAt + 0.75, pace: 1.6, step: 1.0 });
  cues.push({ t: tAt, what: "steps", x: 0 });
  lookAt(sanjeev, [XF1, DOOR_GROUND - 4.6 * U], { at: tAt + 0.3, dur: 0.3 });
  feel(sanjeev, EASY, { at: tAt + 0.4, dur: 0.3 });
  lookAt(f1, [XD, GY - 4.6 * U], { at: tAt + 0.5 });
  lookAt(f2, [XD, GY - 4.6 * U], { at: tAt + 0.9 });
  handsOnHips(f1, { at: W("nobody") + 0.2, dur: 0.45 });
  lookAt(f2, [XD - 200, GY - 2.0 * U], { at: W("trusts") + 0.1, dur: 0.2 });
  lookAt(f2, [XD, GY - 4.6 * U], { at: W("trusts") + 0.4, dur: 0.2 });

  // ==== Beat 4. "But slowly, farmers try it, the crop come up and word spreads." He takes them a bottle.
  const TAKE: Pt = [slotX(SLOT_TAKE), SHELF_Y];
  const bottle2 = new Prop(TAKE);
  const grip2 = (t: number): Pt => [bottle2.at(t)[0], bottle2.at(t)[1] - BOT_GRIP];
  const tTake = W("slowly") + 0.05;
  reach(sanjeev, "R", grip2(tTake), { at: tTake, dur: 0.32, hand: HANDS.grip, pin: grip2, look: true, layer: "front", contact: true });
  cues.push({ t: tTake, what: "glass", x: TAKE[0] });
  const XH = 410;
  /** where he carries it: before his chest, on the side he faces */
  const chest = (t: number): Pt => [sanjeev.x.value(t) + Math.sin(sanjeev.yaw.value(t)) * 0.38 * U, GY - 3.2 * U];
  const carrySanjeev = (t: number): Pt => [chest(t)[0], chest(t)[1] + BOT_GRIP];
  bottle2.carry = carrySanjeev;
  bottle2.held.to(1, { at: tTake + 0.45, dur: 0.4, w: WEIGHT.body, windup: 0 });
  sanjeev.turnTo(-1.05, { at: tTake + 0.65, dur: 0.45 });
  const wh = sanjeev.walkTo(XH, { start: tTake + 0.75, pace: 2.0, step: 1.1 });
  lookAt(sanjeev, [XF1, DOOR_GROUND - 4.6 * U], { at: tTake + 0.7 });
  feel(sanjeev, KEEN, { at: tTake + 0.8, dur: 0.3 });
  // he holds it out at the door; the first farmer takes it and holds it up to the light
  const OUT: Pt = [305, GY - 3.7 * U];
  const tOut = wh.arrive + 0.15;
  bottle2.pos.to([OUT[0], OUT[1] + BOT_GRIP], { at: tOut, dur: 0.02 });
  bottle2.held.to(0, { at: tOut + 0.35, dur: 0.35, w: WEIGHT.body, windup: 0 });
  release(f1, "L", { at: tOut - 0.2, dur: 0.3 });
  release(f1, "R", { at: tOut - 0.15, dur: 0.3 });
  const tGive = tOut + 0.45;
  reach(f1, "R", grip2(tGive), { at: tGive, dur: 0.32, hand: HANDS.grip, pin: grip2, look: true, layer: "front", contact: true });
  release(sanjeev, "R", { at: tGive + 0.2, dur: 0.35 });
  const LOOK_UP: Pt = [XF1 + 0.3 * U, DOOR_GROUND - 4.8 * U + BOT_GRIP];
  bottle2.pos.to(LOOK_UP, { at: tGive + 0.6, dur: 0.45, w: WEIGHT.body, windup: 0, overshoot: 0, bow: 0.1 });
  const LOW: Pt = [XF1 + 0.35 * U, DOOR_GROUND - 3.3 * U + BOT_GRIP];
  bottle2.pos.to(LOW, { at: W("spreads") + 0.8, dur: 0.45, w: WEIGHT.body, windup: 0, overshoot: 0 });
  lookAt(f1, [LOOK_UP[0], LOOK_UP[1] - BOT_GRIP], { at: tGive + 0.6 });
  nod(f1, { at: W("crop", 2) + 0.35, amount: 0.7, times: 2 });
  lookAt(f1, [XH, GY - 4.6 * U], { at: W("word") + 0.3 });
  nod(f2, { at: W("up", 2) + 0.2, amount: 0.5 });
  // a third comes to see
  f3.walkTo(-30, { arrive: W("spreads") + 0.35, pace: 1.6, step: 1.0 });
  lookAt(f3, [XH, GY - 4.6 * U], { at: W("spreads") + 0.4 });

  // ==== Beat 5. "...he does something unusual. He starts teaching everyone around him how to grow mushrooms."
  // He lifts a grow bag off the floor, holds it up for them and pats it.
  const BAG_REST: Pt = [478, GY + 0.04 * U];
  const bag = new Prop(BAG_REST);
  const tie = (t: number): Pt => [bag.at(t)[0], bag.at(t)[1] - BAG_H];
  const tBag = W("something") + 0.1;
  sanjeev.turnTo(1.0, { at: W("same") + 0.1, dur: 0.4 });
  lookAt(sanjeev, [BAG_REST[0], GY - 0.8 * U], { at: W("same") + 0.2 });
  crouch(sanjeev, 1.15, 0.85, { at: tBag, dur: 0.45 });
  reach(sanjeev, "R", tie(tBag + 0.05), { at: tBag + 0.05, dur: 0.34, hand: HANDS.grip, pin: tie, look: true, layer: "front", contact: true });
  crouch(sanjeev, 0, 0, { at: W("unusual") + 0.35, dur: 0.45 });
  bag.pos.to([BAG_REST[0] - 0.05 * U, GY - 1.6 * U], { at: W("unusual") + 0.35, dur: 0.45, w: WEIGHT.heavy, windup: 0, overshoot: 0 });
  sanjeev.turnTo(-1.05, { at: W("starts", 2) - 0.1, dur: 0.45 });
  const SHOWN: Pt = [XH - 0.6 * U, GY - 2.6 * U];
  bag.pos.to(SHOWN, { at: W("teaching") + 0.1, dur: 0.5, w: WEIGHT.body, windup: 0, overshoot: 0, bow: 0.12 });
  lookAt(sanjeev, [XF1, DOOR_GROUND - 4.6 * U], { at: W("everyone") });
  feel(sanjeev, KEEN, { at: W("teaching"), dur: 0.3 });
  const hits = pat(sanjeev, "L", [SHOWN[0] - 0.05 * U, SHOWN[1] - BAG_H * 0.45], { at: W("grow"), times: 2, every: 0.26, layer: "back" });
  cues.push({ t: W("grow"), what: "pat", x: SHOWN[0] });
  release(sanjeev, "L", { at: hits + 0.15, dur: 0.35 });
  lookAt(f1, [SHOWN[0], SHOWN[1] - 0.5 * U], { at: W("teaching") + 0.2 });
  lookAt(f2, [SHOWN[0], SHOWN[1] - 0.5 * U], { at: W("everyone") + 0.1 });
  lookAt(f3, [SHOWN[0], SHOWN[1] - 0.5 * U], { at: W("around") + 0.1 });
  nod(f2, { at: W("how", 3) + 0.1, amount: 0.6 });
  nod(f3, { at: W("mushrooms", 3) + 0.15, amount: 0.6 });

  // ==== Beat 6. "His idea is simple. Instead of a few big farms..." He gives the bag over; they go off with them.
  const GIVE_BAG: Pt = [262, GY - 2.75 * U];
  const tBagOut = W("simple") + 0.05;
  bag.pos.to(GIVE_BAG, { at: tBagOut, dur: 0.5, w: WEIGHT.body, windup: 0, overshoot: 0 });
  release(f2, "R", { at: tBagOut - 0.3, dur: 0.2 });
  reach(f2, "R", tie(tBagOut + 0.2), { at: tBagOut + 0.2, dur: 0.34, hand: HANDS.grip, pin: tie, look: true, layer: "front", contact: true });
  release(sanjeev, "R", { at: tBagOut + 0.42, dur: 0.35 });
  feel(sanjeev, PROUD, { at: tBagOut + 0.4, dur: 0.3 });
  // the farmers carry them off left, one after another
  const tGo = W("instead");
  const hangF = (a: Actor, k: number) => (t: number): Pt => [a.x.value(t) + Math.sin(a.yaw.value(t)) * k * U, a.groundY - 3.15 * U];
  bottle2.carry = (t) => (t < tGo - 0.3 ? carrySanjeev(t) : [hangF(f1, 0.35)(t)[0], hangF(f1, 0.35)(t)[1] + BOT_GRIP + 0.25 * U]);
  bottle2.held.to(1, { at: tGo, dur: 0.4, w: WEIGHT.body, windup: 0 });
  bag.carry = (t) => [hangF(f2, 0.3)(t)[0], hangF(f2, 0.3)(t)[1] + BAG_H];
  bag.held.to(1, { at: tGo + 0.6, dur: 0.4, w: WEIGHT.body, windup: 0 });
  f1.turnTo(-1.1, { at: tGo + 0.1, dur: 0.4 });
  f1.walkTo(-520, { start: tGo + 0.3, pace: 1.6, step: 1.0 });
  f2.turnTo(-1.1, { at: tGo + 0.75, dur: 0.4 });
  f2.walkTo(-560, { start: tGo + 0.95, pace: 1.6, step: 1.0 });
  f3.turnTo(-1.1, { at: tGo + 1.3, dur: 0.4 });
  f3.walkTo(-640, { start: tGo + 1.5, pace: 1.6, step: 1.0 });
  cues.push({ t: tGo + 0.4, what: "steps", x: 0 });
  // he goes to the door after them and watches them go
  // and he goes out after them, leaving the room to its racks
  lookAt(sanjeev, [-600, DOOR_GROUND - 4.4 * U], { at: W("few") });
  feel(sanjeev, PROUD, { at: W("big") + 0.1, dur: 0.3 });
  const wx = sanjeev.walkTo(-520, { start: W("farms") + 0.05, pace: 1.9, step: 1.2 });

  // ---- out: the dark jamb close to the lens slides across and covers the frame by the end (screen x of its edge)
  const jamb = new Track(-140);
  jamb.to(LAB.W + 120, { at: LAB.end, dur: 0.57, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: LAB.end - 0.4, what: "whoosh", x: 540 });

  cam.keys([
    { t: t0 - 0.3, cx: 640, cy: 900, zoom: 1.0 },
    { t: t0 + 0.4, cx: 640, cy: 900, zoom: 1.0 },
    { t: W("himself") + 0.3, cx: 600, cy: 930, zoom: 1.06 },
    { t: W("village", 4) + 0.2, cx: 610, cy: 905, zoom: 1.04 },
    { t: tPut + 0.3, cx: 640, cy: 930, zoom: 1.05 },
    { t: tAt + 0.6, cx: 470, cy: 920, zoom: 1.0 },
    { t: tGive + 0.4, cx: 400, cy: 930, zoom: 1.08 },
    { t: W("same"), cx: 440, cy: 930, zoom: 1.04 },
    { t: W("teaching"), cx: 380, cy: 935, zoom: 1.1 },
    { t: W("simple") + 0.6, cx: 360, cy: 935, zoom: 1.1 },
    { t: W("thousands") - 0.4, cx: 330, cy: 930, zoom: 1.0 },
    { t: LAB.end - 0.6, cx: 335, cy: 930, zoom: 1.02 },
    { t: LAB.end + 0.3, cx: 330, cy: 930, zoom: 1.04 },
  ]);

  const type = {
    sabri: {
      x: 92,
      y: 352,
      size: 132,
      maxW: 800,
      leading: 1.25,
      lines: [
        { lead: "SABRI", text: "", at: W("sabri") },
        { text: "SPAWN LAB", at: W("spawn", 4) },
      ],
      out: W("nobody"),
    } as PhraseCue,
    families: {
      x: 92,
      y: 345,
      size: 116,
      maxW: 800,
      leading: 1.15,
      lines: [
        { text: "THOUSANDS", at: W("thousands") },
        { text: "OF SMALL", at: W("small") },
        { lead: "FAMILIES", text: "", at: W("families") },
      ],
      out: LAB.end - 0.6,
    } as PhraseCue,
  };

  return { sanjeev, f1, f2, f3, cam, near, jamb, lid, steam, bottle, bottle2, bag, type, cues, marks: { t0, tIn, tPut, tOut: wx.arrive, tAt, tTake, tGive, tBag, tGo, pats: hits } };
}

const cam = new Camera(640, 900, 1.0);

export type LabTake = ReturnType<typeof build>;
let take: LabTake | null = null;
export function labTake(): LabTake {
  if (!take) take = build();
  return take;
}
