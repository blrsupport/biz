// Colours that belong to this film alone. A film file may not hold a colour anywhere else (the dry run checks):
// sets, props and people bring their own palettes from src/assets; what is listed here is extra.
import type { Palette } from "../../engine/draw/shape.ts";

export const PALETTE: Palette = {
  "stage.wall": "#b9cbbf",
  "stage.floor": "#857d78",
};
