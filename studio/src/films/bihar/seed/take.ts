// Bihar Mushroom: sequence "seed". The same shed at night, at the bench under the lamp:
// "Think of it like this..." to "...Haryana and Delhi."
// In from `shed` by Carry: same set, same marks; Sanjeev still holds the good bottle out into the doorway and the camera
// keeps pushing in to the bench. Out to `lab` by Pass: on "Delhi" a sack is set down close to the lens and covers the frame.
import { CAST } from "../../../assets/cast/cast.ts";
import type { Cue } from "../../../engine/film.ts";
import { HANDS } from "../../../engine/figure/hand.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Blend, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { crouch, feel, handsOnHips, holdFromStart, lookAt, reach, release } from "../../../engine/motion/verbs.ts";
import { Camera } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { BOTTLE_DULL, BOTTLE_GOOD, FAILED_AT_END, FRUITING_AT_END, LOTA_AT, ROPES, SET, SHED, SHED_PALETTE, TIERS, shedTake, type BagCue } from "../shed/take.ts";
import { WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
const r2 = (v: number) => Math.round(v * 100) / 100;
export const SEED = { W: 1080, HGT: 1920, U: SHED.U, GY: SHED.GY, fps: 30, t0: r2(ANCHOR("think")), end: r2(ANCHOR("so", 2)) } as const;
/** the same room, so the same colours */
export const SEED_PALETTE = SHED_PALETTE;
export const WALL_DEPTH = 0.1;

const { U, GY } = SEED;
/** where people stand in the doorway */
const DOOR_GROUND = SET.junction + 1.0 * U;
/** the two sacks the porters throw down inside the door: middle of where each comes to rest */
export const SACK_REST: Pt[] = [
  [318, GY + 0.05 * U - 0.3 * U],
  [196, GY + 0.22 * U - 0.3 * U],
];

const FOCUS: Expression = { lidU: 0.8, lidL: 0.82, browRaise: 0.1, browTilt: -0.05, smile: 0.04, open: 0, wide: 0, jaw: 0 };
const SUNK: Expression = { lidU: 0.78, lidL: 0.95, browRaise: 0.55, browTilt: -0.85, smile: -0.3, open: 0, wide: 0.1, jaw: 0 };
const WONDER: Expression = { lidU: 1, lidL: 0.7, browRaise: 0.75, browTilt: -0.35, smile: 0.35, open: 0.08, wide: 0.2, jaw: 0.04 };
const HOPE: Expression = { lidU: 0.96, lidL: 0.8, browRaise: 0.6, browTilt: -0.45, smile: 0.3, open: 0, wide: 0.1, jaw: 0 };

function build() {
  const W = ANCHOR;
  const t0 = SEED.t0;
  const cues: Cue[] = [];
  const shed = shedTake();
  const RAISE = shed.raise;

  // ---- the people
  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: 505, yaw: -1.0, seed: 4 });
  sanjeev.face = new Blend<Expression>(WONDER, mixFace);
  const farmer = new Actor({ ch: CAST.sonB, scale: U, groundY: DOOR_GROUND, x: -330, yaw: 1.1, seed: 11 });
  const porter1 = new Actor({ ch: CAST.porter, scale: U, groundY: DOOR_GROUND - 6, x: -360, yaw: 1.1, seed: 13 });
  const porter2 = new Actor({ ch: CAST.sonA, scale: U, groundY: DOOR_GROUND + 10, x: -560, yaw: 1.1, seed: 17 });
  const cam = new Camera(shed.cam.view(t0).cx, shed.cam.view(t0).cy, shed.cam.view(t0).zoom);

  // ---- the bags as the shed left them; on "fails" the rest of the row goes too
  const bags: BagCue[] = [];
  ROPES.forEach((x, i) => {
    for (let k = 0; k < 2; k++) {
      const id = `bag${i}_${k}`;
      bags.push({ id, x, tier: k, sprout: new Track(id === FRUITING_AT_END ? 1 : 0), failed: new Track(FAILED_AT_END.includes(id) ? 1 : 0), seed: 3 + i * 2 + k });
    }
  });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 1. "Think of it like this." Night has come; the lamp is lit. He sets the good bottle down by the dull one.
  // ------------------------------------------------------------------------------------------------------------
  holdFromStart(sanjeev, "R", () => RAISE, { hand: HANDS.grip, palm: 1, layer: "back" });
  handsOnHips(sanjeev, { at: t0 - 0.3, dur: 0.3, sides: ["L"] });
  const lamp = new Track(0);
  lamp.to(1, { at: t0 + 0.6, dur: 0.45, w: WEIGHT.body, windup: 0, overshoot: 0 });
  const night = new Track(0);
  night.to(1, { at: t0 + 1.3, dur: 1.2, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: t0 + 0.2, what: "lamp", x: 604 });
  const tSet = W("this");
  const goodGrip: Pt = [BOTTLE_GOOD[0], BOTTLE_GOOD[1] - 0.3 * U];
  lookAt(sanjeev, [BOTTLE_GOOD[0], BOTTLE_GOOD[1] - 0.4 * U], { at: tSet - 0.35 });
  reach(sanjeev, "R", goodGrip, { at: tSet, dur: 0.6, hand: HANDS.grip, palm: 1, contact: true, look: false, layer: "back" });
  feel(sanjeev, FOCUS, { at: tSet - 0.1, dur: 0.3 });
  cues.push({ t: tSet, what: "glass", x: BOTTLE_GOOD[0] });
  release(sanjeev, "R", { at: tSet + 0.35, dur: 0.4 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 2. "If the seed is bad, the whole crop fails, no matter how hard you work."
  // He tips the dull bottle: grey-green grain. On "fails" the row of bags behind sags and darkens; he waters it anyway.
  // ------------------------------------------------------------------------------------------------------------
  const tSeed = W("seed", 3);
  const tBad = W("bad");
  crouch(sanjeev, 0.1, 0.36, { at: tSeed - 0.05, dur: 0.4 });
  const dullGrip: Pt = [BOTTLE_DULL[0], BOTTLE_DULL[1] - 0.3 * U];
  reach(sanjeev, "L", dullGrip, { at: tSeed, dur: 0.36, hand: HANDS.grip, palm: -1, contact: true, layer: "front", body: false });
  const SHOW: Pt = [418, 1010];
  reach(sanjeev, "L", SHOW, { at: tBad + 0.08, dur: 0.3, hand: HANDS.grip, palm: -1, pin: true, look: false, body: false, layer: "front" });
  const dullTilt = new Track(0);
  dullTilt.to(-0.7, { at: tBad + 0.3, dur: 0.3, w: WEIGHT.hand });
  lookAt(sanjeev, [SHOW[0] - 20, SHOW[1] - 0.3 * U], { at: tBad });
  feel(sanjeev, SUNK, { at: tBad + 0.25, dur: 0.25 });
  dullTilt.to(0, { at: W("crop") - 0.05, dur: 0.25, w: WEIGHT.hand });
  const tDullBack = W("crop") + 0.2;
  reach(sanjeev, "L", dullGrip, { at: tDullBack, dur: 0.3, hand: HANDS.grip, palm: -1, contact: true, look: false, layer: "front", body: false });
  cues.push({ t: tDullBack, what: "glass", x: BOTTLE_DULL[0] });
  const tFails = W("fails");
  let j = 0;
  for (const b of bags) {
    if (b.failed.value(t0) > 0.5 || b.id === FRUITING_AT_END) continue;
    b.failed.to(1, { at: tFails + 0.2 + 0.09 * j++, dur: 0.6, w: WEIGHT.body, windup: 0, overshoot: 0 });
  }
  cues.push({ t: tFails + 0.1, what: "creak", x: 900 });
  lookAt(sanjeev, [760, 900], { at: tFails + 0.1 });
  // the lota from the bench; he straightens only once the words have gone
  const tLota = W("no") + 0.3;
  reach(sanjeev, "L", [LOTA_AT[0] + 4, LOTA_AT[1] - 0.25 * U], { at: tLota, dur: 0.4, hand: HANDS.grip, palm: -1, contact: true, layer: "front" });
  sanjeev.drop.to(0, { at: tLota + 0.4, dur: 0.4, w: WEIGHT.body });
  sanjeev.bend.to(0, { at: tLota + 0.42, dur: 0.4, w: WEIGHT.body });
  sanjeev.lean.to(0, { at: tLota + 0.4, dur: 0.4, w: WEIGHT.body });
  sanjeev.turnTo(0.95, { at: tLota + 0.55, dur: 0.45 });
  const POUR: Pt = [640, 925];
  const tWork = W("work");
  reach(sanjeev, "L", POUR, { at: tWork - 0.15, dur: 0.4, hand: HANDS.grip, palm: 1, pin: true, look: false, layer: "back" });
  const lotaTilt = new Track(0);
  lotaTilt.to(1.55, { at: tWork + 0.1, dur: 0.3, w: WEIGHT.hand });
  lookAt(sanjeev, [700, 1000], { at: tWork - 0.3 });
  cues.push({ t: tWork + 0.05, what: "water", x: 700 });
  lotaTilt.to(0, { at: tWork + 0.6, dur: 0.3, w: WEIGHT.hand });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 3. "And farmers in Bihar simply didn't believe good spawn could be made in Bihar."
  // A farmer in the doorway; Sanjeev holds the good bottle out to him; he shakes his head and goes.
  // ------------------------------------------------------------------------------------------------------------
  const tAnd = W("and", 6);
  const fIn = farmer.walkTo(170, { arrive: tAnd + 0.75, pace: 1.6, step: 1.0 });
  cues.push({ t: tAnd, what: "steps", x: 0 });
  sanjeev.turnTo(-1.0, { at: tAnd + 0.35, dur: 0.45 });
  lookAt(sanjeev, [170, 800], { at: tAnd + 0.4 });
  // the lota goes back on the bench
  const tLotaBack = tAnd + 0.75;
  reach(sanjeev, "L", [LOTA_AT[0] + 4, LOTA_AT[1] - 0.25 * U], { at: tLotaBack, dur: 0.4, hand: HANDS.grip, palm: -1, contact: true, layer: "front" });
  release(sanjeev, "L", { at: tLotaBack + 0.35, dur: 0.4 });
  lookAt(farmer, [505, 760], { at: fIn.arrive - 0.2 });
  const tGood = W("good");
  reach(sanjeev, "R", goodGrip, { at: tGood - 0.5, dur: 0.4, hand: HANDS.grip, palm: 1, contact: true, layer: "back" });
  const OFFER: Pt = [262, 830];
  reach(sanjeev, "R", OFFER, { at: tGood + 0.1, dur: 0.45, hand: HANDS.grip, palm: 1, pin: true, look: false, layer: "back" });
  feel(sanjeev, HOPE, { at: tGood, dur: 0.3 });
  lookAt(sanjeev, eyesAt(farmer, fIn.arrive), { at: tGood + 0.2 });
  // he shakes his head: no
  const tNo = W("could") + 0.05;
  lookAt(farmer, [OFFER[0], OFFER[1] - 40], { at: tGood + 0.1 });
  const ht = farmer.headTurn.value(tNo);
  farmer.headTurn.to(ht + 0.24, { at: tNo, dur: 0.18, w: WEIGHT.head });
  farmer.headTurn.to(ht - 0.24, { at: tNo + 0.24, dur: 0.2, w: WEIGHT.head });
  farmer.headTurn.to(ht + 0.18, { at: tNo + 0.48, dur: 0.2, w: WEIGHT.head });
  farmer.headTurn.to(ht, { at: tNo + 0.74, dur: 0.22, w: WEIGHT.head });
  farmer.turnTo(-1.1, { at: tNo + 0.95, dur: 0.4 });
  farmer.walkTo(-480, { start: tNo + 1.1, pace: 1.7, step: 1.0 });
  feel(sanjeev, SUNK, { at: tNo + 0.6, dur: 0.3 });
  const tBottleBack = W("so") + 0.05;
  reach(sanjeev, "R", goodGrip, { at: tBottleBack, dur: 0.42, hand: HANDS.grip, palm: 1, contact: true, look: false, layer: "back" });
  cues.push({ t: tBottleBack, what: "glass", x: BOTTLE_GOOD[0] });
  release(sanjeev, "R", { at: tBottleBack + 0.3, dur: 0.4 });

  // ------------------------------------------------------------------------------------------------------------
  // Beat 4. "So it came from Punjab, Haryana and Delhi." Porters bring sacks in and throw them down, each on its word;
  // the third is set down close to the lens and covers the frame.
  // ------------------------------------------------------------------------------------------------------------
  const tPunjab = W("punjab");
  const tHaryana = W("haryana", 3);
  const tDelhi = W("delhi");
  sanjeev.turnTo(0.95, { at: tBottleBack + 0.35, dur: 0.4 });
  sanjeev.walkTo(800, { start: tBottleBack + 0.5, pace: 2.0, step: 1.2 });
  sanjeev.turnTo(-1.0, { at: tHaryana - 0.1, dur: 0.45 });
  lookAt(sanjeev, [250, 1300], { at: tHaryana + 0.3 });
  feel(sanjeev, FOCUS, { at: tHaryana + 0.3, dur: 0.3 });
  const p1 = porter1.walkTo(230, { arrive: tPunjab - 0.35, pace: 1.9, step: 1.1 });
  const p2 = porter2.walkTo(110, { arrive: tHaryana - 0.3, pace: 1.9, step: 1.1 });
  cues.push({ t: p1.start + 0.2, what: "steps", x: -100 });
  /** each sack: on the porter's head until it is thrown, then an arc down to the floor, where it settles */
  const throws = [
    { who: porter1, land: tPunjab, rest: SACK_REST[0] },
    { who: porter2, land: tHaryana, rest: SACK_REST[1] },
  ].map((s) => {
    const fly = new Track(0);
    fly.to(1, { at: s.land, dur: 0.42, w: WEIGHT.mech, windup: 0, overshoot: 0 });
    const slump = new Track(0);
    slump.to(1, { at: s.land + 0.2, dur: 0.25, w: WEIGHT.heavy, windup: 0 });
    const onHead = (t: number): Pt => [s.who.x.value(t) + 0.12 * U, s.who.groundY - 5.95 * U];
    const at = (t: number): { c: Pt; tilt: number } => {
      const f = fly.value(t);
      const h = onHead(Math.min(t, s.land - 0.42));
      const c: Pt = [h[0] + (s.rest[0] - h[0]) * f, h[1] + (s.rest[1] - h[1]) * f - Math.sin(Math.PI * f) * 0.5 * U];
      return { c, tilt: 0.35 * f };
    };
    // the far hand steadies the sack on the head, and lets go as it is thrown
    holdFromStart(s.who, "L", (t) => [at(t).c[0] - 0.42 * U, at(t).c[1] + 0.2 * U], { hand: HANDS.grip, palm: 1, layer: "back" });
    release(s.who, "L", { at: s.land - 0.3, dur: 0.35 });
    s.who.lean.to(0.12, { at: s.land - 0.1, dur: 0.3, w: WEIGHT.body });
    s.who.lean.to(0, { at: s.land + 0.45, dur: 0.4, w: WEIGHT.body });
    cues.push({ t: s.land, what: "thud", x: s.rest[0] });
    cam.shake(s.land, 3, 0.25);
    return { fly, slump, at, land: s.land };
  });
  // the third: close to the lens, it comes down and fills the frame (screen coordinates)
  const near = new Track(-1700);
  const tNear = tDelhi + 0.16;
  near.to(SEED.HGT / 2, { at: tNear, dur: 0.5, w: { overshoot: 0.02, settle: 0.3, zeta: 0.5, windup: 0, windupTime: 0 } });
  cues.push({ t: tNear, what: "thud", x: 540 });
  cam.shake(tNear, 5, 0.3);

  // ------------------------------------------------------------------------------------------------------------
  // Camera: on from where `shed` left it, in to the bench; back for the row; then the door
  // ------------------------------------------------------------------------------------------------------------
  const v0 = shed.cam.view(t0 - 0.3);
  const v1 = shed.cam.view(t0);
  cam.keys([
    { t: t0 - 0.3, cx: v0.cx, cy: v0.cy, zoom: v0.zoom },
    { t: t0, cx: v1.cx, cy: v1.cy, zoom: v1.zoom },
    { t: tSet + 0.1, cx: 450, cy: 1005, zoom: 1.26 },
    { t: W("whole") - 0.25, cx: 620, cy: 900, zoom: 1.0 },
    { t: tWork, cx: 630, cy: 902, zoom: 1.01 },
    { t: tAnd + 0.6, cx: 560, cy: 900, zoom: 1.04 },
    { t: W("so") - 0.2, cx: 552, cy: 902, zoom: 1.05 },
    { t: tDelhi, cx: 525, cy: 910, zoom: 1.08 },
    { t: SEED.end + 0.3, cx: 520, cy: 912, zoom: 1.09 },
  ]);

  // ------------------------------------------------------------------------------------------------------------
  // What is written on the wall, each piece landing on its word (ink only: the wall is in lamplight)
  // ------------------------------------------------------------------------------------------------------------
  const type = {
    fails: {
      x: 190,
      y: 312,
      size: 140,
      maxW: 700,
      leading: 1.25,
      lines: [
        { text: "THE WHOLE", at: W("whole") },
        { text: "CROP", at: W("crop") },
        { text: "FAILS", at: tFails },
      ],
      out: tFails + 0.5,
    } as PhraseCue,
    from: {
      x: 340,
      y: 326,
      size: 130,
      maxW: 470,
      leading: 1.2,
      lines: [
        { text: "PUNJAB", at: tPunjab },
        { text: "HARYANA", at: tHaryana },
        { text: "DELHI", at: tDelhi },
      ],
      out: tNear + 0.2,
    } as PhraseCue,
  };

  return {
    sanjeev,
    farmer,
    porter1,
    porter2,
    cam,
    bags,
    lamp,
    night,
    dullTilt,
    lotaTilt,
    throws,
    near,
    type,
    cues,
    marks: { t0, tSet, tSeed, tBad, tDullBack, tFails, tLota, tWork, tAnd, tLotaBack, tGood, tNo, tBottleBack, tPunjab, tHaryana, tDelhi, tNear, farmerIn: fIn.arrive, p1: p1.arrive, p2: p2.arrive },
  };
}

/** where an actor's eyes will be (for a look), without solving the whole pose */
function eyesAt(a: Actor, t: number): Pt {
  return [a.x.value(t) + 0.2 * a.H, a.groundY - 5.3 * a.H];
}

export type SeedTake = ReturnType<typeof build>;
let take: SeedTake | null = null;
export function seedTake(): SeedTake {
  if (!take) take = build();
  return take;
}
