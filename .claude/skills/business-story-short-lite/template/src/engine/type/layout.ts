// Type layout from font metrics. Pure: the same numbers place the glyphs in the browser and feed the checks in Node.
import { FONT_METRICS, type FaceName } from "./metrics.ts";

export type { FaceName };

export interface Glyph {
  ch: string;
  x: number; // left edge of the glyph's box, px from the start of the line
  w: number; // advance or cell width, px
  cx: number; // centre of the box
}

export interface Line {
  glyphs: Glyph[];
  width: number;
  capHeight: number; // px
  xHeight: number;
  size: number;
  face: FaceName;
}

const DIGIT = /[0-9]/;

/**
 * Lays a string out glyph by glyph.
 * `cells`: every digit sits centred in an equal cell (use for numbers that count or change, so nothing jitters).
 * `tracking`: extra space after each glyph, in em.
 */
export function layout(text: string, face: FaceName, size: number, opts: { cells?: boolean; tracking?: number } = {}): Line {
  const m = FONT_METRICS[face];
  const adv = m.adv as Record<string, number>;
  const tracking = (opts.tracking ?? 0) * size;
  const cell = (m.digitCell ?? 0.6) * size;
  const glyphs: Glyph[] = [];
  let x = 0;
  for (const ch of text) {
    const a = adv[ch];
    if (a === undefined) throw new Error(`"${ch}" is not in ${face}; add it to NEED in tools/fonts.py or change the text`);
    const w = opts.cells && DIGIT.test(ch) ? cell : a * size;
    glyphs.push({ ch, x, w, cx: x + w / 2 });
    x += w + tracking;
  }
  return { glyphs, width: Math.max(0, x - tracking), capHeight: m.capHeight * size, xHeight: m.xHeight * size, size, face };
}

/** Font size that gives a wanted cap height in px. */
export const sizeForCap = (face: FaceName, capPx: number) => capPx / FONT_METRICS[face].capHeight;

/** Font size at which `text` is `widthPx` wide. */
export function sizeForWidth(text: string, face: FaceName, widthPx: number, opts: { cells?: boolean; tracking?: number } = {}) {
  return widthPx / layout(text, face, 1, opts).width;
}

/** 150000 -> "1,50,000" (Indian grouping). */
export function groupIndian(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  if (s.length <= 3) return (n < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + rest + "," + last3;
}
