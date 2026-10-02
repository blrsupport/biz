// Bihar Mushroom: sequence "shed" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { shedFrame } from "./frame.ts";
import { SHED, SHED_PALETTE, shedTake } from "./take.ts";

const tk = shedTake();

export const SHED_SEQ: Sequence = {
  id: "shed",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: SHED.t0,
  tFull: SHED.t0,
  end: SHED.end,
  palette: SHED_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: SHED_PALETTE["stage.wall"],
  frame: shedFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
