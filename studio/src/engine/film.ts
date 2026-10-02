// A film is a list of sequences. A sequence is one continuous take in one world ("one organism"): one stage,
// one light, actors that enter and leave, a camera that never cuts. Sequences are joined by a planned hand-over,
// not a cut: the next one starts drawing on top at its `t0` and has covered the frame by its `tFull`.
import type { FrameList, Space } from "./draw/list.ts";
import type { Palette } from "./draw/shape.ts";
import type { SceneLight } from "./look/color.ts";
import type { LookId } from "./look/looks.ts";
import type { Actor } from "./motion/actor.ts";
import type { Word } from "./time/clock.ts";
import type { TypeLook } from "./type/blockspec.ts";

/** Something that should be heard: a contact, an impact, the start of a movement. */
export interface Cue {
  /** seconds of film time */
  t: number;
  /** the kind of event; the film's sound sheet says which sound each name gets */
  what: string;
  /** where it is: x in the layer named by `space` (default 0, the actors' plane), or screen x when space is "screen" */
  x?: number;
  space?: Space;
  /** dB on top of the sheet's level, for one cue that should be softer or louder than its kind */
  gain?: number;
}

export interface Sequence {
  id: string;
  /** seconds of film time. Drawn from t0; covers the whole frame from tFull (the sequence before it stops there); over at `end`. */
  t0: number;
  tFull: number;
  end: number;
  palette: Palette;
  /** the lights of this world by name, and which one a paint item gets when it names none */
  lights: Record<string, SceneLight>;
  light: string;
  /** colour under everything once the sequence covers the frame */
  background: string;
  /** everything drawn at time t, back to front */
  frame(t: number, look?: LookId): FrameList;
  cues: Cue[];
  /** the named moments of the take (printed by the dry run, and a quick way to see where a word landed) */
  marks: Record<string, number>;
  /** who walks, for footfall cues: the steps of each are heard between `from` and `to` */
  walkers?: { name: string; actor: Actor; from?: number; to?: number; space?: number }[];
  /** things that may appear or vanish inside one frame, each with the reason (an impact, a hand-over between two props) */
  allow?: { id: RegExp; why: string }[];
  /** stretches that are meant to rest: a held, living frame of up to 1.25 s */
  holds?: [number, number][];
}

/** A number, a name or a spelling that goes on screen, and where it comes from. */
export interface Fact {
  /** as written on screen */
  text: string;
  /** what the narrator says, when that is spelt differently from what is written ("ten thousand" for "₹10,000") */
  says?: string;
  /** where the spelling or the figure comes from */
  source: string;
  /** true once the user has confirmed it */
  confirmed?: boolean;
}

export interface Film {
  id: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  /** seconds: the length of the tightened voice */
  duration: number;
  look: LookId;
  type: TypeLook;
  words: readonly Word[];
  sequences: Sequence[];
  facts?: readonly Fact[];
}

/** Until when a sequence is drawn: a moment after the next one has covered the frame. */
export function drawnUntil(film: Film, i: number): number {
  const next = film.sequences[i + 1];
  return next ? next.tFull + 0.05 : Infinity;
}

/** The sequences on screen at time t, back to front. */
export function sequencesAt(film: Film, t: number): Sequence[] {
  return film.sequences.filter((s, i) => t >= s.t0 && t < drawnUntil(film, i));
}
