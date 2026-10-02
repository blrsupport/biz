// Bihar Mushroom: sequence "shed". Everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { buildCrate } from "../../../assets/props/crate.ts";
import { growBag, hurricaneLamp, lota, spawnBottle } from "../../../assets/props/mushroom.ts";
import { buildCalendar, buildTin } from "../../../assets/props/tin.ts";
import { shedBack, shedFloor, shedJamb, shedRope, shedTop } from "../../../assets/sets/shed.ts";
import { fade, fill, group, paint, rect, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { ellipse } from "../../../engine/geom/outline.ts";
import { area, type Pt } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import type { Actor, Solved } from "../../../engine/motion/actor.ts";
import { hash } from "../../../engine/motion/track.ts";
import { BACKROW_DEPTH, BACK_ROPES, BOTTLE_DULL, BOTTLE_GOOD, BOTTLE_SCALE, CAL, CRATES_L, CRATES_R, LAMP_AT, LOTA_AT, ROPES, SET, SHED, SHED_PALETTE, TIERS, TIN_AT, WALL_DEPTH, shedTake } from "./take.ts";

const { U, GY, W: FW, HGT } = SHED;
const P = SHED_PALETTE;
/** what the writing on the wall stands against */
const OVER = ["wall"];
const flat = { form: "flat", ink: 0, paper: false } as const;

/** Soft shadows under the feet; they fade as a foot leaves the ground. */
export function footContacts(id: string, a: Actor, s: Solved): Shape[] {
  return (["L", "R"] as const).map((k) => {
    const f = s.feet[k];
    const lift = Math.min(1, f.lift / (0.3 * U));
    return shape(`${id}/contact${k}`, "floor", ellipse([f.x + s.fwd * 0.18 * U, a.groundY + 5], U * (0.42 - 0.12 * lift), U * (0.07 - 0.03 * lift), 0, 3), { ...flat, tone: "deep", opacity: 0.46 * (1 - 0.75 * lift) });
  });
}

// ---- static pieces, built once
/** two crates, one on the other (the shapes are shared with `seed`, which stands at the same bench) */
export const crate = (id: string, c: { x: number; wLow: number; wTop: number }): Shape[] => [
  ...buildCrate(`${id}/low`, [c.x, GY - 0.1 * U - 0.5 * U], c.wLow, 1.0 * U),
  ...buildCrate(`${id}/top`, [c.x + 6, GY - 1.1 * U - 0.4 * U], c.wTop, 0.8 * U),
];
export const CRATES_LEFT = crate("crateL", CRATES_L);
export const CRATES_RIGHT = crate("crateR", CRATES_R);
export const STATIC_CONTACTS: Shape[] = [CRATES_L.x, CRATES_R.x, 590, 1530].map((x, i) =>
  shape(`contact/s${i}`, "floor", ellipse([x, GY - 0.1 * U + 4], (i < 2 ? 0.6 : 0.16) * U, 0.05 * U, 0, 3), { ...flat, tone: "deep", opacity: 0.42 }),
);
export const ROPE_SHAPES: Shape[] = ROPES.map((x, i) => shedRope(`rope/${i}`, x, SET.poleY, TIERS[1] + 0.3 * U));
const BACK_POLE: Shape[] = [shape("back/pole", "bamboo", rect(700, SET.poleY - 0.15 * U, 820, 0.1 * U), { ...flat, tone: "shade" })];
export const BACK_BAGS: Shape[] = [
  ...BACK_POLE,
  ...BACK_ROPES.map((x, i) => shedRope(`back/rope${i}`, x, SET.poleY - 0.1 * U, TIERS[1] + 0.2 * U)),
  ...BACK_ROPES.flatMap((x, i) => [0, 1].flatMap((k) => growBag(`back/bag${i}_${k}`, { top: [x, TIERS[k] - 0.1 * U], u: U, scale: 0.86, seed: 20 + i * 2 + k, myc: 0.5 + 0.3 * hash(i + k) }).shapes)),
];
const DULL = spawnBottle("bottle.dull", { at: BOTTLE_DULL, u: U, bad: 1, scale: BOTTLE_SCALE }).shapes;
const LAMP = hurricaneLamp("lamp", { at: LAMP_AT, u: U, lit: 0 }).shapes;
const LOTA = lota("lota", { at: LOTA_AT, u: U }).shapes;
/** the doorway, for people standing in it: hidden by the near part of the left wall and under the lintel, not by the back jamb */
export const DOOR_CLIP: Pt[] = (() => {
  const [o0, o1, o2, o3] = SET.opening;
  const k = (o3[1] - o2[1]) / (o3[0] - o2[0]);
  return [[o0[0] + 1500, o0[1] + 600], o1, o2, [o3[0] + 1500, o3[1] + 1500 * k]];
})();

const big = (shapes: readonly Shape[], min = 420) => shapes.filter((s) => Math.abs(area(s.pts)) > min);

export function shedFrame(t: number, lookId: LookId = "A"): FrameList {
  const style = LOOKS[lookId].people;
  const tk = shedTake();
  const m = tk.marks;
  const view = tk.cam.view(t);

  // ---- actors
  const ss = tk.sanjeev.solve(t);
  const sf = buildFigure(tk.sanjeev.ch, ss.pose, style);
  const gossipsIn = t < m.tMoney + 1.6;
  const ga = gossipsIn ? buildFigure(tk.gossipA.ch, tk.gossipA.solve(t).pose, style) : null;
  const gb = gossipsIn ? buildFigure(tk.gossipB.ch, tk.gossipB.solve(t).pose, style) : null;

  // ---- the bags on their ropes
  const bagShapes: Shape[] = [];
  for (const b of tk.bags) {
    if (b === tk.dropped) continue;
    const swing = b === tk.hung ? tk.hangSwing.value(t) : 0.012 * Math.sin(0.8 * t + b.seed);
    bagShapes.push(...growBag(b.id, { top: [b.x, TIERS[b.tier]], u: U, sprout: b.sprout.value(t), failed: b.failed.value(t), swing, seed: b.seed }).shapes);
  }
  const da = tk.droppedAt(t);
  const droppedShapes = growBag(tk.dropped.id, { top: da.top, u: U, failed: tk.dropped.failed.value(t), swing: da.swing, seed: tk.dropped.seed }).shapes;

  // ---- the bottle: on the crate, then in his far hand
  const kGrab = Math.max(0, Math.min(1, (t - (m.tGrab - 0.1)) / 0.14));
  const hold = sf.hands.R.hold;
  const inHand: Pt = [hold[0], hold[1] + 0.26 * U];
  const at: Pt = kGrab <= 0 ? BOTTLE_GOOD : kGrab >= 1 ? inHand : [BOTTLE_GOOD[0] + (inHand[0] - BOTTLE_GOOD[0]) * kGrab, BOTTLE_GOOD[1] + (inHand[1] - BOTTLE_GOOD[1]) * kGrab];
  const bottle = spawnBottle("bottle", { at, u: U, tilt: tk.tilt.value(t), scale: BOTTLE_SCALE });

  // ---- tin and calendar
  const tin = buildTin("tin", { ...TIN_AT, lid: tk.lid.value(t), notes: true });
  const n = tk.pages.value(t);
  const cal = buildCalendar("cal", { ...CAL, flip: n - Math.floor(n) });

  // ---- shadows: on the floor inside the doorlight; on the wall, thrown right by the light from the door
  const casters = big([...sf.shapes, ...CRATES_LEFT, ...CRATES_RIGHT]).filter((s) => !/shoe|hair/.test(s.id));
  const wallCasters = big([...sf.shapes, ...bagShapes.filter((s) => /\/body$/.test(s.id)), ...SET.rack.filter((s) => /post/.test(s.id))]);
  const wallSun = SET.room.wallSun.map((s) => s.pts);
  const wallShadow: Item[] = wallSun.length
    ? [group("cast.wall", WALL_DEPTH, [shadow("cast.wall.on", WALL_DEPTH, wallCasters, "wall", { tone: "base", shift: [0.62 * U, -0.1 * U], opacity: 0.7 })], { clip: wallSun })]
    : [];

  // ---- dust hanging in the doorlight
  const specks: Shape[] = [];
  for (let i = 0; i < 20; i++) {
    const x = -40 + 760 * hash(i * 3.1 + 1) + 24 * Math.sin(0.31 * t + i * 1.9) + 7 * (t - m.t0);
    const y = 620 + 760 * hash(i * 5.7 + 2) + 14 * Math.sin(0.25 * t + i * 2.7) - 4 * (t - m.t0);
    const r = 2 + 2.4 * hash(i * 7.3 + 3);
    const glint = 0.6 + 0.4 * Math.sin(1.3 * t + i * 4.1);
    const near = Math.max(0, 1 - Math.abs(x - 300) / 520);
    specks.push(shape(`mote/${i}`, "dust", ellipse([x, y], r, r, 0, 3), { ...flat, opacity: 0.5 * glint * near * (1 - 2 * tk.dusk(t)) }));
  }

  const ty = tk.type;
  const items: Item[] = [
    ...shedBack(SET, {
      id: "shed",
      space: WALL_DEPTH,
      glow: 1 - 1.6 * tk.dusk(t),
      behind: [paint("backrow", BACKROW_DEPTH, BACK_BAGS)],
      inner: [
        ...wallShadow,
        paint("cal.back", WALL_DEPTH, cal.back),
        paint("cal.page", WALL_DEPTH, cal.page),
      ],
    }),
    ...shedFloor(SET, { id: "floor", space: 0, casters, groundY: GY + 4 }),
    paint("door", 0, [...SET.doorSolid, ...SET.doorView]),
  ];
  if (ga && gb) {
    items.push(group("gossips", 0, [paint("gossips.fig", 0, [...gb.shapes, ...ga.shapes])], { clip: [DOOR_CLIP] }));
  }
  items.push(
    paint("door.frame", 0, SET.doorFrame),
    // the writing goes over the back wall and on over the top of the left wall, so it is listed after the doorway
    written("type.engineer", WALL_DEPTH, { kind: "phrase", ...ty.engineer }, OVER),
    written("type.years", WALL_DEPTH, { kind: "number", ...ty.years }, OVER),
    written("type.spawn", WALL_DEPTH, { kind: "phrase", ...ty.spawn }, OVER),
    paint("rack", 0, [...SET.rack, ...ROPE_SHAPES, ...bagShapes]),
    paint("contacts", 0, [...STATIC_CONTACTS, ...footContacts("sanjeev", tk.sanjeev, ss)]),
    paint("props", 0, [...CRATES_LEFT, ...CRATES_RIGHT, ...tin.shapes, ...LAMP, ...LOTA, ...DULL, ...droppedShapes]),
  );
  // the bottle catches the doorlight once he holds it up
  const g = tk.glow.value(t);
  if (g > 0.01) {
    const c = bottle.mid;
    items.push(fill("bottle.glow", 0, { kind: "radial", cx: c[0], cy: c[1], r: 1.1 * U, stops: fade(P["lamp.glow"], 0.42 * g, 0) }, [rect(c[0] - 1.1 * U, c[1] - 1.1 * U, 2.2 * U, 2.2 * U)]));
  }
  items.push(
    paint("actor", 0, [...sf.layers.behind, ...sf.layers.body, ...bottle.shapes, ...sf.layers.front]),
    paint("dust", 0, specks),
    ...shedTop(SET, { id: "top", space: WALL_DEPTH }),
  );
  const d = tk.dusk(t);
  if (d > 0.01) items.push(fill("dusk", "screen", { kind: "solid", color: P["shed.dusk"] }, [rect(-40, -40, FW + 80, HGT + 80)], { opacity: d }));
  const dim = tk.dim.value(t);
  if (dim > 0.01) items.push(fill("dim", "screen", { kind: "solid", color: P["shed.air.dark"] }, [rect(-40, -40, FW + 80, HGT + 80)], { opacity: dim }));
  const jx = tk.jamb.value(t);
  if (jx > -100) items.push(paint("jamb", "screen", shedJamb("jamb", jx, -1, FW, HGT, U)));

  const figures: FrameList["figures"] = [{ name: "sanjeev", actor: tk.sanjeev, fig: sf }];
  if (ga && gb) figures.push({ name: "gossipA", actor: tk.gossipA, fig: ga, head: false }, { name: "gossipB", actor: tk.gossipB, fig: gb, head: false });
  return { t, view, items, figures };
}
