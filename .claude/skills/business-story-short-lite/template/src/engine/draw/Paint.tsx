// One painter per look. Painters are the only code that turns shapes into SVG, and they use no filters:
// volume comes from a second copy of the outline shifted toward the light and clipped to the part.
import React from "react";
import { pathD } from "../geom/outline.ts";
import { area, dot, type Pt } from "../geom/vec.ts";
import { tonesOf, type SceneLight, type Tones } from "../look/color.ts";
import type { Look } from "../look/looks.ts";
import { groundShadow, inkRing, rimRuns } from "./derive.ts";
import type { Palette, Shape } from "./shape.ts";

export interface PaintCtx {
  look: Look;
  light: SceneLight;
  palette: Palette;
  /** camera zoom, so look B's ink keeps one weight on screen */
  zoom?: number;
}

function tonesFor(s: Shape, ctx: PaintCtx): Tones {
  const base = s.color ?? ctx.palette[s.mat];
  if (!base) throw new Error(`material "${s.mat}" (shape ${s.id}) is not in the palette`);
  return tonesOf(base, ctx.light, ctx.look.recipe);
}

const tr = (d: Pt) => `translate(${d[0].toFixed(2)} ${d[1].toFixed(2)})`;

/** Rough thickness of a shape: twice its area over its perimeter (a 12 x 45 finger gives about 9). */
function thickness(pts: readonly Pt[]): number {
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return per > 0 ? (2 * Math.abs(area(pts))) / per : 0;
}

function planeFill(s: Shape, t: Tones, light: SceneLight): string {
  const f = s.facing ? dot(s.facing, light.dir) : 0;
  return f > 0.35 ? t.light : f > -0.15 ? t.base : t.shade;
}

const PartA: React.FC<{ s: Shape; ctx: PaintCtx; cid: string }> = ({ s, ctx, cid }) => {
  const t = tonesFor(s, ctx);
  const d = pathD(s.pts);
  const form = s.form ?? "round";
  if (form === "flat") return <path d={d} fill={t[s.tone ?? "base"]} opacity={s.opacity} />;
  if (form === "plane" && !s.casts?.length) return <path d={d} fill={planeFill(s, t, ctx.light)} opacity={s.opacity} />;
  const { look, light } = ctx;
  const depth = (s.depth ?? 12) * look.shadeShift * (0.55 + 0.45 * light.strength);
  const toLight: Pt = [light.dir[0] * depth, light.dir[1] * depth];
  const rimW = look.rim * (s.rim ?? 1) * (light.rim ?? 0.6);
  const rims = form === "round" && rimW > 0.2 ? rimRuns(s.pts, light.dir as Pt, rimW) : [];
  return (
    <g opacity={s.opacity}>
      <clipPath id={cid}>
        <path d={d} />
      </clipPath>
      {form === "plane" ? <path d={d} fill={planeFill(s, t, light)} /> : <path d={d} fill={t.shade} />}
      <g clipPath={`url(#${cid})`}>
        {form === "round" ? <path d={d} fill={t.base} transform={tr(toLight)} /> : null}
        {s.casts?.map((c, i) => {
          const reach = c.reach ?? depth * 0.9;
          return <path key={i} d={pathD(c.pts)} fill={t.shade} transform={tr([-light.dir[0] * reach, -light.dir[1] * reach])} />;
        })}
        {rims.map((r, i) => (
          <path key={`r${i}`} d={pathD(r)} fill={t.rim} />
        ))}
      </g>
    </g>
  );
};

const PartB: React.FC<{ s: Shape; ctx: PaintCtx; cid: string }> = ({ s, ctx, cid }) => {
  const t = tonesFor(s, ctx);
  const d = pathD(s.pts);
  const form = s.form ?? "round";
  const { look, light } = ctx;
  const ink = look.ink!;
  const inkW = (ink.width * (s.ink ?? 1)) / (ctx.zoom ?? 1);
  const ring = inkW > 0.3 ? inkRing(s.pts, light.dir as Pt, inkW, ink.swell) : null;
  const inkPath = ring ? <path d={pathD(ring.outer) + pathD(ring.inner)} fill={ink.color} fillRule="evenodd" /> : null;
  if (form === "flat") {
    return (
      <g opacity={s.opacity}>
        <path d={d} fill={t[s.tone ?? "base"]} />
        {inkPath}
      </g>
    );
  }
  const depth = (s.depth ?? 12) * look.shadeShift * (0.55 + 0.45 * light.strength);
  const toLight: Pt = [light.dir[0] * depth, light.dir[1] * depth];
  return (
    <g opacity={s.opacity}>
      <clipPath id={cid}>
        <path d={d} />
      </clipPath>
      {form === "plane" ? <path d={d} fill={planeFill(s, t, light)} /> : <path d={d} fill={t.shade} />}
      <g clipPath={`url(#${cid})`}>
        {form === "round" ? <path d={d} fill={t.base} transform={tr(toLight)} /> : null}
        {s.casts?.map((c, i) => {
          const reach = c.reach ?? depth * 0.9;
          return <path key={i} d={pathD(c.pts)} fill={t.shade} transform={tr([-light.dir[0] * reach, -light.dir[1] * reach])} />;
        })}
      </g>
      {inkPath}
    </g>
  );
};

const PartC: React.FC<{ s: Shape; ctx: PaintCtx; cid: string; dots: Map<string, string> }> = ({ s, ctx, cid, dots }) => {
  const t = tonesFor(s, ctx);
  const d = pathD(s.pts);
  const form = s.form ?? "round";
  const { look, light } = ctx;
  const paper = look.paper!;
  if (form === "flat") return <path d={d} fill={t[s.tone ?? "base"]} opacity={s.opacity} />;
  // `paper: false` = not a separate piece of paper (a nose, a moustache): shaded, but no cut edge or drop shadow.
  // Slivers thinner than a finger are never cut out on their own either: the pale edge would swallow them.
  const cut = s.paper !== false && thickness(s.pts) * (ctx.zoom ?? 1) > 15;
  const depth = (s.depth ?? 12) * look.shadeShift * (0.55 + 0.45 * light.strength);
  const toLight: Pt = [light.dir[0] * depth, light.dir[1] * depth];
  const fill = form === "plane" ? planeFill(s, t, light) : t.base;
  return (
    <g opacity={s.opacity}>
      {cut ? <path d={d} fill="#2b1a0e" opacity={paper.dropOpacity} transform={tr(paper.drop as Pt)} /> : null}
      <clipPath id={cid}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={fill} />
      {form === "round" ? (
        <g clipPath={`url(#${cid})`}>
          <path d={d} fill={`url(#${dots.get(t.shade)})`} />
          <path d={d} fill={fill} transform={tr(toLight)} />
          {s.casts?.map((c, i) => {
            const reach = c.reach ?? depth * 0.9;
            return <path key={i} d={pathD(c.pts)} fill={`url(#${dots.get(t.shade)})`} transform={tr([-light.dir[0] * reach, -light.dir[1] * reach])} />;
          })}
        </g>
      ) : null}
      {cut ? <path d={d} fill="none" stroke={paper.edge} strokeWidth={paper.edgeWidth / (ctx.zoom ?? 1)} strokeLinejoin="round" /> : null}
    </g>
  );
};

/**
 * Paints a list of shapes, back to front, in the given look.
 * `uid` must be unique among the painters on screen (it prefixes clip-path ids).
 */
export const Paint: React.FC<{ shapes: readonly Shape[]; ctx: PaintCtx; uid: string }> = ({ shapes, ctx, uid }) => {
  const id = ctx.look.id;
  if (id === "C") {
    // one halftone pattern per shade colour in use
    const dots = new Map<string, string>();
    for (const s of shapes) {
      if ((s.form ?? "round") !== "round") continue;
      const t = tonesFor(s, ctx);
      if (!dots.has(t.shade)) dots.set(t.shade, `${uid}-ht${dots.size}`);
    }
    const size = ctx.look.paper!.dot;
    return (
      <g>
        <defs>
          {[...dots.entries()].map(([color, pid]) => (
            <pattern key={pid} id={pid} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform="rotate(32)">
              <circle cx={size / 2} cy={size / 2} r={size * 0.3} fill={color} />
            </pattern>
          ))}
        </defs>
        {shapes.map((s, i) => (
          <PartC key={s.id} s={s} ctx={ctx} cid={`${uid}-c${i}`} dots={dots} />
        ))}
      </g>
    );
  }
  const Part = id === "B" ? PartB : PartA;
  return (
    <g>
      {shapes.map((s, i) => (
        <Part key={s.id} s={s} ctx={ctx} cid={`${uid}-c${i}`} />
      ))}
    </g>
  );
};

/** The shadow a group of shapes throws on the ground, as one translucent silhouette. */
export const GroundShadow: React.FC<{
  shapes: readonly Shape[];
  groundY: number;
  ctx: PaintCtx;
  color?: string;
  stretch?: number;
  drop?: number;
  opacity?: number;
}> = ({ shapes, groundY, ctx, color = "#1d1424", stretch, drop, opacity }) => (
  <g opacity={opacity ?? ctx.look.castOpacity * (0.6 + 0.4 * ctx.light.strength)}>
    {shapes.map((s) => (
      <path key={s.id} d={pathD(groundShadow(s.pts, groundY, ctx.light.dir as Pt, { stretch, drop }))} fill={color} />
    ))}
  </g>
);
