// Bihar Mushroom: the film as a list of sequences. Add each new sequence here, in order.
import type { Film } from "../../engine/film.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { S1_SEQ } from "./s1/index.ts";
import { VO, WORDS } from "./words.ts";

export const BIHAR_FILM: Film = {
  id: "bihar",
  title: "Bihar Mushroom",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: VO.duration,
  look: "A",
  type: TYPE_LOOKS.A,
  words: WORDS,
  sequences: [S1_SEQ],
  // every name or spelling that goes on screen and had to be looked up: { text, source, confirmed }
  facts: [],
};
