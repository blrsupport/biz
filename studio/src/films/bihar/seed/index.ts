// Bihar Mushroom: sequence "seed" as the film sees it.
import { LIGHT_SHED } from "../../../assets/sets/shed.ts";
import type { Sequence } from "../../../engine/film.ts";
import { seedFrame } from "./frame.ts";
import { SEED, SEED_PALETTE, seedTake } from "./take.ts";

const tk = seedTake();

export const SEED_SEQ: Sequence = {
  id: "seed",
  // In from `shed` by Carry: the same room, marks and camera path, so it takes over on the cut (tFull = t0).
  // Out to `lab` by Pass: the sack set down close to the lens covers the frame from just after "Delhi".
  t0: SEED.t0,
  tFull: SEED.t0,
  end: SEED.end,
  palette: SEED_PALETTE,
  lights: { door: LIGHT_SHED },
  light: "door",
  background: SEED_PALETTE["shed.air.dark"],
  frame: seedFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "sanjeev", actor: tk.sanjeev },
    { name: "farmer", actor: tk.farmer },
    { name: "porter1", actor: tk.porter1 },
    { name: "porter2", actor: tk.porter2 },
  ],
  allow: [
    { id: /^lamp\/(globe\.lit|flame)/, why: "the lamp's flame and the glow in its glass come up as it is lit" },
    { id: /^water\//, why: "water runs from the lota only while it is tipped" },
    { id: /^bag\d_\d\/(mould|rot)/, why: "mould spreads over a failing bag" },
    { id: /^near\//, why: "the sack close to the lens comes down from above the frame and fills it" },
  ],
};
