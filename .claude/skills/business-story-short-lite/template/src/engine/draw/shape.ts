// "Drawings are data." Characters, props and effects return lists of these; one painter per look turns them into SVG.
// Because a drawing is only points and a material, the same description gives three looks, cast shadows,
// colour-ID mattes and geometry checks that run without a browser.
import { area, type Pt } from "../geom/vec.ts";

export type ToneName = "base" | "shade" | "deep" | "light";

export interface Shape {
  /** unique within a frame, path-like: "rahul/arm.near/upper" */
  id: string;
  /** closed outline, clockwise on screen, stage pixels */
  pts: Pt[];
  /** material: a key of the film's palette ("skin.rahul", "kurta", "steel") */
  mat: string;
  /**
   * round: a rounded form with a core shadow on the side away from the light (default)
   * flat:  one tone, no shading (small details, far silhouettes)
   * plane: a flat face that is lit or not as a whole, by its `facing`
   */
  form?: "round" | "flat" | "plane";
  /** round: how deep the form is, in px; the core shadow is about this wide */
  depth?: number;
  /** plane: outward normal of the face in screen space */
  facing?: Pt;
  /** flat: which tone to fill with */
  tone?: ToneName;
  /** outlines of parts in front of this one that throw a contact shadow onto it */
  casts?: { pts: Pt[]; reach?: number }[];
  /** look B: outline weight multiplier (0 = no outline) */
  ink?: number;
  /** look C: cut-paper edge and drop shadow (default true for round and plane) */
  paper?: boolean;
  /** rim-light multiplier for look A (0 = none) */
  rim?: number;
  opacity?: number;
  /** literal colour instead of a palette material (type, effects); use sparingly */
  color?: string;
}

/** Film palette: material name -> base colour. Shade and light tones are computed, never listed. */
export type Palette = Readonly<Record<string, string>>;

/**
 * Spreads palettes into one, and throws when two of them give one name two different colours.
 * (A plain `{ ...A, ...B }` lets the later one win without a word.)
 */
export function mergePalettes(...list: Palette[]): Palette {
  const out: Record<string, string> = {};
  for (const p of list) {
    for (const [k, v] of Object.entries(p)) {
      if (out[k] !== undefined && out[k].toLowerCase() !== v.toLowerCase()) throw new Error(`the material "${k}" has two colours in the palettes being merged (${out[k]} and ${v}): rename one of them`);
      out[k] = v;
    }
  }
  return out;
}

/** Makes a shape. Outlines are stored clockwise, which the rim light and ink outline rely on. */
export const shape = (id: string, mat: string, pts: Pt[], extra: Partial<Shape> = {}): Shape => ({
  id,
  mat,
  pts: area(pts) < 0 ? pts.slice().reverse() : pts,
  ...extra,
});
