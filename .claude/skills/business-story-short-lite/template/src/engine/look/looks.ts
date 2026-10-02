// The three looks as tokens. A painter reads these; a beat never does.
import type { ToneRecipe } from "./color.ts";

export type LookId = "A" | "B" | "C";

export interface Look {
  id: LookId;
  name: string;
  recipe: ToneRecipe;
  /** multiplies a shape's depth to get the core-shadow width */
  shadeShift: number;
  /** rim light width in px at zoom 1 (0 = none) */
  rim: number;
  /** ink outline: colour, width in screen px (constant whatever the zoom), extra weight on the shadow side */
  ink: { color: string; width: number; swell: number } | null;
  /** cut paper: pale cut edge, hard drop shadow, halftone in the shadows */
  paper: { edge: string; edgeWidth: number; drop: readonly [number, number]; dropOpacity: number; dot: number } | null;
  /** opacity of shadows thrown on the ground */
  castOpacity: number;
  /** how people are drawn in this look */
  people: PeopleStyle;
}

export interface PeopleStyle {
  /** head size against the body (1 = the build's own proportion) */
  head: number;
  /** dot eyes, or whites with pupils */
  eyes: "dot" | "white";
  /** size of the features on the face */
  feature: number;
  /** drawn lines for the nose and lashes (look B) */
  lines: boolean;
  /** paper fasteners at the joints (look C) */
  brads: boolean;
}

export const LOOK_A: Look = {
  id: "A",
  name: "Lineless graphic",
  recipe: { shadeDrop: 0.22, shadeChroma: 1.1, shadeHue: 12, lightLift: 0.12, lightChroma: 0.9, lightHue: 8 },
  shadeShift: 1,
  rim: 3.2,
  ink: null,
  paper: null,
  castOpacity: 0.3,
  people: { head: 1.08, eyes: "dot", feature: 1.06, lines: false, brads: false },
};

export const LOOK_B: Look = {
  id: "B",
  name: "Upgraded cartoon",
  recipe: { shadeDrop: 0.3, shadeChroma: 1.12, shadeHue: 14, lightLift: 0.16, lightChroma: 0.85, lightHue: 8 },
  shadeShift: 1.25,
  rim: 0,
  ink: { color: "#2a1c1b", width: 4.6, swell: 0.75 },
  paper: null,
  castOpacity: 0.34,
  people: { head: 1.18, eyes: "white", feature: 1.12, lines: true, brads: false },
};

export const LOOK_C: Look = {
  id: "C",
  name: "Editorial mixed-media",
  recipe: { shadeDrop: 0.3, shadeChroma: 1.0, shadeHue: 6, lightLift: 0.1, lightChroma: 0.9, lightHue: 4 },
  shadeShift: 1.1,
  rim: 0,
  ink: null,
  paper: { edge: "#f6efdf", edgeWidth: 3, drop: [5, 7], dropOpacity: 0.26, dot: 7 },
  castOpacity: 0.22,
  people: { head: 1.1, eyes: "dot", feature: 1.15, lines: false, brads: true },
};

export const LOOKS: Record<LookId, Look> = { A: LOOK_A, B: LOOK_B, C: LOOK_C };
