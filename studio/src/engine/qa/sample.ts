// What colour really lies behind a point of the screen, read from the display list itself: the items drawn before a
// given one are laid over the sequence's background in order, each at its own opacity. The dry run uses it to
// measure the contrast of type against what is actually behind it, rather than against what the sequence says is.
//
// It is an estimate, and says so: a shaded shape counts as its base tone (not its lit or shaded side), a rod's ribs
// are left out, and a group's opacity is applied to each child. Good to a few tenths of a contrast ratio.
import { groundShadow } from "../draw/derive.ts";
import type { Fill, FrameList, Item, Space, Stop } from "../draw/list.ts";
import type { Palette } from "../draw/shape.ts";
import type { Pt } from "../geom/vec.ts";
import { hexToRgb, tonesOf, type SceneLight, type ToneRecipe, type Tones } from "../look/color.ts";
import { layerTransform } from "../stage/camera.ts";

export interface SampleCtx {
  palette: Palette;
  lights: Record<string, SceneLight>;
  light: string;
  recipe: ToneRecipe;
  background: string;
  frame: { width: number; height: number };
}

export interface Sampled {
  /** the colour behind the point, as r, g, b in 0..1 */
  rgb: [number, number, number];
  /** the last thing drawn there that hides most of what is under it */
  top: string;
}

const inside = (p: Pt, poly: readonly Pt[]): boolean => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};

const boxOf = (poly: readonly Pt[]) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
};

/** The colours behind `points` (screen px) as they stand just before the item `before` is drawn. */
export function sampleBehind(list: FrameList, before: string, points: readonly Pt[], ctx: SampleCtx): Sampled[] {
  const out: Sampled[] = points.map(() => ({ rgb: hexToRgb(ctx.background), top: "the background" }));
  const REF = { cx: ctx.frame.width / 2, cy: ctx.frame.height / 2 };
  const tone = (mat: string, which: keyof Tones, light?: string): string | null => {
    const base = ctx.palette[mat];
    const l = ctx.lights[light ?? ctx.light] ?? ctx.lights[ctx.light];
    return base && l ? tonesOf(base, l, ctx.recipe)[which] : null;
  };
  const lay = (i: number, hex: string | null, a: number, id: string) => {
    if (!hex || !(a > 0.004)) return;
    const c = hexToRgb(hex);
    const o = out[i];
    const k = Math.min(1, a);
    o.rgb = [o.rgb[0] + (c[0] - o.rgb[0]) * k, o.rgb[1] + (c[1] - o.rgb[1]) * k, o.rgb[2] + (c[2] - o.rgb[2]) * k];
    if (k > 0.5) o.top = id;
  };
  const stopAt = (stops: readonly Stop[], u: number): { hex: string | null; a: number } => {
    const v = Math.max(0, Math.min(1, u));
    const col = (s: Stop) => (s.tone ? tone(s.tone.mat, s.tone.tone as keyof Tones, s.tone.light) : s.color);
    if (!stops.length) return { hex: null, a: 0 };
    if (v <= stops[0].at) return { hex: col(stops[0]), a: stops[0].a };
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i].at) {
        const s0 = stops[i - 1];
        const s1 = stops[i];
        const k = s1.at > s0.at ? (v - s0.at) / (s1.at - s0.at) : 1;
        const c0 = col(s0);
        const c1 = col(s1);
        if (!c0 || !c1) return { hex: c0 ?? c1, a: s0.a + (s1.a - s0.a) * k };
        const x = hexToRgb(c0);
        const y = hexToRgb(c1);
        const h = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
        return { hex: `#${h(x[0] + (y[0] - x[0]) * k)}${h(x[1] + (y[1] - x[1]) * k)}${h(x[2] + (y[2] - x[2]) * k)}`, a: s0.a + (s1.a - s0.a) * k };
      }
    }
    const last = stops[stops.length - 1];
    return { hex: col(last), a: last.a };
  };
  const fillAt = (f: Fill, p: Pt, path: readonly Pt[]): { hex: string | null; a: number } => {
    if (f.kind === "solid") return { hex: f.color, a: 1 };
    if (f.kind === "linear") {
      const dx = f.x2 - f.x1;
      const dy = f.y2 - f.y1;
      return stopAt(f.stops, ((p[0] - f.x1) * dx + (p[1] - f.y1) * dy) / Math.max(1e-9, dx * dx + dy * dy));
    }
    if (f.kind === "radial") {
      if (f.box) {
        const b = boxOf(path);
        return stopAt(f.stops, Math.hypot((p[0] - (b.x0 + b.x1) / 2) / Math.max(1e-9, (b.x1 - b.x0) / 2), (p[1] - (b.y0 + b.y1) / 2) / Math.max(1e-9, (b.y1 - b.y0) / 2)));
      }
      return stopAt(f.stops, Math.hypot(p[0] - f.cx, (p[1] - f.cy) / (f.sy ?? 1)) / Math.max(1e-9, f.r));
    }
    return { hex: null, a: 0 };
  };

  type Live = { i: number; q: Pt }[];
  let found = false;
  const walk = (items: readonly Item[], live: Live, opacity: number, space: Space | undefined) => {
    for (const it of items) {
      if (found) return;
      if (it.id === before) {
        found = true;
        return;
      }
      const o = opacity * (it.opacity ?? 1);
      let here = live;
      if (space === undefined) {
        // a top-level item: bring the screen points into its layer
        if (it.space !== "screen") {
          const l = layerTransform(list.view, ctx.frame, it.space, REF);
          here = live.map(({ i, q }) => ({ i, q: [(q[0] - l.tx) / l.s, (q[1] - l.ty) / l.s] as Pt }));
        }
      }
      if (!here.length) continue;
      if (it.kind === "group") {
        let inner = here;
        if (it.clip) inner = inner.filter(({ q }) => it.clip!.some((c) => inside(q, c)));
        if (it.about && it.scale !== undefined && it.scale !== 0) {
          const [fx, fy] = it.about;
          const s = it.scale;
          inner = inner.map(({ i, q }) => ({ i, q: [fx + (q[0] - fx) / s, fy + (q[1] - fy) / s] as Pt }));
        }
        walk(it.items, inner, o, space ?? it.space);
      } else if (it.kind === "paint") {
        for (const s of it.shapes) {
          const b = boxOf(s.pts);
          const hex = s.color ?? tone(s.mat, "base", it.light);
          for (const { i, q } of here) if (q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.y0 && q[1] <= b.y1 && inside(q, s.pts)) lay(i, hex, o * (s.opacity ?? 1), `${it.id}/${s.id}`);
        }
      } else if (it.kind === "fill") {
        for (const { i, q } of here) {
          const holding = it.paths.filter((p) => inside(q, p));
          if (it.rule === "evenodd" ? holding.length % 2 === 0 : holding.length === 0) continue;
          const c = fillAt(it.fill, q, holding[0]);
          lay(i, c.hex, o * c.a, it.id);
        }
      } else if (it.kind === "shadow") {
        const light = ctx.lights[it.light ?? ctx.light] ?? ctx.lights[ctx.light];
        const hex = tone(it.on, (it.tone ?? "shade") as keyof Tones, it.light);
        const g = it.ground;
        const sh = it.shift ?? [0, 0];
        for (const s of it.casters) {
          const pts = g && light ? groundShadow(s.pts, g.y, light.dir as Pt, { stretch: g.stretch, drop: g.drop }) : s.pts;
          const b = boxOf(pts);
          for (const { i, q } of here) {
            const p: Pt = [q[0] - sh[0], q[1] - sh[1]];
            if (p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1 && inside(p, pts)) lay(i, hex, o, it.id);
          }
        }
      }
    }
  };
  walk(
    list.items,
    points.map((q, i) => ({ i, q })),
    1,
    undefined,
  );
  return out;
}
