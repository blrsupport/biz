// Feet. A foot is either planted on one world point or swinging to the next; it never slides.
// The walk is not a cycle that is played back: steps are planned from where the body actually travels,
// and the pelvis height comes from how far the legs can reach, so the bounce of a walk falls out of the geometry.
import { clamp, mix } from "../geom/vec.ts";

export interface Plant {
  /** touchdown and lift-off, seconds (lift-off is Infinity for a foot that stays put) */
  t0: number;
  t1: number;
  /** ankle x when the foot is flat, stage px */
  x: number;
}

export interface Gait {
  /** how high the ankle rises in mid-swing, px */
  swingH: number;
  /** heel-off angle before the foot leaves the ground, and toes-up angle at heel strike, radians */
  toeOff: number;
  strike: number;
  /** seconds for the foot to roll flat after heel strike, and for the heel to rise before lift-off */
  rollT: number;
  offT: number;
  /** distance from ankle to toe tip and to the back of the heel, and the ankle's height, px */
  toe: number;
  heel: number;
  ankle: number;
}

export interface FootState {
  /** ankle position: x in stage px, lift in px above its flat height */
  x: number;
  lift: number;
  /** + = toes down */
  pitch: number;
  planted: boolean;
  /** 0..1 through a swing, -1 while planted */
  swing: number;
}

const smooth = (u: number) => {
  const t = clamp(u, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Ankle offset when the foot tips forward about its toe by `phi` (> 0): [forward, up]. */
function toePivot(g: Gait, phi: number): [number, number] {
  return [g.toe * (1 - Math.cos(phi)) + g.ankle * Math.sin(phi), g.toe * Math.sin(phi) - g.ankle * (1 - Math.cos(phi))];
}

/** Ankle offset when the foot tips back about its heel by `phi` (> 0): [forward, up]. */
function heelPivot(g: Gait, phi: number): [number, number] {
  return [-(g.heel * (1 - Math.cos(phi)) + g.ankle * Math.sin(phi)), g.heel * Math.sin(phi) - g.ankle * (1 - Math.cos(phi))];
}

export class Foot {
  plants: Plant[];

  constructor(x: number) {
    this.plants = [{ t0: -Infinity, t1: Infinity, x }];
  }

  /** Where the foot is (or will next be) planted at time t. */
  plantAt(t: number): Plant {
    const P = this.plants;
    for (let i = P.length - 1; i >= 0; i--) if (t >= P[i].t0) return P[i];
    return P[0];
  }

  get last(): Plant {
    return this.plants[this.plants.length - 1];
  }

  /** Lift the foot at `lift` and plant it at `x` at `down`. */
  step(lift: number, down: number, x: number) {
    const cur = this.last;
    cur.t1 = Math.max(cur.t0 + 0.02, lift);
    this.plants.push({ t0: Math.max(down, cur.t1 + 0.12), t1: Infinity, x });
  }

  /** `fwd` is the way the toes point on screen (+1 right, -1 left). */
  state(t: number, g: Gait, fwd: 1 | -1): FootState {
    const P = this.plants;
    let i = 0;
    for (let k = P.length - 1; k >= 0; k--) {
      if (t >= P[k].t0) {
        i = k;
        break;
      }
    }
    const p = P[i];
    const next = P[i + 1];
    if (t <= p.t1 || !next) {
      let pitch = 0;
      let off: [number, number] = [0, 0];
      const since = t - p.t0;
      const moved = i > 0 ? Math.abs(p.x - P[i - 1].x) : 0;
      if (i > 0 && since < g.rollT && moved > g.toe * 0.3) {
        // heel strike: toes still up, rolling flat about the heel
        const k = 1 - smooth(since / g.rollT);
        pitch = -g.strike * k;
        off = heelPivot(g, g.strike * k);
      } else if (next) {
        const offT = Math.min(g.offT, (p.t1 - p.t0) * 0.4);
        const k = smooth(1 - (p.t1 - t) / offT) * Math.min(1, Math.abs(next.x - p.x) / (g.toe * 1.2));
        if (k > 0) {
          // heel-off: the heel rises while the toe stays where it is
          pitch = g.toeOff * k;
          off = toePivot(g, g.toeOff * k);
        }
      }
      return { x: p.x + off[0] * fwd, lift: off[1], pitch, planted: true, swing: -1 };
    }
    // swinging from p to next
    const far = Math.min(1, Math.abs(next.x - p.x) / (g.toe * 1.2));
    const u = clamp((t - p.t1) / Math.max(1e-6, next.t0 - p.t1), 0, 1);
    const a = toePivot(g, g.toeOff * far);
    const strike = Math.abs(next.x - p.x) > g.toe * 0.3 ? g.strike : 0;
    const b = heelPivot(g, strike);
    const e = smooth(u);
    return {
      x: mix(p.x + a[0] * fwd, next.x + b[0] * fwd, e),
      lift: mix(a[1], b[1], e) + g.swingH * (0.35 + 0.65 * far) * Math.pow(Math.sin(Math.PI * u), 1.3),
      pitch: mix(g.toeOff * far, -strike, smooth(u * 1.15)),
      planted: false,
      swing: u,
    };
  }
}

export interface WalkPlan {
  /** start and end of the travel */
  tA: number;
  tB: number;
  steps: number;
  stepLen: number;
}

/**
 * Plans the steps for a body that travels along hipX(t) from tA to tB.
 * Each foot touches down when the hip is 0.62 of a step behind it and lifts when the hip is the same distance
 * ahead (62 % stance, 38 % swing, so there is always a moment on both feet).
 * The walk ends with the feet at endL and endR.
 */
export function planWalk(
  feet: { L: Foot; R: Foot },
  hipX: (t: number) => number,
  tA: number,
  tB: number,
  end: { L: number; R: number },
  stepLen: number,
  first?: "L" | "R",
): WalkPlan {
  const x0 = hipX(tA);
  const x1 = hipX(tB);
  const dir = x1 >= x0 ? 1 : -1;
  const cur = { L: feet.L.last.x, R: feet.R.last.x };
  // the foot that is behind steps first
  const lead: "L" | "R" = first ?? (dir * cur.L <= dir * cur.R ? "L" : "R");
  const other: "L" | "R" = lead === "L" ? "R" : "L";
  // time at which the hip reaches x (the travel is monotonic)
  const tHip = (x: number): number => {
    if (dir * (x - x0) <= 0) return tA;
    if (dir * (x - x1) >= 0) return tB;
    let lo = tA;
    let hi = tB;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (dir * (hipX(m) - x) < 0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  // the foot W that makes the last full step lands on its end mark; the other then closes up beside it
  const span = (who: "L" | "R") => dir * (end[who] - cur[other]);
  let nFull = Math.max(1, Math.round(span(lead) / stepLen));
  // parity: odd full steps end on the lead foot, even on the other
  const lastFull = (n: number): "L" | "R" => (n % 2 === 1 ? lead : other);
  const fits = (n: number) => Math.abs(span(lastFull(n)) / n - stepLen);
  if (nFull > 1 && fits(nFull - 1) < fits(nFull) && fits(nFull - 1) < fits(nFull + 1)) nFull -= 1;
  else if (fits(nFull + 1) < fits(nFull)) nFull += 1;
  const W = lastFull(nFull);
  const Z: "L" | "R" = W === "L" ? "R" : "L";
  const s = span(W) / nFull;
  const minSwing = 0.2;
  const landed: number[] = [];
  let prevDown = tA;
  const where = { ...cur };
  for (let k = 1; k <= nFull + 1; k++) {
    const who = k <= nFull ? (k % 2 === 1 ? lead : other) : Z;
    const target = k <= nFull ? cur[other] + dir * s * k : end[Z];
    const reach = Math.abs(target - where[who]);
    if (reach < 1) continue;
    const lift = k === 1 ? tA + 0.03 : Math.max(prevDown + 0.05, tHip(where[who] + dir * 0.62 * s));
    let down = Math.max(lift + minSwing, tHip(target - dir * 0.62 * s));
    if (k === nFull + 1) down = Math.max(lift + minSwing, Math.min(down + 0.3, tB + 0.05));
    feet[who].step(lift, down, target);
    where[who] = target;
    prevDown = down;
    landed.push(down);
  }
  return { tA, tB, steps: landed.length, stepLen: s };
}
