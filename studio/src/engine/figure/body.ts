// The whole figure: a bendable spine carrying a lofted torso, a neck and head, two arms and two legs.
// A pose is plain numbers; the same pose and character can be painted in any look.
//
// "L" and "R" are the character's own left and right. Body yaw 0 faces the camera, + turns to screen right;
// facing right, the character's right side is the near side.
import { shape, type Shape } from "../draw/shape.ts";
import { capsule, dedupe, ellipse, quad, roundedPoly } from "../geom/outline.ts";
import { add, clamp, DEG, dot, len, lerpPt, mid, mix, mul, perp, rot, smoothstep, sub, unit, type Pt } from "../geom/vec.ts";
import type { PeopleStyle } from "../look/looks.ts";
import { HANDS, type HandOut, type HandPose } from "./hand.ts";
import { buildHead, FACE_PALETTE, type HeadOut, type HeadPose, type HeadSpec } from "./head.ts";
import { buildArm, buildLeg, type ArmOut, type LegOut } from "./limbs.ts";
import { loftFromRows, viewLoft, type Loft } from "./loft.ts";

// ---------------------------------------------------------------------------------------------------------------
// Build: proportions, in head-heights
// ---------------------------------------------------------------------------------------------------------------

export interface TrunkRow {
  /** position down the torso: 0 = base of the neck, 1 = hip line */
  v: number;
  a: number;
  zf: number;
  zb: number;
}

export interface Build {
  torso: number;
  neck: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  thigh: number;
  shin: number;
  foot: number;
  ankle: number;
  /** spine to shoulder joint, spine to hip joint */
  shoulder: number;
  hip: number;
  /** half-widths at the root, the middle joint and the end of the limb */
  arm: readonly [number, number, number];
  neckHalf: number;
  trunk: readonly TrunkRow[];
  /** head size against the head unit */
  head: number;
  /** forward lean of the neck, radians */
  neckLean: number;
}

const TRUNK: readonly TrunkRow[] = [
  { v: -0.05, a: 0.19, zf: 0.13, zb: -0.19 },
  { v: 0.0, a: 0.28, zf: 0.19, zb: -0.25 },
  { v: 0.05, a: 0.44, zf: 0.25, zb: -0.29 },
  { v: 0.105, a: 0.57, zf: 0.31, zb: -0.31 },
  { v: 0.17, a: 0.62, zf: 0.36, zb: -0.32 },
  { v: 0.3, a: 0.6, zf: 0.39, zb: -0.3 },
  { v: 0.52, a: 0.53, zf: 0.36, zb: -0.24 },
  { v: 0.76, a: 0.53, zf: 0.36, zb: -0.28 },
  { v: 1.0, a: 0.56, zf: 0.33, zb: -0.35 },
  { v: 1.1, a: 0.5, zf: 0.27, zb: -0.32 },
  { v: 1.17, a: 0.3, zf: 0.14, zb: -0.18 },
];

export interface BuildOpts {
  /** overall width and depth of the trunk */
  wide?: number;
  deep?: number;
  /** extra at the belly and at the chest, head-heights */
  belly?: number;
  chest?: number;
  shoulders?: number;
  hips?: number;
  /** thickness of arms and neck */
  limb?: number;
  torso?: number;
  legs?: number;
  arms?: number;
  head?: number;
}

export function makeBuild(o: BuildOpts = {}): Build {
  const wide = o.wide ?? 1;
  const deep = o.deep ?? 1;
  const belly = o.belly ?? 0;
  const chest = o.chest ?? 0;
  const sh = o.shoulders ?? 1;
  const hips = o.hips ?? 1;
  const k = o.limb ?? 1;
  const bump = (v: number, c: number, w: number) => Math.exp(-((v - c) * (v - c)) / (2 * w * w));
  const trunk = TRUNK.map((r) => {
    const top = (1 - smoothstep(0.3, 0.62, r.v)) * smoothstep(-0.02, 0.05, r.v);
    const low = smoothstep(0.62, 0.95, r.v);
    return {
      v: r.v,
      a: r.a * wide * (1 + (sh - 1) * top) * (1 + (hips - 1) * low) + belly * 0.45 * bump(r.v, 0.68, 0.2),
      zf: r.zf * deep + belly * bump(r.v, 0.66, 0.2) + chest * bump(r.v, 0.24, 0.14),
      zb: r.zb * deep - chest * 0.3 * bump(r.v, 0.2, 0.15),
    };
  });
  const legs = o.legs ?? 1;
  const arms = o.arms ?? 1;
  return {
    torso: 1.7 * (o.torso ?? 1),
    neck: 0.3,
    upperArm: 1.0 * arms,
    foreArm: 0.9 * arms,
    hand: 0.62,
    thigh: 1.25 * legs,
    shin: 1.25 * legs,
    foot: 0.78,
    ankle: 0.2,
    shoulder: 0.57 * wide * sh,
    hip: 0.3 * wide * hips,
    arm: [0.17 * k, 0.14 * k, 0.105 * k],
    neckHalf: 0.165 * k,
    trunk,
    head: o.head ?? 1,
    neckLean: 0.2,
  };
}

const lofts = new WeakMap<Build, Loft>();
function trunkLoft(b: Build): Loft {
  let l = lofts.get(b);
  if (!l) {
    l = loftFromRows(b.trunk.map((r) => ({ v: r.v * b.torso, a: r.a, zf: r.zf, zb: r.zb, zm: 0.02 })));
    lofts.set(b, l);
  }
  return l;
}

// ---------------------------------------------------------------------------------------------------------------
// Clothes
// ---------------------------------------------------------------------------------------------------------------

export interface Garment {
  mat: string;
  /** top and hem down the torso (0 = base of the neck, 1 = hip line); a hem past 1.17 hangs over the thighs */
  from?: number;
  hem: number;
  /** neckline: how far it dips at the front, head-heights; `point` makes it a V */
  neck?: { dip: number; point?: boolean };
  /** how much looser than the body, head-heights */
  ease?: number;
  /** strip of buttons down the front */
  placket?: { to: number; buttons: number; mat: string; tone?: "light" | "shade" };
}

export interface Outfit {
  top: Garment & { sleeve: number; cuff?: { mat: string; from: number; to: number } };
  over?: Garment;
  legs: { mat: string; half: readonly [number, number, number]; end: number };
  shoe: { mat: string };
  belt?: { mat: string; at: number; width: number };
  collar?: { mat: string; kind: "band" | "wing" };
}

export interface Character {
  id: string;
  skin: string;
  build: Build;
  head: HeadSpec;
  outfit: Outfit;
}

/** Materials every figure needs besides its own clothes. */
export const FIGURE_PALETTE = { ...FACE_PALETTE, brad: "#b48f3d" } as const;

// ---------------------------------------------------------------------------------------------------------------
// Pose
// ---------------------------------------------------------------------------------------------------------------

/** Body-relative offset in head-heights: [forward (the way the body faces), outward (away from the midline), down]. */
export type Rel = readonly [number, number, number];

export interface ArmPose {
  /** where the wrist goes: body-relative from the shoulder, or a stage point when `world` is set */
  to: Rel | Pt;
  world?: boolean;
  /** elbow side, -1..1; by default it leans down and back */
  swivel?: number;
  /** blend from the automatic elbow toward a chosen one (so a verb can take the elbow over without a jump) */
  swivelMix?: { value: number; amount: number };
  hand?: HandPose;
  /** which side of the hand the palm (and thumb) is on; by default the thumb leads */
  palm?: 1 | -1;
  /** wrist bend, radians */
  wrist?: number;
  /** draw in front of or behind the body; by default the far arm goes behind */
  layer?: "front" | "back";
  /** extra shoulder lift, head-heights */
  shrug?: number;
}

export interface LegPose {
  /** where the ankle goes: body-relative from the hip joint, or a stage point when `world` is set */
  to: Rel | Pt;
  world?: boolean;
  swivel?: number;
  /** foot pitch about the ankle, radians (+ = toes down) */
  pitch?: number;
  /** how the foot faces (-1..1, see the leg builder); by default it follows the body's yaw */
  face?: number;
}

export interface FigurePose {
  /** pelvis (centre of the hip line), stage px */
  at: Pt;
  /** px per head-height */
  scale: number;
  yaw: number;
  /** chest yaw minus pelvis yaw */
  twist?: number;
  /** lean of the spine at the pelvis, from upright; + = toward screen right */
  lean?: number;
  /** further lean gathered by the time the spine reaches the neck */
  bend?: number;
  hipRoll?: number;
  shoulderRoll?: number;
  armL: ArmPose;
  armR: ArmPose;
  legL: LegPose;
  legR: LegPose;
  /** extra neck lean in the picture plane */
  neck?: number;
  head: HeadPose;
}

export interface FigureOut {
  /** back to front, ready to paint */
  shapes: Shape[];
  /** the same shapes in three layers, so a prop can go between them */
  layers: { behind: Shape[]; body: Shape[]; front: Shape[] };
  head: HeadOut;
  arms: { L: ArmOut; R: ArmOut };
  legs: { L: LegOut; R: LegOut };
  hands: { L: HandOut; R: HandOut };
  joints: { pelvis: Pt; neck: Pt; headPivot: Pt; shoulderL: Pt; shoulderR: Pt; hipL: Pt; hipR: Pt };
  /** outlines for the checks: torso and head as closed polygons */
  torso: Pt[];
  /** which side is nearer the camera */
  near: "L" | "R";
}

const NECK_TOP = -0.045;
const CROTCH = 1.17;
const SHOULDER_V = 0.105;

function softSwivel(S: Pt, target: Pt, pole: Pt, gain = 2.2): number {
  const u = unit(sub(target, S));
  return Math.tanh(gain * dot(perp(u), pole)) / Math.tanh(gain);
}

/** Height of the hip line above the ground when standing straight, in head-heights. */
export const hipHeight = (b: Build) => (b.thigh + b.shin) * 0.996 + b.ankle;

/** Height of the whole figure, in head-heights. */
export const figureHeight = (b: Build, headScale = 1) => hipHeight(b) + b.torso + b.neck + (0.5 + 0.3) * b.head * headScale;

/** The pose numbers that place the spine, the shoulders and the hips. */
export type SpinePose = Pick<FigurePose, "at" | "scale" | "yaw" | "twist" | "lean" | "bend" | "hipRoll" | "shoulderRoll">;

export interface Skeleton {
  /** a point on the spine, with its up and right directions; vf = 0 at the base of the neck, 1 at the hip line */
  frame(vf: number): { p: Pt; up: Pt; n: Pt };
  /** shoulder joint before the arm pulls on it; sg = 1 for the character's left */
  shoulder(sg: 1 | -1): Pt;
  hip(sg: 1 | -1): Pt;
  neckBase: Pt;
  /** yaw of the chest */
  yawC: number;
}

/** The spine as a curve of constant bend from the pelvis to the base of the neck, and the joints that hang off it. */
export function skeleton(B: Build, pose: SpinePose): Skeleton {
  const H = pose.scale;
  const T = B.torso;
  const lean = pose.lean ?? 0;
  const bend = pose.bend ?? 0;
  const yawC = pose.yaw + (pose.twist ?? 0);
  const SP = 14;
  const sp: Pt[] = [pose.at];
  for (let i = 1; i <= SP; i++) {
    const ph = lean + bend * ((i - 0.5) / SP);
    sp.push(add(sp[i - 1], [(Math.sin(ph) * T * H) / SP, (-Math.cos(ph) * T * H) / SP]));
  }
  const frame = (vf: number): { p: Pt; up: Pt; n: Pt } => {
    const u = 1 - vf;
    const ph = lean + bend * clamp(u, 0, 1);
    const up: Pt = [Math.sin(ph), -Math.cos(ph)];
    const n: Pt = [Math.cos(ph), Math.sin(ph)];
    let p: Pt;
    if (u <= 0) p = add(sp[0], mul(up, u * T * H));
    else if (u >= 1) p = add(sp[SP], mul(up, (u - 1) * T * H));
    else {
      const x = u * SP;
      const i = Math.min(SP - 1, Math.floor(x));
      p = lerpPt(sp[i], sp[i + 1], x - i);
    }
    return { p, up, n };
  };
  const fsh = frame(SHOULDER_V);
  const shAng = lean + bend * (1 - SHOULDER_V) + (pose.shoulderRoll ?? 0);
  const hipAng = (pose.hipRoll ?? 0) + lean * 0.5;
  return {
    frame,
    shoulder: (sg) => add(fsh.p, rot([sg * B.shoulder * Math.cos(yawC) * H, 0], shAng)),
    hip: (sg) => add(pose.at, rot([sg * B.hip * Math.cos(pose.yaw) * H, 0], hipAng)),
    neckBase: frame(0).p,
    yawC,
  };
}

export function buildFigure(ch: Character, pose: FigurePose, style: PeopleStyle): FigureOut {
  const H = pose.scale;
  const B = ch.build;
  const O = ch.outfit;
  const T = B.torso;
  const yaw = pose.yaw;
  const twist = pose.twist ?? 0;
  const sk = skeleton(B, pose);
  const yawC = sk.yawC;
  const frame = sk.frame;
  const loft = trunkLoft(B);
  const view = viewLoft(loft, (v) => yaw + twist * (1 - smoothstep(0.3, 0.85, v / T)));
  const toS = (l: number, vf: number): Pt => {
    const f = frame(vf);
    return add(f.p, mul(f.n, l * H));
  };
  const rel = (sg: 1 | -1, r: Rel, y: number): Pt => [(r[0] * Math.sin(y) + sg * r[1] * Math.cos(y)) * H, r[2] * H];

  // ---- legs
  const near: 1 | -1 = Math.sin(yaw) > 0.05 ? -1 : Math.sin(yaw) < -0.05 ? 1 : -1;
  const hipJ = sk.hip;
  const mkLeg = (sg: 1 | -1, lp: LegPose, key: string): LegOut => {
    const S = hipJ(sg);
    const tgt = lp.world ? (lp.to as Pt) : add(S, rel(sg, lp.to as Rel, yaw));
    const swivel = lp.swivel ?? softSwivel(S, tgt, [Math.sin(yaw) + sg * 0.14 * Math.cos(yaw), -0.08]);
    return buildLeg({
      id: `${ch.id}/leg${key}`,
      S,
      target: tgt,
      thigh: B.thigh * H,
      shin: B.shin * H,
      swivel,
      half: [O.legs.half[0] * H, O.legs.half[1] * H, O.legs.half[2] * H],
      trouser: O.legs.end,
      matCloth: O.legs.mat,
      matSkin: ch.skin,
      matShoe: O.shoe.mat,
      foot: { length: B.foot * H, face: lp.face ?? Math.sin(yaw + sg * 0.22), pitch: lp.pitch ?? 0, height: B.ankle * H },
    });
  };
  const legL = mkLeg(1, pose.legL, "L");
  const legR = mkLeg(-1, pose.legR, "R");

  // ---- arms
  const fsh = frame(SHOULDER_V);
  const armLen = (B.upperArm + B.foreArm) * H;
  const mkArm = (sg: 1 | -1, ap: ArmPose, key: string): { arm: ArmOut; S: Pt } => {
    const S0 = sk.shoulder(sg);
    const tgt = ap.world ? (ap.to as Pt) : add(S0, rel(sg, ap.to as Rel, yawC));
    // the shoulder joins in: it rises as the arm lifts and moves toward a long reach
    const d = sub(tgt, S0);
    const elev = Math.acos(clamp(dot(unit(d), [0, 1]), -1, 1));
    const lift = 0.12 * H * smoothstep(40 * DEG, 150 * DEG, elev) + (ap.shrug ?? 0) * H;
    const pull = 0.08 * H * smoothstep(0.6, 1.05, len(d) / armLen);
    const S = add(S0, add(mul(fsh.up, lift), mul(unit(d), pull)));
    // elbows lean back and down; seen from the front that is mostly toward the camera, so only a little outward
    let swivel = ap.swivel ?? softSwivel(S, tgt, [-0.9 * Math.sin(yawC) + sg * 0.13 * Math.cos(yawC), 0.45]);
    if (ap.swivelMix) swivel = mix(swivel, ap.swivelMix.value, ap.swivelMix.amount);
    const fore = unit(sub(tgt, S));
    const ang = Math.atan2(fore[1], fore[0]);
    const auto = -Math.sin(ang) * (1.2 * Math.sin(yawC) - sg * Math.cos(yawC)) + Math.cos(ang) * 0.6 >= 0 ? 1 : -1;
    const arm = buildArm({
      id: `${ch.id}/arm${key}`,
      S,
      target: tgt,
      upper: B.upperArm * H,
      fore: B.foreArm * H,
      swivel,
      half: [B.arm[0] * H, B.arm[1] * H, B.arm[2] * H],
      sleeve: O.top.sleeve,
      matSleeve: O.top.mat,
      matSkin: ch.skin,
      hand: { pose: ap.hand ?? HANDS.relaxed, bend: ap.wrist ?? 0, palmSide: ap.palm ?? auto, size: B.hand * H, girth: style.lines ? 1.12 : 1 },
      cuff: O.top.cuff ? { ...O.top.cuff, grow: H * 0.016 } : undefined,
    });
    return { arm, S };
  };
  const aL = mkArm(1, pose.armL, "L");
  const aR = mkArm(-1, pose.armR, "R");
  const layerOf = (sg: 1 | -1, ap: ArmPose): "front" | "back" => ap.layer ?? (-sg * Math.sin(yawC) < -0.3 ? "back" : "front");
  const layL = layerOf(1, pose.armL);
  const layR = layerOf(-1, pose.armR);

  // ---- neck and head
  const fn = frame(0);
  const sTop = loft.at(0);
  const nb = add(fn.p, mul(fn.n, ((sTop.zf + sTop.zb) / 2) * Math.sin(yawC) * H));
  const neckAng = B.neckLean * Math.sin(yawC) + (pose.neck ?? 0);
  const neckUp = rot(fn.up, neckAng);
  const headPivot = add(nb, mul(neckUp, B.neck * H));
  const Hh = H * B.head * style.head;
  const head = buildHead(`${ch.id}/head`, ch.head, pose.head, headPivot, Hh, style);
  const neckPts = capsule(add(nb, mul(neckUp, -0.1 * H)), add(headPivot, mul(neckUp, 0.06 * H)), B.neckHalf * 1.1 * H, B.neckHalf * H, 3);
  const neck = shape(`${ch.id}/neck`, ch.skin, neckPts, { depth: H * 0.05, casts: head.mass.map((pts) => ({ pts, reach: Hh * 0.1 })) });

  // ---- torso garments
  const garment = (g: Garment, key: string, sleeves: boolean): Shape => {
    const vA = g.from ?? NECK_TOP;
    const ease = g.ease ?? 0;
    const skirt = g.hem > CROTCH;
    const vB = skirt ? 1.0 : g.hem;
    const n = 16;
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const vf = mix(vA, vB, i / n);
      const e = view.edge(vf * T);
      L.push(toS(e[0] - ease, vf));
      R.push(toS(e[1] + ease, vf));
    }
    const poly: Pt[] = [];
    let hemL = L[n];
    let hemR = R[n];
    if (skirt) {
      // the hem hangs over the thighs and follows them, so a stride opens it
      const q = clamp(((g.hem - 1) * T) / B.thigh, 0.1, 0.95);
      const cand: Pt[] = [];
      for (const [leg, sg] of [
        [legL, 1],
        [legR, -1],
      ] as const) {
        const hip = hipJ(sg);
        const C = lerpPt(hip, leg.knee, q);
        const nr = perp(unit(sub(leg.knee, hip)));
        const w = (mix(O.legs.half[0], O.legs.half[1], q) * 1.1 + 0.05 + ease) * H;
        cand.push(add(C, mul(nr, -w)), add(C, mul(nr, w)));
      }
      hemL = cand.reduce((a, b) => (b[0] < a[0] ? b : a));
      hemR = cand.reduce((a, b) => (b[0] > a[0] ? b : a));
      if (hemL[0] > L[n][0] - 0.02 * H) hemL = [L[n][0] - 0.02 * H, hemL[1]];
      if (hemR[0] < R[n][0] + 0.02 * H) hemR = [R[n][0] + 0.02 * H, hemR[1]];
      poly.push(hemL);
    }
    for (let i = n; i >= 0; i--) poly.push(L[i]);
    const dip = g.neck?.dip ?? (g.from === undefined ? 0.05 : 0);
    if (dip > 0.001) {
      const eT = view.edge(vA * T);
      const sT = loft.at(vA * T);
      const lf = clamp(sT.zf * Math.sin(view.yawAt(vA * T)), eT[0] + 0.05, eT[1] - 0.05);
      const M = toS(lf, vA + dip / T);
      if (g.neck?.point) poly.push(M);
      else poly.push(...quad(L[0], sub(mul(M, 2), mid(L[0], R[0])), R[0], 3).slice(1, -1));
    }
    for (let i = 0; i <= n; i++) poly.push(R[i]);
    if (skirt) poly.push(hemR);
    const sB = loft.at(Math.min(vB, 1.1) * T);
    const front = clamp(sB.zf * Math.sin(yaw) * 0.6, -0.3, 0.3) * H;
    const Mh = add(mid(hemR, hemL), [front, (skirt ? 0.05 : 0.028) * H]);
    poly.push(...quad(hemR, sub(mul(Mh, 2), mid(hemR, hemL)), hemL, 3).slice(1, -1));
    return shape(`${ch.id}/${key}`, g.mat, dedupe(poly, 0.05), { depth: H * (sleeves ? 0.19 : 0.17) });
  };

  const pelvis = garment({ mat: O.legs.mat, from: 0.7, hem: CROTCH, neck: { dip: 0 } }, "pelvis", false);
  const top = garment(O.top, "top", true);
  const over = O.over ? garment({ ease: 0.012, ...O.over }, "over", false) : null;
  const belt = O.belt ? garment({ mat: O.belt.mat, from: O.belt.at - O.belt.width / 2, hem: O.belt.at + O.belt.width / 2, neck: { dip: 0 }, ease: 0.008 }, "belt", false) : null;

  // details that sit on the chest: they turn with it
  const trims: Shape[] = [];
  const surf = (x: number, vHead: number, lift = 0.006) => {
    const p = view.front(x, vHead, lift);
    return { pt: toS(p.l, vHead / T), vis: p.vis, k: p.k };
  };
  const outer = over ?? top;
  const pl = (O.over?.placket ? O.over : O.top).placket;
  if (pl) {
    const g = O.over?.placket ? O.over! : O.top;
    const v0 = ((g.from ?? NECK_TOP) + 0.02) * T + (g.neck?.dip ?? 0.05);
    const v1 = pl.to * T;
    const w = 0.03;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const v = mix(v0, v1, i / 8);
      const a = surf(-w, v);
      const b = surf(w, v);
      if (a.vis > 0.05) left.push(a.pt);
      if (b.vis > 0.05) right.push(b.pt);
    }
    if (left.length >= 2 && right.length >= 2) {
      trims.push(shape(`${ch.id}/placket`, pl.mat, [...left, ...right.reverse()], { form: "flat", tone: pl.tone ?? "light", ink: 0, paper: false }));
    }
    for (let i = 0; i < pl.buttons; i++) {
      const v = mix(v0 + 0.07, v1 - 0.05, pl.buttons === 1 ? 0.5 : i / (pl.buttons - 1));
      const c = surf(0, v, 0.012);
      if (c.vis > 0.12) {
        const kx = clamp(Math.abs(c.k), 0.25, 1);
        trims.push(shape(`${ch.id}/button${i}`, pl.mat, ellipse(c.pt, 0.02 * H * kx, 0.02 * H, 0, 1.5), { form: "flat", tone: "shade", ink: 0, paper: false }));
      }
    }
  }
  if (O.collar?.kind === "wing") {
    for (const sg of [-1, 1] as const) {
      const raw: [number, number][] = [
        [sg * 0.19, -0.085],
        [sg * 0.02, 0.0],
        [sg * 0.11, 0.14],
        [sg * 0.27, 0.035],
      ];
      const pts = raw.map(([x, v]) => surf(x, v, 0.02)).filter((p) => p.vis > 0.02).map((p) => p.pt);
      if (pts.length >= 3) trims.push(shape(`${ch.id}/collar${sg}`, O.collar.mat, roundedPoly(pts.map((p) => ({ p, r: H * 0.012 })), 2), { depth: H * 0.02, rim: 0 }));
    }
  }
  if (O.collar?.kind === "band") {
    const c0 = add(nb, mul(neckUp, -0.02 * H));
    const w = B.neckHalf * 1.2 * H;
    const h = 0.11 * H;
    const nr = perp(neckUp);
    const bandPts = roundedPoly(
      [
        { p: add(add(c0, mul(nr, -w * -1)), mul(neckUp, h)), r: H * 0.02 },
        { p: add(add(c0, mul(nr, -w * -1.06)), mul(neckUp, -h * 0.3)), r: H * 0.02 },
        { p: add(add(c0, mul(nr, -w * 1.06)), mul(neckUp, -h * 0.3)), r: H * 0.02 },
        { p: add(add(c0, mul(nr, -w)), mul(neckUp, h)), r: H * 0.02 },
      ],
      2,
    );
    trims.push(shape(`${ch.id}/collar`, O.collar.mat, bandPts, { depth: H * 0.03, rim: 0.5 }));
  }

  // ---- contact shadows between the parts
  const frontArms: ArmOut[] = [];
  if (layL === "front") frontArms.push(aL.arm);
  if (layR === "front") frontArms.push(aR.arm);
  const armCasts = frontArms.map((a) => ({ pts: a.silhouette, reach: H * 0.07 }));
  const headCasts = head.mass.map((pts) => ({ pts, reach: Hh * 0.11 }));
  outer.casts = [...armCasts, ...headCasts];
  if (over) top.casts = [{ pts: over.pts, reach: H * 0.04 }];
  pelvis.casts = [{ pts: outer.pts, reach: H * 0.05 }, ...armCasts];
  const nearLeg = near === 1 ? legL : legR;
  const farLeg = near === 1 ? legR : legL;
  const skirtCast = O.top.hem > CROTCH ? [{ pts: top.pts, reach: H * 0.05 }] : [{ pts: pelvis.pts, reach: H * 0.03 }];
  for (const s of farLeg.shapes) s.casts = [{ pts: nearLeg.silhouette, reach: H * 0.04 }, ...skirtCast];
  for (const s of nearLeg.shapes) s.casts = [...skirtCast, ...armCasts];
  const backArms: ArmOut[] = [];
  if (layL === "back") backArms.push(aL.arm);
  if (layR === "back") backArms.push(aR.arm);
  for (const a of backArms) for (const s of a.shapes) if (!s.casts) s.casts = [{ pts: outer.pts, reach: H * 0.06 }];

  // ---- look C: paper fasteners at the joints
  const brads: Shape[] = [];
  if (style.brads) {
    const dotAt = (p: Pt, k: string) => brads.push(shape(`${ch.id}/brad.${k}`, "brad", ellipse(p, H * 0.035, H * 0.035, 0, 2), { form: "flat", paper: false }));
    for (const [a, k] of [
      [aL, "L"],
      [aR, "R"],
    ] as const) {
      if ((k === "L" ? layL : layR) === "front") {
        dotAt(a.S, `sh${k}`);
        dotAt(a.arm.elbow, `el${k}`);
      }
    }
    dotAt(nearLeg.knee, "kn");
  }

  const behind: Shape[] = [...head.back, ...backArms.flatMap((a) => a.shapes)];
  const body: Shape[] = [...farLeg.shapes, ...nearLeg.shapes, pelvis, neck, top];
  if (belt) body.push(belt);
  if (over) body.push(over);
  body.push(...trims, ...head.shapes);
  const front: Shape[] = [...frontArms.flatMap((a) => a.shapes), ...brads];

  return {
    shapes: [...behind, ...body, ...front],
    layers: { behind, body, front },
    head,
    arms: { L: aL.arm, R: aR.arm },
    legs: { L: legL, R: legR },
    hands: { L: aL.arm.hand, R: aR.arm.hand },
    joints: { pelvis: pose.at, neck: nb, headPivot, shoulderL: aL.S, shoulderR: aR.S, hipL: hipJ(1), hipR: hipJ(-1) },
    torso: outer.pts,
    near: near === 1 ? "L" : "R",
  };
}

// ---------------------------------------------------------------------------------------------------------------
// A standing pose to start from
// ---------------------------------------------------------------------------------------------------------------

export interface StandOpts {
  /** the spot on the ground between the feet, stage px */
  feet: Pt;
  scale: number;
  yaw: number;
  /** head yaw; by default the head faces the way the body does, turned a little toward the camera */
  headYaw?: number;
}

export function stand(ch: Character, o: StandOpts): FigurePose {
  const B = ch.build;
  const H = o.scale;
  const sn = Math.sin(o.yaw);
  const cs = Math.cos(o.yaw);
  const at: Pt = [o.feet[0], o.feet[1] - hipHeight(B) * H];
  // side-on, the ankles sit a little behind the hips so the weight is over the middle of the feet
  const ankle = (sg: 1 | -1): Pt => [o.feet[0] + (sg * (B.hip * 0.95 * cs - 0.1 * sn) - 0.1 * sn) * H, o.feet[1] - B.ankle * H];
  const reachDown = (B.upperArm + B.foreArm) * 0.972;
  const hang: Rel = [0.1, 0.07, reachDown];
  return {
    at,
    scale: H,
    yaw: o.yaw,
    armL: { to: hang },
    armR: { to: hang },
    legL: { to: ankle(1), world: true },
    legR: { to: ankle(-1), world: true },
    head: { yaw: o.headYaw ?? o.yaw * 0.82 },
  };
}
