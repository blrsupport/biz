// Bihar Mushroom: sequence "home" (simplest form). The same lane in the early 2000s, late afternoon, sun low at right.
// Sanjeev walks in behind the passing sack and stands by the lane while the names and places land across the sky;
// at the end he walks into the dark doorway of the thatched shed and the camera follows him into the dark.
import { CAST } from "../../../assets/cast/cast.ts";
import { thatchShed } from "../../../assets/sets/village.ts";
import type { Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { WEIGHT } from "../../../engine/motion/track.ts";
import { lookAt, lookToCamera } from "../../../engine/motion/verbs.ts";
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
export const BIG_SHED = thatchShed("bigshed", { x: 1700, foot: GY, u: 261, seed: 5 });

function build() {
  const W = ANCHOR;
  const cues: Cue[] = [];
  const door = BIG_SHED.door;
  const dc: Pt = [(door.x0 + door.x1) / 2, (door.y0 + door.y1) / 2];
  const cam = new Camera(420, 950, 1.06);
  cam.keys([
    { t: HOME.t0 - 0.3, cx: 420, cy: 950, zoom: 1.06 },
    { t: 14.0, cx: 520, cy: 945, zoom: 1.08 },
    { t: 17.6, cx: 560, cy: 960, zoom: 0.96 },
    { t: 22.2, cx: 610, cy: 955, zoom: 0.95 },
    { t: 25.6, cx: 560, cy: 930, zoom: 1.08 },
    { t: 30.0, cx: 470, cy: 950, zoom: 0.97 },
    { t: 31.6, cx: 560, cy: 950, zoom: 1.0 },
    { t: 33.0, cx: 1250, cy: 1010, zoom: 1.15 },
    { t: 33.6, cx: 1560, cy: 1060, zoom: 1.45 },
    { t: 34.62, cx: dc[0], cy: dc[1], zoom: 3.3 },
    { t: HOME.end + 0.3, cx: dc[0], cy: dc[1], zoom: 3.32 },
  ]);
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };

  // he walks in behind the sack and stops by the lane
  const sanjeev = new Actor({ ch: CAST.sanjeev, scale: U, groundY: GY, x: -260, yaw: 1.1, seed: 12 });
  const wi = sanjeev.walkTo(600, { arrive: W("finished"), pace: 1.9, step: 1.35 });
  lookToCamera(sanjeev, { at: W("bit") + 0.1, dur: 0.4, yaw: 0.4 });
  lookAt(sanjeev, [1500, 700], { at: W("city") + 0.2 });
  lookAt(sanjeev, [-300, GY - 1.2 * U], { at: W("different") });
  lookAt(sanjeev, [-1200, 800], { at: W("2002") + 0.3 });
  // "...and starts growing them": into the dark doorway of the shed
  const tGo = W("then") + 0.2;
  lookAt(sanjeev, dc, { at: tGo - 0.2 });
  const wd = sanjeev.walkTo(2000, { start: tGo, pace: 2.3, step: 1.5 });
  sanjeev.drop.to(0.55, { at: W("growing"), dur: 0.35, w: WEIGHT.body, windup: 0 });
  sanjeev.bend.to(0.45, { at: W("growing") + 0.02, dur: 0.35, w: WEIGHT.body, windup: 0 });
  const tVeil0 = W("growing") + 0.05;
  const tVeil1 = W("them") + 0.35;
  cues.push({ t: 16.6, what: "hen" }, { t: 20.6, what: "horn.far" }, { t: W("growing"), what: "door.brush", x: dc[0] });

  // across the sky, one block at a time
  const a1 = under(W("sanjeev"), DEPTH.type, 92, 330);
  const a2 = under(W("bit"), DEPTH.type, 92, 430);
  const a3 = under(W("nalanda"), DEPTH.type, 92, 430);
  const a4 = under(W("2002"), DEPTH.type, 92, 430);
  const a5 = under(W("solan"), DEPTH.type, 92, 336);
  const type = {
    name: { x: a1[0], y: a1[1], size: 100, maxW: 790, leading: 1.4, lines: [{ text: "SANJEEV", at: W("sanjeev") }, { lead: "KUMAR", text: "", at: W("kumar") }], out: W("at") - 0.3 } as PhraseCue,
    bit: { x: a2[0], y: a2[1], size: 150, maxW: 720, lines: [{ lead: "BIT SINDRI", text: "", at: W("bit") }], out: W("now") + 0.2 } as PhraseCue,
    nalanda: { x: a3[0], y: a3[1], size: 150, maxW: 700, lines: [{ lead: "NALANDA", text: "", at: W("nalanda") }], out: W("go") - 0.4 } as PhraseCue,
    year: { x: a4[0], y: a4[1], size: 150, maxW: 700, lines: [{ text: "2002", at: W("2002") }], out: W("solan") - 0.15 } as PhraseCue,
    solan: { x: a5[0], y: a5[1], size: 104, maxW: 790, leading: 1.4, lines: [{ text: "SOLAN", at: W("solan") }, { text: "HIMACHAL", at: W("himachal") }], out: W("then") - 0.3 } as PhraseCue,
  };

  return { cam, sanjeev, door, type, cues, marks: { tIn: wi.arrive, tGo, tDoor: wd.arrive, tVeil0, tVeil1 } };
}

export type HomeTake = ReturnType<typeof build>;
let take: HomeTake | null = null;
export function homeTake(): HomeTake {
  if (!take) take = build();
  return take;
}
