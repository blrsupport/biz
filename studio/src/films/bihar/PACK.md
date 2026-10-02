# Worker pack: Bihar Mushroom (common to both world workers)

## 1. The project
You build the sequences of one world of an animated vertical Short (1080x1920, 30 fps) in the studio `/home/user/biz/studio`, with its own engine. Drawings are data: characters, props and sets return lists of shapes, and one painter shades them from the scene's single light. A sequence is a take (data Node can run) plus `frame(t)`, which returns a display list back to front; one generic view paints it and the dry run checks the very same list. Time is seconds in the tightened voice, taken from words: `W("oven")` via `makeAnchors(WORDS)`; never type a time a word could give.

## 2. Read, in this order, and nothing else in full
1. `src/films/bihar/board.md` (your rows) and `src/films/bihar/STATE.md`.
2. `docs/img/` frames, as pictures (that is the look to match). At most 3 of them.
3. `docs/perform.md` (the one-page method).
4. Your nearest example take (named in your brief): its `take.ts`, `frame.ts` and how its sequence object is made.
5. Your base set file (named in your brief).
Look things up in `docs/engine.md` and `docs/draw.md` with grep, never read them through. Do not read `directing.md`, `review.md`, `sound.md`, `machine.md`, or any other video skill.

## 3. Interface (fixed; keep it)
- Sequence folders already exist with placeholder `take.ts`, `frame.ts`, `index.ts`, registered in `src/films/bihar/film.ts`. Fill them in; keep the exported names (`S1_SEQ`, `HOME_SEQ`, `SHED_SEQ`, `SEED_SEQ`, `LAB_SEQ`, `TODAY_SEQ`) and their start word.
- Files you may write: your own sequence folders, and NEW asset files under `src/assets/` named in your brief (library pieces: no film text baked in). Do not edit another world's files, `film.ts`, `cast.ts`, the engine or the tools. If an engine change seems needed, do without and say so.
- Cast is ready in `src/assets/cast/cast.ts`: `SANJEEV` (young, sky-blue shirt), `SANJEEV_NOW` (greying, glasses, white kurta, brown half-jacket), `FATHER` (white hair, white kurta), `IRAKI` (stout, beard, white cap, waistcoat: plays the Haryana trader), `BUYER` (lean, green shirt: plays the Bihar farmer), silhouettes `PORTER`, `SON_A`, `SON_B` (villagers, gossips, trainees, porters).
- Shared mushroom props live in `src/assets/props/mushroom.ts`, written by the shed worker: `growBag` (hanging straw cylinder in clear plastic, mushrooms that can sprout 0..1, a "failed" grey state 0..1), `spawnBottle` (glass bottle of grain with white threads, a "bad" state), `spawnSack` (white woven sack). The village worker imports them; if the file is not there yet when you need it, stage with a placeholder shape and switch over later.

## 4. House rules
- Every colour comes from a palette by name. No randomness, clock or frame numbers. Nothing pops: everything enters and leaves; impacts settle; groups arrive one after another. Something new at least every 2 s (every second in the first 3 s of the film). A hold is at most 1.25 s and alive.
- People act through verbs (`walkTo`, `reach`, `lookAt`, `crouch` ...), side-on to three-quarter. No lip sync, no running, no sitting, no walking toward or away from the camera. Extras are silhouettes.
- On-screen words: only the strings in your board rows, verbatim (spellings via the facts in `film.ts`: "BIT Sindri", "SABRI Spawn Lab", "50,000"), each landing on its word, in the top third, inside x 72-900, y 260-1440, on one calm ground, one block at a time. No sign, label, price, map or logo with words that are not on the board.
- Stage for a phone: what matters is large and in the left four-fifths; a standing figure in a wide shot is at least 22 % of the frame height.
- Every world has lived-in detail and people throw shadows on what is behind them.

## 5. Machine and budget rules
- Do NOT start the browser: no `tools/stills.mjs`, no `tools/render.mjs`, no `npx remotion`, no installs or downloads. Look with `node tools/preview.ts bihar-<seq>:<t> ... --sheet <name>` (no browser): at most 2 preview sheets per sequence, and look at each sheet once.
- Dry run to a file and read only the failing lines: `node tools/check.ts bihar --seq <seq> --cam --out out/bihar/check_<seq>.txt` then `grep -E "FAIL|WARN|PASSED|FAILED" out/bihar/check_<seq>.txt`.
- Type check: `node_modules/.bin/tsc --noEmit 2>&1 | head -20`.
- Write each file whole in one step; do not grow it edit by edit. Never print a whole file or log into the conversation.
- Your turn cap is in your brief. At the cap, stop and hand back what is left.

## 6. Hand-back (at most 100 words, plus file list)
What passes, what does not, what the next person must know. Paths of your preview sheets. Cue names, one line each on what should be heard. Then add one line per sequence to the Sequences table in `STATE.md` and your stage notes (where things stand, where the light is) under "The stage".
