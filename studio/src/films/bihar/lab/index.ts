// Bihar Mushroom: sequence "lab" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { labFrame } from "./frame.ts";
import { LAB, LAB_PALETTE, labTake } from "./take.ts";

const tk = labTake();

export const LAB_SEQ: Sequence = {
  id: "lab",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: LAB.t0,
  tFull: LAB.t0,
  end: LAB.end,
  palette: LAB_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: LAB_PALETTE["stage.wall"],
  frame: labFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
