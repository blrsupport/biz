// Bihar Mushroom: sequence "s1". Everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { CAST } from "../../../assets/cast/cast.ts";
import { spawnSack } from "../../../assets/props/mushroom.ts";
import { buildNotes } from "../../../assets/props/tin.ts";
import { bird } from "../../../assets/props/village.ts";
import { paint, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure, type FigureOut } from "../../../engine/figure/body.ts";
import { ellipse } from "../../../engine/geom/outline.ts";
import { clamp } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { hash } from "../../../engine/motion/track.ts";
import { DEPTH, SKY_OVER, footContacts, laneGround, laneMiddle, laneNear, laneSky } from "./lane.ts";
import { S1, SACK, s1Take } from "./take.ts";

const { U, GY } = S1;
const flat = { form: "flat", ink: 0, paper: false } as const;

/** The sack the farmer swings past the lens, in screen pixels (also drawn by "home" over its first frames). */
export function passItems(t: number): Item[] {
  const p = s1Take().pass(t);
  if (!p) return [];
  return [paint("pass", "screen", spawnSack("sackB", { c: p.c, u: p.u, w: SACK.w, h: SACK.h, tilt: p.tilt, seed: 3 }).shapes)];
}

export function s1Frame(t: number, lookId: LookId = "A"): FrameList {
  const tk = s1Take();
  const m = tk.marks;
  const view = tk.cam.view(t);
  const style = LOOKS[lookId].people;

  // ---- the two men
  const ts = tk.trader.solve(t);
  const ft = buildFigure(CAST.iraki, ts.pose, style);
  const fs = tk.farmer.solve(t);
  const ff = buildFigure(CAST.buyer, fs.pose, style);
  const figs: Record<"trader" | "farmer", FigureOut> = { trader: ft, farmer: ff };

  // ---- the sacks and the notes
  const sa = tk.sackA(t);
  const sackA = spawnSack("sackA", { c: sa.c, u: U, w: SACK.w, h: SACK.h, tilt: sa.tilt, seed: 7 }).shapes;
  const sb = tk.sackB(t);
  const sackB = t < m.tRel ? spawnSack("sackB", { c: sb.c, u: U, w: SACK.w, h: SACK.h, tilt: sb.tilt, seed: 3 }).shapes : [];
  const n = tk.notes(t);
  const notes: Shape[] = n.who && n.size > 0.02 ? buildNotes("notes", figs[n.who].hands[n.side].hold, n.ang, U * n.size) : [];
  const notesLayer = n.who === "trader" && n.side === "L" ? "trader.back" : n.who === "trader" ? "trader.front" : "farmer.front";
  const lifting = t >= m.tLiftB;

  const actors: Shape[] = [...(lifting ? [] : sackB), ...ft.layers.behind, ...(notesLayer === "trader.back" ? notes : []), ...ft.layers.body, ...ff.layers.behind, ...ff.layers.body, ...sackA, ...(lifting ? sackB : [])];
  actors.push(...(notesLayer === "trader.front" ? notes : []), ...ft.layers.front, ...(notesLayer === "farmer.front" ? notes : []), ...ff.layers.front);
  const casters = [...ft.shapes, ...ff.shapes, ...sackA, ...sackB];
  // under each sack on the ground, a soft contact; it fades as the sack is lifted
  const contacts: Shape[] = [...footContacts("trader", tk.trader, ts), ...footContacts("farmer", tk.farmer, fs)];
  for (const [id, c] of [["sackA", sa.c], ["sackB", sb.c]] as const) {
    const lift = clamp((GY - 0.65 * U - c[1]) / (0.5 * U), 0, 1);
    if (lift < 0.99 && !(id === "sackB" && t >= m.tRel)) contacts.push(shape(`${id}/contact`, "vil.lane", ellipse([c[0] + 8, GY + 2], 0.56 * SACK.w * U * (1 - 0.4 * lift), 0.08 * U, 0, 4), { ...flat, tone: "deep", opacity: 0.5 * (1 - lift) }));
  }

  // ---- life: birds over the fields, dust in the low sun
  const birds: Shape[] = [];
  tk.birds.forEach((b, i) => {
    if (t < b.t0) return;
    const x = b.x0 - b.speed * (t - b.t0);
    if (x < -120) return;
    birds.push(...bird(`bird${i}`, [x, b.y + 9 * Math.sin(1.7 * t + i)], b.size, Math.sin(2 * Math.PI * 3.1 * t + 1.7 * i), -1));
  });
  const motes: Shape[] = [];
  for (let i = 0; i < 46; i++) {
    const x = 1150 * hash(i * 3.1 + 1) + 26 * Math.sin(0.31 * t + i * 1.9) + 7 * t - 100;
    const y = 720 + 700 * hash(i * 5.7 + 2) + 16 * Math.sin(0.27 * t + i * 2.7) - 5 * t;
    const lit = clamp(1 - (x + 100) / 1100, 0, 1);
    const r = 2 + 2.6 * hash(i * 7.3 + 3);
    motes.push(shape(`mote/${i}`, "vil.dust", ellipse([x, y], r, r, 0, 3), { ...flat, opacity: 0.6 * lit * (0.6 + 0.4 * Math.sin(1.3 * t + i * 4.1)) }));
  }

  const ty = tk.type;
  const OVER = SKY_OVER.morning;
  const items: Item[] = [
    ...laneSky("morning", birds),
    written("type.haryana", DEPTH.type, { kind: "phrase", ...ty.haryana }, OVER),
    written("type.oneman", DEPTH.type, { kind: "phrase", ...ty.oneMan }, OVER),
    written("type.back", DEPTH.type, { kind: "phrase", ...ty.back }, OVER),
    written("type.early", DEPTH.type, { kind: "phrase", ...ty.early }, OVER),
    ...laneMiddle(t, "morning"),
    ...laneGround("morning"),
    shadow("ground.cast", 0, casters, "vil.lane", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("contacts", 0, contacts),
    paint("actors", 0, actors),
    paint("motes", 0, motes),
    ...laneNear(),
    ...passItems(t),
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
