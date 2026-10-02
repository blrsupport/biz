// Motion core. Every animated value is a pure function of time in seconds, so any frame can be rendered alone.
//
// A Track is a chain of moves. Each move is a quintic from wherever the value is (position, speed and
// acceleration all carried over) to its target, arriving with a little speed in hand, followed by a damped
// spring that spends that speed as overshoot and settle. So:
//   - nothing starts or stops inside one frame (speed and acceleration are continuous across every join)
//   - a move can be interrupted at any time without a jump
//   - overshoot and settle are set by the weight of the thing that moves, not hand-keyed
import { add, clamp, len, mul, perp, sub, unit, type Pt } from "../geom/vec.ts";

export interface Weight {
  /** overshoot as a fraction of the distance travelled */
  overshoot: number;
  /** seconds for the overshoot to die away */
  settle: number;
  /** damping ratio of the settle: 0.5 wobbles, 1 does not */
  zeta: number;
  /** wind-up: how far back first, as a fraction of the distance, and for how long */
  windup: number;
  windupTime: number;
}

/** Weight classes. Light things are quick and springy; heavy things start slowly and do not bounce. */
export const WEIGHT = {
  eye: { overshoot: 0, settle: 0.05, zeta: 1, windup: 0, windupTime: 0 },
  head: { overshoot: 0.04, settle: 0.35, zeta: 0.6, windup: 0.05, windupTime: 0.12 },
  hand: { overshoot: 0.06, settle: 0.4, zeta: 0.55, windup: 0.08, windupTime: 0.16 },
  body: { overshoot: 0.03, settle: 0.55, zeta: 0.65, windup: 0.055, windupTime: 0.2 },
  heavy: { overshoot: 0.008, settle: 0.8, zeta: 0.8, windup: 0.03, windupTime: 0.26 },
  /** machines and the camera: eased, no bounce, no wind-up */
  mech: { overshoot: 0, settle: 0.3, zeta: 1, windup: 0, windupTime: 0 },
} as const satisfies Record<string, Weight>;

export type WeightName = keyof typeof WEIGHT;

export interface State {
  x: number;
  v: number;
  a: number;
}

interface Seg {
  t0: number;
  at(t: number): State;
}

function quintic(t0: number, T: number, s0: State, s1: State): Seg {
  const d = s1.x - s0.x;
  const c0 = s0.x;
  const c1 = s0.v;
  const c2 = s0.a / 2;
  const c3 = (20 * d - (8 * s1.v + 12 * s0.v) * T - (3 * s0.a - s1.a) * T * T) / (2 * T * T * T);
  const c4 = (-30 * d + (14 * s1.v + 16 * s0.v) * T + (3 * s0.a - 2 * s1.a) * T * T) / (2 * T * T * T * T);
  const c5 = (12 * d - (6 * s1.v + 6 * s0.v) * T - (s0.a - s1.a) * T * T) / (2 * T * T * T * T * T);
  return {
    t0,
    at(t: number): State {
      const u = clamp(t - t0, 0, T);
      return {
        x: c0 + u * (c1 + u * (c2 + u * (c3 + u * (c4 + u * c5)))),
        v: c1 + u * (2 * c2 + u * (3 * c3 + u * (4 * c4 + u * 5 * c5))),
        a: 2 * c2 + u * (6 * c3 + u * (12 * c4 + u * 20 * c5)),
      };
    },
  };
}

/** Rest at `x1`, entered at t0 with speed v0: a damped spring that overshoots once and settles. */
function tail(t0: number, x1: number, v0: number, zeta: number, omega: number): Seg {
  if (Math.abs(v0) < 1e-9 || omega <= 0) return { t0, at: () => ({ x: x1, v: 0, a: 0 }) };
  if (zeta >= 0.999) {
    return {
      t0,
      at(t: number): State {
        const u = Math.max(0, t - t0);
        const e = Math.exp(-omega * u);
        return { x: x1 + v0 * u * e, v: v0 * e * (1 - omega * u), a: v0 * e * omega * (omega * u - 2) };
      },
    };
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const k = zeta * omega;
  const A = v0 / wd;
  return {
    t0,
    at(t: number): State {
      const u = Math.max(0, t - t0);
      const e = Math.exp(-k * u);
      const s = Math.sin(wd * u);
      const c = Math.cos(wd * u);
      return {
        x: x1 + A * e * s,
        v: A * e * (wd * c - k * s),
        a: A * e * ((k * k - wd * wd) * s - 2 * k * wd * c),
      };
    },
  };
}

export interface MoveOpts {
  /** when the value arrives at its target (the contact), seconds */
  at: number;
  /** how long the travel takes, seconds */
  dur: number;
  w?: Weight;
  /** override the weight's overshoot (0 = land dead) and wind-up */
  overshoot?: number;
  windup?: number;
}

/**
 * Moves that were written out of time order. A move written later that starts earlier removes the one written
 * before it, without a sound, and the value then never goes where the first one said. The dry run prints these.
 */
export const ORDER_WARNINGS: string[] = [];

/**
 * Moves that leave the stretch between where they start and where they are going. A move must arrive at the speed
 * its overshoot asks for; over a long travel it can only gain that speed by backing up first, sometimes further than
 * the whole distance. The dry run prints these.
 */
export const RANGE_WARNINGS: string[] = [];

/** where in a film's own files the move being made was written */
function writtenAt(): string {
  const where = (new Error().stack ?? "")
    .split("\n")
    .find((l) => /[\\/]films[\\/]/.test(l))
    ?.replace(/^\s*at\s+/, "")
    .replace(/^.*\((.*)\)$/, "$1")
    .replace(/^file:\/\/\/?/, "")
    .replace(/^.*[\\/]src[\\/]films[\\/]/, "src/films/");
  return where ?? "(engine)";
}

function outOfOrder(kind: string, at: number, lost: number) {
  const where = writtenAt();
  ORDER_WARNINGS.push(`${where}: a ${kind} arriving at ${at.toFixed(2)} s was written after one that starts later (${lost.toFixed(2)} s) on the same track, and removed it`);
}

export class Track {
  private segs: Seg[] = [];
  /** when each move that is still queued starts */
  private issued: number[] = [];
  private readonly x0: number;

  constructor(x0: number) {
    this.x0 = x0;
  }

  state(t: number): State {
    const s = this.segs;
    for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].t0) return s[i].at(t);
    return { x: this.x0, v: 0, a: 0 };
  }

  value(t: number): number {
    return this.state(t).x;
  }

  /** The value the track will rest at once everything queued so far has finished. */
  get end(): number {
    return this.segs.length ? this.segs[this.segs.length - 1].at(1e9).x : this.x0;
  }

  private cut(t: number) {
    while (this.segs.length && this.segs[this.segs.length - 1].t0 >= t - 1e-9) this.segs.pop();
  }

  /** Start the track off already moving: from time t it drifts at the given speed until the next move takes over. */
  seed(t: number, s: State): this {
    this.cut(t);
    this.segs.push({ t0: t, at: (u) => ({ x: s.x + s.v * (u - t), v: s.v, a: 0 }) });
    return this;
  }

  /** Travel to `to`, arriving at `o.at` after `o.dur` seconds, with the weight's wind-up, overshoot and settle. */
  to(to: number, o: MoveOpts): this {
    const w = o.w ?? WEIGHT.body;
    const dur = Math.max(1 / 60, o.dur);
    const tGo = o.at - dur;
    const wu = o.windup ?? w.windup;
    const useWind = wu > 0 && w.windupTime > 0;
    const tStart = useWind ? tGo - w.windupTime : tGo;
    const s0 = this.state(tStart);
    const delta = to - s0.x;
    const later = this.issued.filter((t) => t > tStart + 1e-6);
    if (later.length) outOfOrder("move", o.at, later[0]);
    this.issued = this.issued.filter((t) => t <= tStart + 1e-6);
    this.issued.push(tStart);
    this.cut(tStart);
    let from = s0;
    if (useWind && Math.abs(delta) > 1e-9) {
      const back = -wu * delta;
      // stop at the back of the wind-up already pushing forward, so there is no dead hang
      const sBack: State = { x: s0.x + back, v: 0, a: (-4 * back) / (w.windupTime * w.windupTime) };
      this.segs.push(quintic(tStart, w.windupTime, s0, sBack));
      from = sBack;
    }
    const ov = o.overshoot ?? w.overshoot;
    const zeta = clamp(w.zeta, 0.2, 1);
    const omega = w.settle > 0 ? 4 / (zeta * w.settle) : 0;
    let vEnd = 0;
    if (ov > 0 && omega > 0) {
      const phi = Math.acos(Math.min(zeta, 0.999));
      const boost = zeta >= 0.999 ? Math.E : Math.exp((zeta * phi) / Math.sqrt(1 - zeta * zeta));
      vEnd = ov * (to - from.x) * omega * boost;
    }
    const sEnd: State = { x: to, v: vEnd, a: -2 * zeta * omega * vEnd };
    const travel = quintic(tGo, dur, from, sEnd);
    const span = to - from.x;
    // only a move that sets off from rest: one that takes over a track already moving carries that motion on for a moment, and should
    if (Math.abs(span) > 1e-9 && Math.abs(from.v) * dur < 0.1 * Math.abs(span)) {
      let lo = 0;
      let hi = 1;
      for (let i = 1; i < 16; i++) {
        const p = (travel.at(tGo + (dur * i) / 16).x - from.x) / span;
        lo = Math.min(lo, p);
        hi = Math.max(hi, p);
      }
      if (lo < -0.05 || hi > 1.05)
        RANGE_WARNINGS.push(
          `${writtenAt()}: a move arriving at ${o.at.toFixed(2)} s after ${dur.toFixed(2)} s ${lo < -0.05 ? `backs up ${Math.round(-lo * 100)} % of its distance before it sets off` : `runs ${Math.round((hi - 1) * 100)} % past its target before it arrives`}: the travel is too long for the overshoot its weight asks for. Pass overshoot: 0, or split it into an eased move (overshoot: 0) and a short last stretch that carries the overshoot`,
        );
    }
    this.segs.push(travel);
    this.segs.push(tail(o.at, to, vEnd, zeta, omega));
    return this;
  }

  /**
   * Travel a long way at a steady speed: ease up to `speed` over `ramp` seconds, hold it, ease down to a stop.
   * Returns the time of arrival. (A single eased move over a long distance would crawl at both ends.)
   */
  cruise(to: number, o: { start: number; speed: number; ramp?: number }): number {
    const s0 = this.state(o.start);
    const D = to - s0.x;
    const dir = D >= 0 ? 1 : -1;
    let ramp = o.ramp ?? 0.45;
    let v = Math.abs(o.speed);
    if (Math.abs(D) < v * ramp) {
      // too short to reach full speed: a slower, shorter move
      v = Math.max(Math.abs(D) / ramp, v * 0.45);
      ramp = Math.abs(D) / v;
    }
    const hold = (Math.abs(D) - v * ramp) / v;
    this.cut(o.start);
    const a: State = { x: s0.x + (dir * v * ramp) / 2, v: dir * v, a: 0 };
    this.segs.push(quintic(o.start, ramp, s0, a));
    const tC = o.start + ramp;
    this.segs.push({ t0: tC, at: (t) => ({ x: a.x + dir * v * (t - tC), v: dir * v, a: 0 }) });
    const tD = tC + hold;
    const b: State = { x: to - (dir * v * ramp) / 2, v: dir * v, a: 0 };
    this.segs.push(quintic(tD, ramp, b, { x: to, v: 0, a: 0 }));
    this.segs.push({ t0: tD + ramp, at: () => ({ x: to, v: 0, a: 0 }) });
    return tD + ramp;
  }

  /** A straight eased move with no bounce (cameras, machines). */
  ease(to: number, at: number, dur: number): this {
    return this.to(to, { at, dur, w: WEIGHT.mech });
  }

  /** Earliest time at which the track is next free: when its last move has landed and settled. */
  get busyUntil(): number {
    return this.segs.length ? this.segs[this.segs.length - 1].t0 : -Infinity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 2-D moves: a hand travels along a bowed path, never a straight line
// ---------------------------------------------------------------------------------------------------------------

interface PathMove {
  t0: number;
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p1: Pt;
  L: number;
  s: Track;
}

export interface PathOpts extends MoveOpts {
  /** how far the path bows away from the straight line, as a fraction of its length (default 0.14) */
  bow?: number;
  /** the bow curves away from this point (the shoulder, for a hand); default: the origin */
  pivot?: Pt;
  /** points the path must keep clear of, with their radius */
  avoid?: { c: Pt; r: number }[];
}

function bez(m: PathMove, s: number): Pt {
  if (s <= 0) return add(m.p0, mul(sub(m.c1, m.p0), 3 * s));
  if (s >= 1) return add(m.p1, mul(sub(m.p1, m.c2), 3 * (s - 1)));
  const u = 1 - s;
  const a = u * u * u;
  const b = 3 * u * u * s;
  const c = 3 * u * s * s;
  const d = s * s * s;
  return [a * m.p0[0] + b * m.c1[0] + c * m.c2[0] + d * m.p1[0], a * m.p0[1] + b * m.c1[1] + c * m.c2[1] + d * m.p1[1]];
}

export class Path2 {
  private moves: PathMove[] = [];
  private readonly p0: Pt;

  constructor(p0: Pt) {
    this.p0 = p0;
  }

  value(t: number): Pt {
    const m = this.moves;
    for (let i = m.length - 1; i >= 0; i--) if (t >= m[i].t0) return bez(m[i], m[i].s.value(t));
    return this.p0;
  }

  velocity(t: number): Pt {
    const h = 1 / 240;
    const a = this.value(t - h);
    const b = this.value(t + h);
    return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h)];
  }

  get end(): Pt {
    return this.moves.length ? this.moves[this.moves.length - 1].p1 : this.p0;
  }

  /** Put the value at p from time t on, with no travel (only for moments when the value is not being shown). */
  reset(t: number, p: Pt): this {
    while (this.moves.length && this.moves[this.moves.length - 1].t0 >= t - 1e-9) this.moves.pop();
    this.moves.push({ t0: t, p0: p, c1: p, c2: p, p1: p, L: 1, s: new Track(1) });
    return this;
  }

  to(p1: Pt, o: PathOpts): this {
    const w = o.w ?? WEIGHT.hand;
    const dur = Math.max(1 / 60, o.dur);
    const wu = o.windup ?? w.windup;
    // a hand that is already moving does not wind up: it bends into the new path at the speed it has
    let tStart = o.at - dur - (wu > 0 ? w.windupTime : 0);
    let v0 = this.velocity(tStart);
    let moving = len(v0) > 1e-3 * Math.max(1, len(sub(p1, this.value(tStart))));
    let wind = wu;
    if (moving) {
      // no room for a wind-up; and if the hand has in fact come to rest by the later start, leave from rest
      tStart = o.at - dur;
      v0 = this.velocity(tStart);
      wind = 0;
      moving = len(v0) > 1e-3 * Math.max(1, len(sub(p1, this.value(tStart))));
    }
    const p0 = this.value(tStart);
    while (this.moves.length && this.moves[this.moves.length - 1].t0 >= tStart - 1e-9) {
      const gone = this.moves.pop()!;
      if (gone.t0 > tStart + 1e-6) outOfOrder("path move", o.at, gone.t0);
    }
    const d = sub(p1, p0);
    const L = Math.max(1e-6, len(d));
    const dir = unit(d);
    // bow away from the pivot: a hand swings round its shoulder
    const pivot = o.pivot ?? ([0, 0] as Pt);
    let n = perp(dir);
    if (n[0] * ((p0[0] + p1[0]) / 2 - pivot[0]) + n[1] * ((p0[1] + p1[1]) / 2 - pivot[1]) < 0) n = mul(n, -1);
    const build = (bow: number): PathMove => {
      const off = mul(n, (bow * 4) / 3);
      const lead: Pt = moving ? add(mul(unit(v0), L / 3), mul(off, 0.5)) : add(mul(dir, L / 3), off);
      return { t0: tStart, p0, c1: add(p0, lead), c2: add(add(p1, mul(dir, -L / 3)), off), p1, L, s: new Track(0) };
    };
    let bow = (o.bow ?? 0.14) * L;
    let m = build(bow);
    if (o.avoid?.length) {
      // grow the bow until the path clears everything it must not pass through
      for (let tries = 0; tries < 6; tries++) {
        let hit = false;
        for (let k = 1; k < 12 && !hit; k++) {
          const q = bez(m, k / 12);
          for (const a of o.avoid) if (len(sub(q, a.c)) < a.r) hit = true;
        }
        if (!hit) break;
        bow = Math.min(bow + 0.08 * L, 0.45 * L);
        m = build(bow);
      }
    }
    // progress 0 -> 1 with the weight's wind-up, overshoot and settle
    if (moving) m.s.seed(tStart - 1e-6, { x: 0, v: len(v0) / L, a: 0 });
    m.s.to(1, { at: o.at, dur, w, overshoot: o.overshoot, windup: wind });
    this.moves.push(m);
    return this;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Blends between named poses (hands, faces)
// ---------------------------------------------------------------------------------------------------------------

/** Cross-fades between whole poses. `mix(a, b, t)` blends two of them. */
export class Blend<T> {
  private keys: { t0: number; dur: number; to: T }[] = [];
  private readonly first: T;
  private readonly mix: (a: T, b: T, t: number) => T;

  constructor(first: T, mix: (a: T, b: T, t: number) => T) {
    this.first = first;
    this.mix = mix;
  }

  /** Change to `to`, finishing at `at` after `dur` seconds. */
  to(to: T, at: number, dur = 0.18): this {
    const t0 = at - dur;
    while (this.keys.length && this.keys[this.keys.length - 1].t0 >= t0) {
      const gone = this.keys.pop()!;
      if (gone.t0 > t0 + 1e-6) outOfOrder("change of pose", at, gone.t0);
    }
    this.keys.push({ t0, dur, to });
    return this;
  }

  value(t: number): T {
    let cur = this.first;
    for (const k of this.keys) {
      if (t <= k.t0) break;
      const u = clamp((t - k.t0) / k.dur, 0, 1);
      const e = u * u * u * (u * (6 * u - 15) + 10);
      cur = e >= 1 ? k.to : this.mix(cur, k.to, e);
    }
    return cur;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Deterministic noise for idle life (no Math.random anywhere: a frame must render the same every time)
// ---------------------------------------------------------------------------------------------------------------

export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Smooth noise in -1..1; `seed` separates channels. */
export function noise(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(i + seed * 57.31);
  const b = hash(i + 1 + seed * 57.31);
  return (a + (b - a) * u) * 2 - 1;
}

/** Slow wander: a few octaves of smooth noise, -1..1. */
export function wander(t: number, seed = 0): number {
  return noise(t, seed) * 0.6 + noise(t * 2.3 + 7.7, seed + 1) * 0.28 + noise(t * 5.1 + 3.1, seed + 2) * 0.12;
}
