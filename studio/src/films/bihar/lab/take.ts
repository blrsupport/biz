// Bihar Mushroom: sequence "lab". The shed made into the spawn lab, morning: "So Sanjeev decides..." to "...a little each."
// Kept to its simplest form: the sack close to the lens lifts away (Pass in from `seed`) on the whitewashed room with two
// racks of bottles and the steaming drum; Sanjeev at the racks; farmers come to the door, stand, and go; the board's type.
// Out to `today` by Pass: from about 87.9 a dark jamb slides across the lens and covers the frame by 88.47.
import { CAST, CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { MUSHROOM_PALETTE } from "../../../assets/props/mushroom.ts";
import { LAB_PALETTE as LAB_SET_PALETTE, buildShed } from "../../../assets/sets/shed.ts";
import { mergePalettes, type Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { mixFace, type Expression } from "../../../engine/figure/head.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { Blend, Track, WEIGHT } from "../../../engine/motion/track.ts";
import { feel, handsOnHips, lookAt, nod, shiftWeight } from "../../../engine/motion/verbs.ts";
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

const EASY: Expression = { lidU: 0.94, lidL: 0.88, browRaise: 0.3, browTilt: -0.4, smile: 0.3, open: 0, wide: 0.05, jaw: 0 };
const PROUD: Expression = { lidU: 0.9, lidL: 0.55, browRaise: 0.5, browTilt: -0.3, smile: 0.75, open: 0, wide: 0.25, jaw: 0 };

function build() {
  const W = ANCHOR;
  const t0 = LAB.t0;
  const cues: Cue[] = [];
  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: 930, yaw: -0.9, seed: 4 });
  sanjeev.face = new Blend<Expression>(EASY, mixFace);
  const f1 = new Actor({ ch: CAST.sonB, scale: U, groundY: DOOR_GROUND, x: -360, yaw: 1.1, seed: 21 });
  const f2 = new Actor({ ch: CAST.porter, scale: U, groundY: DOOR_GROUND + 8, x: -520, yaw: 1.1, seed: 23 });
  const cam = new Camera(600, 900, 1.12);

  // ---- the sack close to the lens (from `seed`) lifts away: the room is the lab now
  const near = new Track(LAB.HGT / 2);
  near.to(-1700, { at: t0 + 0.75, dur: 0.75, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: t0 + 0.1, what: "lift", x: 540 });

  // ---- Beat 1-2. "So Sanjeev decides to fix that himself. He sets up a spawn lab ... the Sabri Spawn Lab."
  lookAt(sanjeev, [800, 1000], { at: t0 + 0.6 });
  handsOnHips(sanjeev, { at: W("fix") + 0.2, dur: 0.45 });
  feel(sanjeev, PROUD, { at: W("lab") + 0.1, dur: 0.3 });
  lookAt(sanjeev, [500, 1100], { at: W("village", 4) });
  cues.push({ t: W("sets"), what: "steam", x: DRUM_AT[0] });
  nod(sanjeev, { at: W("lab", 2) + 0.1, amount: 0.6 });

  // ---- Beat 3-4. "At first, nobody trusts it. But slowly, farmers try it..." Two farmers at the door.
  const tAt = W("at", 2);
  f1.walkTo(200, { arrive: tAt + 0.4, pace: 1.6, step: 1.0 });
  f2.walkTo(70, { arrive: tAt + 0.8, pace: 1.6, step: 1.0 });
  cues.push({ t: tAt, what: "steps", x: 0 });
  handsOnHips(f1, { at: tAt + 0.9, dur: 0.45 });
  lookAt(sanjeev, [200, 760], { at: tAt + 0.2 });
  feel(sanjeev, EASY, { at: tAt + 0.3, dur: 0.3 });
  lookAt(f1, [900, 720], { at: tAt + 0.6 });
  lookAt(f2, [900, 720], { at: tAt + 1.0 });
  shiftWeight(sanjeev, 0.12, { at: W("slowly") });
  nod(f1, { at: W("crop", 2) + 0.2, amount: 0.6 });
  nod(f2, { at: W("spreads") + 0.1, amount: 0.6 });

  // ---- Beat 5. "... he starts teaching everyone around him how to grow mushrooms."
  lookAt(sanjeev, [200, 800], { at: W("teaching") });
  nod(sanjeev, { at: W("grow") + 0.1, amount: 0.5 });
  shiftWeight(sanjeev, -0.1, { at: W("simple") });

  // ---- Beat 6. "His idea is simple ... thousands of small families growing a little each." The farmers go.
  const tGo = W("instead");
  f1.turnTo(-1.1, { at: tGo, dur: 0.4 });
  f1.walkTo(-460, { start: tGo + 0.2, pace: 1.6, step: 1.0 });
  f2.turnTo(-1.1, { at: tGo + 0.5, dur: 0.4 });
  f2.walkTo(-560, { start: tGo + 0.7, pace: 1.6, step: 1.0 });
  lookAt(sanjeev, [100, 820], { at: tGo + 0.3 });
  feel(sanjeev, PROUD, { at: W("families") + 0.2, dur: 0.3 });

  // ---- out: the dark jamb close to the lens slides across and covers the frame by the end (screen x of its edge)
  const jamb = new Track(-140);
  jamb.to(LAB.W + 120, { at: LAB.end, dur: 0.57, w: WEIGHT.body, windup: 0, overshoot: 0 });
  cues.push({ t: LAB.end - 0.4, what: "whoosh", x: 540 });

  cam.keys([
    { t: t0 - 0.3, cx: 600, cy: 900, zoom: 1.12 },
    { t: t0 + 0.2, cx: 610, cy: 900, zoom: 1.1 },
    { t: W("himself") + 0.3, cx: 640, cy: 900, zoom: 1.0 },
    { t: W("village", 4), cx: 600, cy: 900, zoom: 1.1 },
    { t: W("teaching"), cx: 594, cy: 902, zoom: 1.11 },
    { t: W("thousands") - 0.4, cx: 600, cy: 905, zoom: 1.15 },
    { t: LAB.end - 0.6, cx: 598, cy: 906, zoom: 1.15 },
    { t: LAB.end + 0.3, cx: 520, cy: 930, zoom: 0.98 },
  ]);

  const type = {
    sabri: {
      x: 200,
      y: 345,
      size: 150,
      maxW: 640,
      leading: 1.25,
      lines: [
        { lead: "SABRI", text: "", at: W("sabri") },
        { text: "SPAWN LAB", at: W("spawn", 4) },
      ],
      out: W("nobody"),
    } as PhraseCue,
    families: {
      x: 340,
      y: 370,
      size: 140,
      maxW: 556,
      leading: 1.15,
      lines: [
        { text: "THOUSANDS", at: W("thousands") },
        { text: "OF SMALL", at: W("small") },
        { lead: "FAMILIES", text: "", at: W("families") },
      ],
      out: LAB.end - 0.6,
    } as PhraseCue,
  };

  return { sanjeev, f1, f2, cam, near, jamb, type, cues, marks: { t0, tAt, tGo } };
}

export type LabTake = ReturnType<typeof build>;
let take: LabTake | null = null;
export function labTake(): LabTake {
  if (!take) take = build();
  return take;
}
