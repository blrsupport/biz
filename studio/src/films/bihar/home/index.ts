// Bihar Mushroom: sequence "home" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { homeFrame } from "./frame.ts";
import { HOME, HOME_PALETTE, homeTake } from "./take.ts";

const tk = homeTake();

export const HOME_SEQ: Sequence = {
  id: "home",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: HOME.t0,
  tFull: HOME.t0,
  end: HOME.end,
  palette: HOME_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: HOME_PALETTE["stage.wall"],
  frame: homeFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
