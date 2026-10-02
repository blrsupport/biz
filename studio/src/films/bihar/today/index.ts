// Bihar Mushroom: sequence "today" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { todayFrame } from "./frame.ts";
import { TODAY, TODAY_PALETTE, todayTake } from "./take.ts";

const tk = todayTake();

export const TODAY_SEQ: Sequence = {
  id: "today",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: TODAY.t0,
  tFull: TODAY.t0,
  end: TODAY.end,
  palette: TODAY_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: TODAY_PALETTE["stage.wall"],
  frame: todayFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
