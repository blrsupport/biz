// Two-bone reach, built so the faults of a cut-out puppet cannot happen:
//  - the elbow never flips: its side is a continuous "swivel" from -1 to 1, and passing through 0 reads as the
//    elbow coming toward the camera (the limb looks straight and a little short)
//  - a full reach eases out instead of snapping straight, with a little stretch in reserve
//  - the joint never folds past a minimum angle
import { add, clamp, dist, dot, mul, perp, sub, unit, type Pt } from "../geom/vec.ts";

export interface Reach {
  /** middle joint */
  E: Pt;
  /** where the end of the limb actually is (the target, unless it was out of reach) */
  T: Pt;
  /** bone length multiplier that was applied (1..maxStretch) */
  stretch: number;
  /** 0..1: how close to fully extended */
  extension: number;
}

export interface ReachOpts {
  minAngleDeg?: number;
  maxStretch?: number;
  /** fraction of the limb length over which a full reach eases out */
  soft?: number;
  /**
   * How readily a nearly straight limb is drawn straight (fraction of a bone length; 0 = exact geometry).
   * Near full extension a hair's change in distance swings the middle joint a long way, which shows as a knee
   * that snaps. With this the sideways offset of the joint grows smoothly from zero, so a standing leg looks
   * straight and never pops.
   */
  straighten?: number;
}

export function reach(S: Pt, target: Pt, L1: number, L2: number, swivel: number, opts: ReachOpts = {}): Reach {
  const L = L1 + L2;
  const ds = (opts.soft ?? 0.08) * L;
  const da = L - ds;
  const maxStretch = opts.maxStretch ?? 1.06;
  const minAng = ((opts.minAngleDeg ?? 35) * Math.PI) / 180;
  const x = Math.max(1e-6, dist(S, target));
  let xs = x <= da ? x : da + ds * (1 - Math.exp(-(x - da) / ds));
  const xMin = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(minAng));
  xs = Math.max(xs, xMin);
  const k = clamp(x / xs, 1, maxStretch);
  const l1 = L1 * k;
  const l2 = L2 * k;
  const xe = Math.min(Math.max(x, xMin), xs * k);
  const u = dist(S, target) < 1e-6 ? ([0, 1] as Pt) : unit(sub(target, S));
  const n = perp(u);
  const a = (l1 * l1 - l2 * l2 + xe * xe) / (2 * xe);
  let h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  if (opts.straighten) h = (h * h) / (h + opts.straighten * 0.5 * (L1 + L2));
  const sw = clamp(swivel, -1, 1);
  const E = add(add(S, mul(u, a)), mul(n, sw * h));
  return { E, T: add(S, mul(u, xe)), stretch: k, extension: clamp(xe / (l1 + l2), 0, 1) };
}

/**
 * Swivel from a pole direction: the middle joint leans toward `pole` (elbows down and back, knees forward).
 * It is a smooth function of the reach direction, so sweeping a hand around the shoulder can never flip the elbow.
 */
export function poleSwivel(S: Pt, target: Pt, pole: Pt, gain = 2.2): number {
  const u = unit(sub(target, S));
  const s = dot(perp(u), unit(pole));
  return Math.tanh(gain * s) / Math.tanh(gain);
}

/** Interior angle at the middle joint, degrees (180 = straight). */
export function jointAngle(S: Pt, E: Pt, T: Pt): number {
  const a = unit(sub(S, E));
  const b = unit(sub(T, E));
  return (Math.acos(clamp(dot(a, b), -1, 1)) * 180) / Math.PI;
}
