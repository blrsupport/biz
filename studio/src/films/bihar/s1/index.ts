// Bihar Mushroom: sequence "s1" as the film sees it.
import { VILLAGE_LIGHTS } from "../../../assets/sets/village.ts";
import type { Sequence } from "../../../engine/film.ts";
import { s1Frame } from "./frame.ts";
import { S1, S1_PALETTE, s1Take } from "./take.ts";

const tk = s1Take();

export const S1_SEQ: Sequence = {
  id: "s1",
  // the first sequence: drawn and covering the frame from 0
  t0: S1.t0,
  tFull: S1.t0,
  end: S1.end,
  palette: S1_PALETTE,
  lights: { morning: VILLAGE_LIGHTS.morning },
  light: "morning",
  background: S1_PALETTE["vil.sky.band"],
  frame: s1Frame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "farmer", actor: tk.farmer },
    { name: "trader", actor: tk.trader, to: tk.marks.traderOut - 0.6 },
  ],
  allow: [
    { id: /^notes\//, why: "the banknotes come out of a pocket, pass from hand to hand, and go into a pocket" },
    { id: /^bird\d/, why: "the birds fly in over the right edge of the frame and out over the left" },
    { id: /^sackB\//, why: "the last sack is swung from the farmer's hands past the lens: it grows fast and leaves at the right" },
    { id: /^trader\b/, why: "the trader walks out of the frame at the left with his sack" },
  ],
};
