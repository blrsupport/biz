// Lofted volumes. A head or a torso is described once, as cross-sections stacked along an axis, and can then be
// seen from any side: the outline, the place of every feature and the visible part of hair or a beard all come
// from the same form. This is what lets one drawing turn smoothly from front to profile.
//
// Body space: X = toward the character's left, Z = the way the character faces, v = down the axis.
// Yaw 0 faces the camera; +90 degrees faces screen right. A point shows at lateral position
// l = X*cos(yaw) + Z*sin(yaw), so "loft space" is the flat (l, v) plane the caller maps onto the screen.
import { inflate, spline } from "../geom/outline.ts";
import { area, clamp, smoothstep, type Pt } from "../geom/vec.ts";

/** How much of its volume a patch keeps at the point where its edge meets the silhouette. */
const END = 0.3;

export interface Section {
  /** half-width seen from the front */
  a: number;
  /** front and back surface along Z */
  zf: number;
  zb: number;
  /** Z of the widest point */
  zm: number;
}

export interface Loft {
  v0: number;
  v1: number;
  at(v: number): Section;
}

/** Smooth curve through (x, y) knots, x ascending (cubic Hermite with Catmull-Rom tangents). */
export function curve1(knots: readonly (readonly [number, number])[]): (x: number) => number {
  const n = knots.length;
  const xs = knots.map((k) => k[0]);
  const ys = knots.map((k) => k[1]);
  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    m.push(b === a ? 0 : (ys[b] - ys[a]) / (xs[b] - xs[a]));
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Where a horizontal line at height y crosses a closed polyline: [min x, max x]. */
function scan(poly: readonly Pt[], y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    if (a[1] <= y === b[1] <= y) continue;
    const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return lo <= hi ? [lo, hi] : null;
}

/**
 * A loft from two drawn outlines: the right half of the front view (x >= 0, top to bottom) and the whole side
 * view facing +z (closed, as (z, y) points). `widest(y)` says how far from back (0) to front (1) the widest
 * point of each cross-section lies.
 */
export function loftFromOutlines(front: readonly Pt[], side: readonly Pt[], widest: (v: number) => number = () => 0.5): Loft {
  const full: Pt[] = [...front];
  for (let i = front.length - 1; i >= 0; i--) if (front[i][0] > 1e-6) full.push([-front[i][0], front[i][1]]);
  const fp = spline(full, { closed: true, step: 0.008 });
  const sp = spline(side.slice(), { closed: true, step: 0.008 });
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of sp) {
    if (p[1] < v0) v0 = p[1];
    if (p[1] > v1) v1 = p[1];
  }
  const N = 140;
  const eps = (v1 - v0) * 0.002;
  const rows: Section[] = [];
  for (let i = 0; i <= N; i++) {
    const v = v0 + eps + ((v1 - v0 - 2 * eps) * i) / N;
    const f = scan(fp, v);
    const s = scan(sp, v) ?? [0, 0];
    const a = f ? Math.max(0.002, f[1]) : 0.002;
    const w = clamp(widest(v), 0, 1);
    rows.push({ a, zf: s[1], zb: s[0], zm: s[0] + (s[1] - s[0]) * w });
  }
  return {
    v0,
    v1,
    at(v: number): Section {
      const u = clamp(((v - v0 - eps) / (v1 - v0 - 2 * eps)) * N, 0, N);
      const i = Math.min(N - 1, Math.floor(u));
      const t = u - i;
      const p = rows[i];
      const q = rows[i + 1];
      return { a: p.a + (q.a - p.a) * t, zf: p.zf + (q.zf - p.zf) * t, zb: p.zb + (q.zb - p.zb) * t, zm: p.zm + (q.zm - p.zm) * t };
    },
  };
}

/** A loft from a table of cross-sections (the torso). */
export function loftFromRows(rows: readonly { v: number; a: number; zf: number; zb: number; zm?: number }[]): Loft {
  const a = curve1(rows.map((r) => [r.v, r.a] as const));
  const zf = curve1(rows.map((r) => [r.v, r.zf] as const));
  const zb = curve1(rows.map((r) => [r.v, r.zb] as const));
  const zm = curve1(rows.map((r) => [r.v, r.zm ?? (r.zf + r.zb) / 2] as const));
  return {
    v0: rows[0].v,
    v1: rows[rows.length - 1].v,
    at: (v: number) => ({ a: Math.max(0.002, a(v)), zf: zf(v), zb: zb(v), zm: zm(v) }),
  };
}

export interface SurfPt {
  /** lateral position in loft space */
  l: number;
  /** depth toward the camera */
  zc: number;
  /** cosine between the surface normal and the view: > 0 faces the camera */
  vis: number;
}

export interface LoftView {
  loft: Loft;
  yawAt(v: number): number;
  /** left and right edge of the silhouette at v */
  edge(v: number): [number, number];
  /** a point on the surface at angle alpha round the cross-section (0 = front, +90 deg = character's left) */
  point(alpha: number, v: number, lift?: number): SurfPt;
  /** a point on the front of the surface, given by where it sits in the front view; k = how wide things there look */
  front(x: number, v: number, lift?: number): SurfPt & { k: number };
  /** the silhouette as a closed outline in loft space, clockwise */
  outline(levels?: number): Pt[];
  levels(n: number): number[];
  /** which part of the surface (angle round the cross-section, radians) forms the left (-1) or right (1) edge at v */
  edgeAlpha(v: number, side: -1 | 1): number;
}

export function viewLoft(loft: Loft, yaw: number | ((v: number) => number)): LoftView {
  const yawAt = typeof yaw === "number" ? () => yaw : yaw;
  const edge = (v: number): [number, number] => {
    const s = loft.at(v);
    const ps = yawAt(v);
    const c = Math.cos(ps);
    const sn = Math.sin(ps);
    const f = s.zf - s.zm;
    const b = s.zm - s.zb;
    return [s.zm * sn - Math.hypot(s.a * c, (sn >= 0 ? b : f) * sn), s.zm * sn + Math.hypot(s.a * c, (sn >= 0 ? f : b) * sn)];
  };
  const point = (alpha: number, v: number, lift = 0): SurfPt => {
    const s = loft.at(v);
    const ps = yawAt(v);
    const c = Math.cos(ps);
    const sn = Math.sin(ps);
    const sa = Math.sin(alpha);
    const ca = Math.cos(alpha);
    const D = Math.max(1e-4, ca >= 0 ? s.zf - s.zm : s.zm - s.zb);
    let nx = sa / Math.max(1e-4, s.a);
    let nz = ca / D;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const X = s.a * sa + nx * lift;
    const Z = s.zm + D * ca + nz * lift;
    return { l: X * c + Z * sn, zc: -X * sn + Z * c, vis: -sn * nx + c * nz };
  };
  const front = (x: number, v: number, lift = 0): SurfPt & { k: number } => {
    const s = loft.at(v);
    const r = clamp(x / Math.max(1e-4, s.a), -0.999, 0.999);
    const alpha = Math.asin(r);
    const ps = yawAt(v);
    const k = Math.cos(ps) - ((s.zf - s.zm) / Math.max(1e-4, s.a)) * Math.tan(alpha) * Math.sin(ps);
    return { ...point(alpha, v, lift), k };
  };
  const levels = (n: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(loft.v0 + ((loft.v1 - loft.v0) * (1 - Math.cos((Math.PI * (i + 0.5)) / n))) / 2);
    return out;
  };
  const outline = (n = 40): Pt[] => {
    const lv = levels(n);
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (const v of lv) {
      const e = edge(v);
      left.push([e[0], v]);
      right.push([e[1], v]);
    }
    return [...left.reverse(), ...right];
  };
  const edgeAlpha = (v: number, side: -1 | 1): number => {
    const s = loft.at(v);
    const ps = yawAt(v);
    const c = Math.cos(ps) * side;
    const sn = Math.sin(ps) * side;
    const D = sn >= 0 ? s.zf - s.zm : s.zm - s.zb;
    return Math.atan2(s.a * c, D * sn);
  };
  return { loft, yawAt, edge, point, front, outline, levels, edgeAlpha };
}

export interface LoopPt {
  alpha: number;
  v: number;
  lift?: number;
}

/**
 * The visible part of a patch of the surface (hair, a beard, a cap, a waistcoat opening), as an outline in loft space.
 * `loop` is the edge of the patch, drawn on the surface. Where the edge goes round the back, the outline follows the
 * silhouette instead: over the top for hair and caps, under the bottom for beards.
 * `grow` pushes the outline outward: `edge(v)` where it follows the silhouette (hair has volume), `line` elsewhere.
 */
export function region(
  view: LoftView,
  loop: readonly LoopPt[],
  via: "top" | "bottom",
  grow: { edge?: (v: number, side: -1 | 1) => number; line?: number } = {},
  levelCount = 44,
): Pt[] {
  const n = loop.length;
  const pr = loop.map((q) => view.point(q.alpha, q.v, q.lift ?? 0));
  const vis = pr.map((p) => p.vis > 0);
  const pts: Pt[] = [];
  const g: number[] = [];
  const gLine = grow.line ?? 0;
  const gEdge = grow.edge ?? (() => 0);
  if (vis.every((x) => x)) {
    for (let i = 0; i < n; i++) {
      pts.push([pr[i].l, loop[i].v]);
      g.push(gLine);
    }
  } else if (!vis.some((x) => x)) {
    return [];
  } else {
    const lv = view.levels(levelCount);
    const crossing = (iv: number, ih: number): { v: number; side: -1 | 1; pt: Pt } => {
      const a = pr[iv];
      const b = pr[ih];
      const t = a.vis / (a.vis - b.vis);
      const v = loop[iv].v + (loop[ih].v - loop[iv].v) * t;
      const l = a.l + (b.l - a.l) * t;
      const e = view.edge(v);
      const side: -1 | 1 = Math.abs(l - e[0]) < Math.abs(l - e[1]) ? -1 : 1;
      return { v, side, pt: [side < 0 ? e[0] : e[1], v] };
    };
    // the volume tapers toward the point where the patch edge meets the silhouette, so no horn forms there
    const lo = view.loft.v0;
    const hi = view.loft.v1;
    const taper = (v: number, c: number) => (c < lo || c > hi ? 1 : END + (1 - END) * smoothstep(0, 0.1, Math.abs(v - c)));
    const along = (side: -1 | 1, from: number, to: number) => {
      const up = to < from;
      const list = lv.filter((v) => (up ? v < from - 1e-6 && v > to + 1e-6 : v > from + 1e-6 && v < to - 1e-6));
      if (up) list.reverse();
      for (const v of list) {
        const e = view.edge(v);
        pts.push([side < 0 ? e[0] : e[1], v]);
        g.push(gLine + (gEdge(v, side) - gLine) * Math.min(taper(v, from), taper(v, to)));
      }
    };
    let start = 0;
    while (!(vis[start] && !vis[(start + n - 1) % n])) start++;
    let i = start;
    let done = 0;
    while (done < n) {
      const cin = crossing(i % n, (i + n - 1) % n);
      pts.push(cin.pt);
      g.push(gLine + (gEdge(cin.v, cin.side) - gLine) * END);
      while (done < n && vis[i % n]) {
        pts.push([pr[i % n].l, loop[i % n].v]);
        g.push(gLine);
        i++;
        done++;
      }
      const cout = crossing((i + n - 1) % n, i % n);
      pts.push(cout.pt);
      g.push(gLine + (gEdge(cout.v, cout.side) - gLine) * END);
      while (done < n && !vis[i % n]) {
        i++;
        done++;
      }
      const next = crossing(i % n, (i + n - 1) % n);
      if (cout.side === next.side) {
        along(cout.side, cout.v, next.v);
      } else if (via === "top") {
        along(cout.side, cout.v, view.loft.v0 - 1);
        along(next.side, view.loft.v0 - 1, next.v);
      } else {
        along(cout.side, cout.v, view.loft.v1 + 1);
        along(next.side, view.loft.v1 + 1, next.v);
      }
    }
  }
  if (pts.length < 3) return [];
  if (area(pts) < 0) {
    pts.reverse();
    g.reverse();
  }
  return g.some((x) => x !== 0) ? inflate(pts, (k) => g[k]) : pts;
}

/** A smooth line round the cross-section given as (angle in degrees, v) knots; one-sided knot lists are mirrored. */
export function ringLine(knots: readonly (readonly [number, number])[]): (alphaDeg: number) => number {
  const mirrored = knots[0][0] >= 0;
  const f = curve1(knots);
  return (deg: number) => {
    let d = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (mirrored) d = Math.abs(d);
    return f(d);
  };
}

/** The loop of a ring line all the way round, for `region`. */
export function ringLoop(line: (alphaDeg: number) => number, stepDeg = 5, lift = 0): LoopPt[] {
  const out: LoopPt[] = [];
  for (let d = -180; d < 180; d += stepDeg) out.push({ alpha: (d * Math.PI) / 180, v: line(d), lift });
  return out;
}
