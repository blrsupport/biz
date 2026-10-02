// Bihar Mushroom: the film as a list of sequences. Add each new sequence here, in order.
import type { Film } from "../../engine/film.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { S1_SEQ } from "./s1/index.ts";
import { VO, WORDS } from "./words.ts";
import { HOME_SEQ } from "./home/index.ts";
import { SHED_SEQ } from "./shed/index.ts";
import { SEED_SEQ } from "./seed/index.ts";
import { LAB_SEQ } from "./lab/index.ts";
import { TODAY_SEQ } from "./today/index.ts";

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
  sequences: [S1_SEQ, HOME_SEQ, SHED_SEQ, SEED_SEQ, LAB_SEQ, TODAY_SEQ],
  // every name or spelling that goes on screen and had to be looked up: { text, source, confirmed }
  facts: [
    { text: "Sanjeev Kumar", source: "the narration; spelling confirmed by the user, 2 Oct 2026", confirmed: true },
    { text: "BIT Sindri", says: "BIT Sindhri", source: "the user, 2 Oct 2026 (the transcript heard 'Sindhri')", confirmed: true },
    { text: "Solan", source: "the narration; confirmed by the user, 2 Oct 2026", confirmed: true },
    { text: "Himachal", source: "the narration; confirmed by the user, 2 Oct 2026", confirmed: true },
    { text: "SABRI Spawn Lab", says: "Sabri Spawn Lab", source: "the user, 2 Oct 2026", confirmed: true },
    { text: "50,000", says: "50 ,000", source: "the narration ('more than 50,000 farmers'; the transcript split the number)", confirmed: true },
  ],
};
