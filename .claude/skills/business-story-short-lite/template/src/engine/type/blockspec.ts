// What is written on screen, as data. A take describes each block with one of these; Blocks.tsx draws it, and
// `measure` gives the checks the same boxes the drawing uses (where each spoken piece is, how big, from when).
import type { Box } from "../geom/vec.ts";
import type { LookId } from "../look/looks.ts";
import { layout, sizeForCap, type FaceName, type Line } from "./layout.ts";

export interface TypeLook {
  number: FaceName;
  /** another face for the rupee sign, where the number face draws it poorly */
  rupee?: FaceName;
  name: FaceName;
  label: FaceName;
  ink: string;
  accent: string;
  tracking: number;
}

/** Faces and colours per look. A film may copy one of these and change `ink` and `accent` to suit its palette. */
export const TYPE_LOOKS: Record<LookId, TypeLook> = {
  A: { number: "FrauncesDisplay", rupee: "InterBlack", name: "FrauncesDisplay", label: "InterBlack", ink: "#2a1d1b", accent: "#bf3f2a", tracking: 0.14 },
  B: { number: "Baloo", name: "Baloo", label: "InterBlack", ink: "#2a1c1b", accent: "#c8402a", tracking: 0.12 },
  C: { number: "Anton", name: "FrauncesItalic", label: "PlexMono", ink: "#1f1a1a", accent: "#c23a26", tracking: 0.04 },
};

export const RUPEE = "₹";

/** A small caps label over a rule, and under it a large amount. Each spoken piece of the amount lands on its own moment. */
export interface NumberCue {
  /** left edge and the label's baseline, in the coordinates of the layer the block is drawn in */
  x: number;
  y: number;
  /** cap height of the amount, px, and the widest it may be */
  cap: number;
  maxW: number;
  label: { text: string; at: number };
  /** the amount, in the pieces it is spoken in */
  parts: { text: string; at: number }[];
  /** a year that lands large where the amount will go, then shrinks up to lead the label at `join` */
  stamp?: { text: string; at: number; join: number };
  /** when the whole block leaves */
  out?: number;
  labelSize?: number;
}

/** A year, very large, and under it a place (or any short label) that sets on its own word. */
export interface YearCue {
  /** left edge and the baseline of the year */
  x: number;
  y: number;
  cap: number;
  maxW: number;
  year: { text: string; at: number };
  place?: { text: string; at: number; size?: number };
  out?: number;
  /** glyphs whose middle is to the right of this x have been passed by something in front, and are gone */
  wipeX?: number;
}

/** A small caps lead-in over a rule, and under it a name, each spoken piece of it rising in on its own moment. */
export interface NameCue {
  /** left edge and the label's baseline */
  x: number;
  y: number;
  cap: number;
  maxW: number;
  label: { text: string; at: number };
  /** the name, in the pieces it is spoken in (each with its own leading space, if any) */
  parts: { text: string; at: number }[];
  out?: number;
  labelSize?: number;
}

/** A few words, large, one line per thing said. `lead` is set in the accent colour. */
export interface PhraseCue {
  x: number;
  /** baseline of the first line */
  y: number;
  /** font size: the largest that keeps the longest line inside maxW, up to `size` */
  size: number;
  maxW: number;
  /** distance between baselines, as a multiple of the cap height (default 1.5) */
  leading?: number;
  lines: { lead?: string; text: string; at: number }[];
  out?: number;
}

/** One line of plain type: something printed in the world (a date on a calendar, a sign). It does not animate. */
export interface LineCue {
  text: string;
  face: "number" | "name" | "label";
  /** cap height, px */
  cap: number;
  x: number;
  /** baseline */
  y: number;
  color: string;
  align?: "start" | "middle" | "end";
  tracking?: number;
}

export interface GlyphMove {
  dx?: number;
  dy?: number;
  scale?: number;
  opacity?: number;
  rotate?: number;
}

/**
 * A line whose glyphs the take moves itself (for a treatment the four blocks do not give).
 * Each run is one spoken piece: its glyphs, its colour now, where each glyph is now, and the moment it lands.
 */
export interface GlyphsCue {
  line: Line;
  x: number;
  y: number;
  runs: { text: string; at: number; from: number; to: number; color: string; each: GlyphMove[] }[];
}

export type TypeBlock =
  | ({ kind: "number" } & NumberCue)
  | ({ kind: "year" } & YearCue)
  | ({ kind: "name" } & NameCue)
  | ({ kind: "phrase" } & PhraseCue)
  | ({ kind: "line" } & LineCue)
  | ({ kind: "glyphs" } & GlyphsCue);

/** One spoken piece of a block, for the checks. */
export interface TypePart {
  /** "label", "amount.0", "name.1", "line.0" ... */
  name: string;
  text: string;
  /** when it lands */
  at: number;
  /** when it is gone (undefined = it stays to the end of the sequence) */
  out?: number;
  /** where it is, in the block's own layer */
  box: Box;
  /** cap height in the layer's px */
  cap: number;
  /** which size rule applies: a number, words (a name, a phrase), a small label, or something printed in the world */
  role: "number" | "words" | "label" | "world";
  /** what it is set in: the look's ink, its accent, or a colour of its own */
  color: string;
  /** true once something passing in front has begun to cover it: it is on its way out */
  leaving?: boolean;
}

/** Geometry of a number block; shared by the drawing and the checks. */
export function numberLayout(c: NumberCue, T: TypeLook) {
  const labelSize = c.labelSize ?? 50;
  const amount = c.parts.map((p) => p.text).join("");
  const digits = amount.replace(RUPEE, "");
  const hasRupee = amount.includes(RUPEE);
  const rFace = T.rupee ?? T.number;
  // the sign and the digits share one cap height, whatever faces they come from
  const unitW = layout(digits, T.number, 1).width + (hasRupee ? layout(RUPEE, rFace, sizeForCap(rFace, 1) / sizeForCap(T.number, 1)).width * 1.12 : 0);
  const size = Math.min(sizeForCap(T.number, c.cap), c.maxW / unitW);
  const line = layout(digits, T.number, size);
  const rSize = sizeForCap(rFace, line.capHeight);
  const rupeeLine = layout(RUPEE, rFace, rSize);
  const rW = hasRupee ? rupeeLine.width * 1.12 : 0;
  const base = c.y + labelSize + line.capHeight;
  // which spoken piece each digit belongs to, and its place within that piece
  const when: { at: number; k: number; part: number }[] = [];
  c.parts.forEach((p, part) => {
    let k = p.text.includes(RUPEE) ? 1 : 0;
    for (const ch of p.text) if (ch !== RUPEE) when.push({ at: p.at, k: k++, part });
  });
  const small = c.stamp ? layout(c.stamp.text, T.label, labelSize, { tracking: T.tracking }) : null;
  const pre = c.stamp ? layout(`${c.stamp.text} `, T.label, labelSize, { tracking: T.tracking }).width + T.tracking * labelSize : 0;
  const lab = layout(c.label.text, T.label, labelSize, { tracking: T.tracking });
  const big = c.stamp ? layout(c.stamp.text, T.number, size) : null;
  return { labelSize, digits, hasRupee, size, line, rupeeLine, rW, base, when, small, pre, lab, big };
}

export function yearLayout(c: YearCue, T: TypeLook) {
  const size = Math.min(sizeForCap(T.number, c.cap), c.maxW / layout(c.year.text, T.number, 1).width);
  const line = layout(c.year.text, T.number, size);
  const pSize = c.place?.size ?? 62;
  const lab = c.place ? layout(c.place.text, T.label, pSize, { tracking: T.tracking }) : null;
  const py = c.y + pSize * 1.42;
  return { size, line, pSize, lab, py };
}

export function nameLayout(c: NameCue, T: TypeLook) {
  const labelSize = c.labelSize ?? 46;
  const name = c.parts.map((p) => p.text).join("");
  const size = Math.min(sizeForCap(T.name, c.cap), c.maxW / layout(name, T.name, 1).width);
  const line = layout(name, T.name, size);
  const lab = layout(c.label.text, T.label, labelSize, { tracking: T.tracking });
  const when: { at: number; k: number; part: number }[] = [];
  c.parts.forEach((p, part) => {
    let k = 0;
    for (const ch of p.text) when.push({ at: p.at, k: ch === " " ? k : k++, part });
  });
  return { labelSize, size, line, lab, when, base: c.y + 50 + line.capHeight };
}

export function phraseLayout(c: PhraseCue, T: TypeLook) {
  const leading = c.leading ?? 1.5;
  const full = c.lines.map((l) => (l.lead ?? "") + l.text);
  const widest = Math.max(...full.map((s) => layout(s, T.name, 1).width));
  const sz = Math.min(c.size, c.maxW / widest);
  const lines = full.map((s) => layout(s, T.name, sz));
  return { leading, full, sz, lines, cap: lines[0].capHeight };
}

const span = (line: Line, x: number, idx: number[]): [number, number] => {
  const gs = idx.map((i) => line.glyphs[i]);
  return [x + Math.min(...gs.map((g) => g.x)), x + Math.max(...gs.map((g) => g.x + g.w))];
};

/** The spoken pieces of a block: what each says, when it lands, and the box it fills once it has landed. */
export function measure(b: TypeBlock, T: TypeLook): TypePart[] {
  const parts: TypePart[] = [];
  if (b.kind === "number") {
    const L = numberLayout(b, T);
    const x0 = b.x + 4 + L.pre;
    parts.push({ name: "label", text: b.label.text, at: b.label.at, out: b.out, box: { x0, y0: b.y - L.lab.capHeight, x1: x0 + L.lab.width, y1: b.y + 21 }, cap: L.lab.capHeight, role: "label", color: "accent" });
    b.parts.forEach((p, k) => {
      const idx = L.when.map((w, i) => (w.part === k ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      let [a, z] = span(L.line, b.x + L.rW, idx);
      if (p.text.includes(RUPEE)) a = b.x;
      // a comma hangs a little below the line
      parts.push({ name: `amount.${k}`, text: p.text, at: p.at, out: b.out, box: { x0: a, y0: L.base - L.line.capHeight, x1: z, y1: L.base + (p.text.includes(",") ? 0.2 * L.line.capHeight : 0) }, cap: L.line.capHeight, role: "number", color: "ink" });
    });
    if (b.stamp && L.big) {
      // large where the amount will go until it joins the label
      parts.push({ name: "stamp", text: b.stamp.text, at: b.stamp.at, out: b.stamp.join, box: { x0: b.x, y0: L.base - L.big.capHeight, x1: b.x + L.big.width, y1: L.base }, cap: L.big.capHeight, role: "number", color: "ink" });
    }
  } else if (b.kind === "year") {
    const L = yearLayout(b, T);
    parts.push({ name: "year", text: b.year.text, at: b.year.at, out: b.out, box: { x0: b.x, y0: b.y - L.line.capHeight, x1: b.x + L.line.width, y1: b.y + 8 }, cap: L.line.capHeight, role: "number", color: "ink" });
    if (b.place && L.lab) parts.push({ name: "place", text: b.place.text, at: b.place.at, out: b.out, box: { x0: b.x + 4, y0: L.py - L.lab.capHeight, x1: b.x + 4 + L.lab.width, y1: L.py + 22 }, cap: L.lab.capHeight, role: "label", color: "accent" });
    if (b.wipeX !== undefined) {
      // what something passing in front has covered is gone: only what is left of the wipe still shows
      const wx = b.wipeX;
      // (the block leaves as a whole: once the wipe has reached any piece of it, every piece is on its way out)
      const reached = parts.some((p) => wx < p.box.x1);
      for (const p of parts) {
        p.leaving = reached;
        p.box.x1 = Math.min(p.box.x1, wx);
      }
      return parts.filter((p) => p.box.x1 - p.box.x0 > 8);
    }
  } else if (b.kind === "name") {
    const L = nameLayout(b, T);
    parts.push({ name: "label", text: b.label.text, at: b.label.at, out: b.out, box: { x0: b.x + 3, y0: b.y - L.lab.capHeight, x1: b.x + 3 + L.lab.width, y1: b.y + 20 }, cap: L.lab.capHeight, role: "label", color: "accent" });
    b.parts.forEach((p, k) => {
      const idx = L.when.map((w, i) => (w.part === k && L.line.glyphs[i].ch !== " " ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      const [a, z] = span(L.line, b.x, idx);
      // room for a descender under the baseline
      parts.push({ name: `name.${k}`, text: p.text, at: p.at, out: b.out, box: { x0: a, y0: L.base - L.line.capHeight, x1: z, y1: L.base + 0.26 * L.size }, cap: L.line.capHeight, role: "words", color: "ink" });
    });
  } else if (b.kind === "phrase") {
    const L = phraseLayout(b, T);
    b.lines.forEach((l, k) => {
      const by = b.y + k * L.cap * L.leading;
      parts.push({ name: `line.${k}`, text: (l.lead ?? "") + l.text, at: l.at, out: b.out, box: { x0: b.x, y0: by - L.cap, x1: b.x + L.lines[k].width, y1: by + 0.26 * L.sz }, cap: L.cap, role: "words", color: "ink" });
    });
  } else if (b.kind === "line") {
    const face = T[b.face];
    const line = layout(b.text, face, sizeForCap(face, b.cap), { tracking: b.tracking });
    const x0 = b.align === "middle" ? b.x - line.width / 2 : b.align === "end" ? b.x - line.width : b.x;
    parts.push({ name: "line", text: b.text, at: -Infinity, box: { x0, y0: b.y - line.capHeight, x1: x0 + line.width, y1: b.y }, cap: line.capHeight, role: "world", color: b.color });
  } else {
    b.runs.forEach((r, k) => {
      const g0 = b.line.glyphs[r.from];
      const g1 = b.line.glyphs[r.to - 1];
      parts.push({ name: `run.${k}`, text: r.text, at: r.at, box: { x0: b.x + g0.x, y0: b.y - b.line.capHeight, x1: b.x + g1.x + g1.w, y1: b.y + 0.26 * b.line.size }, cap: b.line.capHeight, role: "words", color: r.color });
    });
  }
  return parts;
}
