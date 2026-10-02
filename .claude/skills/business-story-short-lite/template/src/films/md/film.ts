// Demo 1, Minus Degre: one sequence, one room, one continuous take.
import { LIGHT_MORNING } from "../../assets/lights.ts";
import type { Film, Sequence } from "../../engine/film.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { mdFrame } from "./frame.ts";
import { MD, MD_TAKE_PALETTE, mdTake } from "./take.ts";
import { VO, WORDS } from "./words.ts";

const tk = mdTake();

export const MD_ROOM: Sequence = {
  id: "room",
  t0: 0,
  tFull: 0,
  end: VO.duration,
  palette: MD_TAKE_PALETTE,
  lights: { morning: LIGHT_MORNING },
  light: "morning",
  background: MD_TAKE_PALETTE.wall,
  frame: mdFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "rahul", actor: tk.rahul },
    { name: "vikas", actor: tk.vikas },
  ],
  allow: [
    { id: /^notes\//, why: "the banknotes pass from the tin to Rahul's hand in one frame, behind his fingers" },
    { id: /^tin\/note/, why: "the same banknotes, leaving the tin" },
    { id: /^mote\//, why: "dust specks show only while the sun reaches them" },
    { id: /^door\//, why: "the shutter's slats, rail and handle roll up into the housing over the doorway, which is drawn in front of them" },
    { id: /^cal\/turn/, why: "the calendar's page turns over and is edge-on for a frame" },
    { id: /^tin\/lid/, why: "the lip of the tin's lid goes behind the lid as it swings open" },
  ],
};

export const MD_FILM: Film = {
  id: "md",
  title: "Minus Degre: starting with almost nothing",
  width: MD.W,
  height: MD.HGT,
  fps: MD.fps,
  duration: VO.duration,
  look: "A",
  type: TYPE_LOOKS.A,
  words: WORDS,
  sequences: [MD_ROOM],
  facts: [],
};
