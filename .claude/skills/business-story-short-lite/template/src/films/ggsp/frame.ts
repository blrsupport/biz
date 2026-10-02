// Demo 2, the yard: everything that is drawn at time t.
// `yardParts` works out what is where (who is in view, what each prop is doing); `yardFrame` lays those parts out
// as a display list, layer by layer, back to front. The generic view paints the list and the dry run checks it,
// so what is checked is what is drawn.
import { CAST } from "../../assets/cast/cast.ts";
import { buildSack, buildScale } from "../../assets/props/scale.ts";
import { gear } from "../../assets/props/scrap.ts";
import { buildNotes } from "../../assets/props/tin.ts";
import { bellShadow, bundle, crow } from "../../assets/props/yardlife.ts";
import { fade, fill, group, paint, rect, shadow, type as written, type FrameList, type Item } from "../../engine/draw/list.ts";
import { shape, type Shape } from "../../engine/draw/shape.ts";
import { moveShapes, turnShapes } from "../../engine/draw/xform.ts";
import { buildFigure, type FigureOut } from "../../engine/figure/body.ts";
import { ellipse } from "../../engine/geom/outline.ts";
import { bounds, clamp, smoothstep, type Pt } from "../../engine/geom/vec.ts";
import { dustPuff } from "../../engine/fx/dust.ts";
import { mixHex } from "../../engine/look/color.ts";
import { LOOKS, type LookId } from "../../engine/look/looks.ts";
import type { Actor, Solved } from "../../engine/motion/actor.ts";
import { hash } from "../../engine/motion/track.ts";
import { layerTransform, type View } from "../../engine/stage/camera.ts";
import { DEPTH, GGT, GG_TAKE_PALETTE, HEAPS, JUNCTION, LOOSE, SHAFTS, SHAFT_TILT, WALL_BOX, WALL_TOP, YARD, ggTake, inShaft } from "./take.ts";

const { U, GY } = GGT;
const FRAME = { width: GGT.W, height: GGT.HGT };
const REF = { cx: GGT.W / 2, cy: GGT.HGT / 2 };

/** What a shape is when all that shows of it is its outline: one flat tone. The marks inside a face are dropped. */
const INNER = /eye|glint|brow|mouth|teeth|nose|\.in$|lens|rim|button|placket|collar|bridge|temple|lash/;
export function asShadow(shapes: readonly Shape[], mat = "sil"): Shape[] {
  const out: Shape[] = [];
  for (const s of shapes) if (!INNER.test(s.id)) out.push({ id: s.id, pts: s.pts, mat, form: "flat", ink: 0, paper: false });
  return out;
}

/** Soft shadows under the feet; they fade as a foot leaves the ground. */
function footContacts(id: string, a: Actor, s: Solved): Shape[] {
  return (["L", "R"] as const).map((k) => {
    const f = s.feet[k];
    const lift = Math.min(1, f.lift / (0.3 * a.H));
    return shape(`${id}/contact${k}`, "yard.ground", ellipse([f.x + s.fwd * 0.18 * a.H, a.groundY + 5], a.H * (0.44 - 0.12 * lift), a.H * (0.075 - 0.03 * lift), 0, 4), { form: "flat", tone: "deep", ink: 0, paper: false, opacity: 0.42 * (1 - 0.75 * lift) });
  });
}

// the pieces of the heap that will lift off it, found once
let liftParts: { shapes: Shape[]; c: Pt }[] | null = null;
let heapRest: Shape[] | null = null;
function liftSetup() {
  if (liftParts && heapRest) return { liftParts, heapRest };
  const tk = ggTake();
  const all = tk.heapR.shapes;
  liftParts = tk.lifts.map((l) => {
    const shapes = all.filter((s) => s.id.startsWith(l.prefix));
    const b = bounds(shapes.flatMap((s) => s.pts));
    return { shapes, c: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] as Pt };
  });
  const taken = new Set(liftParts.flatMap((p) => p.shapes.map((s) => s.id)));
  heapRest = all.filter((s) => !taken.has(s.id));
  return { liftParts, heapRest };
}

export interface YardParts {
  view: View;
  /** what the camera sees of the actors' plane, with a margin */
  seen: { x0: number; x1: number; y0: number; y1: number };
  /** stretches of the yard in view */
  yards: typeof YARD;
  /** wall layer */
  crow: Shape[];
  /** thrown onto the wall (moved by the sun's offset): the scale, the sack and the buyer; his own figure apart, as it fades */
  wallCasters: Shape[];
  irakiCaster: Shape[];
  ownShadow: number;
  /** the two shadow figures, each with the spot it grows from, and the bell they ring */
  sons: { shapes: Shape[]; foot: Pt; scale: number }[];
  sonsOn: number;
  bell: Shape[];
  /** actors' plane */
  groundCasters: Shape[];
  heaps: Shape[];
  lifted: Shape[];
  loose: Shape[];
  contacts: Shape[];
  actors: Shape[];
  dust: Shape[];
  specksBack: Shape[];
  specksFront: Shape[];
  /** close to the lens */
  porter: Shape[];
  near: Shape[];
  arm: Shape[];
  figures: { name: string; actor: Actor; fig: FigureOut }[];
}

export function yardParts(t: number, lookId: LookId = "A"): YardParts {
  const tk = ggTake();
  const m = tk.marks;
  const style = LOOKS[lookId].people;
  const view = tk.cam.view(t);
  const lt0 = layerTransform(view, FRAME, 0, REF);
  const seen = { x0: -lt0.tx / lt0.s - 60, x1: (GGT.W - lt0.tx) / lt0.s + 60, y0: -lt0.ty / lt0.s - 60, y1: (GGT.HGT - lt0.ty) / lt0.s + 60 };
  const ltW = layerTransform(view, FRAME, DEPTH.wall, REF);
  const seenW = { x0: -ltW.tx / ltW.s - 60, x1: (GGT.W - ltW.tx) / ltW.s + 60 };
  const yards = YARD.filter((y) => y.x1 > Math.min(seen.x0, seenW.x0) - 80 && y.x0 < Math.max(seen.x1, seenW.x1) + 80);
  const figures: YardParts["figures"] = [];

  // ---- the crow
  const cs = tk.crowState(t);
  const crowShapes = t < 3.2 ? crow("crow", cs.p, 96, { dir: 1, tilt: cs.tilt, flap: cs.flap, fold: cs.fold }) : [];

  // ---- Iraki, the scale and the sack
  const irakiOn = seen.x1 > 250;
  const is = tk.iraki.solve(t);
  const fi = buildFigure(CAST.iraki, is.pose, style);
  figures.push({ name: "iraki", actor: tk.iraki, fig: fi });
  const scale = buildScale("scale", tk.scaleState(t));
  const ss = tk.sackState(t);
  const sack = buildSack("sack", ss.neck, ss.w, ss.h, ss.swing, 4);

  // ---- the buyer and the notes
  const buyerOn = t > m.tBuyerOn && t < m.tBuyerOff;
  let buyerShapes: { behind: Shape[]; body: Shape[]; front: Shape[]; all: Shape[] } = { behind: [], body: [], front: [], all: [] };
  let notesBuyer: Shape[] = [];
  let notesIraki: Shape[] = [];
  let buyerContacts: Shape[] = [];
  if (buyerOn) {
    const bs = tk.buyer.solve(t);
    const fb = buildFigure(CAST.buyer, bs.pose, style);
    figures.push({ name: "buyer", actor: tk.buyer, fig: fb });
    buyerShapes = { ...fb.layers, all: fb.shapes };
    buyerContacts = footContacts("buyer", tk.buyer, bs);
    if (t > m.tPocket - 0.02 && t < m.tTaken) {
      // they come out of the pocket small and open into a fan
      const k = smoothstep(m.tPocket - 0.02, m.tPocket + 0.3, t);
      notesBuyer = buildNotes("notes", fb.hands.R.hold, -0.16 + 0.2 * (fb.arms.R.foreAngle + 0.4), U * (0.35 + 0.65 * k));
    }
  }
  if (t >= m.tTaken && t < m.tPut + 0.02) {
    // in his far hand, pointing back the way they came; they go behind him as he pockets them
    notesIraki = buildNotes("notes", fi.hands.R.hold, Math.PI + 0.12, U * (1 - 0.5 * smoothstep(m.tPut - 0.2, m.tPut, t)));
  }

  // ---- the two shadow figures and their bell
  const sonsOn = tk.sonsOn(t);
  const sons: YardParts["sons"] = [];
  let bell: Shape[] = [];
  if (sonsOn > 0) {
    for (const [name, a, ch] of [["sonA", tk.sonA, CAST.sonA], ["sonB", tk.sonB, CAST.sonB]] as const) {
      const f = buildFigure(ch, a.solve(t).pose, style);
      figures.push({ name, actor: a, fig: f });
      sons.push({ shapes: asShadow(f.shapes), foot: [a.x.value(t), JUNCTION], scale: tk.sonScale(t) });
    }
  }
  if (t > m.tSplit - 0.1) {
    const b = tk.bellState(t);
    bell = bellShadow("bell", b.pivot, b.u, b.swing, b.clap, b.rope);
  }

  // ---- heaps: those in view; from the one at the foot of the wall some pieces lift off and fall
  const heaps: Shape[] = [];
  const lifted: Shape[] = [];
  const { liftParts: parts, heapRest: rest } = liftSetup();
  for (const h of HEAPS) {
    if (h.x1 < seen.x0 || h.x0 > seen.x1) continue;
    if (h.id !== "heapR" || t < tk.lifts[0].t0 - 0.3) {
      heaps.push(...h.shapes);
      continue;
    }
    heaps.push(...rest);
    tk.lifts.forEach((l, i) => {
      const dx = l.x.value(t);
      const dy = l.y.value(t);
      if (dy > 1500) return;
      const p = parts[i];
      lifted.push(...turnShapes(moveShapes(p.shapes, [dx, dy]), [p.c[0] + dx, p.c[1] + dy], t > l.t0 ? l.spin * (t - l.t0) : 0));
    });
  }

  // ---- the thrown piece and the dust it raises
  const dust: Shape[] = [];
  const pc = tk.piece(t);
  const flying: Shape[] = [];
  if (!pc.held && seen.x0 < tk.land[0] + 400) {
    // in the air it leaves two fading copies behind it, one and two sixtieths of a second back
    if (!pc.lying) {
      for (const [k, o] of [[2, 0.16], [1, 0.34]] as const) {
        const q = tk.piece(Math.max(m.tRel, t - k / 60));
        flying.push(...gear(`thrown.g${k}`, q.p, 46, 8, q.spin, "scrap.rust2", "scrap.hole").map((s) => ({ ...s, form: "flat" as const, opacity: o })));
      }
    }
    flying.push(...gear("thrown", pc.p, 46, 8, pc.spin, "scrap.rust2", "scrap.hole"));
  }
  // (once it lies on the heap it is drawn with the heap, in front of the mound)
  if (t > m.tLand && t < m.tLand + 2.4) {
    const age = clamp((t - m.tLand) / 1.9, 0, 1);
    const at: Pt = [tk.land[0], tk.land[1] + 30];
    dust.push(...dustPuff("burst/a", [at[0] - 8, at[1]], 250, -1, age, 3), ...dustPuff("burst/b", [at[0] + 8, at[1]], 300, 1, age, 7));
    for (let i = 0; i < 16; i++) {
      const u = (t - m.tLand) * (0.5 + 0.5 * hash(i * 2.3));
      const p: Pt = [at[0] + (hash(i * 5.1) - 0.5) * 420 * Math.min(1, u * 1.6), at[1] - 30 - 260 * (1 - Math.exp(-u * 2.2)) * (0.4 + hash(i * 3.7))];
      dust.push(shape(`burst/m${i}`, "dust", ellipse(p, 3.5 + 4 * hash(i), 3.5 + 4 * hash(i), 0, 3), { form: "flat", ink: 0, paper: false, opacity: 0.85 * (1 - age) * (0.5 + 0.5 * inShaft(p)) }));
    }
  }

  // ---- dust hanging in the air: each speck on its own slow drift, bright only where a shaft of sun reaches it
  const specksBack: Shape[] = [];
  const specksFront: Shape[] = [];
  for (let i = 0; i < 260; i++) {
    const x = -2600 + 4500 * hash(i * 3.1 + 1) + 30 * Math.sin(0.31 * t + i * 1.9) + 12 * t;
    if (x < seen.x0 || x > seen.x1) continue;
    const y = 640 + 800 * hash(i * 5.7 + 2) + 18 * Math.sin(0.27 * t + i * 2.7) - 4 * t;
    const lit = inShaft([x, y]);
    if (lit < 0.12) continue;
    const r = 2 + 2.8 * hash(i * 7.3 + 3);
    const glint = 0.6 + 0.4 * Math.sin(1.3 * t + i * 4.1);
    (i % 2 ? specksFront : specksBack).push(shape(`mote/${i}`, "dust", ellipse([x, y], r, r, 0, 3), { form: "flat", ink: 0, paper: false, opacity: Math.min(1, lit * 1.5) * 0.62 * glint }));
  }
  // in the first second a wisp of it is carried across the first shaft
  if (t < 2.2) {
    for (let i = 0; i < 16; i++) {
      const u = t * (0.8 + 0.4 * hash(i * 1.3)) + 0.3;
      const p: Pt = [-1990 + 330 * u + 120 * hash(i * 9.1), 930 + 190 * hash(i * 4.3) + 26 * Math.sin(u * 3 + i) - 16 * u];
      const r = 3 + 5 * hash(i * 6.1);
      specksFront.push(shape(`wisp/${i}`, "dust", ellipse(p, r * 1.5, r, 0.4, 3), { form: "flat", ink: 0, paper: false, opacity: (0.18 + 0.6 * inShaft(p)) * (1 - smoothstep(1.5, 2.2, t)) }));
    }
  }

  // ---- the actors' plane, back to front
  const actors: Shape[] = [...flying];
  if (buyerOn) actors.push(...buyerShapes.behind, ...buyerShapes.body, ...notesBuyer, ...buyerShapes.front);
  if (irakiOn) actors.push(...fi.layers.behind, ...notesIraki, ...fi.layers.body, ...scale.back, ...scale.front, ...sack.shapes, ...fi.layers.front);
  const contacts = [...(irakiOn ? footContacts("iraki", tk.iraki, is) : []), ...buyerContacts];
  const hard = (list: readonly Shape[]) => list.filter((s) => !/tick|link|glint|eye/.test(s.id));
  const sackCast = sack.shapes.filter((s) => /body|tuft|rod/.test(s.id));
  const wallCasters = irakiOn ? [...hard(scale.front), ...sackCast, ...buyerShapes.all] : [];
  const irakiCaster = irakiOn ? fi.shapes : [];
  const groundCasters = irakiOn ? [...fi.shapes, ...hard(scale.front), ...sackCast, ...buyerShapes.all] : [];
  for (const h of HEAPS) if (h.x1 > seen.x0 - 300 && h.x0 < seen.x1) groundCasters.push(h.shapes[0]);

  // ---- close to the lens: the porter, the heaps, the arm that throws
  const porter: Shape[] = [];
  if (t > m.tIn - 0.4 && t < m.tOut + 0.4) {
    const fp = buildFigure(CAST.porter, tk.porter.solve(t).pose, style);
    figures.push({ name: "porter", actor: tk.porter, fig: fp });
    porter.push(...asShadow(fp.shapes), ...bundle("bundle", tk.bundleAt(t), tk.BUNDLE.w, tk.BUNDLE.h, 0.03 * Math.sin(t * 7), 5).map((s) => ({ ...s, form: "flat" as const })));
  }
  const ltN = layerTransform(view, FRAME, DEPTH.near, REF);
  const seenN = { x0: -ltN.tx / ltN.s, x1: (GGT.W - ltN.tx) / ltN.s };
  const near: Shape[] = [];
  for (const n of tk.near) if (n.x1 > seenN.x0 && n.x0 < seenN.x1) near.push(...n.shapes);
  const arm: Shape[] = [];
  const th = tk.thrower(t);
  if (th.shown) {
    const flatArm = (list: readonly Shape[]) => list.map((s) => ({ ...s, form: "flat" as const, casts: undefined }));
    // the piece sits in the fist: fingers behind it, palm and thumb in front
    const palm = new Set(th.arm.hand.palm.map((s) => s.id));
    arm.push(...flatArm(th.arm.shapes.filter((s) => !palm.has(s.id))));
    if (pc.held) arm.push(...gear("thrown", th.arm.hand.hold, 46, 8, 0.4 + 3 * t, "scrap.rust2", "scrap.hole"));
    arm.push(...flatArm(th.arm.hand.palm));
  }

  return {
    view,
    seen,
    yards,
    crow: crowShapes,
    wallCasters,
    irakiCaster,
    ownShadow: tk.ownShadow(t),
    sons,
    sonsOn,
    bell,
    groundCasters,
    heaps,
    lifted,
    loose: LOOSE.filter((s) => s.pts[0][0] > seen.x0 - 100 && s.pts[0][0] < seen.x1 + 100),
    contacts,
    actors,
    dust,
    specksBack,
    specksFront,
    porter,
    near,
    arm,
    figures,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The display list
// ---------------------------------------------------------------------------------------------------------------

const P = GG_TAKE_PALETTE;
const { W, HGT } = GGT;
/** how far the shadow on the wall lies from what throws it */
const SUN_SHIFT: Pt = [230, 14];
/** the stretches of far skyline that the long travel can bring into view */
const SKYLINE = YARD.slice(1);
const SKY_X0 = SKYLINE[0].x0 - 200;
const SKY_X1 = SKYLINE[SKYLINE.length - 1].x1 + 200;
/** what the writing across the sky stands against: the sky itself, the sun's glow, and the hazy skyline */
const OVER = [P["yard.sky.band"], P["yard.sky.low"], P["yard.sun.glow"], "sky.far", "sky.mid"];
/** the small labels sit lower, where the skyline already stands in haze (at the least, a seventh of its full strength) */
const OVER_LABEL = [P["yard.sky.band"], P["yard.sky.low"], P["yard.sun.glow"], mixHex(P["sky.far"], P["yard.air.haze"], 0.14), mixHex(P["sky.mid"], P["yard.air.haze"], 0.14)];

export function yardFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = ggTake();
  const m = tk.marks;
  const fr = yardParts(t, lookId);
  const { view, seen } = fr;

  // what the wall layer shows of itself, for the washes of light that are laid over it
  const ltW = layerTransform(view, FRAME, DEPTH.wall, REF);
  const wx0 = -ltW.tx / ltW.s - 80;
  const wx1 = (W - ltW.tx) / ltW.s + 80;
  // the year goes behind the stack of drums as it passes
  const ltT = layerTransform(view, FRAME, DEPTH.type, REF);
  const wipeX = t > m.tWipe - 1.4 ? (tk.stackScreenX(t) - ltT.tx) / ltT.s : undefined;
  const ty = tk.type;
  const frame = [rect(-80, -80, W + 160, HGT + 160)];
  const span = SKY_X1 - SKY_X0;

  // shadows on the wall: a shadow is the wall itself, unlit, and only ever falls on the wall's face
  const onWall: Item[] = [shadow("wall.cast", DEPTH.wall, fr.wallCasters, "yard.wall", { shift: SUN_SHIFT })];
  if (fr.ownShadow > 0.01) onWall.push(shadow("wall.cast.iraki", DEPTH.wall, fr.irakiCaster, "yard.wall", { shift: SUN_SHIFT, opacity: fr.ownShadow }));
  if (fr.sonsOn > 0) {
    // the two shadow figures, each growing from the spot where its feet are
    onWall.push(
      group(
        "wall.sons",
        DEPTH.wall,
        fr.sons.map((s, i) => group(`wall.son${i}`, DEPTH.wall, [shadow(`wall.son${i}.cast`, DEPTH.wall, s.shapes, "yard.wall")], { about: s.foot, scale: s.scale })),
        { opacity: fr.sonsOn },
      ),
    );
  }
  onWall.push(shadow("wall.bell", DEPTH.wall, fr.bell, "yard.wall"));

  const shafts = SHAFTS.filter((s) => s.c[0] + s.rx > seen.x0 && s.c[0] - s.rx < seen.x1).map((s) => ellipse(s.c, s.rx, s.ry, SHAFT_TILT, 24));

  const items: Item[] = [
    // the sky and the low sun: so far off that they do not move as we travel
    fill("sky", "screen", { kind: "linear", x1: 0, y1: -60, x2: 0, y2: 540, stops: [{ at: 0, color: P["yard.sky.top"], a: 1 }, { at: 0.55, color: P["yard.sky.band"], a: 1 }, { at: 1, color: P["yard.sky.low"], a: 1 }] }, frame),
    fill("sky.glow", "screen", { kind: "radial", cx: -40, cy: 440, r: 940, stops: fade(P["yard.sun.glow"], 0.9, 0) }, frame),

    // the far skyline and the mills, in haze
    ...SKYLINE.map((y, i) => paint(`far${i}`, DEPTH.far, y.yard.skyFar)),
    fill("far.base", DEPTH.far, { kind: "solid", color: P["sky.far"] }, [rect(SKY_X0, WALL_TOP + 2, span, 900)]),
    ...SKYLINE.map((y, i) => paint(`mid${i}`, DEPTH.mid, y.yard.skyMid)),
    fill("mid.base", DEPTH.mid, { kind: "solid", color: P["sky.mid"] }, [rect(SKY_X0, WALL_TOP + 2, span, 900)]),
    fill("mid.haze", DEPTH.mid, { kind: "linear", x1: 0, y1: WALL_TOP - 250, x2: 0, y2: WALL_TOP + 900, stops: [{ at: 0, color: P["yard.air.haze"], a: 0 }, { at: 0.217, color: P["yard.air.haze"], a: 0.6 }, { at: 1, color: P["yard.air.haze"], a: 0.6 }] }, [rect(SKY_X0, WALL_TOP - 250, span, 1150)]),

    // what is written across the sky
    written("type.year", DEPTH.type, { kind: "year", ...ty.year, wipeX }, OVER, OVER_LABEL),
    written("type.name", DEPTH.type, { kind: "name", ...ty.name }, OVER, OVER_LABEL),
    written("type.phrase", DEPTH.type, { kind: "phrase", ...ty.phrase }, OVER),

    // the wall, the shadows the low sun throws on it, and the light that lies over it
    ...fr.yards.map((y) => paint(`wall${y.seed}`, DEPTH.wall, y.yard.wall)),
    group("wall.shadows", DEPTH.wall, onWall, { clip: [rect(WALL_BOX.x0, WALL_BOX.y0, WALL_BOX.x1 - WALL_BOX.x0, WALL_BOX.y1 - WALL_BOX.y0)] }),
    fill("wall.warm", DEPTH.wall, { kind: "radial", cx: wx0 + 60, cy: WALL_TOP + 420, r: 900, stops: fade(P["yard.air.warm"], 0.42, 0) }, [rect(wx0, WALL_TOP, wx1 - wx0, JUNCTION - WALL_TOP)]),
    fill("wall.far", DEPTH.wall, { kind: "linear", x1: wx0 + 570, y1: 0, x2: wx0 + 1480, y2: 0, stops: fade(P["yard.air.far"], 0, 0.3) }, [rect(wx0 + 570, WALL_TOP, wx1 - wx0 - 570, JUNCTION - WALL_TOP)]),
    fill("wall.dust", DEPTH.wall, { kind: "linear", x1: 0, y1: JUNCTION - 430, x2: 0, y2: JUNCTION, stops: fade(P["yard.air.dust"], 0, 0.42) }, [rect(wx0, JUNCTION - 430, wx1 - wx0, 430)]),
    paint("crow", DEPTH.wall, fr.crow),

    // the ground and everyone on it
    ...fr.yards.map((y) => paint(`ground${y.seed}`, 0, y.yard.ground)),
    shadow("ground.cast", 0, fr.groundCasters, "yard.ground", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    fill("ground.near", 0, { kind: "linear", x1: 0, y1: JUNCTION + 170, x2: 0, y2: 1980, stops: fade(P["yard.air.near"], 0, 0.46) }, [rect(seen.x0, JUNCTION + 170, seen.x1 - seen.x0, 2700 - JUNCTION - 170)]),
    paint("heaps", 0, fr.heaps),
    paint("lifted", 0, fr.lifted),
    paint("loose", 0, fr.loose),
    ...(shafts.length ? [fill("shafts", 0, { kind: "radial", cx: 0, cy: 0, r: 0, box: true, stops: [{ at: 0, color: P["yard.air.shaft"], a: 0.3 }, { at: 0.6, color: P["yard.air.shaft"], a: 0.13 }, { at: 1, color: P["yard.air.shaft"], a: 0 }] }, shafts)] : []),
    paint("specks.back", 0, fr.specksBack),
    paint("contacts", 0, fr.contacts),
    paint("actors", 0, fr.actors),
    paint("dust", 0, fr.dust),
    paint("specks.front", 0, fr.specksFront),

    // close to the lens, in shade
    paint("porter", DEPTH.porter, fr.porter),
    paint("near", DEPTH.near, fr.near),
    paint("arm", DEPTH.near, fr.arm),
  ];

  return {
    t,
    view,
    items,
    figures: fr.figures.map((f) => ({
      ...f,
      space: f.name === "porter" ? DEPTH.porter : f.name.startsWith("son") ? DEPTH.wall : 0,
      // the porter crosses close to the lens and the sons are shadows on the wall: type may stand over them
      head: f.name !== "porter" && !f.name.startsWith("son"),
    })),
  };
}
