// Bihar Mushroom: sequence "today" as the film sees it.
import { VILLAGE_LIGHTS } from "../../../assets/sets/village.ts";
import type { Sequence } from "../../../engine/film.ts";
import { todayFrame } from "./frame.ts";
import { TODAY, TODAY_PALETTE, todayTake } from "./take.ts";

const tk = todayTake();

export const TODAY_SEQ: Sequence = {
  id: "today",
  // in from "lab" by Pass: the dark jamb that ends "lab" covers this first frame and slides off to the right
  t0: TODAY.t0,
  tFull: TODAY.t0,
  end: TODAY.end,
  palette: TODAY_PALETTE,
  lights: { sunrise: VILLAGE_LIGHTS.sunrise },
  light: "sunrise",
  background: TODAY_PALETTE["vil.sky.band"],
  frame: todayFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "sanjeev", actor: tk.sanjeev },
    { name: "trader", actor: tk.trader },
    { name: "c1", actor: tk.c1 },
    { name: "c2", actor: tk.c2 },
    { name: "p1", actor: tk.p1 },
    { name: "p2", actor: tk.p2 },
    { name: "p3", actor: tk.p3 },
  ],
  allow: [
    { id: /^jamb\//, why: "the dark door jamb close to the lens slides off to the right" },
    { id: /^bird\d/, why: "the birds fly in over the right edge of the frame and out over the left" },
  ],
};
