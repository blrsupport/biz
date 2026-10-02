// Draws a laid-out line as SVG text, one element per glyph, so every glyph can be revealed or moved on its own.
import React from "react";
import { layout, type FaceName, type Line } from "./layout.ts";

export interface GlyphStyle {
  fill: string;
  opacity?: number;
  /** per-glyph transform and opacity; i is the glyph index */
  each?: (i: number, n: number) => { dx?: number; dy?: number; scale?: number; opacity?: number; rotate?: number } | undefined;
}

export const Glyphs: React.FC<{
  line: Line;
  x: number; // left edge (align "start"), centre ("middle") or right edge ("end")
  y: number; // baseline
  align?: "start" | "middle" | "end";
  style: GlyphStyle;
}> = ({ line, x, y, align = "start", style }) => {
  const x0 = align === "middle" ? x - line.width / 2 : align === "end" ? x - line.width : x;
  const n = line.glyphs.length;
  return (
    <g fontFamily={line.face} fontSize={line.size} fill={style.fill} opacity={style.opacity} textAnchor="middle" style={{ fontKerning: "none" }}>
      {line.glyphs.map((g, i) => {
        if (g.ch === " ") return null;
        const e = style.each?.(i, n);
        const gx = x0 + g.cx + (e?.dx ?? 0);
        const gy = y + (e?.dy ?? 0);
        const s = e?.scale ?? 1;
        const r = e?.rotate ?? 0;
        const tf = s !== 1 || r !== 0 ? `translate(${gx.toFixed(2)} ${(gy - line.capHeight / 2).toFixed(2)}) rotate(${r.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-gx).toFixed(2)} ${(-(gy - line.capHeight / 2)).toFixed(2)})` : undefined;
        return (
          <text key={i} x={gx.toFixed(2)} y={gy.toFixed(2)} opacity={e?.opacity} transform={tf}>
            {g.ch}
          </text>
        );
      })}
    </g>
  );
};

/** Convenience: lay out and draw in one go. */
export const TextLine: React.FC<{
  text: string;
  face: FaceName;
  size: number;
  x: number;
  y: number;
  fill: string;
  align?: "start" | "middle" | "end";
  cells?: boolean;
  tracking?: number;
  opacity?: number;
  each?: GlyphStyle["each"];
}> = ({ text, face, size, x, y, fill, align, cells, tracking, opacity, each }) => (
  <Glyphs line={layout(text, face, size, { cells, tracking })} x={x} y={y} align={align} style={{ fill, opacity, each }} />
);
