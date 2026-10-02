// Bihar Mushroom: sequence "home" as the film sees it.
import { VILLAGE_LIGHTS } from "../../../assets/sets/village.ts";
import type { Sequence } from "../../../engine/film.ts";
import { homeFrame } from "./frame.ts";
import { HOME, HOME_PALETTE, homeTake } from "./take.ts";

const tk = homeTake();

export const HOME_SEQ: Sequence = {
  id: "home",
  // in from s1 by Pass: the sack fills the frame at t0, and this world is behind it as it goes off to the right
  t0: HOME.t0,
  tFull: HOME.t0,
  end: HOME.end,
  palette: HOME_PALETTE,
  lights: { afternoon: VILLAGE_LIGHTS.afternoon },
  light: "afternoon",
  background: HOME_PALETTE["vil.sky.band"],
  frame: homeFrame,
  cues: tk.cues,
  marks: tk.marks,
  walkers: [{ name: "sanjeev", actor: tk.sanjeev, to: tk.marks.tVeil1 }],
  allow: [
    { id: /^sackB\//, why: "the sack from s1 goes on past the lens and off to the right over the first frames" },
    { id: /^(bigshed|lane|near|house|yard|fields|banana|straw|tree|pump|hills|city)/, why: "the camera pushes into the doorway: the set rushes out past the edges of the frame" },
    { id: /^handful\//, why: "he takes a handful out of the straw stack: it is part of the stack until his hand closes on it" },
    { id: /^(trunk|degree|bag[LR])\//, why: "they leave and come back with him, off the left edge, while he is away in Solan" },
    { id: /^sanjeev\b/, why: "he walks into the dark of the doorway, behind the wall right of the door" },
  ],
};
