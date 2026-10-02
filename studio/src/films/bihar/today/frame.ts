// Bihar Mushroom: sequence "today". Everything drawn at time t, back to front.
import { CAST } from "../../../assets/cast/cast.ts";
import { growBag, spawnSack } from "../../../assets/props/mushroom.ts";
import { bird, smallHut } from "../../../assets/props/village.ts";
import { paint, rect, shadow, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { smoothstep } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { DEPTH, HOUSE_FOOT, HU, SKY_OVER, footContacts, laneGround, laneMiddle, laneNear, laneSky } from "../s1/lane.ts";
import { TODAY, todayTake } from "./take.ts";

const { U, GY, W, HGT } = TODAY;
/** small huts across the lane, each with grow bags fruiting on its rail */
const HUTS: Shape[] = [-700, 1250, 1700].flatMap((x, i) => {
  const h = smallHut(`hut${i}`, { x, foot: HOUSE_FOOT + 4, u: HU, seed: 3 + i, hooks: i === 1 ? 2 : 1 });
  return [...h.shapes, ...h.hooks.flatMap((p, k) => growBag(`hut${i}/bag${k}`, { top: p, u: HU, sprout: 1, scale: 0.55, seed: 7 * i + k }).shapes)];
});
/** the white sacks stacked by the lane: three, two, one */
const STACK: Shape[] = [];
for (let r = 0; r < 3; r++) {
  for (let i = 0; i < 3 - r; i++) {
    const x = 230 + (i - (2 - r) / 2) * 1.2 * U;
    STACK.push(...spawnSack(`stack/r${r}s${i}`, { c: [x, GY - 0.34 * U - r * 0.6 * U], u: U, w: 1.25, h: 0.66, slump: 0.6, seed: 3 * r + i }).shapes);
  }
}

export function todayFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = todayTake();
  const view = tk.cam.view(t);
  const s = tk.sanjeev.solve(t);
  const f = buildFigure(CAST.sanjeevNow, s.pose, LOOKS[lookId].people);
  const birds: Shape[] = [];
  tk.birds.forEach((b, i) => {
    if (t < b.t0) return;
    const x = b.x0 - b.speed * (t - b.t0);
    if (x > -120) birds.push(...bird(`bird${i}`, [x, b.y + 9 * Math.sin(1.7 * t + i)], b.size, Math.sin(2 * Math.PI * 3.1 * t + 1.7 * i), -1));
  });
  // the dark jamb of the lab door, close to the lens, slides off to the right
  const slide = smoothstep(TODAY.t0, tk.marks.jambOff, t);
  const jambX = -140 + 1400 * slide;
  const OVER = SKY_OVER.morning;
  const items: Item[] = [
    ...laneSky("morning", birds),
    ...Object.entries(tk.type).map(([id, c]) => written(`type.${id}`, DEPTH.type, { kind: "phrase", ...c }, OVER)),
    ...laneMiddle(t, "morning", { after: HUTS }),
    ...laneGround("morning"),
    shadow("ground.cast", 0, [...f.shapes, ...STACK], "vil.lane", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("contacts", 0, footContacts("sanjeev", tk.sanjeev, s)),
    paint("stack", 0, STACK),
    paint("actors", 0, f.shapes),
    ...laneNear(),
    ...(jambX < W + 20 ? [paint("jamb", "screen", [shape("jamb/body", "sil", rect(jambX, -120, W + 260, HGT + 240), { form: "flat", ink: 0, paper: false })])] : []),
  ];
  return { t, view, items, figures: [{ name: "sanjeev", actor: tk.sanjeev, fig: f }] };
}
