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
import { SACK, TODAY, todayTake } from "./take.ts";

const { U, GY, W, HGT } = TODAY;
/** small huts across the lane, each with grow bags fruiting on its rail */
const HUTS: Shape[] = [-700, 1250, 1700].flatMap((x, i) => {
  const h = smallHut(`hut${i}`, { x, foot: HOUSE_FOOT + 4, u: HU, seed: 3 + i, hooks: i === 1 ? 2 : 1 });
  return [...h.shapes, ...h.hooks.flatMap((p, k) => growBag(`hut${i}/bag${k}`, { top: p, u: HU, sprout: i === 0 ? 0.3 : 1, scale: 0.55, seed: 7 * i + k }).shapes)];
});
/** the white sacks stacked by the lane: three, two, one */
const STACK: Shape[] = [];
for (let r = 0; r < 2; r++) {
  for (let i = 0; i < 2 - r; i++) {
    const x = 200 + (i - (1 - r) / 2) * 1.2 * U;
    STACK.push(...spawnSack(`stack/r${r}s${i}`, { c: [x, GY - 0.34 * U - r * 0.6 * U], u: U, w: 1.25, h: 0.66, slump: 0.6, seed: 3 * r + i }).shapes);
  }
}

export function todayFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = todayTake();
  const view = tk.cam.view(t);
  const style = LOOKS[lookId].people;
  const s = tk.sanjeev.solve(t);
  const f = buildFigure(CAST.sanjeevNow, s.pose, style);
  const fig = (a: typeof tk.p1) => {
    const so = a.solve(t);
    return { so, f: buildFigure(a.ch, so.pose, style) };
  };
  /** people waiting or gone beyond what the camera ever sees are not drawn */
  const near = (a: typeof tk.p1) => a.x.value(t) > -470 && a.x.value(t) < 1360;
  const C1 = fig(tk.c1);
  const C2 = fig(tk.c2);
  const P1 = fig(tk.p1);
  const P2 = fig(tk.p2);
  const P3 = fig(tk.p3);
  const TR = fig(tk.trader);
  const bagAt = (w: readonly [number, number], id: string, seed: number) => growBag(id, { top: [w[0], w[1] + 0.05 * U], u: U, scale: 0.7, sprout: 0, seed }).shapes;
  const sackAt = (c: readonly [number, number], id: string, seed: number) => spawnSack(id, { c: [c[0], c[1]], u: U, w: SACK.w, h: SACK.h, seed }).shapes;
  const backFolk = [...(near(tk.c1) ? [...C1.f.shapes, ...bagAt(C1.so.wrists.R, "bagC1", 3)] : []), ...(near(tk.c2) ? [...C2.f.shapes, ...bagAt(C2.so.wrists.L, "bagC2", 5)] : [])];
  const backSacks = near(tk.p3) ? P3.f.shapes : [];
  const sack3 = near(tk.p3) || near(tk.trader) ? sackAt(tk.sack3.at(t), "sack3", 6) : [];
  const sack1 = near(tk.p1) || near(tk.p2) ? sackAt(tk.sack1.at(t), "sack1", 2) : [];
  const porter2 = near(tk.p2) ? P2.f.shapes : [];
  const trader = near(tk.trader) ? TR.f.shapes : [];
  const porter1 = near(tk.p1) ? P1.f.shapes : [];
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
    shadow("ground.cast", 0, [...f.shapes], "vil.lane", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("contacts.back", 0, [...footContacts("c1", tk.c1, C1.so), ...footContacts("c2", tk.c2, C2.so), ...footContacts("p2", tk.p2, P2.so), ...footContacts("p3", tk.p3, P3.so)]),
    paint("folk.back", 0, backFolk),
    paint("porters.back", 0, backSacks),
    paint("sack3", 0, sack3),
    paint("stack", 0, STACK),
    paint("contacts", 0, [...footContacts("sanjeev", tk.sanjeev, s), ...footContacts("trader", tk.trader, TR.so), ...footContacts("p1", tk.p1, P1.so)]),
    paint("trader", 0, trader),
    paint("actors", 0, f.shapes),
    paint("porter1", 0, porter1),
    paint("porter2", 0, porter2),
    paint("sack1", 0, sack1),
    ...laneNear(),
    ...(jambX < W + 20 ? [paint("jamb", "screen", [shape("jamb/body", "sil", rect(jambX, -120, W + 260, HGT + 240), { form: "flat", ink: 0, paper: false })])] : []),
  ];
  return {
    t,
    view,
    items,
    figures: [
      { name: "sanjeev", actor: tk.sanjeev, fig: f },
      { name: "trader", actor: tk.trader, fig: TR.f },
      { name: "c1", actor: tk.c1, fig: C1.f, head: false },
      { name: "c2", actor: tk.c2, fig: C2.f, head: false },
      { name: "p1", actor: tk.p1, fig: P1.f, head: false },
      { name: "p2", actor: tk.p2, fig: P2.f, head: false },
      { name: "p3", actor: tk.p3, fig: P3.f, head: false },
    ],
  };
}
