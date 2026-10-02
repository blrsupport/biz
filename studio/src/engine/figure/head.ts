// The head: one lofted form per character, seen from any side, with every feature placed on its surface.
// Turning the head is a change of one number (yaw); nothing is swapped, so nothing pops.
import { shape, type Shape } from "../draw/shape.ts";
import { clipConvex, ellipse, hull, roundedPoly, spline, squircle, stroke } from "../geom/outline.ts";
import { add, clamp, DEG, mix, rot, smoothstep, type Pt } from "../geom/vec.ts";
import type { PeopleStyle } from "../look/looks.ts";
import { loftFromOutlines, region, ringLine, ringLoop, viewLoft, type Loft, type LoopPt } from "./loft.ts";

/** Everything in head-heights; the head runs from y = -0.5 (crown) to 0.5 (chin). */
export interface HeadForm {
  /** right half of the front view, crown to chin */
  front: Pt[];
  /** side view facing +z, closed, as (z, y) */
  side: Pt[];
  /** where the neck meets the skull, as (z, y) */
  pivot: Pt;
}

export interface FaceSpec {
  eyeX: number;
  eyeY: number;
  eyeW: number;
  eyeH: number;
  browY: number;
  browW: number;
  browT: number;
  browArch: number;
  noseTop: number;
  noseTip: number;
  noseBase: number;
  noseLen: number;
  noseWing: number;
  mouthY: number;
  mouthW: number;
  earY: number;
  earH: number;
  earW: number;
}

export interface HairSpec {
  mat: string;
  /** hairline round the head as (degrees from the front, y) knots; 0..180 for a symmetric cut, -180..180 otherwise */
  line: [number, number][];
  /** volume over the skull at the crown, at the sides and at the nape */
  top: number;
  side: number;
  nape?: number;
  /** soft lumps in the outline (wavy hair): how many round the head, how deep (0..1) */
  wave?: { n: number; d: number };
  /** thickness where the hair ends on the skin */
  lip?: number;
}

export interface BeardSpec {
  mat: string;
  /** upper edge of the beard as (degrees from the front, y) knots, 0 to `end` */
  line: [number, number][];
  /** how far round the jaw it goes, degrees */
  end: number;
  grow: number;
  /** extra length at the chin */
  chin: number;
}

export interface HeadSpec {
  form: HeadForm;
  face: FaceSpec;
  skin: string;
  hair?: HairSpec;
  beard?: BeardSpec;
  moustache?: { mat: string; y: number; w: number; h: number; droop: number };
  cap?: { mat: string; line: [number, number][]; grow: number; top: number };
  glasses?: { mat: string; w: number; h: number; lift: number };
  /** brow colour when there is no hair to take it from */
  browMat?: string;
}

export interface Expression {
  /** eyelids: 1 open, 0 shut */
  lidU: number;
  lidL: number;
  /** brows: raise (+ up); tilt (+ = inner ends down, a frown; - = inner ends up, worry) */
  browRaise: number;
  browTilt: number;
  /** mouth: corners up or down, opening, extra width */
  smile: number;
  open: number;
  wide: number;
  /** jaw drop, which lengthens the lower face */
  jaw: number;
}

export const FACES = {
  neutral: { lidU: 1, lidL: 1, browRaise: 0, browTilt: 0, smile: 0.18, open: 0, wide: 0, jaw: 0 },
  smile: { lidU: 0.95, lidL: 0.5, browRaise: 0.25, browTilt: -0.1, smile: 1, open: 0, wide: 0.3, jaw: 0 },
  grin: { lidU: 0.9, lidL: 0.35, browRaise: 0.35, browTilt: -0.1, smile: 1, open: 0.42, wide: 0.45, jaw: 0.15 },
  effort: { lidU: 0.62, lidL: 0.55, browRaise: -0.5, browTilt: 0.9, smile: -0.35, open: 0.3, wide: 0.5, jaw: 0.15 },
  surprise: { lidU: 1.25, lidL: 1.15, browRaise: 1, browTilt: -0.15, smile: 0, open: 0.5, wide: -0.35, jaw: 0.5 },
  worry: { lidU: 0.92, lidL: 1, browRaise: 0.35, browTilt: -0.9, smile: -0.55, open: 0, wide: 0, jaw: 0 },
  rue: { lidU: 0.8, lidL: 0.9, browRaise: 0.6, browTilt: -0.45, smile: -0.12, open: 0, wide: 0.35, jaw: 0 },
  call: { lidU: 1, lidL: 0.85, browRaise: 0.55, browTilt: 0, smile: 0.15, open: 1, wide: 0.1, jaw: 0.85 },
  talk: { lidU: 1, lidL: 1, browRaise: 0.15, browTilt: 0, smile: 0.2, open: 0.4, wide: 0, jaw: 0.3 },
  exhale: { lidU: 0.5, lidL: 0.8, browRaise: 0.3, browTilt: -0.5, smile: -0.1, open: 0.28, wide: -0.55, jaw: 0.2 },
  blink: { lidU: 0.07, lidL: 0.3, browRaise: 0, browTilt: 0, smile: 0.18, open: 0, wide: 0, jaw: 0 },
} as const satisfies Record<string, Expression>;

export type FaceName = keyof typeof FACES;

export function mixFace(a: Expression, b: Expression, t: number): Expression {
  return {
    lidU: mix(a.lidU, b.lidU, t),
    lidL: mix(a.lidL, b.lidL, t),
    browRaise: mix(a.browRaise, b.browRaise, t),
    browTilt: mix(a.browTilt, b.browTilt, t),
    smile: mix(a.smile, b.smile, t),
    open: mix(a.open, b.open, t),
    wide: mix(a.wide, b.wide, t),
    jaw: mix(a.jaw, b.jaw, t),
  };
}

export interface HeadPose {
  /** where the face points: 0 = at the camera, + = toward screen right, radians */
  yaw: number;
  /** nod: + = chin down */
  pitch?: number;
  /** tilt in the picture plane: + = clockwise */
  roll?: number;
  /** where the eyes look, -1..1 (x: + = screen right, y: + = down) */
  gaze?: Pt;
  face?: Partial<Expression>;
}

export interface HeadOut {
  /** goes behind everything else of the figure (the far ear) */
  back: Shape[];
  /** the head, back to front */
  shapes: Shape[];
  /** outlines that throw shadows on the neck and chest */
  mass: Pt[][];
  /** a point on the face given in front-view coordinates (x toward the character's left, y down), on screen */
  at(x: number, y: number, lift?: number): Pt;
  centre: Pt;
  crown: Pt;
  chin: Pt;
}

export const HEAD_BASE: HeadForm = {
  front: [
    [0, -0.5],
    [0.2, -0.472],
    [0.33, -0.385],
    [0.385, -0.22],
    [0.395, -0.05],
    [0.385, 0.1],
    [0.35, 0.24],
    [0.285, 0.36],
    [0.17, 0.455],
    [0.07, 0.492],
    [0, 0.5],
  ],
  side: [
    [-0.02, -0.5],
    [0.22, -0.455],
    [0.355, -0.33],
    [0.405, -0.15],
    [0.39, -0.02],
    [0.395, 0.13],
    [0.385, 0.25],
    [0.37, 0.34],
    [0.355, 0.43],
    [0.27, 0.495],
    [0.12, 0.475],
    [-0.03, 0.4],
    [-0.13, 0.3],
    [-0.2, 0.22],
    [-0.37, 0.14],
    [-0.47, -0.08],
    [-0.4, -0.32],
    [-0.23, -0.455],
  ],
  pivot: [-0.04, 0.3],
};

export const FACE_BASE: FaceSpec = {
  eyeX: 0.165,
  eyeY: -0.005,
  eyeW: 0.036,
  eyeH: 0.05,
  browY: -0.118,
  browW: 0.15,
  browT: 0.019,
  browArch: 0.018,
  noseTop: 0.02,
  noseTip: 0.135,
  noseBase: 0.182,
  noseLen: 0.075,
  noseWing: 0.058,
  mouthY: 0.305,
  mouthW: 0.105,
  earY: 0.075,
  earH: 0.105,
  earW: 0.15,
};

/** Materials the face needs; spread into a film's palette. */
export const FACE_PALETTE = {
  eye: "#221a1c",
  "eye.white": "#fbf5ea",
  mouth: "#7c3a30",
  "mouth.in": "#4a1d1f",
  teeth: "#f6efe2",
  lens: "#dfeef2",
  frame: "#2b2a30",
} as const;

const lofts = new WeakMap<HeadForm, Loft>();
function loftOf(form: HeadForm): Loft {
  let l = lofts.get(form);
  if (!l) {
    // the widest point of the skull is at the ears; lower down it moves back toward the corner of the jaw
    l = loftFromOutlines(form.front, form.side, (v) => mix(0.47, 0.3, smoothstep(0.05, 0.34, v)));
    lofts.set(form, l);
  }
  return l;
}

function dropJaw(base: Loft, jaw: number): Loft {
  const vj = 0.16;
  const k = 1 + 0.2 * jaw;
  return { v0: base.v0, v1: vj + (base.v1 - vj) * k, at: (v) => base.at(v <= vj ? v : vj + (v - vj) / k) };
}

/** Upper and lower half of an ellipse with different heights: an eye with lids. */
function lidded(c: Pt, w: number, hu: number, hl: number, n = 22): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const s = Math.sin(a);
    out.push([c[0] + Math.cos(a) * w, c[1] + s * (s > 0 ? hl : hu)]);
  }
  return out;
}

export function buildHead(id: string, spec: HeadSpec, pose: HeadPose, pivot: Pt, H: number, style: PeopleStyle): HeadOut {
  const F = spec.face;
  const E: Expression = { ...FACES.neutral, ...(pose.face ?? {}) };
  const yaw = clamp(pose.yaw, -1.8, 1.8);
  const pitch = pose.pitch ?? 0;
  const sn = Math.sin(yaw);
  const cs = Math.cos(yaw);
  const roll = (pose.roll ?? 0) + pitch * sn;
  const nod = pitch * 0.26 * Math.abs(cs);
  const gaze = pose.gaze ?? [0, 0];
  const base = loftOf(spec.form);
  const loft = E.jaw > 0.01 ? dropJaw(base, E.jaw) : base;
  const view = viewLoft(loft, yaw);
  const pivL = spec.form.pivot[0] * sn;
  const pivY = spec.form.pivot[1];
  const toS = (p: Pt): Pt => add(pivot, rot([(p[0] - pivL) * H, (p[1] - pivY) * H], roll));
  const map = (pts: readonly Pt[]): Pt[] => pts.map(toS);
  const st = 2.5 / H;
  const fs = style.feature;
  const skin = spec.skin;
  const hairMat = spec.hair?.mat ?? spec.browMat ?? "hair";
  const back: Shape[] = [];
  const out: Shape[] = [];

  // ---- ears
  const earsFront: Shape[] = [];
  for (const sg of [-1, 1] as const) {
    const v = F.earY - nod * 0.4;
    const s = loft.at(v);
    const X = sg * s.a * 0.985;
    const Z = s.zm - 0.025;
    const l = X * cs + Z * sn + sg * cs * 0.014;
    const zc = -X * sn + Z * cs;
    const hw = Math.hypot(F.earW * 0.5 * sn, F.earW * 0.3 * cs) * fs;
    const e = map(ellipse([l, v], hw, F.earH * fs, -0.14 * sn, st));
    const list = zc > -0.07 ? earsFront : back;
    list.push(shape(`${id}/ear${sg}`, skin, e, { depth: H * 0.02, ink: 0.7 }));
    if (hw * H > 4.5 && zc > -0.07) {
      const inner = map(ellipse([l + hw * 0.18 * Math.sign(sn || sg), v + 0.006], hw * 0.48, F.earH * fs * 0.56, -0.14 * sn, st));
      list.push(shape(`${id}/ear${sg}.in`, skin, inner, { form: "flat", tone: "shade", ink: 0, paper: false }));
    }
  }

  // ---- hair, cap, beard: patches of the surface
  let hairPts: Pt[] = [];
  if (spec.hair) {
    const Hh = spec.hair;
    const line = ringLine(Hh.line);
    const loop = ringLoop((d) => line(d) + nod * 0.8, 5);
    const nape = Hh.nape ?? Hh.side * 0.6;
    hairPts = map(
      region(view, loop, "top", {
        edge: (v, side) => {
          let g = mix(Hh.top, Hh.side, smoothstep(loft.v0, loft.v0 + 0.4, v));
          g = mix(g, nape, smoothstep(0.0, 0.2, v));
          if (Hh.wave) g *= 1 + Hh.wave.d * Math.sin(Hh.wave.n * view.edgeAlpha(v, side) + v * 6);
          return g;
        },
        line: Hh.lip ?? 0.012,
      }),
    );
  }
  let capPts: Pt[] = [];
  if (spec.cap) {
    const C = spec.cap;
    const line = ringLine(C.line);
    const loop = ringLoop((d) => line(d) + nod * 0.8, 5);
    capPts = map(region(view, loop, "top", { edge: (v) => C.grow + C.top * (1 - smoothstep(loft.v0, loft.v0 + 0.22, v)), line: C.grow * 0.6 }));
  }
  let beardPts: Pt[] = [];
  if (spec.beard) {
    const B = spec.beard;
    const line = ringLine(B.line);
    const A = B.end;
    const loop: LoopPt[] = [];
    for (let d = -A; d <= A + 0.01; d += 5) loop.push({ alpha: d * DEG, v: line(d) + nod });
    const vt = line(A) + nod;
    const vb = loft.v1 - 0.012;
    for (let k = 1; k <= 8; k++) loop.push({ alpha: A * DEG, v: mix(vt, vb, k / 8) });
    for (let k = 8; k >= 1; k--) loop.push({ alpha: -A * DEG, v: mix(vt, vb, k / 8) });
    beardPts = map(region(view, loop, "bottom", { edge: (v) => B.grow + B.chin * smoothstep(0.2, 0.5, v), line: 0.006 }));
  }

  // ---- nose: five points on and off the face, wrapped into one soft shape
  const nTop = F.noseTop + nod;
  const nTip = F.noseTip + nod;
  const nBase = F.noseBase + nod;
  const wy = mix(nTip, nBase, 0.45);
  const noseRaw: Pt[] = [
    [view.front(0, nTop, 0).l, nTop],
    [view.point(0, nTip, F.noseLen * fs).l, nTip],
    [view.front(0, nBase, 0.004).l, nBase],
    [view.front(-F.noseWing * fs, wy, 0.014).l, wy],
    [view.front(F.noseWing * fs, wy, 0.014).l, wy],
  ];
  // (rounded on screen: the outline helpers measure in pixels)
  const noseHull = hull(noseRaw);
  const nosePts = noseHull.length >= 3 ? roundedPoly(noseHull.map((p) => ({ p: toS(p), r: 0.024 * fs * H })), 2) : [];
  const noseOk = nosePts.length >= 6;

  // ---- skull
  const skullPts = map(view.outline(46));
  const casts: { pts: Pt[]; reach?: number }[] = noseOk ? [{ pts: nosePts, reach: H * 0.026 }] : [];
  if (hairPts.length) casts.push({ pts: hairPts, reach: H * 0.034 });
  if (capPts.length) casts.push({ pts: capPts, reach: H * 0.04 });
  out.push(shape(`${id}/skull`, skin, skullPts, { depth: H * 0.105, casts }));

  if (beardPts.length) out.push(shape(`${id}/beard`, spec.beard!.mat, beardPts, { depth: H * 0.07, rim: 0.6 }));

  // ---- mouth
  {
    const mw = F.mouthW * fs * (1 + 0.3 * E.wide);
    const my = F.mouthY + nod + E.jaw * 0.02;
    const up: Pt[] = [];
    const lo: Pt[] = [];
    const teethU: Pt[] = [];
    const teethL: Pt[] = [];
    const n = 5;
    for (let i = -n; i <= n; i++) {
      const r = i / n;
      const yU = my - E.smile * 0.034 * r * r + E.smile * 0.01 - E.open * 0.012;
      const gap = E.open * 0.1 * Math.pow(1 - r * r, 0.75);
      const p = view.front(r * mw, yU, 0.004);
      if (p.vis <= 0.04) continue;
      up.push([p.l, yU]);
      lo.push([p.l, yU + gap]);
      if (Math.abs(r) <= 0.81) {
        teethU.push([p.l, yU]);
        teethL.push([p.l, yU + Math.min(gap * 0.4, 0.026)]);
      }
    }
    if (up.length >= 2) {
      if (E.open < 0.07) {
        const hw = 0.0115 * H * fs;
        const pts = stroke(map(up), (t) => hw * (0.42 + 0.58 * Math.sin(Math.PI * t)), true, 1.5);
        if (pts.length >= 3) out.push(shape(`${id}/mouth`, "mouth", pts, { form: "flat", ink: 0, paper: false }));
      } else if (up.length >= 3) {
        out.push(shape(`${id}/mouth`, "mouth.in", map([...up, ...lo.reverse()]), { form: "flat", ink: 0.5, paper: false }));
        if (E.open > 0.3 && teethU.length >= 3) {
          out.push(shape(`${id}/teeth`, "teeth", map([...teethU, ...teethL.reverse()]), { form: "flat", ink: 0, paper: false }));
        }
      }
    }
  }

  if (spec.moustache) {
    const M = spec.moustache;
    const up: Pt[] = [];
    const lo: Pt[] = [];
    const n = 6;
    for (let i = -n; i <= n; i++) {
      const r = i / n;
      const yT = M.y + nod + M.droop * Math.pow(Math.abs(r), 1.6);
      const thick = M.h * (1 - 0.72 * r * r);
      const a = view.front(r * M.w * fs, yT, 0.016);
      if (a.vis <= 0.03) continue;
      up.push([a.l, yT]);
      lo.push([view.front(r * M.w * fs, yT + thick, 0.016).l, yT + thick]);
    }
    if (up.length >= 3) out.push(shape(`${id}/moustache`, M.mat, map([...up, ...lo.reverse()]), { depth: H * 0.012, rim: 0, ink: 0.5, paper: false }));
  }

  if (hairPts.length) out.push(shape(`${id}/hair`, spec.hair!.mat, hairPts, { depth: H * 0.075 }));
  if (capPts.length) out.push(shape(`${id}/cap`, spec.cap!.mat, capPts, { depth: H * 0.08 }));
  out.push(...earsFront);

  // ---- eyes and brows
  for (const sg of [-1, 1] as const) {
    const y = F.eyeY + nod + gaze[1] * 0.014;
    const c = view.front(sg * F.eyeX, y, 0.004);
    if (c.vis >= 0.1 && c.k >= 0.12) {
      const kx = clamp(c.k, 0, 1.08);
      const lu = clamp(E.lidU, 0.07, 1.3);
      const ll = clamp(E.lidL, 0.07, 1.2);
      if (style.eyes === "dot") {
        const cx = c.l + gaze[0] * 0.018 * kx;
        const w = F.eyeW * fs * kx;
        const hu = F.eyeH * fs * lu;
        out.push(shape(`${id}/eye${sg}`, "eye", map(lidded([cx, y], w, hu, F.eyeH * fs * ll)), { form: "flat", ink: 0, paper: false }));
        if (H >= 70 && lu > 0.45) {
          const g = map(ellipse([cx - w * 0.3, y - hu * 0.38], w * 0.3, hu * 0.2, 0, st * 0.5));
          out.push(shape(`${id}/glint${sg}`, "eye.white", g, { form: "flat", ink: 0, paper: false, opacity: 0.85 }));
        }
      } else {
        // the upper lid rests on the pupil: whites all round a pupil read as a stare
        const ww = F.eyeW * 1.8 * fs * kx;
        const wh = F.eyeH * 1.32 * fs;
        const white = lidded([c.l, y], ww, wh * Math.min(1.25, lu * 0.84), wh * ll, 28);
        out.push(shape(`${id}/white${sg}`, "eye.white", map(white), { form: "flat", ink: 0.45, paper: false }));
        const pr = F.eyeW * 1.3 * fs;
        const pc: Pt = [c.l + gaze[0] * (ww - pr * kx) * 0.75, y + gaze[1] * (wh - pr) * 0.6 + wh * 0.02];
        const pupil = clipConvex(ellipse(pc, pr * kx, pr, 0, st * 0.6), white);
        if (pupil.length >= 3) out.push(shape(`${id}/eye${sg}`, "eye", map(pupil), { form: "flat", ink: 0, paper: false }));
        if (H >= 60 && lu > 0.45) {
          const g = map(ellipse([pc[0] - pr * kx * 0.35, pc[1] - pr * 0.4], pr * kx * 0.28, pr * 0.28, 0, st * 0.5));
          out.push(shape(`${id}/glint${sg}`, "eye.white", g, { form: "flat", ink: 0, paper: false }));
        }
        // the upper lid as a drawn line
        const lash: Pt[] = [];
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI + (i / 12) * Math.PI;
          lash.push(toS([c.l + Math.cos(a) * ww, y + Math.sin(a) * wh * Math.min(1.25, lu * 0.84)]));
        }
        const lw = 0.012 * H * fs;
        out.push(shape(`${id}/lash${sg}`, "eye", stroke(lash, (t) => lw * (0.5 + 0.5 * Math.sin(Math.PI * t)), true, 1.5), { form: "flat", ink: 0, paper: false }));
      }
    }
    // brow: three points on the forehead, a tapering stroke
    const lift = E.browRaise * 0.05;
    const xs = [F.eyeX - F.browW * 0.5, F.eyeX + F.browW * 0.08, F.eyeX + F.browW * 0.62];
    const ys = [F.browY - lift + E.browTilt * 0.036, F.browY - lift * 1.1 - F.browArch, F.browY - lift * 0.8 - E.browTilt * 0.014 + F.browArch * 0.4];
    const bp: Pt[] = [];
    for (let k = 0; k < 3; k++) {
      const p = view.front(sg * xs[k], ys[k] + nod, 0.01);
      if (p.vis > 0.06) bp.push(toS([p.l, ys[k] + nod]));
    }
    if (bp.length >= 2) {
      const bw = F.browT * H * fs * (style.eyes === "white" ? 1.25 : 1);
      const line = bp.length === 3 ? spline(bp, { closed: false, step: 3 }) : bp;
      const pts = stroke(line, (t) => bw * (1 - 0.5 * t), true, 1.5);
      if (pts.length >= 3) out.push(shape(`${id}/brow${sg}`, hairMat, pts, { form: "flat", ink: 0, paper: false }));
    }
  }

  if (noseOk) out.push(shape(`${id}/nose`, skin, nosePts, { depth: H * 0.022, rim: 0.5, ink: 0, paper: false }));
  if (style.lines && noseOk) {
    // look B: the nose as a drawn line down its shadow side
    const far = sn >= 0 ? 1 : -1;
    const tip = view.point(0, nTip, F.noseLen * fs).l + far * cs * F.noseWing * fs * 0.9;
    const pts: Pt[] = [toS([view.front(0, nTop, 0).l + far * cs * 0.012, nTop + 0.03]), toS([tip, nTip]), toS([view.front(0, nBase, 0.004).l, nBase])];
    const lw = 0.011 * H;
    out.push(shape(`${id}/nose.line`, "eye", stroke(spline(pts, { closed: false, step: 2 }), (t) => lw * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.25))), true, 1.5), { form: "flat", ink: 0, paper: false }));
  }

  // ---- glasses: a flat frame standing just off the face
  if (spec.glasses && cs > 0.1) {
    const G = spec.glasses;
    const zp = loft.at(F.eyeY).zf + G.lift;
    const gy = F.eyeY + nod + 0.012;
    const proj = (x: number, y: number): Pt => toS([x * cs + zp * sn, y]);
    const fw = 0.0105 * H;
    for (const sg of [-1, 1] as const) {
      const ring = squircle([sg * F.eyeX, gy], G.w, G.h, 2.6, 0, st).map((p) => proj(p[0], p[1]));
      out.push(shape(`${id}/lens${sg}`, "lens", ring, { form: "flat", ink: 0, paper: false, opacity: 0.34 }));
      out.push(shape(`${id}/rim${sg}`, G.mat, stroke([...ring, ring[0]], () => fw, false), { form: "flat", ink: 0, paper: false }));
    }
    out.push(shape(`${id}/bridge`, G.mat, stroke([proj(-(F.eyeX - G.w), gy - G.h * 0.25), proj(0, gy - G.h * 0.42), proj(F.eyeX - G.w, gy - G.h * 0.25)], () => fw, false), { form: "flat", ink: 0, paper: false }));
    if (Math.abs(sn) > 0.12) {
      const near = sn > 0 ? -1 : 1;
      const es = loft.at(F.earY);
      const earL = near * es.a * cs + (es.zm - 0.02) * sn;
      out.push(shape(`${id}/temple`, G.mat, stroke([proj(near * (F.eyeX + G.w), gy - G.h * 0.2), toS([earL, F.earY - 0.05 + nod])], () => fw * 0.9, true), { form: "flat", ink: 0, paper: false }));
    }
  }

  const mass = [skullPts];
  if (beardPts.length) mass.push(beardPts);
  return {
    back,
    shapes: out,
    mass,
    at: (x, y, lift = 0) => toS([view.front(x, y + nod, lift).l, y + nod]),
    centre: toS([0, 0]),
    crown: toS([loft.at(loft.v0 + 0.01).zm * sn, loft.v0]),
    chin: toS([view.front(0, loft.v1 - 0.03, 0).l, loft.v1]),
  };
}
