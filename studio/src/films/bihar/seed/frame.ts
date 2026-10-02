// Bihar Mushroom: sequence "seed". Everything that is drawn at time t, as a display list, back to front.
// The shed's static pieces come from the shed's own frame, so the Carry from `shed` matches it.
import { growBag, hurricaneLamp, lota, spawnBottle, spawnSack } from "../../../assets/props/mushroom.ts";
import { buildCalendar, buildTin } from "../../../assets/props/tin.ts";
import { shedBack, shedFloor, shedTop } from "../../../assets/sets/shed.ts";
import { fade, fill, group, paint, rect, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { capsule } from "../../../engine/geom/outline.ts";
import { add, type Pt } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { BACK_BAGS, CRATES_LEFT, CRATES_RIGHT, DOOR_CLIP, ROPE_SHAPES, STATIC_CONTACTS, footContacts } from "../shed/frame.ts";
import { BACKROW_DEPTH, BOTTLE_DULL, BOTTLE_GOOD, BOTTLE_SCALE, CAL, LAMP_AT, LIE, LOTA_AT, SET, TIERS, TIN_AT } from "../shed/take.ts";
import { SEED, SEED_PALETTE, WALL_DEPTH, seedTake } from "./take.ts";

const { U, GY, W: FW, HGT } = SEED;
const P = SEED_PALETTE;
const OVER = ["wall"];
const flat = { form: "flat", ink: 0, paper: false } as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- static, built once
const CAL_SHAPES = buildCalendar("cal", { ...CAL, flip: 0 });
const TIN = buildTin("tin", { ...TIN_AT, lid: 0, notes: true }).shapes;
const LYING = growBag("bag1_1", { top: LIE, u: U, failed: 1, swing: Math.PI / 2, seed: 6 }).shapes;

/** 0 while a thing stands where it was put, 1 while it is in the hand; a short blend at each end */
const inHand = (t: number, from: number, to: number) => clamp01((t - (from - 0.1)) / 0.12) * clamp01((to + 0.02 - t) / 0.12);
const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

export function seedFrame(t: number, lookId: LookId = "A"): FrameList {
  const style = LOOKS[lookId].people;
  const tk = seedTake();
  const m = tk.marks;
  const view = tk.cam.view(t);
  const n = tk.night.value(t);
  const lit = tk.lamp.value(t);

  // ---- people
  const ss = tk.sanjeev.solve(t);
  const sf = buildFigure(tk.sanjeev.ch, ss.pose, style);
  const farmerIn = t < m.tNo + 2.6;
  const ff = farmerIn ? buildFigure(tk.farmer.ch, tk.farmer.solve(t).pose, style) : null;
  const portersIn = t > m.tBottleBack - 0.6;
  const p1 = portersIn ? buildFigure(tk.porter1.ch, tk.porter1.solve(t).pose, style) : null;
  const p2 = portersIn ? buildFigure(tk.porter2.ch, tk.porter2.solve(t).pose, style) : null;

  // ---- the bags
  const bagShapes: Shape[] = [];
  for (const b of tk.bags) {
    if (b.id === "bag1_1") continue;
    bagShapes.push(...growBag(b.id, { top: [b.x, TIERS[b.tier]], u: U, sprout: b.sprout.value(t), failed: b.failed.value(t), swing: 0.012 * Math.sin(0.8 * t + b.seed), seed: b.seed }).shapes);
  }

  // ---- what is on the bench, or in his hands
  const R = sf.hands.R.hold;
  const L = sf.hands.L.hold;
  const kGood = Math.max(t < m.tSet + 0.1 ? clamp01((m.tSet + 0.02 - t) / 0.12) : 0, inHand(t, m.tGood - 0.5, m.tBottleBack));
  const good = spawnBottle("bottle", { at: lerp(BOTTLE_GOOD, add(R, [0, 0.26 * U]), kGood), u: U, scale: BOTTLE_SCALE });
  const kDull = inHand(t, m.tSeed, m.tDullBack);
  const dull = spawnBottle("bottle.dull", { at: lerp(BOTTLE_DULL, add(L, [0, 0.26 * U]), kDull), u: U, bad: 1, scale: BOTTLE_SCALE, tilt: tk.dullTilt.value(t) });
  const kLota = inHand(t, m.tLota, m.tLotaBack);
  const lt = lota("lota", { at: lerp(LOTA_AT, add(L, [0, 0.16 * U]), kLota), u: U, tilt: tk.lotaTilt.value(t) * kLota });
  const water: Shape[] = [];
  const pour = clamp01((tk.lotaTilt.value(t) - 0.9) / 0.5);
  if (pour > 0.01) {
    for (let i = 0; i < 4; i++) {
      const a = add(lt.lip, [0.05 * U * i, 0.2 * U * i * i * 0.6]);
      const b = add(lt.lip, [0.05 * U * (i + 1), 0.2 * U * (i + 1) * (i + 1) * 0.6]);
      water.push(shape(`water/${i}`, "mush.water", capsule(a, b, 3, 2.4, 2), { ...flat, opacity: 0.75 * pour * (0.8 + 0.2 * Math.sin(18 * t + i)) }));
    }
  }
  const lamp = hurricaneLamp("lamp", { at: LAMP_AT, u: U, lit });

  // ---- the porters' sacks
  const sacks: Shape[] = [];
  tk.throws.forEach((s, i) => {
    const a = s.at(t);
    sacks.push(...spawnSack(`sack${i}`, { c: a.c, u: U, w: 1.15, h: 0.62, tilt: a.tilt, slump: s.slump.value(t), seed: 4 + i }).shapes);
  });

  const ty = tk.type;
  const items: Item[] = [
    ...shedBack(SET, { id: "shed", space: WALL_DEPTH, glow: 1 - 0.8 * n, behind: [paint("backrow", BACKROW_DEPTH, BACK_BAGS)], inner: [paint("cal.back", WALL_DEPTH, CAL_SHAPES.back), paint("cal.page", WALL_DEPTH, CAL_SHAPES.page)] }),
    ...shedFloor(SET, { id: "floor", space: 0, casters: [], groundY: GY + 4 }),
    paint("door", 0, [...SET.doorSolid, ...SET.doorView]),
    fill("door.night", 0, { kind: "solid", color: P["shed.dusk"] }, [SET.opening], { opacity: 0.08 + 0.42 * n }),
    paint("door.frame", 0, SET.doorFrame),
    written("type.fails", WALL_DEPTH, { kind: "phrase", ...ty.fails }, OVER),
    written("type.from", WALL_DEPTH, { kind: "phrase", ...ty.from }, OVER),
    paint("rack", 0, [...SET.rack, ...ROPE_SHAPES, ...bagShapes]),
    paint("contacts", 0, [...STATIC_CONTACTS, ...footContacts("sanjeev", tk.sanjeev, ss)]),
    paint("props", 0, [...CRATES_LEFT, ...CRATES_RIGHT, ...TIN, ...lamp.shapes, ...LYING]),
  ];
  const inDoor: Shape[] = [...(ff ? ff.shapes : []), ...(p2 ? p2.shapes : []), ...(p1 ? p1.shapes : []), ...sacks];
  items.push(group("doorway", 0, [paint("doorway.people", 0, inDoor)], { clip: [DOOR_CLIP] }));
  items.push(
    paint("actor", 0, [...sf.layers.behind, ...good.shapes, ...sf.layers.body, ...dull.shapes, ...lt.shapes, ...water, ...sf.layers.front]),
    ...shedTop(SET, { id: "top", space: WALL_DEPTH }),
    fill("night", "screen", { kind: "linear", x1: 0, y1: 0, x2: 0, y2: HGT, stops: [...fade(P["shed.dusk"], 0.08 + 0.1 * n, 0.08 + 0.34 * n)] }, [rect(-40, -40, FW + 80, HGT + 80)]),
  );
  if (lit > 0.01) items.push(fill("lamp.glow", 0, { kind: "radial", cx: lamp.flame[0], cy: lamp.flame[1], r: 760, stops: fade(P["lamp.glow"], 0.3 * lit, 0) }, [rect(lamp.flame[0] - 760, lamp.flame[1] - 760, 1520, 1520)]));
  const ny = tk.near.value(t);
  if (ny > -1650) items.push(paint("near", "screen", spawnSack("near", { c: [540, ny], u: 1500, w: 1.0, h: 1.6, tilt: 0.03, seed: 9 }).shapes));

  const figures: FrameList["figures"] = [{ name: "sanjeev", actor: tk.sanjeev, fig: sf }];
  if (ff) figures.push({ name: "farmer", actor: tk.farmer, fig: ff, head: false });
  if (p1 && p2) figures.push({ name: "porter1", actor: tk.porter1, fig: p1, head: false }, { name: "porter2", actor: tk.porter2, fig: p2, head: false });
  return { t, view, items, figures };
}
