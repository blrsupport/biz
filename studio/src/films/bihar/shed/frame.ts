// Bihar Mushroom: sequence "shed". Everything that is drawn at time t, as a display list, back to front.
// The generic view paints this list and the dry run checks it, so what is checked is what is drawn.
import { paint, rect, shadow, type FrameList, type Item } from "../../../engine/draw/list.ts";
import { shape, type Shape } from "../../../engine/draw/shape.ts";
import { buildFigure } from "../../../engine/figure/body.ts";
import { LOOKS, type LookId } from "../../../engine/look/looks.ts";
import { SHED, WALL_DEPTH, shedTake } from "./take.ts";

const { U, GY } = SHED;
const JUNCTION = GY - 0.36 * U;
const flat = { form: "flat", ink: 0, paper: false } as const;
// static geometry is built once, not every frame
const WALL: Shape[] = [shape("stage/wall", "stage.wall", rect(-700, -500, 2480, JUNCTION + 700), flat)];
const FLOOR: Shape[] = [shape("stage/floor", "stage.floor", rect(-700, JUNCTION, 2480, 1400), flat)];

export function shedFrame(t: number, lookId: LookId = "A"): FrameList {
  const tk = shedTake();
  const view = tk.cam.view(t);
  const fig = buildFigure(tk.who.ch, tk.who.solve(t).pose, LOOKS[lookId].people);
  const items: Item[] = [
    paint("wall", WALL_DEPTH, WALL),
    paint("floor", 0, FLOOR),
    // a cast shadow is the floor itself, unlit, laid down away from the light
    shadow("cast", 0, fig.shapes, "stage.floor", { ground: { y: GY, stretch: 0.4, drop: 0.26 } }),
    paint("actor", 0, fig.shapes),
  ];
  return { t, view, items, figures: [{ name: "who", actor: tk.who, fig }] };
}
