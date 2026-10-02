// Demo 1, the room: everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { buildOven } from "../../assets/props/md.ts";
import { buildPress } from "../../assets/props/press.ts";
import { buildCalendar, buildNotes, buildTin } from "../../assets/props/tin.ts";
import { roomBack, roomFloor } from "../../assets/sets/room.ts";
import { fill, group, paint, rect, type as written, type FrameList, type Item } from "../../engine/draw/list.ts";
import { shape, type Shape } from "../../engine/draw/shape.ts";
import { moveShapes, turnShapes } from "../../engine/draw/xform.ts";
import { buildFigure } from "../../engine/figure/body.ts";
import { ellipse } from "../../engine/geom/outline.ts";
import { area } from "../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../engine/look/looks.ts";
import type { Actor, Solved } from "../../engine/motion/actor.ts";
import { hash } from "../../engine/motion/track.ts";
import { CAL, DOOR, MD, MD_TAKE_PALETTE, OVEN, PRESS_AT, ROOM, TABLE, TIN_AT, WALL_DEPTH, mdTake, sunEdgeY, sunFor } from "./take.ts";

const { U, GY } = MD;
const P = MD_TAKE_PALETTE;
/** what the writing on the wall stands against (it sits high on the wall, above the sun's edge) */
const OVER = ["wall"];

/** Soft shadows under the feet; they fade as a foot leaves the ground. */
function footContacts(id: string, a: Actor, s: Solved): Shape[] {
  return (["L", "R"] as const).map((k) => {
    const f = s.feet[k];
    const lift = Math.min(1, f.lift / (0.3 * U));
    return shape(`${id}/contact${k}`, "floor", ellipse([f.x + s.fwd * 0.18 * U, a.groundY + 5], U * (0.42 - 0.12 * lift), U * (0.07 - 0.03 * lift), 0, 3), { form: "flat", tone: "deep", ink: 0, paper: false, opacity: 0.46 * (1 - 0.75 * lift) });
  });
}

const STATIC_CONTACTS: Shape[] = [TABLE.x0 + 0.16 * U, TABLE.x1 - 0.16 * U, PRESS_AT.x - 0.8 * U, PRESS_AT.x + 0.8 * U].map((x, i) =>
  shape(`contact/s${i}`, "floor", ellipse([x, GY - 4], (i < 2 ? 0.18 : 0.3) * U, (i < 2 ? 0.036 : 0.05) * U, 0, 3), { form: "flat", tone: "deep", ink: 0, paper: false, opacity: 0.45 }),
);

const big = (shapes: readonly Shape[], min = 420) => shapes.filter((s) => Math.abs(area(s.pts)) > min);

export function mdFrame(t: number, lookId: LookId = "A"): FrameList {
  const style = LOOKS[lookId].people;
  const tk = mdTake();
  const m = tk.marks;
  const view = tk.cam.view(t);

  // the light: as the shutter rises, the sun's edge climbs the wall and runs out across the floor
  const open = tk.shutter.value(t);
  const room = { ...ROOM, ...ROOM.sun(sunFor(open)) };
  const sh = DOOR.shutter(open);
  const dim = 0.5 * Math.pow(Math.max(0, 1 - open), 1.3);

  // actors
  const vs = tk.vikas.solve(t);
  const rs = tk.rahul.solve(t);
  const vf = buildFigure(tk.vikas.ch, vs.pose, style);
  const rf = buildFigure(tk.rahul.ch, rs.pose, style);

  // props
  const dy = tk.thud(t);
  const op = tk.oven.at(t);
  const onTable = t >= m.tPut;
  const ovenShapes = turnShapes(buildOven("oven", { x: op[0], base: op[1] + (onTable ? dy : 0), w: OVEN.w, h: OVEN.h, u: U }).shapes, op, tk.oven.tilt.value(t));
  const tableBack = Math.abs(dy) > 0.05 ? moveShapes(TABLE.back, [0, dy * 0.5]) : TABLE.back;
  const tableFront = Math.abs(dy) > 0.05 ? moveShapes(TABLE.front, [0, dy * 0.5]) : TABLE.front;
  const tin = buildTin("tin", { ...TIN_AT, base: TIN_AT.base + dy, lid: tk.lid.value(t), notes: t < m.tGrab });
  const press = buildPress("press", PRESS_AT, tk.pressState(t));
  const cal = buildCalendar("cal", { ...CAL, flip: tk.flip.value(t) });
  const notes = t >= m.tGrab ? buildNotes("notes", rf.hands.L.hold, -1.95 + 0.25 * (rf.arms.L.foreAngle - 3.4), U * 1.12) : [];

  // dust hanging in the shaft of sun: each speck on its own slow drift, and only where the light reaches it
  const specks: { back: Shape[]; front: Shape[] } = { back: [], front: [] };
  if (open > 0.3) {
    for (let i = 0; i < 22; i++) {
      const x = -380 + 1150 * hash(i * 3.1 + 1) + 26 * Math.sin(0.34 * t + i * 1.9) + 9 * t;
      const y = 640 + 740 * hash(i * 5.7 + 2) + 16 * Math.sin(0.27 * t + i * 2.7) - 5 * t;
      const lit = y - sunEdgeY(open, x);
      if (lit < 20 || y > ROOM.junction + 70) continue;
      const r = 2 + 2.6 * hash(i * 7.3 + 3);
      const glint = 0.6 + 0.4 * Math.sin(1.3 * t + i * 4.1);
      (i % 2 ? specks.front : specks.back).push(shape(`mote/${i}`, "dust", ellipse([x, y], r, r, 0, 3), { form: "flat", ink: 0, paper: false, opacity: Math.min(1, lit / 80) * 0.55 * glint * Math.min(1, (open - 0.3) * 3) }));
    }
  }

  // back to front. Until he lets go, the fingers of Vikas's near hand are under the oven, so behind it.
  const under = t < m.tFree ? new Set(vf.hands.R.fingers.map((s) => s.id)) : null;
  const order: Shape[] = [
    ...press.shapes,
    ...tableBack,
    ...tableFront,
    ...specks.back,
    ...vf.layers.behind,
    ...vf.layers.body,
    ...(under ? vf.layers.front.filter((s) => under.has(s.id)) : []),
    ...ovenShapes,
    ...tin.shapes,
    ...rf.layers.behind,
    ...rf.layers.body,
    ...(under ? vf.layers.front.filter((s) => !under.has(s.id)) : vf.layers.front),
    ...notes,
    ...rf.layers.front,
    ...specks.front,
  ];
  const casters = big([...press.shapes, ...TABLE.back, ...TABLE.front, ...ovenShapes, ...tin.shapes, ...vf.shapes, ...rf.shapes]).filter((s) => !/shoe|bar|cable|hole|streak|rack|glass/.test(s.id));
  const contacts = [...STATIC_CONTACTS, ...footContacts("vikas", tk.vikas, vs), ...footContacts("rahul", tk.rahul, rs)];

  // while they are still outside, they show only through the open part of the doorway
  const entering = t < 1.5;
  const thr = DOOR.threshold(GY + 5 - ROOM.junction);
  const hole = sh.open.length ? [sh.open] : [];

  const ty = tk.type;
  const acting = paint("actors", 0, order);
  const items: Item[] = [
    // the back wall, with what hangs on it and what is written on it
    ...roomBack(room, {
      id: "room",
      space: WALL_DEPTH,
      glow: Math.min(1, open * 1.1),
      inner: [
        paint("cal.back", WALL_DEPTH, cal.back),
        written("cal.year", WALL_DEPTH, { kind: "line", text: "2020", face: "label", cap: cal.yearCap, x: cal.yearAt[0], y: cal.yearAt[1], color: P["cal.page"], align: "middle" }),
        paint("cal.page", WALL_DEPTH, cal.page),
        written("type.oven", WALL_DEPTH, { kind: "number", ...ty.oven }, OVER),
        written("type.machine", WALL_DEPTH, { kind: "number", ...ty.machine }, OVER),
        written("type.phrase", WALL_DEPTH, { kind: "phrase", ...ty.phrase }, OVER),
        written("type.revenue", WALL_DEPTH, { kind: "number", ...ty.revenue }, OVER),
      ],
    }),
    // the floor, the doorway, and everyone on the floor
    ...roomFloor(room, { id: "floor", space: 0, casters, groundY: GY + 4 }),
    paint("door", 0, [...DOOR.solid, ...DOOR.view, ...sh.shapes, ...DOOR.housing]),
    paint("contacts", 0, contacts),
    entering ? group("entering", 0, [acting], { clip: [rect(thr, -4000, 9000, 9000), ...hole] }) : acting,
  ];
  // the room is dark until the shutter is up: everything but the doorway is dimmed
  if (dim > 0.01) items.push(fill("dim", 0, { kind: "solid", color: P["room.air.dark"] }, [rect(-6000, -6000, 15000, 15000), ...hole], { rule: "evenodd", opacity: dim }));

  return {
    t,
    view,
    items,
    figures: [
      { name: "vikas", actor: tk.vikas, fig: vf },
      { name: "rahul", actor: tk.rahul, fig: rf },
    ],
  };
}
