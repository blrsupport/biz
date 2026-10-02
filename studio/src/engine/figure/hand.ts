// One hand, one topology: a palm, four fingers and a thumb. A pose is five curl numbers, so any two poses blend.
// The hand is drawn from the thumb side (the view you get of most acting hands), palm toward `palmSide`.
import { shape, type Shape } from "../draw/shape.ts";
import { limb, roundedPoly } from "../geom/outline.ts";
import { add, clamp, fromAngle, mix, mul, rot, type Pt } from "../geom/vec.ts";

export interface HandPose {
  /** curl of index, middle, ring, little finger: 0 straight, 1 closed */
  curl: readonly [number, number, number, number];
  /** thumb: -1 lifted away from the palm, 0 resting alongside, 1 folded across the palm */
  thumb: number;
  /** fan of the fingers: 0 together, 1 spread */
  spread: number;
}

export const HANDS = {
  relaxed: { curl: [0.18, 0.26, 0.34, 0.42], thumb: 0.1, spread: 0.15 },
  open: { curl: [0.03, 0.03, 0.05, 0.08], thumb: -0.45, spread: 0.6 },
  flat: { curl: [0, 0, 0, 0], thumb: 0.1, spread: 0.05 },
  fist: { curl: [1, 1, 1, 1], thumb: 0.95, spread: 0 },
  point: { curl: [0, 0.95, 1, 1], thumb: 0.8, spread: 0 },
  grip: { curl: [0.62, 0.66, 0.7, 0.74], thumb: 0.55, spread: 0.1 },
  hook: { curl: [0.5, 0.52, 0.55, 0.6], thumb: -0.2, spread: 0.1 },
  pinch: { curl: [0.5, 0.2, 0.25, 0.3], thumb: 0.5, spread: 0.3 },
  cup: { curl: [0.3, 0.32, 0.36, 0.4], thumb: -0.3, spread: 0.15 },
  splay: { curl: [0, 0, 0, 0.02], thumb: -0.9, spread: 1 },
} as const satisfies Record<string, HandPose>;

export type HandName = keyof typeof HANDS;

export function mixHand(a: HandPose, b: HandPose, t: number): HandPose {
  return {
    curl: [mix(a.curl[0], b.curl[0], t), mix(a.curl[1], b.curl[1], t), mix(a.curl[2], b.curl[2], t), mix(a.curl[3], b.curl[3], t)],
    thumb: mix(a.thumb, b.thumb, t),
    spread: mix(a.spread, b.spread, t),
  };
}

export interface HandSpec {
  id: string;
  mat: string;
  wrist: Pt;
  /** direction the hand points, radians */
  angle: number;
  /** wrist to middle fingertip when straight, px */
  size: number;
  pose: HandPose;
  /** +1: palm faces the right-hand side of the hand's direction; -1: the left */
  palmSide: 1 | -1;
  /** chunkier (look B) or slimmer fingers */
  girth?: number;
}

export interface HandOut {
  /** back to front: little, ring, middle, index, palm, thumb */
  shapes: Shape[];
  /** the four fingers only (to put behind a held thing) and the palm with thumb (to put in front) */
  fingers: Shape[];
  palm: Shape[];
  /** centre of the palm, where a held object sits */
  hold: Pt;
  /** tip of the index finger */
  tip: Pt;
  /** tip of the thumb */
  thumbTip: Pt;
}

const DEG = Math.PI / 180;

export function buildHand(spec: HandSpec): HandOut {
  const s = spec.size;
  const g = spec.girth ?? 1;
  const ps = spec.palmSide;
  // local frame: x along the hand, y toward the palm side
  const toWorld = (p: Pt): Pt => add(spec.wrist, rot([p[0], p[1] * ps], spec.angle));
  const dirW = (a: number) => spec.angle + a * ps;
  const depth = Math.max(2, s * 0.045);

  const palmL: Pt[] = [
    [-0.03 * s, -0.16 * s * g],
    [0.34 * s, -0.205 * s * g],
    [0.53 * s, -0.165 * s * g],
    [0.56 * s, 0.085 * s * g],
    [0.3 * s, 0.215 * s * g],
    [-0.03 * s, 0.155 * s * g],
  ];
  const palm = roundedPoly(
    palmL.map((p, i) => ({ p: toWorld(p), r: [0.07, 0.12, 0.09, 0.1, 0.16, 0.07][i] * s })),
    Math.max(1.5, s / 40),
  );

  // fingers sit close together and overlap, so the hand keeps one compact silhouette at any size
  const lens = [0.44, 0.48, 0.44, 0.35];
  const baseY = [-0.1, -0.045, 0.01, 0.06];
  const widths = [0.125, 0.13, 0.12, 0.105];
  const fan = [-10, -3, 4, 12];
  const fingers: Shape[] = [];
  let tip: Pt = spec.wrist;
  for (let k = 3; k >= 0; k--) {
    const c = clamp(spec.pose.curl[k], 0, 1.05);
    const len = lens[k] * s;
    const base = toWorld([0.46 * s, baseY[k] * s * g * (1 + 0.5 * spec.pose.spread)]);
    const a1 = (fan[k] * spec.pose.spread * 1.5 + c * 78) * DEG;
    const a2 = a1 + c * 98 * DEG;
    const E = add(base, fromAngle(dirW(a1), len * 0.52));
    const T = add(E, fromAngle(dirW(a2), len * 0.48));
    const w = widths[k] * s * g;
    const L = limb({ S: base, E, T, h0: w * 0.52, h1: w * 0.5, h2: w * 0.44, point: 0.12, step: Math.max(1.2, s / 50) });
    fingers.push(shape(`${spec.id}/f${k}`, spec.mat, L.outline, { depth, rim: 0, ink: 0.6 }));
    if (k === 0) tip = add(T, fromAngle(dirW(a2), w * 0.42));
  }

  // thumb: lies along the palm-side edge of the hand, pointing forward at rest;
  // -1 swings it out and away, +1 wraps it forward over the curled fingers (it stays inside the fist)
  const th = clamp(spec.pose.thumb, -1, 1);
  const tBase = toWorld([0.13 * s, 0.09 * s * g]);
  const tA1 = (th >= 0 ? mix(14, 20, th) : mix(14, 62, -th)) * DEG;
  const tA2 = tA1 + (th >= 0 ? -th * 34 : th * 10) * DEG;
  const tE = add(tBase, fromAngle(dirW(tA1), 0.24 * s));
  const tT = add(tE, fromAngle(dirW(tA2), (th >= 0 ? mix(0.2, 0.165, th) : 0.2) * s));
  const tw = 0.15 * s * g;
  const thumbL = limb({ S: tBase, E: tE, T: tT, h0: tw * 0.6, h1: tw * 0.5, h2: tw * 0.42, point: 0.1, step: Math.max(1.2, s / 50) });
  const thumb = shape(`${spec.id}/thumb`, spec.mat, thumbL.outline, { depth, rim: 0, ink: 0.7 });
  const palmShape = shape(`${spec.id}/palm`, spec.mat, palm, { depth: depth * 2.2, ink: 0.85, casts: [{ pts: thumbL.outline, reach: depth * 1.2 }] });

  return {
    shapes: [...fingers, palmShape, thumb],
    fingers,
    palm: [palmShape, thumb],
    hold: toWorld([0.36 * s, 0.1 * s]),
    tip,
    thumbTip: add(tT, mul(fromAngle(dirW(tA2)), tw * 0.42)),
  };
}
