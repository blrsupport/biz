// Bihar Mushroom: sequence "lab". Everything that is drawn at time t, as a display list, back to front.
import { bottleRack, growBag, spawnBottle, spawnSack, steamDrum } from "../../../assets/props/mushroom.ts";
import { shedBack, shedFloor, shedJamb, shedTop } from "../../../assets/sets/shed.ts";
import { group, paint, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import type { Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { area } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { DOOR_CLIP, footContacts } from "../shed/frame.ts";
import { BAG_SC, DRUM_AT, LAB, RACKS, SET, SHELF, SLOT_PUT, SLOT_TAKE, WALL_DEPTH, labTake } from "./take.ts";

const { U, GY, W: FW, HGT } = LAB;
const OVER = ["wall"];
const RACK_SHAPES: Shape[] = RACKS.flatMap(
  (x, i) => bottleRack(`rack${i}`, { x, ground: GY - 0.1 * U, u: U, seed: 5 + i, filled: (k, j) => i !== 0 || k !== SHELF || (j !== SLOT_PUT && j !== SLOT_TAKE) }).shapes,
);
const big = (shapes: readonly Shape[], min = 420) => shapes.filter((s) => Math.abs(area(s.pts)) > min);

export function labFrame(t: number, lookId: LookId = "A"): FrameList {
  const style = LOOKS[lookId].people;
  const tk = labTake();
  const view = tk.cam.view(t);
  const ss = tk.sanjeev.solve(t);
  const sf = buildFigure(tk.sanjeev.ch, ss.pose, style);
  const ff1 = buildFigure(tk.f1.ch, tk.f1.solve(t).pose, style);
  const ff2 = buildFigure(tk.f2.ch, tk.f2.solve(t).pose, style);
  const ff3 = buildFigure(tk.f3.ch, tk.f3.solve(t).pose, style);
  const drum = steamDrum("drum", { at: DRUM_AT, u: U, lid: tk.lid.value(t), steam: tk.steam.value(t), phase: t });
  const b1 = spawnBottle("bottle", { at: tk.bottle.at(t), u: U, scale: 0.78 }).shapes;
  const b2 = spawnBottle("bottle2", { at: tk.bottle2.at(t), u: U, scale: 0.78 }).shapes;
  const bag = growBag("bag", { top: [tk.bag.at(t)[0], tk.bag.at(t)[1] - 1.06 * U * BAG_SC], u: U, scale: BAG_SC, myc: 0.85, seed: 6 }).shapes;
  const inDrum = t < tk.marks.tIn + 0.25;
  const m = tk.marks;
  /** the bottles stand behind him when they are on the rack, in front of him when he carries them */
  const b1Front = !inDrum && t < m.tPut + 0.25;
  const b2Front = t > m.tTake + 0.1;
  const ty = tk.type;

  const items: Item[] = [
    ...shedBack(SET, { id: "lab", space: WALL_DEPTH }),
    ...shedFloor(SET, { id: "floor", space: 0, casters: big(sf.shapes), groundY: GY + 4 }),
    paint("door", 0, [...SET.doorSolid, ...SET.doorView]),
    group("doorway", 0, [paint("doorway.people", 0, [...ff3.shapes, ...ff2.shapes, ...ff1.shapes])], { clip: [DOOR_CLIP] }),
    paint("door.frame", 0, SET.doorFrame),
    written("type.sabri", "screen", { kind: "phrase", ...ty.sabri }, OVER),
    written("type.families", "screen", { kind: "phrase", ...ty.families }, OVER),
    paint("racks", 0, RACK_SHAPES),
    ...(inDrum || !b1Front ? [paint("bottle", 0, b1)] : []),
    ...(b2Front ? [] : [paint("bottle2", 0, b2)]),
    paint("drum", 0, drum.shapes),
    paint("contacts", 0, footContacts("sanjeev", tk.sanjeev, ss)),
    paint("bag", 0, bag),
    paint("actor", 0, sf.shapes),
    ...(b1Front ? [paint("bottle", 0, b1)] : []),
    ...(b2Front ? [paint("bottle2", 0, b2)] : []),
    ...shedTop(SET, { id: "top", space: WALL_DEPTH }),
  ];
  const ny = tk.near.value(t);
  if (ny > -1650) items.push(paint("near", "screen", spawnSack("near", { c: [540, ny], u: 1500, w: 1.0, h: 1.6, tilt: 0.03, seed: 9 }).shapes));
  const jx = tk.jamb.value(t);
  if (jx > -130) items.push(paint("jamb", "screen", shedJamb("jamb", jx, -1, FW, HGT, U)));

  return {
    t,
    view,
    items,
    figures: [
      { name: "sanjeev", actor: tk.sanjeev, fig: sf },
      { name: "f1", actor: tk.f1, fig: ff1, head: false },
      { name: "f2", actor: tk.f2, fig: ff2, head: false },
      { name: "f3", actor: tk.f3, fig: ff3, head: false },
    ],
  };
}
