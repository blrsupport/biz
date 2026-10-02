// Node self-test of the motion core: continuity of tracks, a planned walk with planted feet, pelvis smoothness.
// Run: node tools/selftest/motion_test.ts
import { RAHUL } from "../../src/assets/cast/cast.ts";
import { buildFigure } from "../../src/engine/figure/body.ts";
import { jointAngle } from "../../src/engine/figure/ik.ts";
import { footShape } from "../../src/engine/figure/limbs.ts";
import { LOOKS } from "../../src/engine/look/looks.ts";
import { Actor } from "../../src/engine/motion/actor.ts";
import { Path2, Track, WEIGHT } from "../../src/engine/motion/track.ts";

let bad = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "BAD "} ${msg}`);
  if (!ok) bad++;
};

// ---- a track: move, interrupt it half-way, check that speed never jumps
{
  const tr = new Track(0);
  tr.to(100, { at: 1.0, dur: 0.5, w: WEIGHT.hand });
  tr.to(-40, { at: 1.5, dur: 0.6, w: WEIGHT.hand });
  let maxJump = 0;
  let peak = 0;
  let prevV = tr.state(0).v;
  let hi = -1e9;
  for (let t = 0; t <= 3; t += 1 / 240) {
    const s = tr.state(t);
    maxJump = Math.max(maxJump, Math.abs(s.v - prevV));
    peak = Math.max(peak, Math.abs(s.v));
    prevV = s.v;
    hi = Math.max(hi, s.x);
  }
  check(maxJump < peak * 0.12, `track: largest speed change in 1/240 s is ${((maxJump / peak) * 100).toFixed(1)} % of peak speed (a jump would be near 100 %)`);
  check(Math.abs(tr.value(3) + 40) < 0.05, `track settles on target (${tr.value(3).toFixed(3)})`);
  const one = new Track(0).to(100, { at: 1, dur: 0.5, w: WEIGHT.hand });
  let top = 0;
  for (let t = 0; t <= 3; t += 1 / 240) top = Math.max(top, one.value(t));
  check(Math.abs(top - 106) < 0.6, `hand overshoot peaks at ${top.toFixed(2)} (asked for 6 %)`);
  let low = 0;
  for (let t = 0; t <= 1; t += 1 / 240) low = Math.min(low, one.value(t));
  check(low < -6 && low > -9.5, `wind-up goes back to ${low.toFixed(2)} (asked for 8 %)`);
}

// ---- a path: bow and speed continuity
{
  const p = new Path2([0, 0]);
  p.to([100, 0], { at: 1, dur: 0.5, w: WEIGHT.hand, pivot: [50, 200] });
  let bow = 0;
  for (let t = 0.3; t <= 1; t += 1 / 240) bow = Math.max(bow, -p.value(t)[1]);
  check(bow > 6 && bow < 40, `path bows ${bow.toFixed(1)} px on a 100 px move, away from the pivot`);
}

// ---- a walk
{
  const a = new Actor({ ch: RAHUL, scale: 100, groundY: 1000, x: 200, yaw: 1.2, seed: 3, life: 0 });
  const w = a.walkTo(1100, { start: 0.5 });
  console.log(`     walk ${w.start.toFixed(2)} -> ${w.arrive.toFixed(2)} s, ${w.steps} steps`);
  for (const k of ["L", "R"] as const) console.log(`     ${k}: ` + a.feet[k].plants.map((p) => `${p.x.toFixed(0)}@${Number.isFinite(p.t0) ? p.t0.toFixed(2) : "-"}..${Number.isFinite(p.t1) ? p.t1.toFixed(2) : ""}`).join("  "));
  let slide = 0;
  let maxAy = 0;
  let minKnee = 180;
  let both = 0;
  let none = 0;
  let n = 0;
  const dt = 1 / 120;
  let prev: { y: number; vy: number } | null = null;
  const last: Record<string, { toe: number; planted: boolean; plant: number }> = {};
  for (let t = 0; t <= w.arrive + 1; t += dt) {
    const s = a.solve(t);
    n++;
    const pl = (s.feet.L.planted ? 1 : 0) + (s.feet.R.planted ? 1 : 0);
    if (pl === 2) both++;
    if (pl === 0) none++;
    for (const k of ["L", "R"] as const) {
      const f = s.feet[k];
      const plant = a.feet[k].plantAt(t).x;
      // the toe tip is the point that must not move while the foot is on the ground and the heel is rising
      const fs = footShape(a.ch.build.foot * a.H, s.pose[k === "L" ? "legL" : "legR"].face ?? 1);
      const toe = f.x + (fs.toe * Math.cos(f.pitch) - a.gait.ankle * Math.sin(f.pitch)) * fs.sgn;
      const q = last[k];
      if (q && q.planted && f.planted && q.plant === plant && f.pitch >= 0) slide = Math.max(slide, Math.abs(toe - q.toe));
      last[k] = { toe, planted: f.planted, plant };
    }
    const y = s.pose.at[1];
    if (prev) {
      const vy: number = (y - prev.y) / dt;
      maxAy = Math.max(maxAy, Math.abs(vy - prev.vy) / dt);
      prev = { y, vy };
    } else prev = { y, vy: 0 };
    const fig = buildFigure(a.ch, s.pose, LOOKS.A.people);
    for (const k of ["L", "R"] as const) {
      const hip = k === "L" ? fig.joints.hipL : fig.joints.hipR;
      minKnee = Math.min(minKnee, jointAngle(hip, fig.legs[k].knee, fig.legs[k].ankle));
    }
  }
  check(slide < 0.6, `planted toe moves at most ${slide.toFixed(3)} px between samples`);
  check(none === 0, `never airborne (${none} samples with no foot down)`);
  console.log(`     both feet down ${((both / n) * 100).toFixed(0)} % of the time; sharpest knee ${minKnee.toFixed(0)} deg; peak pelvis acceleration ${(maxAy / 100).toFixed(1)} head-heights/s^2`);
  const ys: number[] = [];
  for (let t = w.start; t <= w.arrive; t += 1 / 60) ys.push(a.solve(t).pose.at[1]);
  console.log(`     pelvis bob ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} px at 100 px per head`);
}
process.exitCode = bad ? 1 : 0;
