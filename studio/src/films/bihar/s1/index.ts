// Bihar Mushroom: sequence "s1" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { s1Frame } from "./frame.ts";
import { S1, S1_PALETTE, s1Take } from "./take.ts";

const tk = s1Take();

export const S1_SEQ: Sequence = {
  id: "s1",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: S1.t0,
  tFull: S1.t0,
  end: S1.end,
  palette: S1_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: S1_PALETTE["stage.wall"],
  frame: s1Frame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
