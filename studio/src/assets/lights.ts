// The lights of the worlds built so far. A light is one direction, a key colour and an ambient colour;
// every shade, rim and cast shadow in a sequence is computed from it, so a world has exactly one of these
// (or a few named ones when part of it is lit by something else, like a furnace).
import { unit } from "../engine/geom/vec.ts";
import type { SceneLight } from "../engine/look/color.ts";

/** Low morning sun through a doorway at frame left: warm key, cool shade. */
export const LIGHT_MORNING: SceneLight = { dir: unit([-0.82, -0.57]), key: "#ffd9a0", ambient: "#6a7fa8", strength: 0.85, rim: 1 };

/** Late afternoon sun, low at frame left: a deeper, more orange key and long shadows. */
export const LIGHT_AFTERNOON: SceneLight = { dir: unit([-0.88, -0.47]), key: "#ffc474", ambient: "#5c6da0", strength: 0.92, rim: 1 };
