// Plays a film: every sequence that is on screen now, one over the other, each on its own stage.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Display } from "./draw/Display";
import { drawnUntil, type Film, type Sequence } from "./film.ts";
import { LOOKS } from "./look/looks.ts";
import { Stage } from "./stage/Stage";
import { useT } from "./time/useT";

const SeqView: React.FC<{ film: Film; seq: Sequence; t: number }> = ({ film, seq, t }) => {
  const list = seq.frame(t, film.look);
  const M = 80;
  return (
    <Stage view={list.view} frame={{ width: film.width, height: film.height }}>
      {t >= seq.tFull ? <rect x={-M} y={-M} width={film.width + 2 * M} height={film.height + 2 * M} fill={seq.background} /> : null}
      <Display list={list} ctx={{ look: LOOKS[film.look], palette: seq.palette, lights: seq.lights, light: seq.light, type: film.type, uid: seq.id }} />
    </Stage>
  );
};

/**
 * The whole film, or (with `only`) one sequence by itself over its own background, at the film's time.
 * A sequence is drawn from its t0 until a moment after the next one has covered the frame.
 */
export const FilmView: React.FC<{ film: Film; only?: string }> = ({ film, only }) => {
  const t = useT();
  const seqs = film.sequences;
  const first = only ? seqs.find((s) => s.id === only) : seqs[0];
  if (!first) throw new Error(`no sequence "${only}" in film ${film.id}`);
  return (
    <AbsoluteFill style={{ background: first.background }}>
      {seqs.map((s, i) => {
        if (only ? s.id !== only : t >= drawnUntil(film, i)) return null;
        if (t < s.t0) return null;
        return <SeqView key={s.id} film={film} seq={s} t={t} />;
      })}
    </AbsoluteFill>
  );
};
