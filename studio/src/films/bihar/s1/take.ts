// Bihar Mushroom: sequence "s1".
// A PLACEHOLDER so that the film compiles, passes the dry run and renders: one person on a bare stage, and the
// opening words. Replace all of it with the real sequence. docs/perform.md says how a take is written;
// src/films/md/take.ts and src/films/ggsp/take.ts are the models. This file never draws: it is the performance as data.
import { CAST, CAST_PALETTE } from "../../../assets/cast/cast.ts";
import { mergePalettes, type Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { lookToCamera } from "../../../engine/motion/verbs.ts";
import { Camera } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { PALETTE } from "../palette.ts";
import { VO, WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
/** frame size, px per head-height, the ground line, and the stretch of the film this sequence covers (from word anchors) */
export const S1 = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, t0: 0, end: VO.duration } as const;
// (mergePalettes throws if two palettes give one name two colours; a plain spread would let the later one win)
export const S1_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE);
/** how far behind the actors the back wall is, for the camera's parallax */
export const WALL_DEPTH = 0.1;

function build() {
  const W = ANCHOR;
  const { U, GY } = S1;
  const who = new Actor({ ch: CAST.rahul, scale: U, groundY: GY, x: 560, yaw: 0.5, seed: 3 });
  const cam = new Camera(540, 960, 1);
  const cues: Cue[] = [];

  // every moment comes from a word
  const tFirst = W("for");
  lookToCamera(who, { at: tFirst + 0.5 });

  // the camera is keyed once for the whole take; two equal keys give a rest (it still drifts, so the frame is alive).
  // The first key lies before the take begins and the last after it ends, so the camera neither starts nor stops dead.
  cam.keys([
    { t: S1.t0 - 0.3, cx: 540, cy: 960, zoom: 1 },
    { t: S1.end + 0.3, cx: 540, cy: 960, zoom: 1 },
  ]);

  // what is written on the wall: verbatim from the narration, each piece landing on its own word
  const type = {
    opening: { x: 100, y: 430, size: 150, maxW: 760, lines: [{ text: "For years, Bihar's", at: tFirst }], out: tFirst + 2.4 } as PhraseCue,
  };

  return { who, cam, cues, type, marks: { tFirst } };
}

export type S1Take = ReturnType<typeof build>;
let take: S1Take | null = null;
export function s1Take(): S1Take {
  if (!take) take = build();
  return take;
}
