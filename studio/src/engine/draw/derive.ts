// Shapes derived from other shapes: rim light, ink outline, shadows on the ground. Pure geometry, no SVG.
import { clipConvex, normalsOf } from "../geom/outline.ts";
import { area, clamp, dot, smoothstep, type Pt } from "../geom/vec.ts";
import type { Shape } from "./shape.ts";

/**
 * The parts of flat set shapes that lie inside the sun's patch (a convex outline), as new shapes in each one's
 * sunlit material: `wall` gives `wall.sun`, with the id `<id>.sun`. Paint them over the unlit ones.
 * A shape is lit as a whole, so only flat shapes can be cut this way; a round form stands on one side of the edge.
 */
export function litParts(shapes: readonly Shape[], patch: readonly Pt[], suffix = ".sun"): Shape[] {
  const out: Shape[] = [];
  for (const s of shapes) {
    const c = clipConvex(s.pts, patch);
    if (c.length < 3 || Math.abs(area(c)) < 1) continue;
    out.push({ ...s, id: `${s.id}${suffix}`, mat: `${s.mat}${suffix}`, pts: area(c) < 0 ? c.reverse() : c });
  }
  return out;
}

/**
 * Rim light: thin slivers along the edges that face the light, widest where the edge faces it squarely.
 * Returned as closed polygons that sit just inside the outline.
 */
export function rimRuns(pts: readonly Pt[], dir: Pt, width: number): Pt[][] {
  const n = pts.length;
  if (n < 8 || width <= 0) return [];
  const nn = normalsOf(pts);
  const w: number[] = [];
  for (let i = 0; i < n; i++) w.push(width * smoothstep(0.1, 0.75, dot(nn[i], dir)));
  // start from an unlit vertex so that a run never wraps around the end of the array
  let start = w.findIndex((v) => v <= 0.01);
  if (start < 0) start = 0;
  const runs: Pt[][] = [];
  let outer: Pt[] = [];
  let inner: Pt[] = [];
  const flush = () => {
    if (outer.length >= 3) runs.push([...outer, ...inner.reverse()]);
    outer = [];
    inner = [];
  };
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n;
    if (w[i] > 0.01 && k < n) {
      outer.push(pts[i]);
      inner.push([pts[i][0] - nn[i][0] * w[i], pts[i][1] - nn[i][1] * w[i]]);
    } else {
      flush();
    }
  }
  return runs;
}

/**
 * Ink outline as two rings (fill with the even-odd rule). The line is heavier on the side away from the light,
 * the way an inker weights a line.
 */
export function inkRing(pts: readonly Pt[], dir: Pt, width: number, swell: number): { outer: Pt[]; inner: Pt[] } {
  const nn = normalsOf(pts);
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const away = Math.max(0, -dot(nn[i], dir));
    const h = (width * (1 + swell * away)) / 2;
    outer.push([pts[i][0] + nn[i][0] * h * 0.9, pts[i][1] + nn[i][1] * h * 0.9]);
    inner.push([pts[i][0] - nn[i][0] * h * 1.1, pts[i][1] - nn[i][1] * h * 1.1]);
  }
  return { outer, inner };
}

/**
 * The shadow an upright shape throws on level ground: every point is slid along the ground in proportion to
 * its height. `drop` moves the shadow down the screen per unit of height (the ground seen slightly from above).
 */
export function groundShadow(pts: readonly Pt[], groundY: number, dir: Pt, opts: { stretch?: number; drop?: number; maxLen?: number } = {}): Pt[] {
  const k = clamp((dir[0] / Math.min(-0.15, dir[1])) * (opts.stretch ?? 1), -(opts.maxLen ?? 3.2), opts.maxLen ?? 3.2);
  const drop = opts.drop ?? 0.1;
  return pts.map((p) => {
    const h = Math.max(0, groundY - p[1]);
    return [p[0] + h * k, groundY + h * drop] as Pt;
  });
}
