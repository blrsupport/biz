// Bihar Mushroom: sequence "shed" as the film sees it.
import { LIGHT_SHED } from "../../../assets/sets/shed.ts";
import type { Sequence } from "../../../engine/film.ts";
import { shedFrame } from "./frame.ts";
import { SHED, SHED_PALETTE, shedTake } from "./take.ts";

const tk = shedTake();

export const SHED_SEQ: Sequence = {
  id: "shed",
  // In from "home" by Through: home ends pushing into the dark doorway, so this opens on the dark jamb close to the
  // lens and covers the frame from its first frame (tFull = t0); the jamb slides off to the left.
  t0: SHED.t0,
  tFull: SHED.t0,
  end: SHED.end,
  palette: SHED_PALETTE,
  lights: { door: LIGHT_SHED },
  light: "door",
  background: SHED_PALETTE["shed.air.dark"],
  frame: shedFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [
    { name: "sanjeev", actor: tk.sanjeev },
    { name: "gossipA", actor: tk.gossipA },
    { name: "gossipB", actor: tk.gossipB },
  ],
  allow: [
    { id: /^mote\//, why: "dust specks show only where the doorlight reaches them" },
    { id: /^cal\/turn/, why: "each calendar page turns over and is edge-on for a frame before the next" },
    { id: /^tin\/lid/, why: "the lip of the tin's lid goes behind the lid as it swings open" },
    { id: /^bag\d_\d\/(cap|gill)/, why: "oyster caps grow from nothing out of the holes in the bag" },
    { id: /^bag\d_\d\/(mould|rot|grain|tear|flap)/, why: "mould spreads over a failed bag; the tear opens from a line" },
    { id: /^jamb\//, why: "the door jamb close to the lens slides out of frame at the start" },
  ],
};
