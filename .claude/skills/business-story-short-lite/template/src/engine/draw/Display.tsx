// The one view: turns a display list (list.ts) into SVG. Sequences never write SVG themselves.
// Solid things go to the painter of the look; light and air are gradients; shadows are the unlit tone of the
// surface they fall on. No SVG filter, blur or blend mode exists here, so none can appear in a film.
import React from "react";
import { pathD } from "../geom/outline.ts";
import type { Pt } from "../geom/vec.ts";
import { tonesOf, type SceneLight } from "../look/color.ts";
import type { Look } from "../look/looks.ts";
import { Layer } from "../stage/Stage";
import { Block } from "../type/Blocks";
import type { TypeLook } from "../type/blockspec.ts";
import { groundShadow } from "./derive.ts";
import type { FillItem, FrameList, GroupItem, Item, ShadowItem, Space, Stop } from "./list.ts";
import { Paint, type PaintCtx } from "./Paint";
import type { Palette } from "./shape.ts";

export interface DisplayCtx {
  look: Look;
  palette: Palette;
  lights: Record<string, SceneLight>;
  /** the light an item gets when it names none */
  light: string;
  type: TypeLook;
  /** prefix for the ids of gradients and clips; unique among the sequences on screen */
  uid: string;
}

const uidOf = (prefix: string, id: string) => `${prefix}-${id.replace(/[^a-zA-Z0-9]/g, "-")}`;
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

function lightOf(ctx: DisplayCtx, name?: string): SceneLight {
  const l = ctx.lights[name ?? ctx.light];
  if (!l) throw new Error(`light "${name ?? ctx.light}" is not one of this sequence's lights`);
  return l;
}

function toneOf(ctx: DisplayCtx, mat: string, tone: "base" | "shade" | "deep" | "light" | "rim", light?: string): string {
  const base = ctx.palette[mat];
  if (!base) throw new Error(`material "${mat}" is not in the palette`);
  return tonesOf(base, lightOf(ctx, light), ctx.look.recipe)[tone];
}

const stopsOf = (list: readonly Stop[], ctx: DisplayCtx) =>
  list.map((s, i) => <stop key={i} offset={s.at.toFixed(4)} stopColor={s.tone ? toneOf(ctx, s.tone.mat, s.tone.tone, s.tone.light) : s.color} stopOpacity={s.a.toFixed(3)} />);

/** An outline (or several) filled with light: a flat colour, a gradient, or the ribs of a rod. */
const Filled: React.FC<{ it: FillItem; ctx: DisplayCtx }> = ({ it, ctx }) => {
  const d = it.paths.map((p) => pathD(p)).join("");
  const f = it.fill;
  const id = uidOf(ctx.uid, it.id);
  if (f.kind === "solid") return <path d={d} fill={f.color} opacity={it.opacity} fillRule={it.rule} />;
  if (f.kind === "linear") {
    return (
      <g opacity={it.opacity}>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={n2(f.x1)} y1={n2(f.y1)} x2={n2(f.x2)} y2={n2(f.y2)}>
            {stopsOf(f.stops, ctx)}
          </linearGradient>
        </defs>
        <path d={d} fill={`url(#${id})`} fillRule={it.rule} />
      </g>
    );
  }
  if (f.kind === "radial") {
    if (f.box) {
      // fitted to each path's own box: one gradient serves every path of the item
      return (
        <g opacity={it.opacity}>
          <defs>
            <radialGradient id={id}>{stopsOf(f.stops, ctx)}</radialGradient>
          </defs>
          {it.paths.map((p, i) => (
            <path key={i} d={pathD(p)} fill={`url(#${id})`} />
          ))}
        </g>
      );
    }
    const squash = f.sy !== undefined ? `translate(${n2(f.cx)} ${n2(f.cy)}) scale(1 ${f.sy.toFixed(4)}) translate(${n2(-f.cx)} ${n2(-f.cy)})` : undefined;
    return (
      <g opacity={it.opacity}>
        <defs>
          <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={n2(f.cx)} cy={n2(f.cy)} r={n2(f.r)} gradientTransform={squash}>
            {stopsOf(f.stops, ctx)}
          </radialGradient>
        </defs>
        <path d={d} fill={`url(#${id})`} fillRule={it.rule} />
      </g>
    );
  }
  // ribs: one leaning ridge per tile, its underside in the material's deep tone and its top edge catching the light.
  // The tile is anchored to the tip of the rod, so the ribs travel with the rod.
  const base = ctx.palette[f.mat];
  if (!base) throw new Error(`material "${f.mat}" is not in the palette`);
  const tones = tonesOf(base, lightOf(ctx, f.light), ctx.look.recipe);
  const a = (f.pitch + f.lean - f.thick) / 2;
  const lip = Math.max(1.2, f.thick * 0.3);
  return (
    <g opacity={it.opacity}>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={n2(f.w)} height={n2(f.pitch)} patternTransform={`translate(${n2(f.x)} ${n2(f.y)})`}>
          <path d={`M0 ${n2(a)}L${n2(f.w)} ${n2(a - f.lean)}L${n2(f.w)} ${n2(a - f.lean + f.thick)}L0 ${n2(a + f.thick)}Z`} fill={tones.deep} opacity={0.5} />
          <path d={`M0 ${n2(a - lip)}L${n2(f.w)} ${n2(a - f.lean - lip)}L${n2(f.w)} ${n2(a - f.lean)}L0 ${n2(a)}Z`} fill={tones.rim} opacity={0.5} />
        </pattern>
      </defs>
      <path d={d} fill={`url(#${id})`} />
    </g>
  );
};

/** Cast shadows: the casters' outlines in one tone of the surface they fall on. */
const Shadows: React.FC<{ it: ShadowItem; ctx: DisplayCtx }> = ({ it, ctx }) => {
  const light = lightOf(ctx, it.light);
  const color = toneOf(ctx, it.on, it.tone ?? "shade", it.light);
  const tf = it.shift ? `translate(${it.shift[0]} ${it.shift[1]})` : undefined;
  const g = it.ground;
  const paths = it.casters.map((s) => <path key={s.id} d={pathD(g ? groundShadow(s.pts, g.y, light.dir as Pt, { stretch: g.stretch, drop: g.drop }) : s.pts)} fill={color} transform={tf} />);
  return it.opacity !== undefined ? <g opacity={it.opacity}>{paths}</g> : <>{paths}</>;
};

const Group: React.FC<{ it: GroupItem; ctx: DisplayCtx; t: number; zoom: number }> = ({ it, ctx, t, zoom }) => {
  const id = uidOf(ctx.uid, it.id);
  let body: React.ReactNode = it.items.map((c) => <One key={c.id} it={c} ctx={ctx} t={t} zoom={zoom} />);
  if (it.about && it.scale !== undefined) {
    const [fx, fy] = it.about;
    body = <g transform={`translate(${fx.toFixed(2)} ${fy.toFixed(2)}) scale(${it.scale.toFixed(4)}) translate(${(-fx).toFixed(2)} ${(-fy).toFixed(2)})`}>{body}</g>;
  }
  if (it.clip) {
    body = (
      <>
        <clipPath id={id}>
          {it.clip.map((p, i) => (
            <path key={i} d={pathD(p)} />
          ))}
        </clipPath>
        <g clipPath={`url(#${id})`}>{body}</g>
      </>
    );
  }
  return it.opacity !== undefined ? <g opacity={it.opacity}>{body}</g> : <>{body}</>;
};

const One: React.FC<{ it: Item; ctx: DisplayCtx; t: number; zoom: number }> = ({ it, ctx, t, zoom }) => {
  switch (it.kind) {
    case "paint": {
      const pc: PaintCtx = { look: ctx.look, light: lightOf(ctx, it.light), palette: ctx.palette, zoom };
      const p = <Paint shapes={it.shapes} ctx={pc} uid={uidOf(ctx.uid, it.id)} />;
      return it.opacity !== undefined ? <g opacity={it.opacity}>{p}</g> : p;
    }
    case "fill":
      return <Filled it={it} ctx={ctx} />;
    case "shadow":
      return <Shadows it={it} ctx={ctx} />;
    case "type": {
      const b = <Block block={it.block} T={ctx.type} t={t} />;
      return it.opacity !== undefined ? <g opacity={it.opacity}>{b}</g> : b;
    }
    default:
      return <Group it={it} ctx={ctx} t={t} zoom={zoom} />;
  }
};

/** Draws a frame's list inside a <Stage>. Items that follow one another in the same space share one layer. */
export const Display: React.FC<{ list: FrameList; ctx: DisplayCtx }> = ({ list, ctx }) => {
  const runs: { space: Space; items: Item[] }[] = [];
  for (const it of list.items) {
    const last = runs[runs.length - 1];
    if (last && last.space === it.space) last.items.push(it);
    else runs.push({ space: it.space, items: [it] });
  }
  const draw = (it: Item) => <One key={it.id} it={it} ctx={ctx} t={list.t} zoom={list.view.zoom} />;
  return (
    <>
      {runs.map((r, i) =>
        r.space === "screen" ? (
          <g key={i}>{r.items.map(draw)}</g>
        ) : (
          <Layer key={i} depth={r.space}>
            {r.items.map(draw)}
          </Layer>
        ),
      )}
    </>
  );
};
