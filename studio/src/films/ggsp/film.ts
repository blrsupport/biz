// Demo 2, the GGSP opening: two sequences. The yard (one long take), then the steel world, which starts drawing
// on top of the yard under a rising glow at STEEL.t0 and has covered the frame by STEEL.tFull.
import { LIGHT_AFTERNOON } from "../../assets/lights.ts";
import { STEEL_LIGHTS, STEEL_PALETTE } from "../../assets/sets/steel.ts";
import { type as written, type FrameList } from "../../engine/draw/list.ts";
import type { Film, Sequence } from "../../engine/film.ts";
import type { Pt } from "../../engine/geom/vec.ts";
import { TYPE_LOOKS } from "../../engine/type/blockspec.ts";
import { yardFrame } from "./frame.ts";
import { STEEL, steelTake } from "./steel.ts";
import { GGT, GG_TAKE_PALETTE, ggTake } from "./take.ts";
import { VO, WORDS } from "./words.ts";

const yard = ggTake();
const steel = steelTake();

export const GG_YARD: Sequence = {
  id: "yard",
  t0: 0,
  tFull: 0,
  end: yard.yardUntil,
  palette: GG_TAKE_PALETTE,
  lights: { afternoon: LIGHT_AFTERNOON },
  light: "afternoon",
  background: GG_TAKE_PALETTE["yard.sky.band"],
  frame: yardFrame,
  // (this take notes where each sound is in screen pixels)
  cues: yard.cues.map((c) => ({ ...c, space: "screen" as const })),
  marks: yard.marks,
  walkers: [
    { name: "iraki", actor: yard.iraki, from: 6.0 },
    { name: "buyer", actor: yard.buyer, from: yard.marks.tBuyerOn + 0.7, to: yard.marks.tBuyerOff - 0.8 },
  ],
  allow: [
    { id: /^(mote|wisp|burst)\//, why: "dust shows only where a shaft of sun reaches it, and a burst is an impact" },
    { id: /^thrown/, why: "the thrown piece leaves the fist and is drawn with its two ghost copies" },
    { id: /^thrower\//, why: "the arm that throws swings fast, close to the lens: about 178 px a frame for two frames" },
    { id: /^notes\//, why: "the banknotes come out of a pocket, pass from hand to hand, and go into a pocket" },
    { id: /^(crow|bell)\//, why: "the crow flies out of frame; the bell's shadow is let down from the wall top, behind the coping" },
    { id: /^(heap|near|loose|yard)/, why: "set pieces are only listed while the long travel has them in view" },
    { id: /^(buyer|porter|sonA|sonB|iraki|bundle|scale|sack)\b/, why: "figures and what they carry are listed only while they are in view or on the wall" },
  ],
};

/** The steel take lists its own items; its two words are added here as a type item, with what is behind them now. */
function steelFrame(t: number): FrameList {
  const fr = steel.frame(t);
  if (!fr.type) return { t, view: fr.view, items: fr.items };
  const ty = steel.type;
  const b = ty.box;
  const behind = new Set<string>();
  for (let ix = 0; ix <= 6; ix++) {
    for (let iy = 0; iy <= 3; iy++) {
      const p: Pt = [b.x0 + ((b.x1 - b.x0) * ix) / 6, b.y0 + ((b.y1 - b.y0) * iy) / 3];
      const c = steel.backdrop(t, p).color;
      if (c) behind.add(c);
    }
  }
  const runs = fr.type.words.map((w) => {
    const word = ty.words.find((x) => x.from === w.from)!;
    return { text: word.text, at: word.at, from: w.from, to: w.to, color: w.color, each: w.each };
  });
  return { t, view: fr.view, items: [...fr.items, written("type.steel", "screen", { kind: "glyphs", line: fr.type.line, x: fr.type.x, y: fr.type.y, runs }, [...behind])] };
}

export const GG_STEEL: Sequence = {
  id: "steel",
  t0: STEEL.t0,
  tFull: STEEL.tFull,
  end: STEEL.end,
  palette: STEEL_PALETTE,
  lights: STEEL_LIGHTS,
  light: "dawn",
  background: STEEL_PALETTE["furnace.dark"],
  frame: steelFrame,
  cues: steel.cues.map((c) => ({ ...c, space: "screen" as const })),
  marks: steel.marks,
  allow: [
    { id: /^(dust|splash)\b/, why: "an impact: dust and splashes start in one frame" },
    { id: /^(fall\d|rod\/)/, why: "scrap sinks into the melt and rods rise out of it: both pass behind the melt's crest" },
    { id: /^(sun|city\/)/, why: "the dawn city is uncovered as the furnace's glow shrinks away from it" },
    { id: /^(tie\d|cap\/|tower\/f)/, why: "ties, the pier cap and the floors grow out of what is already there" },
  ],
};

export const GG_FILM: Film = {
  id: "ggsp",
  title: "German Green Steel and Power: the opening",
  width: GGT.W,
  height: GGT.HGT,
  fps: GGT.fps,
  duration: VO.duration,
  look: "A",
  type: TYPE_LOOKS.A,
  words: WORDS,
  sequences: [GG_YARD, GG_STEEL],
  facts: [{ text: "Shamsulhaq Iraki", source: "the narration script; IPO coverage of the DRHP names the promoters Inamulhaq Shamsulhaq Iraki and Abdulhaq Shamsulhaq Iraki", confirmed: true }],
};
