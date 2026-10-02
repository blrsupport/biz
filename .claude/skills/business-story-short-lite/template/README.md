# Studio

This folder is a studio for the **business-story-short** skill: the animation engine, the asset library, the tools, and every film made with them. It was set up by the skill's `scripts/new-studio.mjs`; each film is started with `node tools/new-film.mjs`.

| Where | What |
|---|---|
| `docs/` | The skill's reference pages. Start with `perform.md`; the others are named in the skill's `SKILL.md`. |
| `src/engine/` | The engine: time, motion, figures, the camera, type, the painter, the display list, the dry run. Films do not edit it. |
| `src/assets/` | The library: cast, sets, props, lights. New pieces go here, with nothing film-specific baked in. |
| `src/films/<id>/` | One film: its words, board, state, sound sheet and sequences. `md` and `ggsp` are the two approved examples. |
| `src/sheets/` | Sheets to inspect before animating: cast, tones, limbs, type. |
| `tools/` | Every command (`node tools/doctor.mjs` lists what is missing). |
| `public/` | Fonts and the paper texture; voice, music and effects go in `public/audio/<id>/` and `public/sfx/<id>/`. |
| `out/` | Everything that is rendered or measured. Safe to delete. |

The two example films compile, pass `node tools/check.ts md` and `node tools/check.ts ggsp`, and render their picture. Their voice, music and effects are not shipped (the recordings belong to the user and the sounds are licensed to their Epidemic Sound account), so their `sound.json` files are there to read, not to run.

Rules for rendering on a small PC are in `docs/machine.md`. The short version: only `tools/stills.mjs` and `tools/render.mjs` ever start a browser, one at a time.
