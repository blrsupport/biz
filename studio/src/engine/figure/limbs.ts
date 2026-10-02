// Arms and legs as soft shapes: solve the reach, then cut the limb into cloth and skin.
import { shape, type Shape } from "../draw/shape.ts";
import { clockwise, inflate, limb, roundedPoly } from "../geom/outline.ts";
import { add, angleOf, fromAngle, mul, rot, sub, type Pt } from "../geom/vec.ts";
import { buildHand, type HandOut, type HandPose } from "./hand.ts";
import { reach, type Reach } from "./ik.ts";

export interface ArmSpec {
  id: string;
  /** shoulder joint, stage px */
  S: Pt;
  /** where the wrist should be */
  target: Pt;
  /** bone lengths, px */
  upper: number;
  fore: number;
  /** -1..1, which side the elbow leans to (see ik.ts) */
  swivel: number;
  /** half-widths at shoulder, elbow, wrist, px */
  half: readonly [number, number, number];
  /** where the sleeve ends along the limb: 0 none, 1 elbow, 2 wrist */
  sleeve: number;
  matSleeve: string;
  matSkin: string;
  hand: { pose: HandPose; bend: number; palmSide: 1 | -1; size: number; girth?: number };
  /** a rolled sleeve or a cuff band: a slightly thicker piece of the limb between two positions */
  cuff?: { mat: string; from: number; to: number; grow: number };
  /** shading depth scale */
  depth?: number;
}

export interface ArmOut {
  /** back to front */
  shapes: Shape[];
  elbow: Pt;
  wrist: Pt;
  hand: HandOut;
  reach: Reach;
  /** direction of the forearm, radians */
  foreAngle: number;
  /** outline of the whole arm, for contact shadows on the body */
  silhouette: Pt[];
}

export function buildArm(a: ArmSpec): ArmOut {
  const r = reach(a.S, a.target, a.upper, a.fore, a.swivel, { straighten: 0.05 });
  const L = limb({ S: a.S, E: r.E, T: r.T, h0: a.half[0], h1: a.half[1], h2: a.half[2], point: 0.32, step: 3 });
  const foreAngle = angleOf(sub(r.T, r.E));
  const hand = buildHand({
    id: `${a.id}/hand`,
    mat: a.matSkin,
    wrist: add(r.T, fromAngle(foreAngle, -a.half[2] * 0.25)),
    angle: foreAngle + a.hand.bend,
    size: a.hand.size,
    pose: a.hand.pose,
    palmSide: a.hand.palmSide,
    girth: a.hand.girth,
  });
  const d = a.depth ?? 1;
  const shapes: Shape[] = [];
  const sl = Math.max(0, Math.min(2, a.sleeve));
  if (sl < 1.98) {
    const from = Math.max(0, sl - 0.12);
    shapes.push(shape(`${a.id}/skin`, a.matSkin, L.section(from, 2), { depth: a.half[1] * 0.5 * d }));
  }
  shapes.push(...hand.shapes);
  if (sl > 0.02) {
    const cuff = sl >= 1.98 ? 2 : sl;
    shapes.push(shape(`${a.id}/sleeve`, a.matSleeve, L.section(0, cuff, { bulgeB: a.half[2] * 0.22 }), { depth: a.half[0] * 0.55 * d }));
  }
  if (a.cuff) {
    const band = inflate(clockwise(L.section(a.cuff.from, a.cuff.to, { bulgeA: -a.half[2] * 0.18, bulgeB: a.half[2] * 0.22 })), a.cuff.grow);
    shapes.push(shape(`${a.id}/cuff`, a.cuff.mat, band, { depth: a.half[1] * 0.5 * d }));
  }
  return { shapes, elbow: r.E, wrist: r.T, hand, reach: r, foreAngle, silhouette: L.outline };
}

export interface LegSpec {
  id: string;
  /** hip joint */
  S: Pt;
  /** ankle target */
  target: Pt;
  thigh: number;
  shin: number;
  swivel: number;
  half: readonly [number, number, number];
  /** trouser end along the limb: 2 = ankle */
  trouser: number;
  matCloth: string;
  matSkin: string;
  matShoe: string;
  /**
   * foot: full length px; `face` -1..1 (sign = which way the toes point on screen, size = how side-on the foot is,
   * so a foot seen from the front is short); pitch about the ankle in radians (+ = toes down); ankle height px
   */
  foot: { length: number; face: number; pitch: number; height: number };
  depth?: number;
}

export interface LegOut {
  shapes: Shape[];
  knee: Pt;
  ankle: Pt;
  toe: Pt;
  heel: Pt;
  reach: Reach;
  silhouette: Pt[];
}

/**
 * How a foot of the given length shows when its facing is `face` (-1..1, see LegSpec): its drawn length, and how
 * far the toe tip and the back of the heel lie from the ankle. The walk uses the same numbers to pivot the foot.
 */
export function footShape(length: number, face: number): { sgn: 1 | -1; side: number; len: number; toe: number; heel: number } {
  const sgn: 1 | -1 = face >= 0 ? 1 : -1;
  const side = Math.max(0.42, Math.abs(face));
  const len = length * side;
  const back = 0.3 * side + 0.16 * (1 - side);
  return { sgn, side, len, toe: (1 - back) * len, heel: back * len };
}

export function buildLeg(g: LegSpec): LegOut {
  const r = reach(g.S, g.target, g.thigh, g.shin, g.swivel, { soft: 0.015, maxStretch: 1.03, minAngleDeg: 40, straighten: 0.12 });
  const L = limb({ S: g.S, E: r.E, T: r.T, h0: g.half[0], h1: g.half[1], h2: g.half[2], point: 0.25, step: 3 });
  const d = g.depth ?? 1;
  // foot: a wedge from heel to toe, pitched about the ankle; seen from the front it shortens and widens
  const fsh = footShape(g.foot.length, g.foot.face);
  const sgn = fsh.sgn;
  const side = fsh.side;
  const len = fsh.len;
  const h = g.foot.height;
  const p = g.foot.pitch;
  const dir: Pt = [sgn * Math.cos(p), Math.sin(p)];
  const up: Pt = [sgn * Math.sin(p), -Math.cos(p)];
  const ankle = r.T;
  const at = (x: number, y: number): Pt => add(ankle, add(mul(dir, x * len), mul(up, y * h)));
  const back = fsh.heel / len;
  void side;
  const heel = at(-back, -1);
  const toe = at(1 - back, -1);
  const foot = clockwise(
    roundedPoly(
      [
        { p: at(-back * 0.8, 0.3), r: h * 0.35 },
        { p: at(0.16, 0.25), r: h * 0.6 },
        { p: at(1 - back - 0.12, -0.5), r: h * 0.3 },
        { p: at(1 - back, -0.84), r: h * 0.16 },
        { p: toe, r: h * 0.12 },
        { p: heel, r: h * 0.22 },
        { p: at(-back - 0.04, -0.55), r: h * 0.3 },
      ],
      2.5,
    ),
  );
  const shapes: Shape[] = [];
  const tr = Math.max(0, Math.min(2, g.trouser));
  if (tr < 1.98) shapes.push(shape(`${g.id}/skin`, g.matSkin, L.section(Math.max(0, tr - 0.1), 2), { depth: g.half[1] * 0.5 * d }));
  shapes.push(shape(`${g.id}/foot`, g.matShoe, foot, { depth: h * 0.3 * d }));
  if (tr > 0.02) shapes.push(shape(`${g.id}/cloth`, g.matCloth, L.section(0, tr >= 1.98 ? 2 : tr, { bulgeB: g.half[2] * 0.15 }), { depth: g.half[0] * 0.5 * d }));
  return { shapes, knee: r.E, ankle, toe, heel, reach: r, silhouette: L.outline };
}

/** Rotates a point list about an origin (used by sheets). */
export const spin = (pts: readonly Pt[], o: Pt, ang: number): Pt[] => pts.map((p) => add(o, rot(sub(p, o), ang)));
