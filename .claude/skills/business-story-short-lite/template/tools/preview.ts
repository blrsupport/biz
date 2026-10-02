// A picture of a frame in a few seconds, with no browser: the display list is turned into the same fills the
// painter writes and rasterised with Pillow. Use it while staging (where is everyone, what overlaps what, where the
// type sits, how the light falls). It is NOT the renderer: type is set plainly and does not animate, a rod's ribs are
// left out, edges are a little rougher, and there is no finishing pass. Judge the look on real stills (tools/stills.mjs).
//
//   node tools/preview.ts <film>[-<seq>]:<seconds>[=name] ... [--scale 0.5] [--sheet <name>]
//
// Writes out/preview/<name>.png (default name: <film>_<seconds>). --sheet also tiles them into out/boards/<name>.png.
import "./lib/fail.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { groundShadow, rimRuns } from "../src/engine/draw/derive.ts";
import type { Fill, FrameList, Item, Space } from "../src/engine/draw/list.ts";
import type { Palette, Shape } from "../src/engine/draw/shape.ts";
import { drawnUntil, type Film, type Sequence } from "../src/engine/film.ts";
import { bounds, dot, type Pt } from "../src/engine/geom/vec.ts";
import { tonesOf, type SceneLight } from "../src/engine/look/color.ts";
import { LOOKS, type Look } from "../src/engine/look/looks.ts";
import { layerTransform } from "../src/engine/stage/camera.ts";
import { measure, type TypeBlock, type TypeLook } from "../src/engine/type/blockspec.ts";
import { sizeForCap } from "../src/engine/type/layout.ts";
import { FONT_METRICS, type FaceName } from "../src/engine/type/metrics.ts";
import { FILMS } from "../src/films/index.ts";

interface Stop {
  at: number;
  color: string;
  a: number;
}
type Op =
  | { k: "poly"; pts: readonly Pt[]; fill: string; o?: number }
  | { k: "eo"; paths: readonly (readonly Pt[])[]; fill: string; o?: number }
  | { k: "round"; pts: readonly Pt[]; shade: string; base: string | null; dx: number; dy: number; casts: { pts: readonly Pt[]; dx: number; dy: number; fill: string }[]; rims: Pt[][]; rim: string; o?: number }
  | { k: "lin"; pts: readonly Pt[]; x1: number; y1: number; x2: number; y2: number; stops: Stop[]; o?: number }
  | { k: "rad"; pts: readonly Pt[]; cx: number; cy: number; r: number; sy?: number; stops: Stop[]; o?: number }
  | { k: "text"; text: string; x: number; y: number; size: number; font: string; fill: string }
  | { k: "clip"; clip: readonly (readonly Pt[])[]; ops: Op[]; o?: number };

interface Ctx {
  look: Look;
  palette: Palette;
  lights: Record<string, SceneLight>;
  light: string;
  type: TypeLook;
  frame: { width: number; height: number };
  t: number;
}

/** The fills the look's painter writes for each shape, in order. */
function paintOps(shapes: readonly Shape[], ctx: Ctx, light: SceneLight): Op[] {
  const out: Op[] = [];
  for (const s of shapes) {
    const base = s.color ?? ctx.palette[s.mat];
    if (!base) throw new Error(`material "${s.mat}" (shape ${s.id}) is not in the palette`);
    const t = tonesOf(base, light, ctx.look.recipe);
    const form = s.form ?? "round";
    const f = s.facing ? dot(s.facing, light.dir as Pt) : 0;
    const planeFill = f > 0.35 ? t.light : f > -0.15 ? t.base : t.shade;
    if (form === "flat") {
      out.push({ k: "poly", pts: s.pts, fill: t[s.tone ?? "base"], o: s.opacity });
      continue;
    }
    if (form === "plane" && !s.casts?.length) {
      out.push({ k: "poly", pts: s.pts, fill: planeFill, o: s.opacity });
      continue;
    }
    const depth = (s.depth ?? 12) * ctx.look.shadeShift * (0.55 + 0.45 * light.strength);
    const rimW = ctx.look.rim * (s.rim ?? 1) * (light.rim ?? 0.6);
    const rims = form === "round" && rimW > 0.2 ? rimRuns(s.pts, light.dir as Pt, rimW) : [];
    out.push({
      k: "round",
      pts: s.pts,
      shade: form === "plane" ? planeFill : t.shade,
      base: form === "round" ? t.base : null,
      dx: light.dir[0] * depth,
      dy: light.dir[1] * depth,
      casts: (s.casts ?? []).map((c) => {
        const reach = c.reach ?? depth * 0.9;
        return { pts: c.pts, dx: -light.dir[0] * reach, dy: -light.dir[1] * reach, fill: t.shade };
      }),
      rims,
      rim: t.rim,
      o: s.opacity,
    });
  }
  return out;
}

interface Lay {
  tx: number;
  ty: number;
  s: number;
}
const mapPt = (l: Lay) => (p: Pt): Pt => [l.tx + p[0] * l.s, l.ty + p[1] * l.s];
function place(op: Op, l: Lay): Op {
  const m = mapPt(l);
  const mp = (pts: readonly Pt[]) => pts.map(m);
  if (op.k === "poly") return { ...op, pts: mp(op.pts) };
  if (op.k === "eo") return { ...op, paths: op.paths.map((q) => mp(q)) };
  if (op.k === "round") return { ...op, pts: mp(op.pts), dx: op.dx * l.s, dy: op.dy * l.s, casts: op.casts.map((c) => ({ ...c, pts: mp(c.pts), dx: c.dx * l.s, dy: c.dy * l.s })), rims: op.rims.map((r) => mp(r)) };
  if (op.k === "lin") {
    const a = m([op.x1, op.y1]);
    const b = m([op.x2, op.y2]);
    return { ...op, pts: mp(op.pts), x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
  }
  if (op.k === "rad") {
    const c = m([op.cx, op.cy]);
    return { ...op, pts: mp(op.pts), cx: c[0], cy: c[1], r: op.r * l.s };
  }
  if (op.k === "text") {
    const p = m([op.x, op.y]);
    return { ...op, x: p[0], y: p[1], size: op.size * l.s };
  }
  return { ...op, clip: op.clip.map((c) => mp(c)), ops: op.ops.map((x) => place(x, l)) };
}

const HUGE: Pt[] = [[-1e5, -1e5], [1e5, -1e5], [1e5, 1e5], [-1e5, 1e5]];
const fadeAll = (ops: Op[], o?: number): Op[] => (o === undefined || o >= 0.999 ? ops : [{ k: "clip", clip: [HUGE], ops, o }]);

function fillOps(f: Fill, paths: Pt[][], ctx: Ctx, o?: number, evenodd = false): Op[] {
  const stops = (list: Extract<Fill, { kind: "linear" }>["stops"]): Stop[] => list.map((s) => ({ at: s.at, a: s.a, color: s.tone ? tonesOf(ctx.palette[s.tone.mat], ctx.lights[s.tone.light ?? ctx.light], ctx.look.recipe)[s.tone.tone] : s.color }));
  if (f.kind === "solid") {
    if (evenodd && paths.length > 1) return [{ k: "eo", paths, fill: f.color, o }];
    return paths.map((p) => ({ k: "poly", pts: p, fill: f.color, o }) as Op);
  }
  if (f.kind === "linear") return paths.map((p) => ({ k: "lin", pts: p, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2, stops: stops(f.stops), o }) as Op);
  if (f.kind === "radial") {
    return paths.map((p) => {
      if (!f.box) return { k: "rad", pts: p, cx: f.cx, cy: f.cy, r: f.r, sy: f.sy, stops: stops(f.stops), o } as Op;
      const b = bounds(p);
      const r = (b.x1 - b.x0) / 2;
      return { k: "rad", pts: p, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, r, sy: (b.y1 - b.y0) / 2 / r, stops: stops(f.stops), o } as Op;
    });
  }
  return []; // the ribs of a rod are not previewed
}

/** Type, set plainly where it will stand: each spoken piece that has landed by now, in its face, size and colour. */
function typeOps(block: TypeBlock, ctx: Ctx): Op[] {
  const T = ctx.type;
  const out: Op[] = [];
  for (const p of measure(block, T)) {
    if (ctx.t < p.at - 0.02 || (p.out !== undefined && ctx.t > p.out + 0.1) || p.leaving) continue;
    const face: FaceName = block.kind === "glyphs" ? block.line.face : block.kind === "line" ? T[block.face] : p.role === "label" ? T.label : p.role === "number" ? T.number : T.name;
    const fill = p.color === "ink" ? T.ink : p.color === "accent" ? T.accent : p.color;
    out.push({ k: "text", text: p.text.trim(), x: p.box.x0, y: p.box.y0 + p.cap, size: sizeForCap(face, p.cap), font: path.resolve("public", "fonts", FONT_METRICS[face].file), fill });
  }
  return out;
}

function itemOps(it: Item, ctx: Ctx): Op[] {
  if (it.kind === "paint") return fadeAll(paintOps(it.shapes, ctx, ctx.lights[it.light ?? ctx.light]), it.opacity);
  if (it.kind === "fill") return fillOps(it.fill, it.paths, ctx, it.opacity, it.rule === "evenodd");
  if (it.kind === "shadow") {
    const light = ctx.lights[it.light ?? ctx.light];
    const color = tonesOf(ctx.palette[it.on], light, ctx.look.recipe)[it.tone ?? "shade"];
    const sh: Pt = it.shift ?? [0, 0];
    const g = it.ground;
    return fadeAll(
      it.casters.map((s) => ({ k: "poly", pts: (g ? groundShadow(s.pts, g.y, light.dir as Pt, { stretch: g.stretch, drop: g.drop }) : s.pts).map((p) => [p[0] + sh[0], p[1] + sh[1]] as Pt), fill: color }) as Op),
      it.opacity,
    );
  }
  if (it.kind === "type") return fadeAll(typeOps(it.block, ctx), it.opacity);
  let ops = it.items.flatMap((c) => itemOps(c, ctx));
  if (it.about && it.scale !== undefined) ops = ops.map((op) => place(op, { tx: it.about![0] * (1 - it.scale!), ty: it.about![1] * (1 - it.scale!), s: it.scale! }));
  if (it.clip) return [{ k: "clip", clip: it.clip, ops, o: it.opacity }];
  return fadeAll(ops, it.opacity);
}

/** Every item of a frame, placed by the camera for its layer, back to front. */
function listOps(list: FrameList, ctx: Ctx): Op[] {
  const ref = { cx: ctx.frame.width / 2, cy: ctx.frame.height / 2 };
  const lay = (space: Space): Lay => (space === "screen" ? { tx: 0, ty: 0, s: 1 } : layerTransform(list.view, ctx.frame, space, ref));
  return list.items.flatMap((it) => itemOps(it, ctx).map((op) => place(op, lay(it.space))));
}

// ---- the command
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const specs = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--scale", "--sheet"].includes(args[i - 1])));
if (!specs.length) {
  console.log(`usage: node tools/preview.ts <film>[-<seq>]:<seconds>[=name] ... [--scale 0.5] [--sheet <name>]\nfilms: ${FILMS.map((f) => `${f.id} (${f.sequences.map((s) => s.id).join(", ")})`).join("; ")}`);
  process.exit(2);
}
const scale = opt("scale", "0.5")!;
const py = process.platform === "win32" ? "python" : "python3";
const dir = path.join("out", "preview");
fs.mkdirSync(dir, { recursive: true });
const round = (v: unknown): unknown => (typeof v === "number" ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, round(x)])) : v);
const made: { file: string; label: string }[] = [];
const failed: string[] = [];
const t0 = Date.now();
for (const spec of specs) {
  const m = /^([^:=]+):([0-9.]+)(?:=(.+))?$/.exec(spec);
  if (!m) throw new Error(`bad spec "${spec}": write <film>:<seconds> or <film>-<seq>:<seconds>`);
  let film: Film | undefined = FILMS.find((f) => f.id === m[1]);
  let only: Sequence | undefined;
  if (!film) {
    film = FILMS.find((f) => m[1].startsWith(`${f.id}-`));
    only = film?.sequences.find((s) => `${film!.id}-${s.id}` === m[1]);
    if (!film || !only) throw new Error(`no film or sequence "${m[1]}" (have: ${FILMS.map((f) => [f.id, ...f.sequences.map((s) => `${f.id}-${s.id}`)].join(", ")).join("; ")})`);
  }
  const t = Number(m[2]);
  const seqs = only ? [only] : film.sequences.filter((s, i) => t >= s.t0 && t < drawnUntil(film!, i));
  if (!seqs.length) throw new Error(`nothing is drawn at ${t} s in ${m[1]}`);
  const frame = { width: film.width, height: film.height };
  const ops: Op[] = [];
  for (const s of seqs) {
    const ctx: Ctx = { look: LOOKS[film.look], palette: s.palette, lights: s.lights, light: s.light, type: film.type, frame, t };
    if (t >= s.tFull) ops.push({ k: "poly", pts: [[-80, -80], [frame.width + 80, -80], [frame.width + 80, frame.height + 80], [-80, frame.height + 80]], fill: s.background });
    ops.push(...listOps(s.frame(t, film.look), ctx));
  }
  const name = m[3] ?? `${m[1]}_${m[2]}`;
  const json = path.join(dir, `${name}.json`);
  const png = path.join(dir, `${name}.png`);
  fs.writeFileSync(json, JSON.stringify(round({ w: frame.width, h: frame.height, bg: seqs[0].background, ops })));
  let r = spawnSync(py, [path.join("tools", "raster.py"), json, png, scale], { encoding: "utf8" });
  if (r.status !== 0) r = spawnSync(py, [path.join("tools", "raster.py"), json, png, scale], { encoding: "utf8" });
  fs.rmSync(json, { force: true });
  if (r.status !== 0) {
    // one bad frame does not cost the others, or the sheet
    failed.push(`${spec}: ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" | ")}`);
    continue;
  }
  console.log(png);
  made.push({ file: png, label: `${t.toFixed(2)} s` });
}
console.log(`${made.length} preview(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s (no browser)`);
const sheet = opt("sheet");
if (sheet && made.length) {
  const per = made.length > 6 ? Math.ceil(made.length / 2) : made.length;
  const rows: string[] = [];
  for (let i = 0, k = 0; i < made.length; i += per, k++) {
    const row = `${sheet}_row${k}`;
    spawnSync(process.execPath, ["tools/board.mjs", "--out", row, "--size", "640", "--labels", made.slice(i, i + per).map((x) => x.label).join("|"), ...made.slice(i, i + per).map((x) => x.file)], { encoding: "utf8" });
    rows.push(path.join("out", "boards", `${row}.png`));
  }
  if (rows.length === 1) fs.copyFileSync(rows[0], path.join("out", "boards", `${sheet}.png`));
  else spawnSync(process.execPath, ["tools/board.mjs", "--out", sheet, "--dir", "v", "--size", "2400", ...rows], { encoding: "utf8" });
  console.log(path.join("out", "boards", `${sheet}.png`));
}
if (failed.length) {
  for (const f of failed) console.log(`NOT DRAWN  ${f}`);
  console.log(`FAILED: ${failed.length} of ${specs.length} preview(s) were not drawn`);
  process.exitCode = 1;
}
