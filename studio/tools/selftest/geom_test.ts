// Quick Node check of the outline builders (no browser): node tools/selftest/geom_test.ts
import { ellipse, limb, roundedPoly, spline } from "../../src/engine/geom/outline.ts";
import { area, type Pt } from "../../src/engine/geom/vec.ts";
import { tonesOf } from "../../src/engine/look/color.ts";
import { LOOK_A } from "../../src/engine/look/looks.ts";
import { inkRing, rimRuns } from "../../src/engine/draw/derive.ts";

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name} ${extra}`);
  if (!cond) process.exitCode = 1;
};
const finite = (pts: Pt[]) => pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

const e = ellipse([0, 0], 100, 60);
ok("ellipse clockwise", area(e) > 0, `area ${area(e).toFixed(0)} (pi*a*b = ${(Math.PI * 6000).toFixed(0)})`);

for (const [name, E] of [
  ["bend right", [90, 150]],
  ["bend left", [-90, 150]],
  ["straight", [0, 150]],
  ["sharp", [140, 60]],
] as [string, Pt][]) {
  const L = limb({ S: [0, 0], E, T: [E[0] * 0.2, 300], h0: 40, h1: 32, h2: 22 });
  const whole = L.outline;
  const a = area(whole);
  const up = L.section(0, 0.7);
  const lo = L.section(0.7, 2);
  ok(`limb ${name}`, finite(whole) && whole.length > 8 && Math.abs(a) > 5000, `pts ${whole.length} area ${a.toFixed(0)} inner ${L.inner}`);
  ok(`limb ${name} sections add up`, Math.abs(Math.abs(area(up)) + Math.abs(area(lo)) - Math.abs(a)) < Math.abs(a) * 0.03, `${area(up).toFixed(0)} + ${area(lo).toFixed(0)}`);
}

const rp = roundedPoly([{ p: [0, 0], r: 20 }, { p: [200, 0], r: 20 }, { p: [200, 100], r: 20 }, { p: [0, 100], r: 20 }]);
ok("rounded rect", finite(rp) && Math.abs(area(rp) - (200 * 100 - (4 - Math.PI) * 400)) < 40, `area ${area(rp).toFixed(0)}`);
const sp = spline([[0, 0], [100, -20], [140, 80], [40, 120]], { closed: true });
ok("spline", finite(sp) && sp.length > 20, `pts ${sp.length}`);

const light = { dir: [-0.82, -0.57] as const, key: "#ffd9a0", ambient: "#6a7fa8", strength: 0.85 };
const t = tonesOf("#d9a233", light, LOOK_A.recipe);
console.log("tones of mustard:", t);
const w = tonesOf("#f2ecdf", light, LOOK_A.recipe);
console.log("tones of off-white:", w);
ok("rim runs", rimRuns(e, [-0.82, -0.57], 4).length >= 1);
ok("ink ring", inkRing(e, [-0.82, -0.57], 5, 0.7).outer.length === e.length);
