// The dry run: builds every frame of a sequence exactly as the view will draw it and checks it, with no browser.
// It inspects the display list itself, so what is checked is what is drawn. Run it with: node tools/check.ts <film>
import { flatItems, type Space } from "../draw/list.ts";
import type { Shape } from "../draw/shape.ts";
import { jointAngle } from "../figure/ik.ts";
import { drawnUntil, type Cue, type Film, type Sequence } from "../film.ts";
import { area, dist, type Box, type Pt } from "../geom/vec.ts";
import { contrast, rgbToHex, tonesOf } from "../look/color.ts";
import { LOOKS } from "../look/looks.ts";
import { layerTransform, type View } from "../stage/camera.ts";
import { measure } from "../type/blockspec.ts";
import { LIMITS } from "./limits.ts";
import { sampleBehind } from "./sample.ts";

export interface CheckOpts {
  /** list every appearance, disappearance and jump, not only the first few */
  pops?: boolean;
  /** print where the camera is and what it frames, twice a second */
  cam?: boolean;
  log?: (line: string) => void;
}

export interface SeqResult {
  fails: string[];
  warns: string[];
  frames: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tokensOf = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);
const HEX = /^#[0-9a-f]{6}$/i;
const badPts = (pts: readonly Pt[]) => pts.length < 3 || pts.some((p) => !Number.isFinite(p[0] + p[1]));
const gapOf = (a: Box, b: Box) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
const sec = (t: number) => t.toFixed(2);

/** The stretch of film time in which a sequence is drawn, as frames. */
export function framesOf(film: Film, seq: Sequence): { f0: number; f1: number; until: number } {
  const i = film.sequences.indexOf(seq);
  const until = Math.min(seq.end, drawnUntil(film, i), film.duration);
  return { f0: Math.ceil(seq.t0 * film.fps - 1e-6), f1: Math.ceil(until * film.fps - 1e-6) - 1, until };
}

/** Where the narrator says `text`: one window of time per occurrence, or none when the words are not in the voice. */
function spoken(film: Film, text: string): [number, number][] {
  const toks = tokensOf(text);
  const out: [number, number][] = [];
  if (!toks.length) return out;
  const W = film.words;
  for (let i = 0; i + toks.length <= W.length; i++) {
    let ok = true;
    for (let k = 0; k < toks.length; k++) {
      if (W[i + k].n !== toks[k]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push([W[i].t0, W[i + toks.length - 1].t1]);
  }
  return out;
}

interface Seen {
  box: Box;
  c: Pt;
  o: number;
}

interface PartStat {
  item: string;
  name: string;
  text: string;
  role: string;
  at: number;
  out?: number;
  minCap: number;
  ext: Box;
  outside: number;
  head: { gap: number; at: number; who: string };
  contrast: { v: number; at: number; pair: string };
  /** the same, measured against what the display list really draws behind it */
  seen: { v: number; at: number; pair: string; top: string };
  /** the largest contrast between two points of what lies behind it: 1 is one calm surface */
  ground: { v: number; at: number; tops: string };
  frames: number;
}

export function checkSequence(film: Film, seq: Sequence, o: CheckOpts = {}): SeqResult {
  const log = o.log ?? console.log;
  const fails: string[] = [];
  const warns: string[] = [];
  const fail = (m: string) => {
    fails.push(`${seq.id}: ${m}`);
    log(`  !! ${m}`);
  };
  const warn = (m: string) => {
    warns.push(`${seq.id}: ${m}`);
    log(`  ?  ${m}`);
  };
  const { fps, width: FW, height: FH } = film;
  const FRAME = { width: FW, height: FH };
  const REF = { cx: FW / 2, cy: FH / 2 };
  const look = LOOKS[film.look];
  const T = film.type;
  const SAFE = LIMITS.safe;
  const { f0, f1, until } = framesOf(film, seq);
  const mapper = (view: View, space: Space) => {
    if (space === "screen") return { f: (p: Pt): Pt => p, s: 1 };
    const l = layerTransform(view, FRAME, space, REF);
    return { f: (p: Pt): Pt => [l.tx + p[0] * l.s, l.ty + p[1] * l.s], s: l.s };
  };
  const boxOf = (pts: readonly Pt[], f: (p: Pt) => Pt): Box => {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of pts) {
      const q = f(p);
      if (q[0] < b.x0) b.x0 = q[0];
      if (q[0] > b.x1) b.x1 = q[0];
      if (q[1] < b.y0) b.y0 = q[1];
      if (q[1] > b.y1) b.y1 = q[1];
    }
    return b;
  };
  const inFrame = (b: Box) => b.x1 > 0 && b.x0 < FW && b.y1 > 0 && b.y0 < FH;
  const atEdge = (b: Box) => b.x0 <= 6 || b.x1 >= FW - 6 || b.y0 <= 6 || b.y1 >= FH - 6;
  const visible = (b: Box) => Math.max(0, Math.min(b.x1, FW) - Math.max(b.x0, 0)) * Math.max(0, Math.min(b.y1, FH) - Math.max(b.y0, 0));
  const allowed = (id: string) => seq.allow?.find((a) => a.id.test(id));

  /** covers the frame from its first frame, after another sequence: a cut, with nothing carried across */
  const cutsIn = film.sequences.indexOf(seq) > 0 && seq.tFull < seq.t0 + 0.5 / fps;

  log(`---- ${film.id}/${seq.id}: ${sec(seq.t0)}-${sec(until)} s (covers the frame from ${sec(seq.tFull)} s)`);
  log("marks " + Object.entries(seq.marks).map(([k, v]) => `${k} ${v.toFixed(2)}`).join("  "));

  let bad = 0;
  const missing = new Set<string>();
  const dupes = new Set<string>();
  const worst = { paths: 0, pathsAt: 0, shapes: 0, shapesAt: 0 };
  const parts = new Map<string, PartStat>();
  const noOver = new Set<string>();
  const joints = new Map<string, { elbow: number; elbowAt: string; knee: number; kneeAt: string; stretch: number; stretchAt: string; pin: number; pinAt: string; slip: number; slipAt: string }>();
  const subject = { min: Infinity, at: 0, frames: 0 };
  /** how much each figure acts while it is in view: frames seen, frames in which something of it moves, and the longest spell of breath alone */
  const acting = new Map<string, { seen: number; moving: number; idle: number; idleFrom: number; worst: number; worstFrom: number; last?: { p: Pt; l: Pt; r: Pt; h: Pt } }>();
  const pops: string[] = [];
  const jumps: string[] = [];
  const allowedHits = new Map<string, number>();
  let prev = new Map<string, Seen>();
  let prevFeet = new Map<string, { L: number | null; R: number | null }>();
  const t0 = performance.now();

  const shapeOk = (s: Shape, t: number, where: string) => {
    if (badPts(s.pts) || !(area(s.pts) > 0)) {
      bad++;
      if (bad < 9) log(`  bad shape ${s.id} in ${where} at ${sec(t)} s (${s.pts.length} points, area ${badPts(s.pts) ? "?" : area(s.pts).toFixed(1)})`);
      return false;
    }
    if (s.color ? !HEX.test(s.color) : !seq.palette[s.mat]) missing.add(s.color ? `colour ${s.color}` : s.mat);
    return true;
  };
  const lightOf = (name?: string) => {
    const l = seq.lights[name ?? seq.light];
    if (!l) missing.add(`light ${name ?? seq.light}`);
    return l ?? seq.lights[Object.keys(seq.lights)[0]];
  };

  for (let fr = f0; fr <= f1; fr++) {
    const t = fr / fps;
    const list = seq.frame(t, film.look);
    const now = new Map<string, Seen>();
    let paths = 0;
    let shapes = 0;

    // which shapes belong to a figure: a figure appears, moves and leaves as one thing
    const owner = new Map<string, string>();
    for (const g of list.figures ?? []) for (const s of g.fig.shapes) owner.set(s.id, g.name);
    const unit = (key: string, b: Box, op: number) => {
      const u = now.get(key);
      if (!u) now.set(key, { box: { ...b }, c: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], o: op });
      else {
        u.box = { x0: Math.min(u.box.x0, b.x0), y0: Math.min(u.box.y0, b.y0), x1: Math.max(u.box.x1, b.x1), y1: Math.max(u.box.y1, b.y1) };
        u.c = [(u.box.x0 + u.box.x1) / 2, (u.box.y0 + u.box.y1) / 2];
        u.o = Math.max(u.o, op);
      }
    };

    for (const { item: it, opacity, space } of flatItems(list.items)) {
      const m = mapper(list.view, space);
      if (it.kind === "paint") {
        const light = lightOf(it.light);
        const ids = new Set<string>();
        for (const s of it.shapes) {
          shapes++;
          if (!shapeOk(s, t, it.id)) continue;
          if (ids.has(s.id)) dupes.add(`${it.id}: ${s.id}`);
          ids.add(s.id);
          const form = s.form ?? "round";
          const rim = form === "round" && look.rim * (s.rim ?? 1) * (light.rim ?? 0.6) > 0.2 ? 1 : 0;
          paths += form === "flat" || (form === "plane" && !s.casts?.length) ? 1 : 2 + (form === "round" ? 1 : 0) + (s.casts?.length ?? 0) + rim;
          const b = boxOf(s.pts, m.f);
          const fig = owner.get(s.id);
          unit(fig ? `figure ${fig}` : `${it.id}|${s.id}`, b, opacity * (s.opacity ?? 1));
        }
      } else if (it.kind === "fill") {
        for (const p of it.paths) {
          if (badPts(p) || Math.abs(area(p)) <= 0) {
            bad++;
            if (bad < 9) log(`  bad path in ${it.id} at ${sec(t)} s`);
          }
        }
        const f = it.fill;
        paths += f.kind === "ribs" ? 3 : f.kind === "radial" && f.box ? it.paths.length : 1;
        if (f.kind === "ribs" && !seq.palette[f.mat]) missing.add(f.mat);
        if (f.kind === "solid" && !HEX.test(f.color)) missing.add(`colour ${f.color}`);
        if (f.kind === "linear" || f.kind === "radial") {
          f.stops.forEach((st, i) => {
            if (!Number.isFinite(st.at + st.a) || st.at < -1e-6 || st.at > 1 + 1e-6 || (i > 0 && st.at < f.stops[i - 1].at - 1e-9)) fail(`gradient ${it.id} has a bad stop at ${sec(t)} s`);
            if (st.tone ? !seq.palette[st.tone.mat] : !HEX.test(st.color)) missing.add(st.tone ? st.tone.mat : `colour ${st.color}`);
          });
        }
      } else if (it.kind === "shadow") {
        if (!seq.palette[it.on]) missing.add(it.on);
        lightOf(it.light);
        paths += it.casters.length;
      } else if (it.kind === "type") {
        const heads: { who: string; box: Box }[] = [];
        for (const g of list.figures ?? []) {
          if (g.head === false) continue;
          const hm = mapper(list.view, g.space ?? 0);
          let hb: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
          for (const s of g.fig.head.shapes) {
            const b = boxOf(s.pts, hm.f);
            hb = { x0: Math.min(hb.x0, b.x0), y0: Math.min(hb.y0, b.y0), x1: Math.max(hb.x1, b.x1), y1: Math.max(hb.y1, b.y1) };
          }
          heads.push({ who: g.name, box: hb });
        }
        const colours = (list: string[] | undefined) => {
          const out: string[] = [];
          for (const c of list ?? []) {
            if (HEX.test(c)) out.push(c);
            else if (seq.palette[c]) out.push(tonesOf(seq.palette[c], lightOf(), look.recipe).base);
            else missing.add(c);
          }
          return out;
        };
        const behind = colours(it.over);
        const behindLabel = it.overLabel ? colours(it.overLabel) : behind;
        const measured = measure(it.block, T);
        const upNow: { st: PartStat; sb: Box; col: string }[] = [];
        const mainAt = Math.min(...measured.filter((p) => p.role === "number" || p.role === "words").map((p) => p.at));
        for (const p of measured) {
          const key = `${it.id}/${p.name}`;
          let st = parts.get(key);
          if (!st) {
            st = { item: it.id, name: p.name, text: p.text, role: p.role, at: p.at, out: p.out, minCap: Infinity, ext: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, outside: 0, head: { gap: Infinity, at: 0, who: "" }, contrast: { v: Infinity, at: 0, pair: "" }, seen: { v: Infinity, at: 0, pair: "", top: "" }, ground: { v: 1, at: 0, tops: "" }, frames: 0 };
            parts.set(key, st);
          }
          if (p.role === "world") continue;
          const a = m.f([p.box.x0, p.box.y0]);
          const z = m.f([p.box.x1, p.box.y1]);
          const sb: Box = { x0: a[0], y0: a[1], x1: z[0], y1: z[1] };
          // (a label may be carried into frame by the camera ahead of the amount or name it leads in)
          const from = p.role === "label" && Number.isFinite(mainAt) ? Math.max(p.at, mainAt) : p.at;
          const up = t >= from - 1e-6 && (p.out === undefined || t <= p.out + 1e-6);
          if (up) {
            st.frames++;
            st.minCap = Math.min(st.minCap, p.cap * m.s);
            st.ext = { x0: Math.min(st.ext.x0, sb.x0), y0: Math.min(st.ext.y0, sb.y0), x1: Math.max(st.ext.x1, sb.x1), y1: Math.max(st.ext.y1, sb.y1) };
            // (the safe zone is for type that is being read; a piece that is being covered is already leaving)
            if (!p.leaving && (sb.x0 < SAFE.x0 - 1 || sb.x1 > SAFE.x1 + 1 || sb.y0 < SAFE.y0 - 1 || sb.y1 > SAFE.y1 + 1)) st.outside++;
            const col = p.color === "ink" ? T.ink : p.color === "accent" ? T.accent : p.color;
            for (const c of p.role === "label" ? behindLabel : behind) {
              const v = contrast(col, c);
              if (v < st.contrast.v) st.contrast = { v, at: t, pair: `${col} on ${c}` };
            }
            if (!it.over) noOver.add(it.id);
            // (measured once it has landed and while it is being read, every second frame)
            if (!p.leaving && t >= from + 0.2 && (fr - f0) % 2 === 0) upNow.push({ st, sb, col });
          }
          // it is on its way in a moment before it lands, and on its way out a moment after
          if (t >= p.at - 0.1 && (p.out === undefined || t <= p.out + 0.12)) {
            for (const h of heads) {
              const g = gapOf(sb, h.box);
              if (g < st.head.gap) st.head = { gap: g, at: t, who: h.who };
            }
          }
        }
        if (upNow.length) {
          // what is really behind each piece: nine points of its box, read from the items drawn before it
          const pts: Pt[] = [];
          for (const u of upNow) for (const fy of [0.15, 0.5, 0.85]) for (const fx of [0.08, 0.5, 0.92]) pts.push([u.sb.x0 + (u.sb.x1 - u.sb.x0) * fx, u.sb.y0 + (u.sb.y1 - u.sb.y0) * fy]);
          const got = sampleBehind(list, it.id, pts, { palette: seq.palette, lights: seq.lights, light: seq.light, recipe: look.recipe, background: seq.background, frame: FRAME });
          upNow.forEach((u, k) => {
            const mine = got.slice(k * 9, k * 9 + 9).map((g) => ({ hex: rgbToHex(g.rgb[0], g.rgb[1], g.rgb[2]), top: g.top }));
            for (const g of mine) {
              const v = contrast(u.col, g.hex);
              if (v < u.st.seen.v) u.st.seen = { v, at: t, pair: `${u.col} on ${g.hex}`, top: g.top };
            }
            for (const a of mine) for (const b of mine) {
              const v = contrast(a.hex, b.hex);
              if (v > u.st.ground.v) u.st.ground = { v, at: t, tops: a.top === b.top ? a.top : `${a.top} and ${b.top}` };
            }
          });
        }
      }
    }
    if (paths > worst.paths) (worst.paths = paths), (worst.pathsAt = t);
    if (shapes > worst.shapes) (worst.shapes = shapes), (worst.shapesAt = t);

    // figures: joints, stretch, pinned hands, planted feet, and how large the largest of them is
    let tallest = 0;
    const feetNow = new Map<string, { L: number | null; R: number | null }>();
    for (const g of list.figures ?? []) {
      const w = joints.get(g.name) ?? { elbow: 180, elbowAt: "", knee: 180, kneeAt: "", stretch: 0, stretchAt: "", pin: 0, pinAt: "", slip: 0, slipAt: "" };
      joints.set(g.name, w);
      const fig = g.fig;
      const solved = g.actor?.solve(t);
      const feet = { L: null as number | null, R: null as number | null };
      for (const k of ["L", "R"] as const) {
        const sh = k === "L" ? fig.joints.shoulderL : fig.joints.shoulderR;
        const hip = k === "L" ? fig.joints.hipL : fig.joints.hipR;
        const el = jointAngle(sh, fig.arms[k].elbow, fig.arms[k].wrist);
        const kn = jointAngle(hip, fig.legs[k].knee, fig.legs[k].ankle);
        if (el < w.elbow) (w.elbow = el), (w.elbowAt = `${k} ${sec(t)}`);
        if (kn < w.knee) (w.knee = kn), (w.kneeAt = `${k} ${sec(t)}`);
        for (const [what, v] of [["arm", fig.arms[k].reach.stretch], ["leg", fig.legs[k].reach.stretch]] as const) if (v > w.stretch + 1e-4) (w.stretch = v), (w.stretchAt = `${what}${k} ${sec(t)}`);
        if (g.actor) {
          const pin = g.actor.arms[k].pin.value(t);
          const p = g.actor.arms[k].pinPoint(t);
          if (pin > 0.999 && p) {
            const off = dist(fig.arms[k].wrist, p);
            if (off > w.pin) (w.pin = off), (w.pinAt = `${k} ${sec(t)}`);
          }
          const ft = solved?.feet[k];
          if (ft && ft.planted && Math.abs(ft.pitch) < 0.01 && ft.lift < 0.5) {
            feet[k] = fig.legs[k].ankle[0];
            const was = prevFeet.get(g.name)?.[k];
            if (was !== null && was !== undefined) {
              const d = Math.abs(feet[k]! - was);
              // (a foot that has just been set down somewhere new moves a whole step: that is a new plant, not a slip)
              if (d > w.slip && d < 0.25 * g.actor.H) (w.slip = d), (w.slipAt = `${k} ${sec(t)}`);
            }
          }
        }
      }
      feetNow.set(g.name, feet);
      if (g.actor && g.head !== false) {
        const fm2 = mapper(list.view, g.space ?? 0);
        const c = fm2.f(fig.joints.pelvis);
        const a = acting.get(g.name) ?? { seen: 0, moving: 0, idle: 0, idleFrom: t, worst: 0, worstFrom: t };
        acting.set(g.name, a);
        const p = fig.joints.pelvis;
        const now2 = { p, l: [fig.arms.L.wrist[0] - p[0], fig.arms.L.wrist[1] - p[1]] as Pt, r: [fig.arms.R.wrist[0] - p[0], fig.arms.R.wrist[1] - p[1]] as Pt, h: [fig.joints.headPivot[0] - p[0], fig.joints.headPivot[1] - p[1]] as Pt };
        if (c[0] > 0 && c[0] < FW && a.last) {
          a.seen++;
          const d = Math.max(dist(now2.l, a.last.l), dist(now2.r, a.last.r), 2 * dist(now2.h, a.last.h), dist(now2.p, a.last.p));
          if (d > LIMITS.acting.move * g.actor.H) {
            a.moving++;
            a.idle = 0;
            a.idleFrom = t;
          } else {
            if (a.idle === 0) a.idleFrom = t;
            a.idle++;
            if (a.idle > a.worst) (a.worst = a.idle), (a.worstFrom = a.idleFrom);
          }
        }
        a.last = now2;
      }
      if (g.head !== false) {
        const fm = mapper(list.view, g.space ?? 0);
        let fb: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const s of fig.shapes) {
          const b = boxOf(s.pts, fm.f);
          fb = { x0: Math.min(fb.x0, b.x0), y0: Math.min(fb.y0, b.y0), x1: Math.max(fb.x1, b.x1), y1: Math.max(fb.y1, b.y1) };
        }
        // counted only while the middle of the figure is inside the frame
        const cx = (fb.x0 + fb.x1) / 2;
        if (cx > 0 && cx < FW && inFrame(fb)) tallest = Math.max(tallest, (fb.y1 - fb.y0) / FH);
      }
    }
    prevFeet = feetNow;
    if (tallest > 0) {
      subject.frames++;
      if (tallest < subject.min) (subject.min = tallest), (subject.at = t);
    }

    // nothing may appear, vanish or jump between two frames unless the sequence says why. The first frame of a
    // sequence that covers the frame at once is a cut: everything changes there, so nothing in it is a pop.
    if (fr > f0 || (seq.t0 > 0 && !cutsIn)) {
      const note = (id: string) => {
        const a = allowed(id.replace(/^figure /, "").replace(/^[^|]*\|/, ""));
        if (a) allowedHits.set(a.why, (allowedHits.get(a.why) ?? 0) + 1);
        return !!a;
      };
      for (const [id, s] of now) {
        const p = prev.get(id);
        if (!p) {
          if (!inFrame(s.box) || atEdge(s.box) || s.o <= LIMITS.pop.opacity || visible(s.box) <= LIMITS.pop.area) continue;
          if (!note(id)) pops.push(`${sec(t)} + ${id} (opacity ${s.o.toFixed(2)}, ${visible(s.box).toFixed(0)} px2)`);
          continue;
        }
        const d = Math.hypot(s.c[0] - p.c[0], s.c[1] - p.c[1]);
        if (d > LIMITS.jump && inFrame(s.box) && inFrame(p.box) && !note(id)) jumps.push(`${sec(t)} ${id} moved ${d.toFixed(0)} px`);
      }
      for (const [id, p] of prev) {
        if (now.has(id) || !inFrame(p.box) || atEdge(p.box) || p.o <= LIMITS.pop.opacity - 0.1 || visible(p.box) <= LIMITS.pop.area) continue;
        if (!note(id)) pops.push(`${sec(t)} - ${id} (opacity ${p.o.toFixed(2)}, ${visible(p.box).toFixed(0)} px2)`);
      }
    }
    prev = now;

    if (o.cam && (fr - f0) % Math.round(fps / 2) === 0) {
      const v = list.view;
      const hw = FW / 2 / v.zoom;
      const hh = FH / 2 / v.zoom;
      const who = (list.figures ?? []).map((g) => (g.actor ? `${g.name} ${mapper(v, g.space ?? 0).f([g.actor.x.value(t), 0])[0].toFixed(0)}` : "")).filter(Boolean).join("  ");
      log(`${t.toFixed(1).padStart(6)}  cam ${v.cx.toFixed(0).padStart(5)},${v.cy.toFixed(0).padStart(5)} x${v.zoom.toFixed(2)}  sees x ${(v.cx - hw).toFixed(0).padStart(5)}..${(v.cx + hw).toFixed(0).padEnd(5)} y ${(v.cy - hh).toFixed(0).padStart(5)}..${(v.cy + hh).toFixed(0).padEnd(5)}  on screen: ${who}`);
    }
  }

  const n = f1 - f0 + 1;
  log(`${n} frames built in ${((performance.now() - t0) / n).toFixed(1)} ms each; ${bad} bad shapes; missing from the palette: ${[...missing].join(", ") || "none"}`);
  if (bad) fail(`${bad} bad shapes (fewer than 3 points, no area, or a number that is not finite)`);
  if (missing.size) fail(`not in the palette or the lights: ${[...missing].join(", ")}`);
  if (dupes.size) fail(`shape ids used twice in one paint item: ${[...dupes].slice(0, 6).join("; ")}`);
  log(`most in one frame: ${worst.shapes} shapes at ${sec(worst.shapesAt)} s, about ${worst.paths} paths at ${sec(worst.pathsAt)} s${worst.paths > LIMITS.paths ? `  OVER ${LIMITS.paths}` : ""}`);
  if (worst.paths > LIMITS.paths) fail(`${worst.paths} paths in one frame (the budget is ${LIMITS.paths}): make far and small things flat, or drop shapes that are out of view`);

  // ---- figures
  for (const [name, w] of joints) {
    log(`  ${name.padEnd(8)} sharpest elbow ${w.elbow.toFixed(0)} deg (${w.elbowAt}), knee ${w.knee.toFixed(0)} deg (${w.kneeAt}), most stretch ${((w.stretch - 1) * 100).toFixed(1)} % (${w.stretchAt}), worst pinned hand ${w.pin.toFixed(0)} px off (${w.pinAt}), planted foot moved ${w.slip.toFixed(1)} px at most (${w.slipAt})`);
    if (w.elbow < LIMITS.joint) fail(`${name}: an elbow folds to ${w.elbow.toFixed(0)} deg at ${w.elbowAt} s`);
    if (w.knee < LIMITS.joint) fail(`${name}: a knee folds to ${w.knee.toFixed(0)} deg at ${w.kneeAt} s`);
    if (w.stretch > LIMITS.stretch) fail(`${name}: a limb is stretched ${((w.stretch - 1) * 100).toFixed(1)} % at ${w.stretchAt} s (move the body closer, or the thing)`);
    if (w.pin > LIMITS.pin) fail(`${name}: a pinned hand is ${w.pin.toFixed(0)} px off its pin at ${w.pinAt} s (out of reach: bring the body nearer)`);
    if (w.slip > LIMITS.footSlip) fail(`${name}: a planted foot moves ${w.slip.toFixed(1)} px in one frame at ${w.slipAt} s`);
  }
  for (const [name, a] of acting) {
    if (a.seen < fps) continue;
    const share = a.moving / a.seen;
    log(`  ${name.padEnd(8)} in view for ${(a.seen / fps).toFixed(1)} s and acting in ${(share * 100).toFixed(0)} % of it; longest spell of breath alone ${(a.worst / fps).toFixed(1)} s (from ${sec(a.worstFrom)} s)`);
    if (a.worst / fps > LIMITS.acting.still) warn(`${name} does nothing but breathe for ${(a.worst / fps).toFixed(1)} s from ${sec(a.worstFrom)} s: give them a look, a shift of weight, a hand that does something (the example films never leave a figure longer than ${LIMITS.acting.still} s)`);
  }
  if (subject.frames) {
    log(`  with someone in view, the largest figure is at least ${(subject.min * 100).toFixed(0)} % of the frame's height (smallest at ${sec(subject.at)} s)`);
    if (subject.min < LIMITS.subject) warn(`figures are small: ${(subject.min * 100).toFixed(0)} % of the frame's height at ${sec(subject.at)} s (a wide shot wants ${LIMITS.subject * 100} % or more)`);
  }

  // ---- type
  if (parts.size) log("type:");
  for (const st of parts.values()) {
    const words = spoken(film, st.text);
    const fact = film.facts?.find((f) => norm(f.text).includes(norm(st.text)) || norm(st.text).includes(norm(f.text)));
    const said = words.length ? words : fact?.says ? spoken(film, fact.says) : [];
    let wordNote: string;
    if (!tokensOf(st.text).length) wordNote = "";
    else if (!said.length) {
      wordNote = "NOT IN THE NARRATION";
      fail(`"${st.text.trim()}" (${st.item}) is not in the narration${fact ? "" : " and not in the film's facts"}: on-screen words are the narrator's own`);
    } else if (st.role === "world") wordNote = "in the narration";
    else {
      const ok = said.some(([a, b]) => st.at >= a - LIMITS.early - 1e-6 && st.at <= b + LIMITS.late + 1e-6);
      const near = said.reduce((best, w) => (Math.abs(st.at - w[0]) < Math.abs(st.at - best[0]) ? w : best), said[0]);
      const d = st.at - near[0];
      wordNote = `lands ${sec(st.at)} (${d >= 0 ? "+" : ""}${d.toFixed(2)} s from its word)`;
      if (!ok) {
        wordNote += "  OFF ITS WORD";
        fail(`"${st.text.trim()}" (${st.item}) lands at ${sec(st.at)} s but is said at ${said.map((w) => `${sec(w[0])}-${sec(w[1])}`).join(", ")} s`);
      }
    }
    if (st.role === "world") {
      log(`  ${`${st.item}/${st.name}`.padEnd(26)} "${st.text.trim()}" printed in the world; ${wordNote}`);
      continue;
    }
    if (!st.frames) {
      log(`  ${`${st.item}/${st.name}`.padEnd(26)} "${st.text.trim()}" never shows in this sequence`);
      continue;
    }
    const lim = LIMITS.cap[st.role as "number" | "words" | "label"];
    const inside = st.outside === 0;
    log(`  ${`${st.item}/${st.name}`.padEnd(26)} "${st.text.trim()}" ${wordNote}; screen x ${st.ext.x0.toFixed(0)}..${st.ext.x1.toFixed(0)} y ${st.ext.y0.toFixed(0)}..${st.ext.y1.toFixed(0)} ${inside ? "inside the safe zone" : `OUTSIDE the safe zone for ${st.outside} frames`}; cap ${st.minCap.toFixed(0)} px or more; nearest head ${Number.isFinite(st.head.gap) ? `${st.head.gap.toFixed(0)} px (${st.head.who} at ${sec(st.head.at)} s)` : "none"}${Number.isFinite(st.contrast.v) ? `; contrast ${st.contrast.v.toFixed(1)}:1 or more against what it names` : ""}${Number.isFinite(st.seen.v) ? `, ${st.seen.v.toFixed(1)}:1 measured (${sec(st.seen.at)} s, over ${st.seen.top})` : ""}`);
    if (!inside) fail(`"${st.text.trim()}" (${st.item}) is outside the safe zone for ${st.outside} frames (x ${SAFE.x0}-${SAFE.x1}, y ${SAFE.y0}-${SAFE.y1})`);
    if (st.minCap < lim) fail(`"${st.text.trim()}" (${st.item}) is ${st.minCap.toFixed(0)} px tall on screen; a ${st.role === "number" ? "number" : st.role === "words" ? "name or phrase" : "label"} wants ${lim} px or more`);
    if (st.head.gap < LIMITS.headGap) fail(`"${st.text.trim()}" (${st.item}) is ${st.head.gap.toFixed(0)} px from ${st.head.who}'s head at ${sec(st.head.at)} s: type and heads keep apart`);
    const need = st.role === "label" ? LIMITS.contrast.accent : LIMITS.contrast.ink;
    if (st.contrast.v < need) fail(`"${st.text.trim()}" (${st.item}) has a contrast of ${st.contrast.v.toFixed(1)}:1 (${st.contrast.pair}) at ${sec(st.contrast.at)} s; it wants ${need}:1`);
    // (a number, a name or a phrase must be readable, so it fails; a small label is an accent, so it is a note)
    else if (st.seen.v < need * LIMITS.contrast.seen) (st.role === "label" ? warn : fail)(`"${st.text.trim()}" (${st.item}) has a contrast of only ${st.seen.v.toFixed(1)}:1 against what is drawn behind it at ${sec(st.seen.at)} s (${st.seen.pair}, over ${st.seen.top}); it wants ${need}:1. Its \`over\` list does not name that: move the type, change its colour, or take what is behind it away`);
    if (st.ground.v > LIMITS.contrast.ground) warn(`"${st.text.trim()}" (${st.item}) stands across two surfaces at ${sec(st.ground.at)} s (${st.ground.tops}, ${st.ground.v.toFixed(1)}:1 apart): type reads best on one calm ground`);
  }
  for (const id of noOver) warn(`${id} does not say what it stands against (\`over\`), so its contrast was not checked`);

  // ---- pops and jumps
  log(`appearances, disappearances and jumps inside the frame with no reason given: ${pops.length + jumps.length}`);
  for (const p of [...pops, ...jumps].slice(0, o.pops ? 500 : 12)) log(`  ${p}`);
  if (pops.length) fail(`${pops.length} thing(s) appear or vanish inside the frame in one frame: give each an entrance and an exit, or name it in the sequence's \`allow\` with the reason (run with --pops for the list)`);
  if (jumps.length) fail(`${jumps.length} move(s) of more than ${LIMITS.jump} px between two frames`);
  if (allowedHits.size) for (const [why, k] of allowedHits) log(`  allowed ${k} time(s): ${why}`);
  if (cutsIn) warn(`cuts in at ${sec(seq.t0)} s: nothing is carried across from the sequence before. If the board plans a join here, give \`tFull\` its later time and bring the first things in over the sequence before (docs/perform.md, joining two sequences)`);

  // ---- how long nothing is marked
  {
    const ev = [...seq.cues.map((c) => c.t), ...[...parts.values()].filter((p) => Number.isFinite(p.at)).map((p) => p.at), ...Object.values(seq.marks)].filter((x) => x >= seq.t0 - 1e-6 && x <= until + 1e-6).sort((a, b) => a - b);
    const pts = [seq.t0, ...ev, until];
    let gap = 0;
    let from = seq.t0;
    for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > gap) (gap = pts[i] - pts[i - 1]), (from = pts[i - 1]);
    log(`longest stretch with no cue, no type landing and no named mark: ${gap.toFixed(2)} s (from ${sec(from)} s)`);
    if (gap > LIMITS.quiet) warn(`${gap.toFixed(2)} s from ${sec(from)} s with nothing marked: look at that stretch (a camera move may carry it; a still frame may not)`);
  }
  return { fails, warns, frames: n };
}

/** The cue list of a film for the sound mix: what each sequence calls out, plus every footfall, with where it is on screen. */
export function cueList(film: Film): { duration: number; fps: number; cues: { t: number; what: string; pan: number; gain?: number }[] } {
  const FRAME = { width: film.width, height: film.height };
  const REF = { cx: film.width / 2, cy: film.height / 2 };
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const out: { t: number; what: string; pan: number; gain?: number }[] = [];
  for (const seq of film.sequences) {
    const { until } = framesOf(film, seq);
    const screenX = (t: number, x: number, space: Space) => {
      if (space === "screen") return x;
      const l = layerTransform(seq.frame(Math.max(seq.t0, Math.min(t, until)), film.look).view, FRAME, space, REF);
      return l.tx + x * l.s;
    };
    const pan = (sx: number | undefined) => (sx === undefined ? 0 : Math.round(Math.max(-1, Math.min(1, (sx - film.width / 2) / (film.width / 2))) * 0.5 * 100) / 100);
    const one = (c: Cue) => ({ t: r3(c.t), what: c.what, pan: pan(c.x === undefined ? undefined : screenX(c.t, c.x, c.space ?? 0)), ...(c.gain !== undefined ? { gain: c.gain } : {}) });
    for (const c of seq.cues) out.push(one(c));
    for (const w of seq.walkers ?? []) {
      const from = w.from ?? seq.t0 + 0.02;
      const to = w.to ?? until - 0.05;
      for (const side of ["L", "R"] as const) {
        const P = w.actor.feet[side].plants;
        for (let i = 1; i < P.length; i++) {
          const t = P[i].t0;
          if (!(t > from && t < to)) continue;
          const far = Math.abs(P[i].x - P[i - 1].x);
          out.push({ t: r3(t), what: far > 0.45 * w.actor.H ? `step.${w.name}` : "scuff", pan: pan(screenX(t, P[i].x, w.space ?? 0)) });
        }
      }
    }
  }
  out.sort((a, b) => a.t - b.t);
  return { duration: film.duration, fps: film.fps, cues: out };
}
