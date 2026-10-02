// 2-D vector helpers. Screen coordinates: x right, y down. Angles in radians unless a name says deg.

export type Pt = readonly [number, number];

export const V = (x: number, y: number): Pt => [x, y];
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const unit = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]);
  return l < 1e-9 ? [1, 0] : [a[0] / l, a[1] / l];
};
/** Right-hand normal on screen: walking along `a`, this points to your right. */
export const perp = (a: Pt): Pt => [-a[1], a[0]];
export const neg = (a: Pt): Pt => [-a[0], -a[1]];
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const rot = (a: Pt, ang: number): Pt => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
};
export const rotAbout = (a: Pt, o: Pt, ang: number): Pt => add(o, rot(sub(a, o), ang));
export const fromAngle = (ang: number, r = 1): Pt => [Math.cos(ang) * r, Math.sin(ang) * r];
export const angleOf = (a: Pt) => Math.atan2(a[1], a[0]);
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export const DEG = Math.PI / 180;
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Shortest signed difference between two angles. */
export const angDiff = (a: number, b: number) => {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/** Intersection of line p + t*d with line q + s*e, or null when parallel. */
export function lineHit(p: Pt, d: Pt, q: Pt, e: Pt): Pt | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(q, p), e) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function bounds(pts: readonly Pt[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
}

export function pointInPoly(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Signed area; positive when the points run clockwise on screen (y down). */
export function area(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return s / 2;
}
