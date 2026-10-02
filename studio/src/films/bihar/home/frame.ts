// Bihar Mushroom: sequence "home". Everything drawn at time t, back to front.
import { CAST } from "../../../assets/cast/cast.ts";
import { growBag } from "../../../assets/props/mushroom.ts";
import { rolledDegree, strawHandful, strawStack, tinTrunk } from "../../../assets/props/village.ts";
import { fill, paint, rect, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import type { Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { smoothstep, type Pt } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { passItems } from "../s1/frame.ts";
import { DEPTH, SKY_OVER, footContacts, laneGround, laneMiddle, laneNear, laneSky } from "../s1/lane.ts";
import { BIG_SHED, HOME, HOME_PALETTE, STRAW, TRUNK_U, homeTake } from "./take.ts";

const { U, GY } = HOME;
/** the parts of the shed in front of a man in its doorway: the wall right of the door, the lintel, the wall above */
const AFTER = /wallR|plinthR|wallT|lintel|poleR/;
const SHED_BEHIND = [...BIG_SHED.dark, ...BIG_SHED.front.filter((s) => !AFTER.test(s.id))];
const SHED_FRONT = BIG_SHED.front.filter((s) => AFTER.test(s.id));
const STACK = strawStack("straw", { x: STRAW.x, ground: GY, w: STRAW.w, h: STRAW.h, seed: 4 });

let dropFrom: Pt | null = null;

export function homeFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = homeTake();
  const m = tk.marks;
  const style = LOOKS[lookId].people;
  const view = tk.cam.view(t);
  const s = tk.sanjeev.solve(t);
  const f = buildFigure(CAST.sanjeev, s.pose, style);
  const sf = tk.father.solve(t);
  const ff = buildFigure(CAST.father, sf.pose, style);
  const facingR = tk.sanjeev.yaw.value(t) > 0;
  const veil = smoothstep(m.tVeil0, m.tVeil1, t);
  const d = tk.door;
  const ty = tk.type;

  // what he has in his hands: trunk, degree, straw, then the two grow bags. Each keeps its own name whichever side
  // of him it is drawn on, so turning round never makes it vanish and reappear.
  const back: Item[] = [];
  const front: Item[] = [];
  const casters: Shape[] = [];
  const put = (id: string, shapes: Shape[], near: boolean) => {
    if (!shapes.length) return;
    casters.push(...shapes);
    (near ? front : back).push(paint(id, 0, shapes));
  };
  const nearOf = (side: "L" | "R") => (side === "R") === facingR;
  const trunkCarried = tk.trunk.held.value(t) > 0.5;
  if (t < m.tSwap) put("held.trunk", tinTrunk("trunk", { c: tk.trunk.at(t), u: TRUNK_U }), trunkCarried && nearOf("L"));
  if (t < m.tSwap) {
    const w = s.wrists.R;
    put("held.degree", rolledDegree("degree", [w[0] + 0.03 * U, w[1] - 0.55 * U], [w[0] - 0.03 * U, w[1] + 0.32 * U], U), nearOf("R"));
  }
  if (t >= m.tHandful && t < m.tDrop + 0.1) {
    put("held.handful", strawHandful("handful", s.wrists.L, U, 0.35, 3), t > m.tHandful + 0.9);
  } else if (t >= m.tDrop + 0.1) {
    if (!dropFrom) dropFrom = tk.sanjeev.solve(m.tDrop + 0.1).wrists.L;
    const k = Math.min(1, (t - m.tDrop - 0.1) / 0.32);
    const p: Pt = [dropFrom[0] + 0.1 * U * k, dropFrom[1] + (GY - 0.08 * U - dropFrom[1]) * k * k];
    put("held.handful", strawHandful("handful", p, U, 0.35 + 0.4 * k, 3), false);
  }
  if (t >= m.tSwap) {
    for (const k of ["L", "R"] as const) {
      const w = s.wrists[k];
      put(`held.bag${k}`, growBag(`bag${k}`, { top: [w[0], w[1] + 0.05 * U], u: U, scale: 0.85, myc: 0.75, seed: k === "L" ? 3 : 8 }).shapes, nearOf(k));
    }
  }

  const OVER = SKY_OVER.afternoon;
  const items: Item[] = [
    ...laneSky("afternoon", []),
    written("type.name", DEPTH.type, { kind: "phrase", ...ty.name }, OVER),
    written("type.bit", DEPTH.type, { kind: "phrase", ...ty.bit }, OVER),
    written("type.nalanda", DEPTH.type, { kind: "phrase", ...ty.nalanda }, OVER),
    written("type.year", DEPTH.type, { kind: "phrase", ...ty.year }, OVER),
    written("type.solan", DEPTH.type, { kind: "phrase", ...ty.solan }, OVER),
    ...laneMiddle(t, "afternoon"),
    ...laneGround("afternoon"),
    paint("shed.behind", 0, SHED_BEHIND),
    shadow("ground.cast", 0, [...ff.shapes, ...f.shapes, ...STACK, ...casters], "vil.lane", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("straw", 0, STACK),
    paint("contacts.father", 0, footContacts("father", tk.father, sf)),
    paint("father", 0, ff.shapes),
    paint("contacts", 0, footContacts("sanjeev", tk.sanjeev, s)),
    ...back,
    paint("actors", 0, f.shapes),
    ...front,
    ...(veil > 0.01 ? [fill("veil", 0, { kind: "solid", color: HOME_PALETTE["vil.dark"] }, [rect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0 + 4)], { opacity: veil })] : []),
    paint("shed.front", 0, SHED_FRONT),
    ...laneNear(),
    ...passItems(t),
  ];
  return {
    t,
    view,
    items,
    figures: [
      { name: "sanjeev", actor: tk.sanjeev, fig: f },
      { name: "father", actor: tk.father, fig: ff },
    ],
  };
}
