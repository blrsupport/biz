// Node self-test of the asset library's small pieces: every shape they make is sound, and the helpers that new
// worlds lean on behave. Run: node tools/selftest/assets_test.ts
import { CAST, CAST_PALETTE, headForm } from "../../src/assets/cast/cast.ts";
import { LIGHT_AFTERNOON, LIGHT_MORNING } from "../../src/assets/lights.ts";
import { CRATE_PALETTE, buildCrate } from "../../src/assets/props/crate.ts";
import { brickPatch, chimney, minaret, roofline, ruts, sawtooth, stains, tank } from "../../src/assets/sets/dressing.ts";
import { litParts } from "../../src/engine/draw/derive.ts";
import { mergePalettes, shape, type Shape } from "../../src/engine/draw/shape.ts";
import { buildFigure, stand } from "../../src/engine/figure/body.ts";
import { clipConvex, dense } from "../../src/engine/geom/outline.ts";
import { area, type Pt } from "../../src/engine/geom/vec.ts";
import { contrast, toLch, unlit } from "../../src/engine/look/color.ts";
import { LOOK_A } from "../../src/engine/look/looks.ts";

let bad = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "BAD "} ${msg}`);
  if (!ok) bad++;
};
const sound = (list: readonly Shape[]) => list.every((s) => s.pts.length >= 3 && area(s.pts) > 0 && s.pts.every((p) => Number.isFinite(p[0] + p[1])));
const unique = (list: readonly Shape[]) => new Set(list.map((s) => s.id)).size === list.length;

// ---- set dressing
const U = 172;
const dressing: Shape[] = [
  ...stains("w", "m", { x0: 0, x1: 1400, top: 500, u: U, seed: 3 }),
  ...brickPatch("w/p0", "b", "m", [300, 900], 0.5 * U, 0.36 * U, 4),
  ...ruts("g", "m", { x0: 0, x1: 1400, top: 1440, depth: 500, u: U, seed: 2 }),
  roofline("far", "m", { x0: -100, x1: 1500, base: 500, lo: 28, hi: 90, seed: 7 }),
  sawtooth("mill", "m", 600, 500, 0.42 * U, 0.42 * U, 6),
  ...chimney("ch0", "m", 700, 500, 2.5 * U, 0.26 * U, 1),
  ...chimney("ch1", "m", 900, 500, 2.0 * U, 0.22 * U),
  ...minaret("min", "m", 200, 500, 2.0 * U, 0.19 * U),
  ...tank("tank", "m", 1200, 500, U),
];
check(sound(dressing) && unique(dressing), `set dressing: ${dressing.length} shapes, all sound, ids unique`);
check(chimney("x", "m", 0, 0, 100, 20).length === 2 && chimney("x", "m", 0, 0, 100, 20, 1).length === 7, "a dead chimney has no smoke; a live one has five puffs");

// ---- the sun's patch
const wall: Shape[] = [shape("w/wall", "wall", [[0, 0], [1000, 0], [1000, 600], [0, 600]], { form: "flat" })];
const patch: Pt[] = [[400, -50], [1100, -50], [1100, 700], [200, 700]];
const lit = litParts(wall, patch);
check(lit.length === 1 && lit[0].mat === "wall.sun" && lit[0].id === "w/wall.sun" && area(lit[0].pts) > 0 && area(lit[0].pts) < area(wall[0].pts), "litParts cuts the sunlit part of a flat shape into its .sun material");
check(clipConvex(wall[0].pts, patch.slice().reverse()).length >= 3, "clipConvex takes a clip of either winding");
check(dense([[0, 0], [100, 0], [100, 50], [0, 50]], 10).length >= 28, "dense adds points along long edges");

// ---- colour helpers
const sun = "#e6ae7c";
for (const [name, light] of [["morning", LIGHT_MORNING], ["afternoon", LIGHT_AFTERNOON]] as const) {
  const sh = unlit(sun, light);
  const a = toLch(sun);
  const b = toLch(sh);
  check(b.l < a.l && b.l > 0.6 * a.l && b.c < a.c, `unlit under the ${name} light: ${sun} -> ${sh} (lightness x${(b.l / a.l).toFixed(2)}, chroma x${(b.c / Math.max(a.c, 1e-6)).toFixed(2)}, contrast ${contrast(sun, sh).toFixed(2)}:1)`);
}
let threw = false;
try {
  mergePalettes({ steel: "#9aa3ad" }, { steel: "#707a86" });
} catch {
  threw = true;
}
check(threw && mergePalettes({ a: "#ffffff" }, { a: "#FFFFFF", b: "#000000" }).b === "#000000", "mergePalettes refuses one name with two colours, and merges the rest");

// ---- the cast and the crate
const form = headForm({ wide: 1.05, jaw: 1.06, chin: 1.3 });
check(form.front.length > 6 && form.side.length > 6, "headForm is exported and reshapes the base head");
for (const [name, ch] of Object.entries(CAST)) {
  const shapes = buildFigure(ch, stand(ch, { feet: [0, 0], scale: 100, yaw: 0.9 }), LOOK_A.people).shapes;
  check(sound(shapes) && shapes.every((s) => CAST_PALETTE[s.mat]), `${name}: ${shapes.length} shapes, all sound, every material in the cast's palette`);
}
const crate = buildCrate("crate", [0, 0], 200, 150);
check(sound(crate) && crate.every((s) => CRATE_PALETTE[s.mat]), "the crate is sound and has its palette");

console.log(bad ? `FAILED (${bad})` : "PASSED");
process.exitCode = bad ? 1 : 0;
