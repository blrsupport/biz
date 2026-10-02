// Bihar Mushroom: sequence "lab". Everything that is drawn at time t, as a display list, back to front.
import { bottleRack, spawnSack, steamDrum } from "../../../assets/props/mushroom.ts";
import { shedBack, shedFloor, shedJamb, shedTop } from "../../../assets/sets/shed.ts";
import { group, paint, type as written, type FrameList, type Item } from "../../../engine/draw/list.ts";
import type { Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { area } from "../../../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { DOOR_CLIP, footContacts } from "../shed/frame.ts";
import { DRUM_AT, LAB, RACKS, SET, WALL_DEPTH, labTake } from "./take.ts";

const { U, GY, W: FW, HGT } = LAB;
const OVER = ["wall"];
const RACK_SHAPES: Shape[] = RACKS.flatMap((x, i) => bottleRack(`rack${i}`, { x, ground: GY - 0.1 * U, u: U, seed: 5 + i }).shapes);
const big = (shapes: readonly Shape[], min = 420) => shapes.filter((s) => Math.abs(area(s.pts)) > min);

export function labFrame(t: number, lookId: LookId = "A"): FrameList {
  const style = LOOKS[lookId].people;
  const tk = labTake();
  const view = tk.cam.view(t);
  const ss = tk.sanjeev.solve(t);
  const sf = buildFigure(tk.sanjeev.ch, ss.pose, style);
  const ff1 = buildFigure(tk.f1.ch, tk.f1.solve(t).pose, style);
  const ff2 = buildFigure(tk.f2.ch, tk.f2.solve(t).pose, style);
  const drum = steamDrum("drum", { at: DRUM_AT, u: U, lid: 0, steam: 0.8, phase: t });
  const ty = tk.type;

  const items: Item[] = [
    ...shedBack(SET, { id: "lab", space: WALL_DEPTH }),
    ...shedFloor(SET, { id: "floor", space: 0, casters: big(sf.shapes), groundY: GY + 4 }),
    paint("door", 0, [...SET.doorSolid, ...SET.doorView]),
    group("doorway", 0, [paint("doorway.people", 0, [...ff2.shapes, ...ff1.shapes])], { clip: [DOOR_CLIP] }),
    paint("door.frame", 0, SET.doorFrame),
    written("type.sabri", WALL_DEPTH, { kind: "phrase", ...ty.sabri }, OVER),
    written("type.families", WALL_DEPTH, { kind: "phrase", ...ty.families }, OVER),
    paint("racks", 0, RACK_SHAPES),
    paint("drum", 0, drum.shapes),
    paint("contacts", 0, footContacts("sanjeev", tk.sanjeev, ss)),
    paint("actor", 0, sf.shapes),
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
    ],
  };
}
