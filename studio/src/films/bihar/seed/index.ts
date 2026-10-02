// Bihar Mushroom: sequence "seed" as the film sees it.
import { LIGHT_MORNING } from "../../../assets/lights.ts";
import type { Sequence } from "../../../engine/film.ts";
import { seedFrame } from "./frame.ts";
import { SEED, SEED_PALETTE, seedTake } from "./take.ts";

const tk = seedTake();

export const SEED_SEQ: Sequence = {
  id: "seed",
  // Drawn from t0; covers the frame from tFull. With tFull equal to t0 this sequence cuts in. For a planned hand-over
  // (a glow that rises, a thing that sweeps across) make tFull later and list, until then, only what shows over the
  // sequence before it (docs/perform.md, "The sequence, and joining two of them").
  t0: SEED.t0,
  tFull: SEED.t0,
  end: SEED.end,
  palette: SEED_PALETTE,
  lights: { key: LIGHT_MORNING },
  light: "key",
  background: SEED_PALETTE["stage.wall"],
  frame: seedFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "who", actor: tk.who }],
  allow: [],
};
