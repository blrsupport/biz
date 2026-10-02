// Moving and turning finished shapes (a prop carried at a tilt, a part that swings on a hook).
import { add, rot, sub, type Pt } from "../geom/vec.ts";
import type { Shape } from "./shape.ts";

const map = (s: Shape, f: (p: Pt) => Pt): Shape => ({ ...s, pts: s.pts.map(f), casts: s.casts?.map((c) => ({ ...c, pts: c.pts.map(f) })) });

/** Turns shapes about `o` by `ang` radians (clockwise on screen). */
export function turnShapes(shapes: readonly Shape[], o: Pt, ang: number): Shape[] {
  if (Math.abs(ang) < 1e-6) return shapes.slice();
  return shapes.map((s) => map(s, (p) => add(o, rot(sub(p, o), ang))));
}

export function moveShapes(shapes: readonly Shape[], d: Pt): Shape[] {
  if (Math.abs(d[0]) + Math.abs(d[1]) < 1e-6) return shapes.slice();
  return shapes.map((s) => map(s, (p) => add(p, d)));
}
