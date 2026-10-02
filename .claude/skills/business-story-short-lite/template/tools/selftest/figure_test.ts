// Node self-test of the figure: builds every character at many yaws and looks for broken geometry.
// Run: node tools/selftest/figure_test.ts
import { CAST } from "../../src/assets/cast/cast.ts";
import { buildFigure, figureHeight, stand } from "../../src/engine/figure/body.ts";
import { area, bounds, DEG } from "../../src/engine/geom/vec.ts";
import { LOOKS } from "../../src/engine/look/looks.ts";

let bad = 0;
const t0 = performance.now();
let built = 0;
for (const look of ["A", "B", "C"] as const) {
  for (const ch of Object.values(CAST)) {
    for (let deg = -100; deg <= 100; deg += 10) {
      const fig = buildFigure(ch, stand(ch, { feet: [500, 1000], scale: 100, yaw: deg * DEG }), LOOKS[look].people);
      built++;
      for (const s of fig.shapes) {
        const a = area(s.pts);
        const b = bounds(s.pts);
        const nan = s.pts.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]));
        const huge = b.x1 - b.x0 > 900 || b.y1 - b.y0 > 900;
        if (nan || s.pts.length < 3 || a <= 0 || huge) {
          bad++;
          if (bad < 25) console.log(`BAD ${look} ${s.id} yaw ${deg}: pts ${s.pts.length} area ${a.toFixed(1)} nan ${nan} size ${(b.x1 - b.x0).toFixed(0)}x${(b.y1 - b.y0).toFixed(0)}`);
        }
      }
    }
    if (look === "A") console.log(`ok   ${ch.id}: ${figureHeight(ch.build).toFixed(2)} heads`);
  }
}
const ms = (performance.now() - t0) / built;
console.log(`${built} figures built, ${ms.toFixed(2)} ms each, ${bad} bad shapes`);
process.exitCode = bad ? 1 : 0;
