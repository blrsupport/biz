// Cast sheet: every character turned from front to profile, a large head, the expressions, and the line-up as
// black shapes. If two people read alike as silhouettes, or a face breaks at some angle, it shows here first.
import React from "react";
import { AbsoluteFill } from "remotion";
import { CAST, CAST_PALETTE } from "../assets/cast/cast.ts";
import { GroundShadow, Paint, type PaintCtx } from "../engine/draw/Paint";
import type { Shape } from "../engine/draw/shape.ts";
import { buildFigure, figureHeight, stand, type Character } from "../engine/figure/body.ts";
import { buildHead, FACES, type FaceName } from "../engine/figure/head.ts";
import { pathD } from "../engine/geom/outline.ts";
import { DEG } from "../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../engine/look/looks.ts";
import { TextLine } from "../engine/type/Glyphs";
import { LIGHT_MORNING } from "./ToneSheet";

const W = 2400;
const ROW = 560;
// everyone in the cast who is drawn in full (a figure in the one flat material "sil" is only ever a dark shape)
const NAMES = (Object.keys(CAST) as (keyof typeof CAST)[]).filter((n) => CAST[n].skin !== "sil");
const N = NAMES.length;
const YAWS = [0, 35, 65, 90, -50];
const FACE_ROW: FaceName[] = ["smile", "effort", "surprise", "worry", "call", "blink"];

const Row: React.FC<{ ch: Character; look: LookId; y: number }> = ({ ch, look, y }) => {
  const L = LOOKS[look];
  const ctx: PaintCtx = { look: L, light: LIGHT_MORNING, palette: CAST_PALETTE, zoom: 1 };
  const H = 78;
  const ground = y + ROW - 46;
  const figs: Shape[] = [];
  YAWS.forEach((deg, i) => {
    const pose = stand(ch, { feet: [150 + i * 215, ground], scale: H, yaw: deg * DEG });
    figs.push(...buildFigure({ ...ch, id: `${ch.id}${i}` }, pose, L.people).shapes);
  });
  // a large head, three-quarter, then the expressions
  const heads: Shape[] = [];
  const big = buildHead(`${ch.id}/big`, ch.head, { yaw: 32 * DEG }, [1330, y + 372], 250 * L.people.head, L.people);
  heads.push(...big.back, ...big.shapes);
  FACE_ROW.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const h = buildHead(`${ch.id}/f${i}`, ch.head, { yaw: (col === 1 ? -28 : 30) * DEG, face: FACES[f], pitch: f === "effort" ? 0.12 : 0 }, [1650 + col * 250, y + 205 + row * 250], 150 * L.people.head, L.people);
    heads.push(...h.back, ...h.shapes);
  });
  return (
    <g>
      <rect x={20} y={y + 8} width={W - 40} height={ROW - 16} rx={18} fill={look === "C" ? "#d8c6a2" : "#efe3cb"} />
      <rect x={20} y={ground} width={1160} height={38} fill={look === "C" ? "#bfae8c" : "#d9c9aa"} />
      <GroundShadow shapes={figs} groundY={ground} ctx={ctx} drop={0.1} stretch={0.55} />
      <Paint shapes={figs} ctx={ctx} uid={`cast${ch.id}`} />
      <Paint shapes={heads} ctx={ctx} uid={`heads${ch.id}`} />
      <TextLine text={`${ch.id}  ·  ${figureHeight(ch.build, L.people.head).toFixed(2)} heads`} face="InterBold" size={26} x={40} y={y + 44} fill="#3a3028" />
      {FACE_ROW.map((f, i) => (
        <TextLine key={f} text={f} face="InterBold" size={18} x={1600 + (i % 3) * 250} y={y + 290 + Math.floor(i / 3) * 250} fill="#6a5a4a" />
      ))}
    </g>
  );
};

const LineUp: React.FC<{ look: LookId; y: number }> = ({ look, y }) => {
  const L = LOOKS[look];
  const ctx: PaintCtx = { look: L, light: LIGHT_MORNING, palette: CAST_PALETTE, zoom: 1 };
  const H = 62;
  const ground = y + 430;
  const lit: Shape[] = [];
  const dark: Shape[] = [];
  NAMES.forEach((n, i) => {
    const ch = CAST[n];
    const a = buildFigure({ ...ch, id: `${ch.id}a` }, stand(ch, { feet: [200 + i * Math.min(270, 1080 / N), ground], scale: H, yaw: 40 * DEG }), L.people);
    lit.push(...a.shapes);
    const b = buildFigure({ ...ch, id: `${ch.id}b` }, stand(ch, { feet: [1400 + i * Math.min(250, 940 / N), ground], scale: H, yaw: 40 * DEG }), L.people);
    dark.push(...b.shapes);
  });
  return (
    <g>
      <rect x={20} y={y + 8} width={W - 40} height={470} rx={18} fill={look === "C" ? "#d8c6a2" : "#efe3cb"} />
      <rect x={20} y={ground} width={W - 40} height={38} fill={look === "C" ? "#bfae8c" : "#d9c9aa"} />
      <TextLine text="Line-up, and the same people as black shapes" face="InterBold" size={26} x={40} y={y + 44} fill="#3a3028" />
      <GroundShadow shapes={lit} groundY={ground} ctx={ctx} drop={0.1} stretch={0.55} />
      <Paint shapes={lit} ctx={ctx} uid="lineup" />
      {dark.map((s) => (
        <path key={s.id} d={pathD(s.pts)} fill="#1d1a22" />
      ))}
    </g>
  );
};

export const CastSheet: React.FC<{ look: LookId }> = ({ look }) => (
  <AbsoluteFill style={{ background: "#f3ead8" }}>
    <svg width={W} height={ROW * N + 500} viewBox={`0 0 ${W} ${ROW * N + 500}`}>
      {NAMES.map((n, i) => (
        <Row key={n} ch={CAST[n]} look={look} y={i * ROW} />
      ))}
      <LineUp look={look} y={ROW * N} />
    </svg>
  </AbsoluteFill>
);

export const CAST_SHEET_SIZE = { width: W, height: ROW * N + 500 };
