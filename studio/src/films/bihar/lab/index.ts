// Bihar Mushroom: sequence "lab" as the film sees it.
import { LIGHT_LAB } from "../../../assets/sets/shed.ts";
import type { Sequence } from "../../../engine/film.ts";
import { labFrame } from "./frame.ts";
import { LAB, LAB_PALETTE, labTake } from "./take.ts";

const tk = labTake();

export const LAB_SEQ: Sequence = {
  id: "lab",
  // In from `seed` by Pass: it opens on the same sack close to the lens, covering the frame, which lifts away.
  // Out to `today` by Pass: the dark jamb covers the frame by `end`.
  t0: LAB.t0,
  tFull: LAB.t0,
  end: LAB.end,
  palette: LAB_PALETTE,
  lights: { door: LIGHT_LAB },
  light: "door",
  background: LAB_PALETTE["shed.air.dark"],
  frame: labFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "sanjeev", actor: tk.sanjeev },
    { name: "f1", actor: tk.f1 },
    { name: "f2", actor: tk.f2 },
    { name: "f3", actor: tk.f3 },
  ],
  allow: [
    { id: /^drum\/steam/, why: "steam puffs rise from the drum and thin out to nothing" },
    { id: /^(bottle2?|bag)\//, why: "the bottle comes up out of the drum; bottle and bag go off left with the farmers" },
    { id: /^near\//, why: "the sack close to the lens lifts up out of the frame" },
    { id: /^jamb\//, why: "the door jamb close to the lens slides in across the frame" },
  ],
};
