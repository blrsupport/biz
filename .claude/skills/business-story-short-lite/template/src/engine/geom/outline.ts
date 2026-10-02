// Outline builders. Every drawing in the engine is a closed, dense polyline made here.
// Dense polylines render faster than Bézier paths on this PC and the same points feed the checks.
import { add, angleOf, area, clamp, cross, dist, dot, lerpPt, lineHit, mix, mul, perp, sub, unit, type Pt } from "./vec.ts";

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** SVG path data for a polyline. */
export function pathD(pts: readonly Pt[], closed = true): string {
  if (!pts.length) return "";
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${f1(pts[i][0])} ${f1(pts[i][1])}`;
  return closed ? d + "Z" : d;
}

/** Points on an arc from angle a0 to a1 (signed sweep), ends included. */
export function arc(c: Pt, r: number, a0: number, a1: number, step = 4): Pt[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * Math.max(r, 1)) / step));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

export function ellipse(c: Pt, rx: number, ry: number, rotRad = 0, step = 4): Pt[] {
  const n = Math.max(16, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step));
  const cs = Math.cos(rotRad);
  const sn = Math.sin(rotRad);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]);
  }
  return out;
}

/** Superellipse ("squircle"): exponent 2 is an ellipse, higher is boxier. */
export function squircle(c: Pt, rx: number, ry: number, k = 3, rotRad = 0, step = 4): Pt[] {
  const n = Math.max(24, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step));
  const cs = Math.cos(rotRad);
  const sn = Math.sin(rotRad);
  const out: Pt[] = [];
  const e = 2 / k;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * rx;
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), e) * ry;
    out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]);
  }
  return out;
}

export interface Node {
  p: Pt;
  /** corner radius; 0 or undefined keeps the corner sharp */
  r?: number;
}

/** Polygon with every corner filleted by its own radius. Radii are cut down where edges are too short. */
export function roundedPoly(nodes: readonly Node[], step = 4): Pt[] {
  const n = nodes.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = nodes[i].p;
    const a = nodes[(i + n - 1) % n].p;
    const b = nodes[(i + 1) % n].p;
    const r0 = nodes[i].r ?? 0;
    const d1 = unit(sub(a, p));
    const d2 = unit(sub(b, p));
    const cosT = clamp(dot(d1, d2), -1, 1);
    const theta = Math.acos(cosT); // interior angle
    if (r0 <= 0.01 || theta > Math.PI - 0.02 || theta < 0.02) {
      out.push(p);
      continue;
    }
    const tMax = 0.5 * Math.min(dist(a, p), dist(b, p));
    const t = Math.min(r0 / Math.tan(theta / 2), tMax);
    const r = t * Math.tan(theta / 2);
    const p1 = add(p, mul(d1, t));
    const p2 = add(p, mul(d2, t));
    const bis = unit(add(d1, d2));
    const c = add(p, mul(bis, r / Math.sin(theta / 2)));
    let a0 = angleOf(sub(p1, c));
    let a1 = angleOf(sub(p2, c));
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    a1 = a0 + sweep;
    for (const q of arc(c, r, a0, a1, step)) out.push(q);
  }
  return dedupe(out);
}

/** Rounded rectangle, centre and half-sizes, optional rotation. */
export function roundRect(c: Pt, hw: number, hh: number, r: number, rotRad = 0, step = 4): Pt[] {
  const cs = Math.cos(rotRad);
  const sn = Math.sin(rotRad);
  const tr = (x: number, y: number): Pt => [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
  return roundedPoly(
    [
      { p: tr(-hw, -hh), r },
      { p: tr(hw, -hh), r },
      { p: tr(hw, hh), r },
      { p: tr(-hw, hh), r },
    ],
    step,
  );
}

/** Catmull-Rom spline through the control points. */
export function spline(ctrl: readonly Pt[], opts: { closed?: boolean; step?: number; tension?: number } = {}): Pt[] {
  const closed = opts.closed ?? true;
  const step = opts.step ?? 4;
  const k = (opts.tension ?? 0.5) * 2; // 1 = standard Catmull-Rom
  const n = ctrl.length;
  const get = (i: number): Pt => (closed ? ctrl[((i % n) + n) % n] : ctrl[clamp(i, 0, n - 1)]);
  const out: Pt[] = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const m1: Pt = [((p2[0] - p0[0]) * k) / 2, ((p2[1] - p0[1]) * k) / 2];
    const m2: Pt = [((p3[0] - p1[0]) * k) / 2, ((p3[1] - p1[1]) * k) / 2];
    const segs = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      const h1 = 2 * t3 - 3 * t2 + 1;
      const h2 = t3 - 2 * t2 + t;
      const h3 = -2 * t3 + 3 * t2;
      const h4 = t3 - t2;
      out.push([h1 * p1[0] + h2 * m1[0] + h3 * p2[0] + h4 * m2[0], h1 * p1[1] + h2 * m1[1] + h3 * p2[1] + h4 * m2[1]]);
    }
  }
  if (!closed) out.push(ctrl[n - 1]);
  return out;
}

/** Quadratic Bézier, sampled, both ends included. */
export function quad(a: Pt, c: Pt, b: Pt, step = 4): Pt[] {
  const n = Math.max(2, Math.ceil((dist(a, c) + dist(c, b)) / step));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** Tapered capsule from a (radius ra) to b (radius rb). */
export function capsule(a: Pt, b: Pt, ra: number, rb: number, step = 4): Pt[] {
  const u = unit(sub(b, a));
  const ang = angleOf(u);
  const left = arc(b, rb, ang - Math.PI / 2, ang + Math.PI / 2, step);
  const right = arc(a, ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2, step);
  return dedupe([...left, ...right]);
}

export function dedupe(pts: Pt[], eps = 0.05): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop();
  }
  return out;
}

/** Makes a polygon run clockwise on screen, so that the interior is on the right of each edge. */
export function clockwise(pts: Pt[]): Pt[] {
  return area(pts) < 0 ? pts.slice().reverse() : pts;
}

export const translate = (pts: readonly Pt[], d: Pt): Pt[] => pts.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);

/** Scale about an origin, then rotate about it, then move. */
export function place(pts: readonly Pt[], o: Pt, scale: number | Pt = 1, rotRad = 0, flipX = false): Pt[] {
  const sx = (typeof scale === "number" ? scale : scale[0]) * (flipX ? -1 : 1);
  const sy = typeof scale === "number" ? scale : scale[1];
  const cs = Math.cos(rotRad);
  const sn = Math.sin(rotRad);
  return pts.map((p) => {
    const x = p[0] * sx;
    const y = p[1] * sy;
    return [o[0] + x * cs - y * sn, o[1] + x * sn + y * cs] as Pt;
  });
}

/** Outward unit normals at each vertex of a clockwise polygon. */
export function normalsOf(pts: readonly Pt[]): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const t = unit(sub(b, a));
    out.push([t[1], -t[0]]); // left of the direction of travel = outside of a clockwise shape
  }
  return out;
}

/** Moves every vertex of a clockwise polygon outward (d > 0) or inward (d < 0) along its normal. */
export function inflate(pts: readonly Pt[], d: number | ((i: number, normal: Pt) => number)): Pt[] {
  const nn = normalsOf(pts);
  return pts.map((p, i) => {
    const k = typeof d === "number" ? d : d(i, nn[i]);
    return [p[0] + nn[i][0] * k, p[1] + nn[i][1] * k] as Pt;
  });
}

/** A stroke with varying width along an open polyline, as a closed polygon. half(t) is the half-width at t in 0..1. */
export function stroke(pts: readonly Pt[], half: (t: number) => number, roundEnds = true, step = 3): Pt[] {
  const n = pts.length;
  if (n < 2) return [];
  let total = 0;
  const cum = [0];
  for (let i = 1; i < n; i++) {
    total += dist(pts[i - 1], pts[i]);
    cum.push(total);
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const nr = perp(unit(sub(b, a)));
    const h = half(total > 0 ? cum[i] / total : 0);
    left.push([pts[i][0] - nr[0] * h, pts[i][1] - nr[1] * h]);
    right.push([pts[i][0] + nr[0] * h, pts[i][1] + nr[1] * h]);
  }
  const out: Pt[] = [...left];
  const h1 = half(1);
  if (roundEnds && h1 > 0.6) {
    const ang = angleOf(sub(pts[n - 1], pts[n - 2]));
    out.push(...arc(pts[n - 1], h1, ang - Math.PI / 2, ang + Math.PI / 2, step).slice(1, -1));
  }
  for (let i = n - 1; i >= 0; i--) out.push(right[i]);
  const h0 = half(0);
  if (roundEnds && h0 > 0.6) {
    const ang = angleOf(sub(pts[0], pts[1]));
    out.push(...arc(pts[0], h0, ang - Math.PI / 2, ang + Math.PI / 2, step).slice(1, -1));
  }
  return dedupe(out);
}

/** Convex hull of a point set, clockwise on screen. */
export function hull(pts: readonly Pt[]): Pt[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return clockwise([...lower, ...upper]);
}

/** The part of polygon `subject` inside the convex polygon `clip`. */
export function clipConvex(subject: readonly Pt[], clipIn: readonly Pt[]): Pt[] {
  // (the test below takes "inside" to be on the right of each edge, so the clip is walked clockwise)
  const clip = area(clipIn) < 0 ? clipIn.slice().reverse() : clipIn;
  let out: Pt[] = subject.slice();
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    // inside = on the right of the edge a->b (clockwise on screen)
    const inside = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pin = inside(p);
      const qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) {
        const hit = lineHit(p, sub(q, p), a, sub(b, a));
        if (hit) out.push(hit);
      }
    }
  }
  return out;
}

/**
 * Adds points along the long edges of a closed outline, one every `step` px or so. A box of four points gets no rim
 * light (the painter needs eight or more) and an uneven one along a long edge: pass such an outline through this.
 */
export function dense(pts: readonly Pt[], step = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Resamples an open polyline to roughly even spacing. */
export function resample(pts: readonly Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = dist(a, b);
    let t = step - carry;
    while (t < d) {
      out.push(lerpPt(a, b, t / d));
      t += step;
    }
    carry = d - (t - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------------------------------------------

export interface LimbSpec {
  S: Pt; // root joint (shoulder, hip)
  E: Pt; // middle joint (elbow, knee)
  T: Pt; // end joint (wrist, ankle)
  h0: number; // half-width at S
  h1: number; // half-width at E
  h2: number; // half-width at T
  /** 0 = round outer joint, 1 = sharp. Elbows and knees read best slightly pointed. */
  point?: number;
  step?: number;
}

export interface Limb {
  /** The whole limb as one closed outline with round ends. */
  outline: Pt[];
  /**
   * The part of the limb between two positions. 0 = root joint, 1 = middle joint, 2 = end joint.
   * `bulgeA`/`bulgeB` curve the cut ends (px along the bone), which is how a cuff or sleeve edge is drawn.
   */
  section(a: number, b: number, opts?: { bulgeA?: number; bulgeB?: number }): Pt[];
  at(p: number): Pt;
  dirAt(p: number): Pt;
  /** +1 when the inside of the bend is on the right-hand side of the limb, -1 on the left, 0 when straight. */
  inner: 1 | -1 | 0;
}

interface SideVert {
  p: number;
  pt: Pt;
}

/**
 * A two-bone limb as one soft shape: straight tapered edges, a rounded outer joint and a clean crease inside the bend.
 * The crease is the meeting point of the two inner edges, so the inside of an elbow never folds over itself.
 */
export function limb(spec: LimbSpec): Limb {
  const { S, E, T, h0, h1, h2 } = spec;
  const step = spec.step ?? 4;
  const point = spec.point ?? 0.3;
  const u1 = unit(sub(E, S));
  const u2 = unit(sub(T, E));
  const n1 = perp(u1);
  const n2 = perp(u2);
  const c = cross(u1, u2);
  const d = dot(u1, u2);
  const phi = Math.atan2(c, d); // signed turn at the joint
  const inner: 1 | -1 | 0 = Math.abs(phi) < 0.02 ? 0 : phi > 0 ? 1 : -1;

  const side = (sg: 1 | -1): SideVert[] => {
    const A0 = add(S, mul(n1, sg * h0));
    const A1 = add(E, mul(n1, sg * h1));
    const B0 = add(E, mul(n2, sg * h1));
    const B1 = add(T, mul(n2, sg * h2));
    if (inner === 0) {
      return [
        { p: 0, pt: A0 },
        { p: 1, pt: lerpPt(A1, B0, 0.5) },
        { p: 2, pt: B1 },
      ];
    }
    if (sg === inner) {
      // inside of the bend: the two edges meet at a crease
      let M = lineHit(A0, sub(A1, A0), B0, sub(B1, B0)) ?? lerpPt(A1, B0, 0.5);
      const la = dist(A0, A1);
      const lb = dist(B0, B1);
      let tA = dot(sub(M, A0), sub(A1, A0)) / (la * la);
      let tB = dot(sub(M, B0), sub(B1, B0)) / (lb * lb);
      if (tA < 0.08 || tB > 0.92) {
        // folded almost shut: keep the crease on the limb
        tA = clamp(tA, 0.08, 1);
        tB = clamp(tB, 0, 0.92);
        M = lerpPt(lerpPt(A0, A1, tA), lerpPt(B0, B1, tB), 0.5);
      }
      return [
        { p: 0, pt: A0 },
        { p: clamp(tA, 0, 1), pt: M },
        { p: 1 + clamp(tB, 0, 1), pt: M },
        { p: 2, pt: B1 },
      ];
    }
    // outside of the bend: rounded, a little pointed
    const half = Math.abs(phi) / 2;
    const bis = unit(add(mul(n1, sg), mul(n2, sg)));
    const reach = h1 * mix(2 - Math.cos(half), 1 / Math.max(0.2, Math.cos(half)), point);
    const C = add(E, mul(bis, reach));
    const join = quad(A1, C, B0, step);
    const verts: SideVert[] = [{ p: 0, pt: A0 }];
    for (const q of join) verts.push({ p: 1, pt: q });
    verts.push({ p: 2, pt: B1 });
    return verts;
  };

  const R = side(1);
  const L = side(-1);

  const between = (verts: SideVert[], a: number, b: number): Pt[] => {
    const interp = (p: number, last: boolean): Pt => {
      if (last) {
        for (let i = verts.length - 1; i > 0; i--) {
          const v0 = verts[i - 1];
          const v1 = verts[i];
          if (v0.p <= p && p <= v1.p) return v1.p - v0.p < 1e-9 ? v1.pt : lerpPt(v0.pt, v1.pt, (p - v0.p) / (v1.p - v0.p));
        }
        return verts[verts.length - 1].pt;
      }
      for (let i = 1; i < verts.length; i++) {
        const v0 = verts[i - 1];
        const v1 = verts[i];
        if (v0.p <= p && p <= v1.p) return v1.p - v0.p < 1e-9 ? v0.pt : lerpPt(v0.pt, v1.pt, (p - v0.p) / (v1.p - v0.p));
      }
      return verts[0].pt;
    };
    // every vertex inside the range, in order; a range that touches the joint takes the whole joint curve
    const out: Pt[] = [interp(a, false)];
    for (const v of verts) if (v.p >= a - 1e-9 && v.p <= b + 1e-9) out.push(v.pt);
    out.push(interp(b, true));
    const clean: Pt[] = [];
    for (const q of out) {
      const z = clean[clean.length - 1];
      if (!z || Math.abs(z[0] - q[0]) > 0.02 || Math.abs(z[1] - q[1]) > 0.02) clean.push(q);
    }
    return clean;
  };

  const at = (p: number): Pt => (p <= 1 ? lerpPt(S, E, clamp(p, 0, 1)) : lerpPt(E, T, clamp(p - 1, 0, 1)));
  const dirAt = (p: number): Pt => (p <= 1 ? u1 : u2);

  const section = (a: number, b: number, opts: { bulgeA?: number; bulgeB?: number } = {}): Pt[] => {
    const lf = between(L, a, b);
    const rt = between(R, a, b);
    const out: Pt[] = [...lf];
    const lb = lf[lf.length - 1];
    const rb = rt[rt.length - 1];
    if (b >= 2 - 1e-9) {
      const ang = angleOf(u2);
      out.push(...arc(T, h2, ang - Math.PI / 2, ang + Math.PI / 2, step).slice(1, -1));
    } else if (opts.bulgeB) {
      out.push(...quad(lb, add(lerpPt(lb, rb, 0.5), mul(dirAt(b), opts.bulgeB * 2)), rb, step).slice(1, -1));
    }
    for (let i = rt.length - 1; i >= 0; i--) out.push(rt[i]);
    const la = lf[0];
    const ra = rt[0];
    if (a <= 1e-9) {
      const ang = angleOf(u1);
      out.push(...arc(S, h0, ang + Math.PI / 2, ang + (3 * Math.PI) / 2, step).slice(1, -1));
    } else if (opts.bulgeA) {
      out.push(...quad(ra, add(lerpPt(ra, la, 0.5), mul(dirAt(a), opts.bulgeA * 2)), la, step).slice(1, -1));
    }
    return dedupe(out, 0.02);
  };

  return { outline: section(0, 2), section, at, dirAt, inner };
}

/**
 * A soft shape of varying width around a smooth centre line (torso, neck, tail of cloth).
 * `half[i]` is the half-width at centre[i]; `left`/`right` let the two sides differ.
 */
export function tube(center: readonly Pt[], halfLeft: readonly number[], halfRight: readonly number[] = halfLeft): { left: Pt[]; right: Pt[] } {
  const n = center.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const nr = perp(unit(sub(b, a)));
    left.push([center[i][0] - nr[0] * halfLeft[i], center[i][1] - nr[1] * halfLeft[i]]);
    right.push([center[i][0] + nr[0] * halfRight[i], center[i][1] + nr[1] * halfRight[i]]);
  }
  return { left, right };
}
