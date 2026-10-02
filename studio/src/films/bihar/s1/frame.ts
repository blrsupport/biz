// Bihar Mushroom: sequence "s1". Everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { CAST } from "../../../assets/cast/cast.ts";
import { buildNotes } from "../../../assets/props/tin.ts";
import { bird, wovenSack } from "../../../assets/props/village.ts";
import { bananaPlant } from "../../../assets/sets/village.ts";
import { fade, fill, paint, rect, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure, type FigureOut } from "../../../engine/figure/body.ts";
import { ellipse } from "../../../engine/geom/outline.ts";
import { clamp, type Pt } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import type { Actor, Solved } from "../../../engine/motion/actor.ts";
import { hash } from "../../../engine/motion/track.ts";
import { BANANAS, DEPTH, HORIZON, HOUSE, PUMP_SHAPES, REST_B, S1, S1_PALETTE, SACK, SET, SHED, s1Take } from "./take.ts";

const { U, GY, W, HGT } = S1;
const P = S1_PALETTE;
const SCREEN = [rect(-80, -80, W + 160, HGT + 160)];
/** what the writing across the sky stands against */
const OVER = [P["vil.sky.top"], P["vil.sky.band"], P["vil.sky.low"], P["vil.sun.glow"]];
const SACK_B = wovenSack("sackB", REST_B, SACK.w, SACK.h, 0, 3);
const SACK_B_CAST = SACK_B.filter((s) => s.id.endsWith("/body"));
const flat = { form: "flat", ink: 0, paper: false } as const;

/** Soft shadows under the feet; they fade as a foot leaves the ground. */
function footContacts(id: string, a: Actor, s: Solved): Shape[] {
  return (["L", "R"] as const).map((k) => {
    const f = s.feet[k];
    const lift = Math.min(1, f.lift / (0.3 * a.H));
    return shape(`${id}/contact${k}`, "vil.lane", ellipse([f.x + s.fwd * 0.18 * a.H, a.groundY + 5], a.H * (0.44 - 0.12 * lift), a.H * (0.075 - 0.03 * lift), 0, 4), { ...flat, tone: "deep", opacity: 0.42 * (1 - 0.75 * lift) });
  });
}

export function s1Frame(t: number, lookId: LookId = "A"): FrameList {
  const tk = s1Take();
  const view = tk.cam.view(t);
  const style = LOOKS[lookId].people;

  // ---- the two men
  const ts = tk.trader.solve(t);
  const ft = buildFigure(CAST.iraki, ts.pose, style);
  const fs = tk.farmer.solve(t);
  const ff = buildFigure(CAST.buyer, fs.pose, style);
  const figs: Record<"trader" | "farmer", FigureOut> = { trader: ft, farmer: ff };

  // ---- the sack that changes hands, and the notes
  const sa = tk.sackA(t);
  const sackA = wovenSack("sackA", sa.c, SACK.w, SACK.h, sa.tilt, 7);
  const n = tk.notes(t);
  const notes: Shape[] = n.who && n.size > 0.02 ? buildNotes("notes", figs[n.who].hands[n.side].hold, n.ang, U * n.size) : [];
  const notesLayer = n.who === "trader" && n.side === "L" ? "trader.back" : n.who === "trader" ? "trader.front" : "farmer.front";

  const actors: Shape[] = [...SACK_B, ...ft.layers.behind, ...(notesLayer === "trader.back" ? notes : []), ...ft.layers.body, ...ff.layers.behind, ...ff.layers.body, ...sackA];
  actors.push(...(notesLayer === "trader.front" ? notes : []), ...ft.layers.front, ...(notesLayer === "farmer.front" ? notes : []), ...ff.layers.front);
  const sackCast = sackA.filter((s) => s.id.endsWith("/body"));
  const casters = [...ft.shapes, ...ff.shapes, ...sackCast, ...SACK_B_CAST];
  // under each sack on the ground, a soft contact; it fades as the sack is lifted
  const liftA = clamp((GY - 0.6 * U - sa.c[1]) / (0.5 * U), 0, 1);
  const contacts: Shape[] = [
    ...footContacts("trader", tk.trader, ts),
    ...footContacts("farmer", tk.farmer, fs),
    shape("sackB/contact", "vil.lane", ellipse([REST_B[0] + 8, GY + 2], 0.56 * SACK.w, 0.08 * U, 0, 4), { ...flat, tone: "deep", opacity: 0.5 }),
  ];
  if (liftA < 0.99) contacts.push(shape("sackA/contact", "vil.lane", ellipse([sa.c[0] + 8, GY + 2], 0.56 * SACK.w * (1 - 0.4 * liftA), 0.08 * U, 0, 4), { ...flat, tone: "deep", opacity: 0.5 * (1 - liftA) }));

  // ---- life: birds over the fields, the banana leaves stirring, dust in the low sun
  const birds: Shape[] = [];
  tk.birds.forEach((b, i) => {
    if (t < b.t0) return;
    const x = b.x0 - b.speed * (t - b.t0);
    if (x < -120) return;
    birds.push(...bird(`bird${i}`, [x, b.y + 9 * Math.sin(1.7 * t + i)], b.size, Math.sin(2 * Math.PI * 3.1 * t + 1.7 * i), -1));
  });
  const bananas: Shape[] = BANANAS.flatMap((b, i) => bananaPlant(b.id, { ...b, sway: 0.05 * Math.sin(0.9 * t + 1.9 * i) + 0.02 * Math.sin(2.3 * t + i) }));
  const motes: Shape[] = [];
  for (let i = 0; i < 46; i++) {
    const x = 1150 * hash(i * 3.1 + 1) + 26 * Math.sin(0.31 * t + i * 1.9) + 7 * t;
    const y = 720 + 700 * hash(i * 5.7 + 2) + 16 * Math.sin(0.27 * t + i * 2.7) - 5 * t;
    const lit = clamp(1 - x / 1100, 0, 1);
    const r = 2 + 2.6 * hash(i * 7.3 + 3);
    motes.push(shape(`mote/${i}`, "vil.dust", ellipse([x, y], r, r, 0, 3), { ...flat, opacity: 0.6 * lit * (0.6 + 0.4 * Math.sin(1.3 * t + i * 4.1)) }));
  }

  const ty = tk.type;
  const items: Item[] = [
    // the morning sky, the low sun at frame left
    fill("sky", "screen", { kind: "linear", x1: 0, y1: -60, x2: 0, y2: 1060, stops: [{ at: 0, color: P["vil.sky.top"], a: 1 }, { at: 0.55, color: P["vil.sky.band"], a: 1 }, { at: 1, color: P["vil.sky.low"], a: 1 }] }, SCREEN),
    fill("sky.glow", "screen", { kind: "radial", cx: -60, cy: 860, r: 1000, stops: fade(P["vil.sun.glow"], 0.95, 0) }, SCREEN),
    paint("birds", DEPTH.sky, birds),

    // the far horizon: pine hills at the left end, the city at the right end, in haze
    paint("far", DEPTH.far, SET.far),
    fill("far.haze", DEPTH.far, { kind: "linear", x1: 0, y1: HORIZON - 300, x2: 0, y2: HORIZON + 8, stops: fade(P["vil.air.haze"], 0.15, 0.6) }, [rect(-2600, HORIZON - 300, 6000, 320)]),

    // what is written across the sky
    written("type.haryana", DEPTH.type, { kind: "phrase", ...ty.haryana }, OVER),
    written("type.oneman", DEPTH.type, { kind: "phrase", ...ty.oneMan }, OVER),
    written("type.back", DEPTH.type, { kind: "phrase", ...ty.back }, OVER),

    // the fields
    paint("fields", DEPTH.fields, SET.fields),
    fill("fields.haze", DEPTH.fields, { kind: "linear", x1: 0, y1: HORIZON, x2: 0, y2: HORIZON + 240, stops: fade(P["vil.air.haze"], 0.5, 0) }, [rect(-1600, HORIZON, 4200, 240)]),

    // the house, the shed, the plants and the straw, across the lane
    paint("yard", DEPTH.house, SET.yard),
    paint("trees", DEPTH.house, SET.trees),
    paint("house", DEPTH.house, HOUSE.shapes),
    paint("shed.dark", DEPTH.house, SHED.dark),
    paint("shed", DEPTH.house, SHED.front),
    paint("bananas", DEPTH.house, bananas),
    paint("straw", DEPTH.house, SET.straw),
    fill("house.warm", DEPTH.house, { kind: "radial", cx: -300, cy: 860, r: 1300, stops: fade(P["vil.air.warm"], 0.4, 0) }, [rect(-1600, 300, 4200, 1500)]),
    fill("house.haze", DEPTH.house, { kind: "linear", x1: 0, y1: 500, x2: 0, y2: 1300, stops: fade(P["vil.air.haze"], 0.12, 0.2) }, [rect(-1600, 300, 4200, 1000)]),

    // the pump by the lane
    paint("pump", DEPTH.pump, PUMP_SHAPES),

    // the lane and the two men on it
    paint("lane", 0, SET.lane),
    fill("lane.warm", 0, { kind: "radial", cx: -200, cy: 1560, r: 1000, stops: fade(P["vil.air.warm"], 0.3, 0) }, [rect(-1600, 1430, 4300, 1200)]),
    shadow("ground.cast", 0, casters, "vil.lane", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("contacts", 0, contacts),
    paint("actors", 0, actors),
    paint("motes", 0, motes),

    // close to the lens
    paint("near", DEPTH.near, SET.near),
    fill("near.air", 0, { kind: "linear", x1: 0, y1: 1640, x2: 0, y2: 2100, stops: fade(P["vil.air.near"], 0, 0.42) }, [rect(-1600, 1640, 4300, 900)]),
  ];

  return {
    t,
    view,
    items,
    figures: [
      { name: "trader", actor: tk.trader, fig: ft },
      { name: "farmer", actor: tk.farmer, fig: ff },
    ],
  };
}
