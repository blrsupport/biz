// Designed type that is written on the set and timed to the voice: an amount under its label, a year, a name, a phrase.
// Every glyph arrives on its own, lands on the moment it is given, and leaves again; nothing pops on or off.
// The blocks are described as data in blockspec.ts (which also measures them for the checks); this file draws them.
import React from "react";
import { clamp, mix } from "../geom/vec.ts";
import { Track, WEIGHT, type Weight } from "../motion/track.ts";
import { nameLayout, numberLayout, phraseLayout, yearLayout, type GlyphsCue, type LineCue, type NameCue, type NumberCue, type PhraseCue, type TypeBlock, type TypeLook, type YearCue } from "./blockspec.ts";
import { Glyphs, TextLine, type GlyphStyle } from "./Glyphs";
import { sizeForCap, type Line } from "./layout.ts";

export type { TypeLook };

const smooth = (u: number) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

/** 0 -> 1, arriving at `at` after `dur` seconds, with the weight's overshoot and settle. */
export function arrive(t: number, at: number, dur: number, w: Weight = WEIGHT.hand, overshoot?: number): number {
  if (t <= at - dur) return 0;
  const tr = new Track(0);
  tr.to(1, { at, dur, w, windup: 0, overshoot });
  return tr.value(t);
}

type Each = NonNullable<GlyphStyle["each"]>;
type Move = ReturnType<Each>;

/** A glyph that rises into place from t0 on (one after another along the line) and sinks away at `out`. */
function rise(t: number, t0: number, i: number, out: number | undefined, from = 22, stagger = 0.02): Move {
  const ti = t0 + i * stagger;
  if (t < ti) return { opacity: 0 };
  const dur = 0.24;
  const p = arrive(t, ti + dur, dur, WEIGHT.hand);
  let dy = (1 - p) * from;
  let opacity = smooth((t - ti) / (dur * 0.5));
  if (out !== undefined && t > out + i * 0.01) {
    const q = smooth((t - out - i * 0.01) / 0.22);
    dy += q * q * from * 1.3;
    opacity *= 1 - q;
  }
  return { dy, opacity };
}

/** A glyph that drops in and lands at `at` (its neighbours a frame apart), a little large until it lands. */
function drop(t: number, at: number, i: number, out: number | undefined, cap: number): Move {
  const ti = at + i * 0.026;
  const dur = 0.17;
  if (t < ti - dur) return { opacity: 0 };
  const p = arrive(t, ti, dur, WEIGHT.body, 0.05);
  let dy = -(1 - p) * cap * 0.42;
  let opacity = smooth((t - (ti - dur)) / (dur * 0.45));
  if (out !== undefined && t > out + i * 0.012) {
    const q = smooth((t - out - i * 0.012) / 0.22);
    dy += q * q * cap * 0.3;
    opacity *= 1 - q;
  }
  return { dy, opacity, scale: 1 + (1 - p) * 0.14 };
}

export interface NumberBlockProps extends NumberCue {
  T: TypeLook;
  /** now, seconds */
  t: number;
}

/** A small caps label over a rule, and under it a large amount with the rupee sign in the accent colour. */
export const NumberBlock: React.FC<NumberBlockProps> = (props) => {
  const { T, t, x, y, label, parts, stamp, out } = props;
  const first = Math.min(label.at, stamp?.at ?? Infinity, ...parts.map((p) => p.at)) - 0.3;
  if (t < first || (out !== undefined && t > out + 0.6)) return null;
  const { hasRupee, line, rupeeLine, rW, base, when, small, pre, lab, big } = numberLayout(props, T);
  const leave = out !== undefined ? 1 - smooth((t - out) / 0.24) : 1;
  // the rule is drawn under the year first, then runs on under the label when that arrives
  const ruleNow = (small && stamp ? small.width * smooth((t - stamp.join - 0.2) / 0.3) : 0) + (pre - (small?.width ?? 0) + lab.width) * smooth((t - label.at - 0.05) / 0.32);

  let stampEl: React.ReactNode = null;
  if (stamp && small && big) {
    const p = smooth((t - stamp.join) / 0.38);
    const s = mix(1, small.capHeight / big.capHeight, p);
    const sx = mix(x, x + 4, p);
    const sy = mix(base, y, p);
    const swap = smooth((p - 0.6) / 0.4);
    stampEl = (
      <g>
        {swap < 1 ? (
          <g transform={`translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${s.toFixed(4)})`} opacity={(1 - swap) * leave}>
            <Glyphs line={big} x={0} y={0} style={{ fill: T.ink, each: (i) => drop(t, stamp.at, i, undefined, big.capHeight) }} />
          </g>
        ) : null}
        {swap > 0 ? <Glyphs line={small} x={x + 4} y={y} style={{ fill: T.accent, opacity: swap * leave }} /> : null}
      </g>
    );
  }
  return (
    <g>
      {stampEl}
      <Glyphs line={lab} x={x + 4 + pre} y={y} style={{ fill: T.accent, each: (i) => rise(t, label.at, i, out) }} />
      {ruleNow > 1 ? <rect x={x + 4} y={y + 15} width={ruleNow} height={6} fill={T.accent} opacity={leave} /> : null}
      {hasRupee ? <Glyphs line={rupeeLine} x={x} y={base} style={{ fill: T.accent, each: () => drop(t, parts[0].at, 0, out, line.capHeight) }} /> : null}
      <Glyphs line={line} x={x + rW} y={base} style={{ fill: T.ink, each: (i) => drop(t, when[i].at, when[i].k, out, line.capHeight) }} />
    </g>
  );
};

export interface YearBlockProps extends YearCue {
  T: TypeLook;
  t: number;
}

/** A year, very large, and under it a place name. Each figure drops in on its own; the place rises in on its word. */
export const YearBlock: React.FC<YearBlockProps> = (props) => {
  const { T, t, x, y, year, place, out, wipeX } = props;
  if (t < year.at - 0.3 || (out !== undefined && t > out + 0.6)) return null;
  const { line, lab, py } = yearLayout(props, T);
  const gone = (cx: number) => wipeX !== undefined && cx > wipeX;
  const leave = out !== undefined ? 1 - smooth((t - out) / 0.24) : 1;
  const rule = lab && place ? lab.width * smooth((t - place.at - 0.05) / 0.36) : 0;
  const ruleEnd = wipeX !== undefined ? Math.min(x + 4 + rule, wipeX) : x + 4 + rule;
  return (
    <g>
      <Glyphs line={line} x={x} y={y} style={{ fill: T.ink, each: (i) => (gone(x + line.glyphs[i].cx) ? { opacity: 0 } : drop(t, year.at, i, out, line.capHeight)) }} />
      {lab && place ? <Glyphs line={lab} x={x + 4} y={py} style={{ fill: T.accent, each: (i) => (gone(x + 4 + lab.glyphs[i].cx) ? { opacity: 0 } : rise(t, place.at, i, out)) }} /> : null}
      {ruleEnd - (x + 4) > 1 ? <rect x={x + 4} y={py + 16} width={ruleEnd - (x + 4)} height={6} fill={T.accent} opacity={leave} /> : null}
    </g>
  );
};

export interface NameBlockProps extends NameCue {
  T: TypeLook;
  t: number;
}

/** A small caps lead-in over a rule, and under it a name, each spoken piece of it rising in on its own moment. */
export const NameBlock: React.FC<NameBlockProps> = (props) => {
  const { T, t, x, y, label, parts, out } = props;
  if (t < Math.min(label.at, parts[0].at) - 0.3 || (out !== undefined && t > out + 0.6)) return null;
  const { line, lab, when, base } = nameLayout(props, T);
  const leave = out !== undefined ? 1 - smooth((t - out) / 0.24) : 1;
  const rule = lab.width * smooth((t - label.at - 0.05) / 0.32);
  return (
    <g>
      <Glyphs line={lab} x={x + 3} y={y} style={{ fill: T.accent, each: (i) => rise(t, label.at, i, out) }} />
      {rule > 1 ? <rect x={x + 3} y={y + 14} width={rule} height={6} fill={T.accent} opacity={leave} /> : null}
      <Glyphs line={line} x={x} y={base} style={{ fill: T.ink, each: (i) => rise(t, when[i].at, when[i].k, out, line.capHeight * 0.55, 0.022) }} />
    </g>
  );
};

export interface PhraseBlockProps extends PhraseCue {
  T: TypeLook;
  t: number;
}

/** A few words, large, one line per thing said. `lead` is set in the accent colour. */
export const PhraseBlock: React.FC<PhraseBlockProps> = (props) => {
  const { T, t, x, y, lines, out } = props;
  if (t < lines[0].at - 0.2 || (out !== undefined && t > out + 0.6)) return null;
  const L = phraseLayout(props, T);
  return (
    <g>
      {lines.map((l, k) => {
        const line = L.lines[k];
        const n = [...(l.lead ?? "")].length;
        const part = (from: number, to: number | undefined): Line => ({ ...line, glyphs: line.glyphs.slice(from, to) });
        const by = y + k * line.capHeight * L.leading;
        return (
          <g key={k}>
            {n ? <Glyphs line={part(0, n)} x={x} y={by} style={{ fill: T.accent, each: (i) => rise(t, l.at, i, out, line.capHeight * 0.5, 0.016) }} /> : null}
            <Glyphs line={part(n, undefined)} x={x} y={by} style={{ fill: T.ink, each: (i) => rise(t, l.at, i + n, out, line.capHeight * 0.5, 0.016) }} />
          </g>
        );
      })}
    </g>
  );
};

/** One line printed in the world (a date on a calendar, a sign). */
export const LineBlock: React.FC<LineCue & { T: TypeLook }> = ({ T, text, face, cap, x, y, color, align, tracking }) => (
  <TextLine text={text} face={T[face]} size={sizeForCap(T[face], cap)} x={x} y={y} fill={color} align={align} tracking={tracking} />
);

/** A line whose glyphs the take moves itself: one run per spoken piece, each with its own colour. */
export const GlyphsBlock: React.FC<GlyphsCue> = ({ line, x, y, runs }) => (
  <g>
    {runs.map((r) => {
      const part: Line = { ...line, glyphs: line.glyphs.slice(r.from, r.to) };
      return <Glyphs key={r.from} line={part} x={x} y={y} style={{ fill: r.color, each: (i) => r.each[i] }} />;
    })}
  </g>
);

/** Draws any block of the display list. */
export const Block: React.FC<{ block: TypeBlock; T: TypeLook; t: number }> = ({ block, T, t }) => {
  switch (block.kind) {
    case "number":
      return <NumberBlock T={T} t={t} {...block} />;
    case "year":
      return <YearBlock T={T} t={t} {...block} />;
    case "name":
      return <NameBlock T={T} t={t} {...block} />;
    case "phrase":
      return <PhraseBlock T={T} t={t} {...block} />;
    case "line":
      return <LineBlock T={T} {...block} />;
    default:
      return <GlyphsBlock {...block} />;
  }
};
