// The display list: a frame of a sequence is an ordered list of these items, back to front, and nothing else.
// A sequence's `frame(t)` returns the list; one generic view (Display.tsx) turns it into SVG, and the dry run
// (tools/check.ts) inspects the very same list. So what is checked is what is drawn, and a sequence cannot
// reach for anything the look does not allow: there is no item for a filter, a blur or a blend mode.
import type { FigureOut } from "../figure/body.ts";
import type { Pt } from "../geom/vec.ts";
import type { Actor } from "../motion/actor.ts";
import type { View } from "../stage/camera.ts";
import type { TypeBlock } from "../type/blockspec.ts";
import type { Shape, ToneName } from "./shape.ts";

/** "screen" = fixed to the frame (a sky, a sun); a number = a camera layer at that depth (0 = the actors' plane). */
export type Space = "screen" | number;

export interface Stop {
  /** 0..1 along the gradient */
  at: number;
  color: string;
  /** opacity of this stop */
  a: number;
  /** when given, the painter's tone of that material (under `light`, or the sequence's own light) replaces `color` */
  tone?: { mat: string; tone: ToneName | "rim"; light?: string };
}

export type Fill =
  | { kind: "solid"; color: string }
  | { kind: "linear"; x1: number; y1: number; x2: number; y2: number; stops: Stop[] }
  /**
   * `sy` squashes the gradient about its centre (a flat band of haze).
   * `box: true` fits the gradient to each path's own bounding box instead (cx, cy and r are then ignored).
   */
  | { kind: "radial"; cx: number; cy: number; r: number; stops: Stop[]; sy?: number; box?: boolean }
  /** the ribs of a rod: a tile `w` wide and `pitch` high, anchored at (x, y), each rib leaning by `lean` px */
  | { kind: "ribs"; x: number; y: number; w: number; pitch: number; lean: number; thick: number; mat: string; light?: string };

interface ItemBase {
  /** unique within a frame and stable from frame to frame */
  id: string;
  space: Space;
  opacity?: number;
}

/** Shapes for the painter of the look: this is how everything solid is drawn. */
export interface PaintItem extends ItemBase {
  kind: "paint";
  shapes: readonly Shape[];
  /** name of one of the sequence's lights (default: the sequence's own) */
  light?: string;
}

/** Light and air: outlines filled with a flat colour, a gradient or a pattern. Never shaded. */
export interface FillItem extends ItemBase {
  kind: "fill";
  fill: Fill;
  paths: Pt[][];
  /** "evenodd" makes a second path cut a hole in the first */
  rule?: "evenodd";
}

/**
 * Cast shadows. A shadow is the surface it falls on, unlit: the casters' outlines are filled with one tone of the
 * material `on`. With `ground`, each outline is first laid down along the ground away from the light; with `shift`
 * it is simply moved (a shadow on a wall behind the caster).
 */
export interface ShadowItem extends ItemBase {
  kind: "shadow";
  casters: readonly Shape[];
  on: string;
  tone?: ToneName;
  light?: string;
  shift?: Pt;
  ground?: { y: number; stretch?: number; drop?: number };
}

/** Designed type (see engine/type/blockspec.ts). The block animates itself from the frame's time. */
export interface TypeItem extends ItemBase {
  kind: "type";
  block: TypeBlock;
  /**
   * What the type stands against, for the contrast check: palette materials or hex colours.
   * Type that belongs to the world (a date on a calendar, a sign) says `world: true` in its block instead.
   */
  over?: string[];
  /** the same for the block's small label, when that sits against something else (default: `over`) */
  overLabel?: string[];
}

/** Items that share an opacity, a clip, or a scale about a point. Children are drawn in the group's space. */
export interface GroupItem extends ItemBase {
  kind: "group";
  items: Item[];
  /** only what lies inside these outlines shows (several outlines add up) */
  clip?: Pt[][];
  /** scale about a point (a shadow that grows from its feet) */
  about?: Pt;
  scale?: number;
}

export type Item = PaintItem | FillItem | ShadowItem | TypeItem | GroupItem;

/** A figure in the frame, for the checks: joints, pinned hands, planted feet, and heads that type must not cover. */
export interface FigureRef {
  name: string;
  fig: FigureOut;
  actor?: Actor;
  /** depth of the layer the figure is drawn in (default 0) */
  space?: number;
  /** false for a figure whose head may pass under type (a silhouette crossing close to the lens, a shadow on a wall) */
  head?: boolean;
}

/** Everything that is drawn at one moment of a sequence. */
export interface FrameList {
  /** seconds of film time */
  t: number;
  view: View;
  items: Item[];
  figures?: FigureRef[];
}

// ---- small builders, so a frame file reads as a list

export const paint = (id: string, space: Space, shapes: readonly Shape[], extra: Partial<Omit<PaintItem, "kind" | "id" | "space" | "shapes">> = {}): PaintItem => ({ kind: "paint", id, space, shapes, ...extra });

export const fill = (id: string, space: Space, f: Fill, paths: Pt[][], extra: Partial<Omit<FillItem, "kind" | "id" | "space" | "fill" | "paths">> = {}): FillItem => ({ kind: "fill", id, space, fill: f, paths, ...extra });

export const shadow = (id: string, space: Space, casters: readonly Shape[], on: string, extra: Partial<Omit<ShadowItem, "kind" | "id" | "space" | "casters" | "on">> = {}): ShadowItem => ({ kind: "shadow", id, space, casters, on, ...extra });

export const type = (id: string, space: Space, block: TypeBlock, over?: string[], overLabel?: string[]): TypeItem => ({ kind: "type", id, space, block, over, overLabel });

export const group = (id: string, space: Space, items: Item[], extra: Partial<Omit<GroupItem, "kind" | "id" | "space" | "items">> = {}): GroupItem => ({ kind: "group", id, space, items, ...extra });

/** A rectangle as an outline, for fills and clips. */
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** A gradient from one colour to nothing (or between two opacities of one colour): the usual way to lay air or light over a surface. */
export const fade = (color: string, a0: number, a1: number): Stop[] => [
  { at: 0, color, a: a0 },
  { at: 1, color, a: a1 },
];

/** Every item of a list, with groups opened up (for the checks). */
export function flatItems(items: readonly Item[], out: { item: Exclude<Item, GroupItem>; opacity: number; space: Space }[] = [], opacity = 1, space?: Space) {
  for (const it of items) {
    const o = opacity * (it.opacity ?? 1);
    const sp = space ?? it.space;
    if (it.kind === "group") flatItems(it.items, out, o, sp);
    else out.push({ item: it, opacity: o, space: sp });
  }
  return out;
}
