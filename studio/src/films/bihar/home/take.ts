// Bihar Mushroom: sequence "home". The same lane in the early 2000s, late afternoon, sun low at right.
// Sanjeev walks in with his tin trunk and his rolled degree and sets the trunk down; his father comes out to him, looks
// at the degree and points him to the far city. Sanjeev turns away to the straw stack and takes up a handful instead.
// In 2002 he picks up the trunk and walks off left toward the hills while his father calls after him; he comes back in
// carrying two grow bags past his father and goes into the dark doorway of the thatched shed.
import { CAST } from "../../../assets/cast/cast.ts";
import { thatchShed } from "../../../assets/sets/village.ts";
import type { Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Prop } from "../../../engine/motion/prop.ts";
import { Blend, Path2, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { callOut, crouch, feel, handsOnHips, holdFromStart, lookAt, nod, reach, release } from "../../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { DEPTH, LANE, LANE_PALETTE } from "../s1/lane.ts";
import { WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
const r2 = (v: number) => Math.round(v * 100) / 100;
export const HOME = { ...LANE, fps: 30, t0: r2(ANCHOR("sanjeev")), end: r2(ANCHOR("and", 4)) + 0.04 } as const;
export const HOME_PALETTE: Palette = LANE_PALETTE;
const { U, GY } = HOME;
const FRAME = { width: HOME.W, height: HOME.HGT };
const REF = { cx: HOME.W / 2, cy: HOME.HGT / 2 };
/** the thatched shed, by the lane at full size, so a man can walk into its doorway */
export const BIG_SHED = thatchShed("bigshed", { x: 1260, foot: GY, u: 261, seed: 5 });
/** the straw stack he turns to instead of the city */
export const STRAW = { x: 872, w: 1.7 * U, h: 1.15 * U };
/** size unit of the tin trunk (it is 1.3 of these long) */
export const TRUNK_U = 1.1 * U;
/** the father stands a little further back than the lane's front line, so his son can pass in front of him */
const FATHER_GY = GY - 26;

const PROUD: Expression = { lidU: 0.88, lidL: 0.58, browRaise: 0.45, browTilt: -0.2, smile: 0.8, open: 0, wide: 0.2, jaw: 0 };
const SURE: Expression = { lidU: 0.86, lidL: 0.6, browRaise: 0.25, browTilt: -0.35, smile: 0.35, open: 0, wide: 0.1, jaw: 0 };
const STERN: Expression = { lidU: 0.8, lidL: 0.6, browRaise: 0.1, browTilt: 0.45, smile: -0.25, open: 0, wide: 0.05, jaw: 0 };
const WORRY: Expression = { lidU: 0.84, lidL: 0.7, browRaise: 0.6, browTilt: 0.5, smile: -0.2, open: 0.05, wide: 0.1, jaw: 0 };

function build() {
  const W = ANCHOR;
  const cues: Cue[] = [];
  const door = BIG_SHED.door;
  const dc: Pt = [(door.x0 + door.x1) / 2, (door.y0 + door.y1) / 2];

  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: -300, yaw: 1.1, seed: 12 });
  sanjeev.face = new Blend<Expression>(SURE, mixFace);
  const father = new Actor({ ch: CAST.father, scale: U, groundY: FATHER_GY, x: -420, yaw: 1.1, seed: 31 });
  father.face = new Blend<Expression>(SURE, mixFace);
  const PY = sanjeev.pelvis(-1)[1];
  /** where a hand hangs at his side with something heavy in it */
  const hang = (a: Actor, py0: number, fwd = 0.06) => (t: number): Pt => {
    const p = a.pelvis(t);
    return [p[0] + Math.sin(a.yaw.value(t)) * fwd * U, p[1] + (GY - 3.18 * U - py0)];
  };
  const side = hang(sanjeev, PY);

  // ---- the trunk: carried in his far hand when he walks in, set down on "finished", taken up again in 2002
  const trunk = new Prop([0, GY]);
  trunk.held = new Track(1);
  trunk.carry = (t) => [side(t)[0], side(t)[1] + 0.79 * TRUNK_U];
  const handle = (t: number): Pt => [trunk.at(t)[0], trunk.at(t)[1] - 0.79 * TRUNK_U];
  holdFromStart(sanjeev, "L", handle, { hand: HANDS.grip, layer: "back" });
  // ---- the degree: rolled, in his near hand
  const DEG_LOW = (t: number): Pt => {
    const p = sanjeev.pelvis(t);
    return [p[0] + Math.sin(sanjeev.yaw.value(t)) * 0.42 * U, p[1] - 0.05 * U];
  };
  holdFromStart(sanjeev, "R", DEG_LOW, { hand: HANDS.grip, layer: "front" });

  // ==== Beat 1. "Sanjeev Kumar has just finished electrical engineering at BIT Sindhri."
  const XS = 560;
  const wi = sanjeev.walkTo(XS, { arrive: W("finished"), pace: 1.9, step: 1.35 });
  lookAt(sanjeev, [XS + 600, GY - 4.4 * U], { at: HOME.t0 + 0.1 });
  const tDown = W("finished") + 0.32;
  crouch(sanjeev, 0.34, 0.24, { at: tDown, dur: 0.34 });
  const TRUNK_AT = XS - 0.62 * U;
  trunk.pos = new Path2([TRUNK_AT, GY]);
  trunk.held.to(0, { at: tDown + 0.06, dur: 0.36, w: WEIGHT.heavy, windup: 0 });
  cues.push({ t: tDown + 0.06, what: "thud.sack", x: XS });
  release(sanjeev, "L", { at: tDown + 0.2, dur: 0.35 });
  crouch(sanjeev, 0, 0, { at: tDown + 0.62, dur: 0.42 });
  // he lifts the degree on "BIT Sindhri", pleased with it
  const tBit = W("bit");
  const UP: Pt = [XS + 1.0 * U, GY - 4.55 * U];
  reach(sanjeev, "R", UP, { at: tBit + 0.25, dur: 0.6, hand: HANDS.grip, pin: true, look: true, layer: "front", bow: 0.18 });
  feel(sanjeev, PROUD, { at: tBit + 0.2, dur: 0.3 });
  sanjeev.lean.to(-0.05, { at: tBit + 0.2, dur: 0.4, w: WEIGHT.body, windup: 0 });
  sanjeev.lean.to(0, { at: W("now") + 0.3, dur: 0.5, w: WEIGHT.body, windup: 0 });

  // ==== Beat 2. "Now, in a village like Nalanda, an engineering degree means one thing." His father comes out to him.
  const XF = 250;
  const fw = father.walkTo(XF, { arrive: W("nalanda") + 0.1, pace: 1.6, step: 1.0 });
  cues.push({ t: W("now"), what: "door.brush", x: 0 });
  lookAt(father, [XS, GY - 4.6 * U], { at: W("now") + 0.2 });
  sanjeev.turnTo(-1.05, { at: W("village", 2) + 0.15, dur: 0.5 });
  lookAt(sanjeev, [XF, GY - 4.7 * U], { at: W("village", 2) });
  feel(sanjeev, SURE, { at: W("village", 2) + 0.2, dur: 0.3 });
  // he holds the degree out for his father to see
  reach(sanjeev, "R", [XS - 0.15 * U, GY - 3.8 * U], { at: W("village", 2) + 0.8, dur: 0.4, hand: HANDS.grip, pin: true, look: false, layer: "back" });
  const OFFER: Pt = [XS - 0.85 * U, GY - 3.95 * U];
  reach(sanjeev, "R", OFFER, { at: W("degree") + 0.05, dur: 0.36, hand: HANDS.grip, pin: true, look: false, layer: "back", bow: 0.1 });
  lookAt(father, OFFER, { at: W("degree") + 0.1, dur: 0.25 });
  feel(father, PROUD, { at: W("means") + 0.1, dur: 0.3 });
  nod(father, { at: W("one thing") + 0.05, amount: 0.7, times: 2 });
  lookAt(father, [XS, GY - 4.6 * U], { at: W("thing") + 0.1 });

  // ==== Beat 3. "Go to a city, get a job and settle down." The father points to the far city.
  const CITY: Pt = [XF + 1.15 * U, GY - 6.0 * U];
  reach(father, "R", CITY, { at: W("go to a city") + 0.3, dur: 0.42, hand: HANDS.point, pin: true, look: true, body: false, layer: "front", bow: 0.12 });
  feel(father, STERN, { at: W("go to a city") + 0.2, dur: 0.3 });
  lookAt(father, [2400, 700], { at: W("city") + 0.1 });
  reach(sanjeev, "R", [XS - 0.12 * U, GY - 3.6 * U], { at: W("go to a city") + 0.25, dur: 0.35, hand: HANDS.grip, pin: true, look: false, layer: "back" });
  sanjeev.turnTo(1.05, { at: W("city") + 0.25, dur: 0.5 });
  lookAt(sanjeev, [2400, 760], { at: W("city") + 0.15 });
  reach(sanjeev, "R", DEG_LOW(W("get") + 0.4), { at: W("get") + 0.4, dur: 0.4, hand: HANDS.grip, pin: DEG_LOW, look: false, layer: "front" });
  feel(sanjeev, WORRY, { at: W("job"), dur: 0.35 });
  cues.push({ t: 20.6, what: "horn.far", x: 1080 });
  release(father, "R", { at: W("down") + 0.35, dur: 0.45 });
  lookAt(father, [XS + 40, GY - 4.6 * U], { at: W("down") + 0.2 });
  feel(father, SURE, { at: W("down") + 0.3, dur: 0.3 });

  // ==== Beat 4. "But Sanjeev comes from a farming family and he has a different idea." He turns to the straw.
  lookAt(sanjeev, [XF, GY - 4.6 * U], { at: W("but") + 0.05, dur: 0.22 });
  lookAt(sanjeev, [STRAW.x, GY - 1.0 * U], { at: W("comes") + 0.15, dur: 0.3 });
  feel(sanjeev, SURE, { at: W("comes") + 0.1, dur: 0.3 });
  const XW = 668;
  const ws = sanjeev.walkTo(XW, { start: W("from a farming") - 0.05, pace: 1.3, step: 0.8 });
  const GRAB: Pt = [STRAW.x - STRAW.w / 2 + 0.05 * U, GY - 1.05 * U];
  const tCrouch = Math.max(ws.arrive + 0.1, W("family") + 0.15);
  crouch(sanjeev, 0.85, 0.6, { at: tCrouch, dur: 0.45 });
  reach(sanjeev, "L", GRAB, { at: tCrouch + 0.08, dur: 0.38, hand: HANDS.grip, pin: true, look: true, layer: "back", contact: true });
  const tHandful = tCrouch + 0.08;
  crouch(sanjeev, 0, 0, { at: W("different") + 0.15, dur: 0.5 });
  reach(sanjeev, "L", [XW + 0.5 * U, GY - 2.9 * U], { at: W("different") + 0.12, dur: 0.36, hand: HANDS.grip, pin: true, look: false, layer: "back" });
  const SHOW: Pt = [XW + 0.95 * U, GY - 4.5 * U];
  reach(sanjeev, "L", SHOW, { at: W("idea") + 0.12, dur: 0.42, hand: HANDS.grip, pin: true, look: true, layer: "front", bow: 0.16 });
  feel(sanjeev, PROUD, { at: W("idea") + 0.2, dur: 0.35 });
  // his father folds his arms, and does not like it
  lookAt(father, [XW, GY - 3.0 * U], { at: W("family") });
  handsOnHips(father, { at: W("family") + 0.2, dur: 0.45 });
  feel(father, WORRY, { at: W("idea") + 0.1, dur: 0.35 });

  // ==== Beat 5. "In 2002, he goes all the way to Solan in Himachal to learn mushroom farming."
  // He lets the straw fall, takes up his trunk and walks off left toward the hills; his father calls after him.
  const tDrop = W("2002") - 0.25;
  release(sanjeev, "L", { at: tDrop + 0.1, dur: 0.35 });
  sanjeev.turnTo(-1.1, { at: W("2002") + 0.2, dur: 0.45 });
  lookAt(sanjeev, [-1500, 900], { at: W("2002") });
  const wt = sanjeev.walkTo(TRUNK_AT + 0.06 * U, { start: W("2002") + 0.45, pace: 1.2, step: 0.7 });
  const tTake = Math.max(W("goes") - 0.1, wt.arrive + 0.08);
  const PICK_X = XW - 0.05 * U;
  crouch(sanjeev, 1.2, 0.85, { at: tTake - 0.06, dur: 0.42 });
  reach(sanjeev, "L", handle(tTake), { at: tTake + 0.02, dur: 0.3, hand: HANDS.grip, pin: handle, look: true, layer: "front", contact: true });
  trunk.held.to(1, { at: tTake + 0.42, dur: 0.38, w: WEIGHT.heavy, windup: 0 });
  crouch(sanjeev, 0, 0, { at: tTake + 0.45, dur: 0.38 });
  cues.push({ t: tTake + 0.05, what: "heave", x: PICK_X });
  const wo = sanjeev.walkTo(-400, { start: tTake + 0.5, pace: 2.6, step: 1.45 });
  feel(sanjeev, SURE, { at: tTake + 0.4, dur: 0.3 });
  release(father, "L", { at: tTake + 0.2, dur: 0.35 });
  release(father, "R", { at: tTake + 0.25, dur: 0.35 });
  lookAt(father, [XF - 200, GY - 4.6 * U], { at: W("all") });
  father.turnTo(-1.1, { at: W("way") + 0.15, dur: 0.5 });
  const tCall = callOut(father, "L", { at: W("solan") + 0.1, hold: 0.55 });
  feel(father, WORRY, { at: tCall + 0.1, dur: 0.3 });
  // ==== "...to learn mushroom farming." He is gone; his father turns back to the lane, shaking his head.
  father.turnTo(1.1, { at: W("learn") + 0.15, dur: 0.55 });
  lookAt(father, [XF + 500, GY - 1.2 * U], { at: W("learn") + 0.3 });
  lookAt(father, [XF + 300, GY - 1.0 * U], { at: W("mushroom farming") + 0.25, dur: 0.3 });
  lookAt(father, [XF + 520, GY - 1.1 * U], { at: W("learn") + 0.95, dur: 0.3 });
  handsOnHips(father, { at: W("learn") + 1.25, dur: 0.45 });

  // ==== Beat 6. "Then he comes back to his village and starts growing them." Back in with two grow bags.
  const bagFar = hang(sanjeev, PY, 0.02);
  const bagNear = (t: number): Pt => {
    const p = sanjeev.pelvis(t);
    return [p[0] + Math.sin(sanjeev.yaw.value(t)) * 0.12 * U, p[1] + (GY - 3.22 * U - PY)];
  };
  const tSwap = wo.arrive + 0.05;
  sanjeev.turnTo(1.1, { at: tSwap + 0.2, dur: 0.3 });
  reach(sanjeev, "R", bagNear(tSwap + 0.3), { at: tSwap + 0.3, dur: 0.2, hand: HANDS.grip, pin: bagNear, look: false, layer: "front" });
  reach(sanjeev, "L", bagFar(tSwap + 0.3), { at: tSwap + 0.3, dur: 0.2, hand: HANDS.grip, pin: bagFar, look: false, layer: "back" });
    const wd = sanjeev.walkTo(dc[0] + 0.1 * U, { start: tSwap + 0.3, pace: 2.75, step: 1.55 });
  const tBack = wd.start;
  lookAt(sanjeev, [dc[0], GY - 4.0 * U], { at: tBack + 0.3 });
  feel(sanjeev, PROUD, { at: tBack + 0.4, dur: 0.3 });
  lookAt(father, [-200, GY - 4.4 * U], { at: tBack + 0.2 });
  lookAt(father, [dc[0], GY - 4.0 * U], { at: W("village", 3) + 0.1, dur: 0.6 });
  feel(father, STERN, { at: W("village", 3), dur: 0.3 });
  sanjeev.drop.to(0.55, { at: W("growing"), dur: 0.35, w: WEIGHT.body, windup: 0 });
  sanjeev.bend.to(0.45, { at: W("growing") + 0.02, dur: 0.35, w: WEIGHT.body, windup: 0 });
  const tVeil0 = W("growing") + 0.05;
  const tVeil1 = W("them") + 0.35;
  cues.push({ t: 16.6, what: "hen" }, { t: W("growing"), what: "door.brush", x: dc[0] });

  const cam = new Camera(420, 950, 1.06);
  cam.keys([
    { t: HOME.t0 - 0.3, cx: 420, cy: 950, zoom: 1.06 },
    { t: 14.2, cx: 470, cy: 940, zoom: 1.04 },
    { t: 16.0, cx: 470, cy: 940, zoom: 1.05 },
    { t: 17.9, cx: 410, cy: 955, zoom: 1.0 },
    { t: 20.2, cx: 430, cy: 955, zoom: 1.02 },
    { t: 22.2, cx: 690, cy: 950, zoom: 0.93 },
    { t: 23.6, cx: 640, cy: 955, zoom: 0.98 },
    { t: 25.9, cx: 650, cy: 935, zoom: 1.06 },
    { t: 27.3, cx: 560, cy: 950, zoom: 1.0 },
    { t: 29.3, cx: 190, cy: 950, zoom: 0.95 },
    { t: 31.2, cx: 230, cy: 950, zoom: 0.97 },
    { t: 32.4, cx: 520, cy: 955, zoom: 1.0 },
    { t: 33.3, cx: dc[0] - 260, cy: 1010, zoom: 1.2 },
    { t: 33.8, cx: dc[0] - 60, cy: 1060, zoom: 1.5 },
    { t: 34.62, cx: dc[0], cy: dc[1], zoom: 3.3 },
    { t: HOME.end + 0.3, cx: dc[0], cy: dc[1], zoom: 3.32 },
  ]);
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };

  // across the sky, one block at a time
  const a1 = under(W("sanjeev"), DEPTH.type, 92, 330);
  const a2 = under(W("bit"), DEPTH.type, 92, 362);
  const a3 = under(W("nalanda"), DEPTH.type, 92, 430);
  const a4 = under(W("2002"), DEPTH.type, 92, 374);
  const a5 = under(W("solan"), DEPTH.type, 92, 336);
  const type = {
    name: { x: a1[0], y: a1[1], size: 100, maxW: 790, leading: 1.4, lines: [{ text: "SANJEEV", at: W("sanjeev") }, { lead: "KUMAR", text: "", at: W("kumar") }], out: W("at") - 0.3 } as PhraseCue,
    bit: { x: a2[0], y: a2[1], size: 150, maxW: 720, lines: [{ lead: "BIT SINDRI", text: "", at: W("bit") }], out: W("now") + 0.2 } as PhraseCue,
    nalanda: { x: a3[0], y: a3[1], size: 150, maxW: 700, lines: [{ lead: "NALANDA", text: "", at: W("nalanda") }], out: W("go to a city") - 0.4 } as PhraseCue,
    year: { x: a4[0], y: a4[1], size: 150, maxW: 700, lines: [{ text: "2002", at: W("2002") }], out: W("solan") - 0.15 } as PhraseCue,
    solan: { x: a5[0], y: a5[1], size: 104, maxW: 790, leading: 1.4, lines: [{ text: "SOLAN", at: W("solan") }, { text: "HIMACHAL", at: W("himachal") }], out: W("then") - 0.3 } as PhraseCue,
  };

  return {
    cam,
    sanjeev,
    father,
    trunk,
    door,
    type,
    cues,
    marks: { tIn: wi.arrive, tFather: fw.arrive, tHandful, tDrop, tSwap, tBack, tDoor: wd.arrive, tVeil0, tVeil1 },
  };
}

export type HomeTake = ReturnType<typeof build>;
let take: HomeTake | null = null;
export function homeTake(): HomeTake {
  if (!take) take = build();
  return take;
}
