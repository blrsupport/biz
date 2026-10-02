// The camera: where it looks and how close it is, as tracks, plus a slight constant drift so that a held frame
// is never dead. Layers at different depths are placed from one camera, which gives real parallax on a move.
import { Track, wander, WEIGHT } from "../motion/track.ts";

export interface View {
  /** stage point at the centre of the frame */
  cx: number;
  cy: number;
  /** 1 = the stage at its own size; 1.4 = pushed in */
  zoom: number;
  /** picture roll, radians (handheld feel, shakes) */
  roll: number;
}

export interface Frame {
  width: number;
  height: number;
}

export interface CamKey {
  t: number;
  cx: number;
  cy: number;
  zoom: number;
}

/**
 * A curve through keyed values that passes through every key, never overshoots between two keys, and only comes
 * to rest where the value turns round (monotone cubic). So a camera keyed this way keeps travelling through its keys.
 */
export class KeyCurve {
  private readonly ts: number[];
  private readonly ys: number[];
  private readonly ms: number[];

  constructor(ts: number[], ys: number[]) {
    const n = ts.length;
    this.ts = ts;
    this.ys = ys;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
    const m: number[] = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] > 0 ? (d[i - 1] + d[i]) / 2 : 0;
    if (n > 1) {
      m[0] = d[0];
      m[n - 1] = d[n - 2];
    }
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        m[i] = k * a * d[i];
        m[i + 1] = k * b * d[i];
      }
    }
    this.ms = m;
  }

  value(t: number): number {
    const { ts, ys, ms } = this;
    const n = ts.length;
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i];
    const u = (t - ts[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * ms[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * ms[i + 1];
  }
}

export class Camera {
  cx: Track;
  cy: Track;
  zoom: Track;
  /** how much the idle drift shows (0 = locked off) */
  drift = 1;
  shakes: { t: number; amp: number; dur: number }[] = [];
  private readonly seed: number;
  private curve: { cx: KeyCurve; cy: KeyCurve; zoom: KeyCurve } | null = null;

  /** Key the whole move at once: the camera travels through these framings without stopping between them. */
  keys(list: CamKey[]): this {
    for (let i = 1; i < list.length; i++) {
      if (!(list[i].t > list[i - 1].t)) throw new Error(`camera keys must be in time order: key ${i} (t ${list[i].t}) does not come after key ${i - 1} (t ${list[i - 1].t})`);
    }
    const ts = list.map((k) => k.t);
    this.curve = { cx: new KeyCurve(ts, list.map((k) => k.cx)), cy: new KeyCurve(ts, list.map((k) => k.cy)), zoom: new KeyCurve(ts, list.map((k) => Math.log(k.zoom))) };
    return this;
  }

  constructor(cx: number, cy: number, zoom = 1, seed = 9) {
    this.cx = new Track(cx);
    this.cy = new Track(cy);
    this.zoom = new Track(zoom);
    this.seed = seed;
  }

  /** Move to a framing, arriving at `at` after `dur` seconds, eased with no bounce. */
  to(v: { cx?: number; cy?: number; zoom?: number }, at: number, dur: number): this {
    if (v.cx !== undefined) this.cx.to(v.cx, { at, dur, w: WEIGHT.mech });
    if (v.cy !== undefined) this.cy.to(v.cy, { at, dur, w: WEIGHT.mech });
    if (v.zoom !== undefined) this.zoom.to(v.zoom, { at, dur, w: WEIGHT.mech });
    return this;
  }

  /** A knock: the frame jolts at t and rings down over `dur` seconds. */
  shake(t: number, amp = 10, dur = 0.35): this {
    this.shakes.push({ t, amp, dur });
    return this;
  }

  view(t: number): View {
    const c = this.curve;
    const z = c ? Math.exp(c.zoom.value(t)) : this.zoom.value(t);
    let sx = 0;
    let sy = 0;
    for (const s of this.shakes) {
      const u = (t - s.t) / s.dur;
      if (u < 0 || u > 1) continue;
      const k = s.amp * Math.pow(1 - u, 2.2);
      sx += k * Math.sin(u * 38 + s.t * 3.1);
      sy += k * Math.cos(u * 31 + s.t * 1.7);
    }
    const d = this.drift;
    return {
      cx: (c ? c.cx.value(t) : this.cx.value(t)) + (wander(t * 0.11, this.seed) * 7 * d + sx) / z,
      cy: (c ? c.cy.value(t) : this.cy.value(t)) + (wander(t * 0.09, this.seed + 3) * 5 * d + sy) / z,
      zoom: z * (1 + wander(t * 0.07, this.seed + 6) * 0.006 * d),
      roll: wander(t * 0.08, this.seed + 8) * 0.0025 * d,
    };
  }
}

/**
 * Transform for a layer at depth k: 0 = the plane the actors stand on, 0.1 = a wall right behind them,
 * 4 = a skyline, -0.3 = something close to the lens. Far layers move and grow less than near ones.
 * `ref` is the camera centre the layers were drawn for.
 */
export function layerTransform(v: View, f: Frame, k: number, ref: { cx: number; cy: number }): { tx: number; ty: number; s: number } {
  const zk = v.zoom / (1 + v.zoom * k);
  const s = zk * (1 + k);
  return {
    s,
    tx: f.width / 2 - ref.cx * s - (v.cx - ref.cx) * zk,
    ty: f.height / 2 - ref.cy * s - (v.cy - ref.cy) * zk,
  };
}

/**
 * Where a point drawn in the layer at depth k sits, in the coordinates of the layer at depth 0 (the plane the actors
 * stand on), for this view. A hand that must take hold of something that is part of a wall, or of any other layer,
 * reaches for and is pinned to this point: `pin: (t) => fromLayer(cam.view(t), FRAME, DEPTH.wall, REF, p)`.
 */
export function fromLayer(v: View, f: Frame, k: number, ref: { cx: number; cy: number }, p: readonly [number, number]): [number, number] {
  const a = layerTransform(v, f, k, ref);
  const b = layerTransform(v, f, 0, ref);
  return [(a.tx + p[0] * a.s - b.tx) / b.s, (a.ty + p[1] * a.s - b.ty) / b.s];
}
