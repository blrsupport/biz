import React from "react";
import { Composition } from "remotion";
import { FilmView } from "./engine/FilmView";
import { loadFonts } from "./engine/type/fonts";
import { FILMS, filmById } from "./films/index.ts";
import { CAST_SHEET_SIZE, CastSheet } from "./sheets/CastSheet";
import { LIMB_SHEET_SIZE, LimbSheet } from "./sheets/LimbSheet";
import { TONE_SHEET_SIZE, ToneSheet } from "./sheets/ToneSheet";
import { TYPE_SPECIMEN_SIZE, TypeSpecimen } from "./sheets/TypeSpecimen";

loadFonts();

/** A film by its id, or one of its sequences alone (props must be plain data, so the film is looked up here). */
const FilmComp: React.FC<{ film: string; only?: string }> = ({ film, only }) => <FilmView film={filmById(film)} only={only} />;

export const Root: React.FC = () => (
  <>
    {/* one composition per film ("md"), and one per sequence by itself ("md-room") for stills while it is being built */}
    {FILMS.map((f) => (
      <React.Fragment key={f.id}>
        <Composition id={f.id} component={FilmComp} defaultProps={{ film: f.id }} durationInFrames={Math.ceil(f.duration * f.fps)} fps={f.fps} width={f.width} height={f.height} />
        {f.sequences.map((s) => (
          <Composition key={s.id} id={`${f.id}-${s.id}`} component={FilmComp} defaultProps={{ film: f.id, only: s.id }} durationInFrames={Math.ceil(f.duration * f.fps)} fps={f.fps} width={f.width} height={f.height} />
        ))}
      </React.Fragment>
    ))}

    {/* sheets: what the engine and the cast look like, to inspect before any animation */}
    <Composition id="TypeSpecimen" component={TypeSpecimen} durationInFrames={1} fps={30} {...TYPE_SPECIMEN_SIZE} />
    <Composition id="ToneSheet" component={ToneSheet} durationInFrames={1} fps={30} {...TONE_SHEET_SIZE} />
    <Composition id="LimbSheet" component={LimbSheet} durationInFrames={1} fps={30} {...LIMB_SHEET_SIZE} />
    <Composition id="CastSheet" component={CastSheet} defaultProps={{ look: "A" as const }} durationInFrames={1} fps={30} {...CAST_SHEET_SIZE} />

  </>
);
