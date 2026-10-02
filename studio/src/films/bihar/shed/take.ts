// Bihar Mushroom: sequence "shed".
// A PLACEHOLDER so that the film compiles, passes the dry run and renders: one person on a bare stage. Replace all of it with the real sequence. docs/perform.md says how a take is written;
// src/films/md/take.ts and src/films/ggsp/take.ts are the models. This file never draws: it is the performance as data.
import { CAST, CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { mergePalettes, type Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { lookToCamera } from "../../../engine/motion/verbs.ts";
import { Camera } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import { PALETTE } from "../palette.ts";
import { VO, WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
/** frame size, px per head-height, the ground line, and the stretch of the film this sequence covers (from word anchors) */
export const SHED = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, t0: Math.round(ANCHOR("and", 4) * 100) / 100, end: VO.duration } as const;
// (mergePalettes throws if two palettes give one name two colours; a plain spread would let the later one win)
export const SHED_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE);
/** how far behind the actors the back wall is, for the camera's parallax */
export const WALL_DEPTH = 0.1;

function build() {
  const W = ANCHOR;
  const { U, GY } = SHED;
  const who = new Actor({ ch: CAST.rahul, scale: U, groundY: GY, x: 560, yaw: 0.5, seed: 3 });
  const cam = new Camera(540, 960, 1);
  const cues: Cue[] = [];

  // every moment comes from a word
  const tFirst = W("and", 4);
  lookToCamera(who, { at: tFirst + 0.5 });

  // the camera is keyed once for the whole take; two equal keys give a rest (it still drifts, so the frame is alive).
  // The first key lies before the take begins and the last after it ends, so the camera neither starts nor stops dead.
  cam.keys([
    { t: SHED.t0 - 0.3, cx: 540, cy: 960, zoom: 1 },
    { t: SHED.end + 0.3, cx: 540, cy: 960, zoom: 1 },
  ]);

  return { who, cam, cues, marks: { tFirst } };
}

export type ShedTake = ReturnType<typeof build>;
let take: ShedTake | null = null;
export function shedTake(): ShedTake {
  if (!take) take = build();
  return take;
}
