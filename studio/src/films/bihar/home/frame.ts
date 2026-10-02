// Bihar Mushroom: sequence "home". Everything drawn at time t, back to front.
import { CAST } from "../../../assets/cast/cast.ts";
import { fill, paint, rect, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { smoothstep } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { passItems } from "../s1/frame.ts";
import { DEPTH, SKY_OVER, footContacts, laneGround, laneMiddle, laneNear, laneSky } from "../s1/lane.ts";
import { BIG_SHED, HOME, HOME_PALETTE, homeTake } from "./take.ts";

/** the parts of the shed in front of a man in its doorway: the wall right of the door, the lintel, the wall above */
const AFTER = /wallR|plinthR|wallT|lintel|poleR/;
const SHED_BEHIND = [...BIG_SHED.dark, ...BIG_SHED.front.filter((s) => !AFTER.test(s.id))];
const SHED_FRONT = BIG_SHED.front.filter((s) => AFTER.test(s.id));

export function homeFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = homeTake();
  const view = tk.cam.view(t);
  const s = tk.sanjeev.solve(t);
  const f = buildFigure(CAST.sanjeev, s.pose, LOOKS[lookId].people);
  const veil = smoothstep(tk.marks.tVeil0, tk.marks.tVeil1, t);
  const d = tk.door;
  const ty = tk.type;
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
    shadow("ground.cast", 0, f.shapes, "vil.lane", { ground: { y: HOME.GY, stretch: 0.4, drop: 0.26 } }),
    paint("contacts", 0, footContacts("sanjeev", tk.sanjeev, s)),
    paint("actors", 0, f.shapes),
    ...(veil > 0.01 ? [fill("veil", 0, { kind: "solid", color: HOME_PALETTE["vil.dark"] }, [rect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0 + 4)], { opacity: veil })] : []),
    paint("shed.front", 0, SHED_FRONT),
    ...laneNear(),
    ...passItems(t),
  ];
  return { t, view, items, figures: [{ name: "sanjeev", actor: tk.sanjeev, fig: f }] };
}
