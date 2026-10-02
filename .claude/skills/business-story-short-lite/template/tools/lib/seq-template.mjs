// The three files of a placeholder sequence: a take, a frame and the sequence object. Used by tools/new-film.mjs
// (the first sequence of a film) and tools/new-seq.mjs (every one after it). The placeholder compiles, passes the dry
// run and renders: one person on a bare stage. It fixes the interface; the real sequence replaces its contents.

/**
 * @param {{ title: string, seq: string, depth: number, anchor: string, nth?: number, first: boolean, opening?: string }} o
 *   seq: the sequence's id (lower-case letters and digits). depth: how many folders it lies below src/films/<film>/
 *   (1). anchor: the normalised word the sequence starts on. first: true for a film's first sequence (it starts at 0).
 *   opening: words to write on the wall on the first word, or nothing.
 */
export function sequenceFiles(o) {
  const S = o.seq.toUpperCase();
  const s = o.seq;
  const up = "../../../";
  const anchor = `W(${JSON.stringify(o.anchor)}${o.nth && o.nth > 1 ? `, ${o.nth}` : ""})`;
  const take = `// ${o.title}: sequence "${s}".
// A PLACEHOLDER so that the film compiles, passes the dry run and renders: one person on a bare stage${o.opening ? ", and the\n// opening words" : ""}. Replace all of it with the real sequence. docs/perform.md says how a take is written;
// src/films/md/take.ts and src/films/ggsp/take.ts are the models. This file never draws: it is the performance as data.
import { CAST, CAST_PALETTE } from "${up}assets/cast/cast.ts";
import { mergePalettes, type Palette } from "${up}engine/draw/shape.ts";
import type { Cue } from "${up}engine/film.ts";
import { Actor } from "${up}engine/motion/actor.ts";
import { lookToCamera } from "${up}engine/motion/verbs.ts";
import { Camera } from "${up}engine/stage/camera.ts";
import { makeAnchors } from "${up}engine/time/clock.ts";
${o.opening ? `import type { PhraseCue } from "${up}engine/type/blockspec.ts";\n` : ""}import { PALETTE } from "../palette.ts";
import { VO, WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
/** frame size, px per head-height, the ground line, and the stretch of the film this sequence covers (from word anchors) */
export const ${S} = { W: 1080, HGT: 1920, U: 172, GY: 1500, fps: 30, t0: ${o.first ? "0" : `Math.round(${anchor.replace("W(", "ANCHOR(")} * 100) / 100`}, end: VO.duration } as const;
// (mergePalettes throws if two palettes give one name two colours; a plain spread would let the later one win)
export const ${S}_PALETTE: Palette = mergePalettes(CAST_PALETTE, PALETTE);
/** how far behind the actors the back wall is, for the camera's parallax */
export const WALL_DEPTH = 0.1;

function build() {
  const W = ANCHOR;
  const { U, GY } = ${S};
  const who = new Actor({ ch: CAST.rahul, scale: U, groundY: GY, x: 560, yaw: 0.5, seed: 3 });
  const cam = new Camera(540, 960, 1);
  const cues: Cue[] = [];

  // every moment comes from a word
  const tFirst = ${anchor};
  lookToCamera(who, { at: tFirst + 0.5 });

  // the camera is keyed once for the whole take; two equal keys give a rest (it still drifts, so the frame is alive).
  // The first key lies before the take begins and the last after it ends, so the camera neither starts nor stops dead.
  cam.keys([
    { t: ${S}.t0 - 0.3, cx: 540, cy: 960, zoom: 1 },
    { t: ${S}.end + 0.3, cx: 540, cy: 960, zoom: 1 },
  ]);
${
  o.opening
    ? `
  // what is written on the wall: verbatim from the narration, each piece landing on its own word
  const type = {
    opening: { x: 100, y: 430, size: 150, maxW: 760, lines: [{ text: ${JSON.stringify(o.opening)}, at: tFirst }], out: tFirst + 2.4 } as PhraseCue,
  };

  return { who, cam, cues, type, marks: { tFirst } };`
    : `
  return { who, cam, cues, marks: { tFirst } };`
}
}

export type ${S[0]}${s.slice(1)}Take = ReturnType<typeof build>;
let take: ${S[0]}${s.slice(1)}Take | null = null;
export function ${s}Take(): ${S[0]}${s.slice(1)}Take {
  if (!take) take = build();
  return take;
}
`;

  const frame = `// ${o.title}: sequence "${s}". Everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { paint, rect, shadow, ${o.opening ? "type as written, " : ""}type FrameList, type Item } from "${up}engine/draw/list.ts";
import { shape, type Shape } from "${up}engine/draw/shape.ts";
import { buildFigure } from "${up}engine/figure/body.ts";
import { LOOKS, type LookId } from "${up}engine/look/looks.ts";
import { ${S}, WALL_DEPTH, ${s}Take } from "./take.ts";

const { U, GY } = ${S};
const JUNCTION = GY - 0.36 * U;
const flat = { form: "flat", ink: 0, paper: false } as const;
// static geometry is built once, not every frame
const WALL: Shape[] = [shape("stage/wall", "stage.wall", rect(-700, -500, 2480, JUNCTION + 700), flat)];
const FLOOR: Shape[] = [shape("stage/floor", "stage.floor", rect(-700, JUNCTION, 2480, 1400), flat)];

export function ${s}Frame(t: number, lookId: LookId = "A"): FrameList {
  const tk = ${s}Take();
  const view = tk.cam.view(t);
  const fig = buildFigure(tk.who.ch, tk.who.solve(t).pose, LOOKS[lookId].people);
  const items: Item[] = [
    paint("wall", WALL_DEPTH, WALL),
${o.opening ? `    written("type.opening", WALL_DEPTH, { kind: "phrase", ...tk.type.opening }, ["stage.wall"]),\n` : ""}    paint("floor", 0, FLOOR),
    // a cast shadow is the floor itself, unlit, laid down away from the light
    shadow("cast", 0, fig.shapes, "stage.floor", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("actor", 0, fig.shapes),
  ];
  return { t, view, items, figures: [{ name: "who", actor: tk.who, fig }] };
}
`;

  const index = `// ${o.title}: sequence "${s}" as the film sees it.
import { LIGHT_MORNING } from "${up}assets/lights.ts";
import type { Sequence } from "${up}engine/film.ts";
import { ${s}Frame } from "./frame.ts";
import { ${S}, ${S}_PALETTE, ${s}Take } from "./take.ts";

const tk = ${s}Take();

export const ${S}_SEQ: Sequence = {
  id: "${s}",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: ${S}.t0,
  tFull: ${S}.t0,
  end: ${S}.end,
  palette: ${S}_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: ${S}_PALETTE["stage.wall"],
  frame: ${s}Frame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
`;
  return { "take.ts": take, "frame.ts": frame, "index.ts": index };
}
