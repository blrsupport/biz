# The pack a sequence worker gets

A fresh worker builds one sequence from a written pack and nothing else. It has not seen the conversation, the user or the other sequences, and that is the point: it works from the same small set of files every time, so the eighth sequence is built with the same care as the first. The last five seconds of the `ggsp` example (the furnace, the rods, the flyover and the tower) were built this way and held the bar.

Write the pack as a message of under two pages. A worker that has to survey the repo has been given a bad pack.

## Before you send it

1. **Fix the interface first.** `node tools/new-seq.mjs <film> <seq> --from "<word>"` puts placeholder files in place and registers them, so the worker fills in files that already exist: the sequence's folder with `take.ts`, `frame.ts`, `index.ts`, and the entry in `film.ts`. Then set its `t0`, `tFull` and `end` yourself (from word anchors, not typed), because the hand-over between two sequences is yours to decide, not the worker's. `node tools/check.ts <film>` should pass with the placeholder.
2. **Build what is shared yourself**: the cast, any set or prop two sequences use, the film's palette. A worker may add assets that only its sequence needs.
3. **Render the style frame** of its world, or of the nearest one, so it has a picture to match.

## The pack

Fill in the brackets. Keep the headings.

> **1. The project in one paragraph.** You are building one sequence of an animated vertical Short with a custom engine in `[studio path]`. Drawings are data: characters, props and sets return lists of shapes, and one painter shades them from the scene's single light. A sequence is a take (data that Node can run) plus a frame function that returns a display list; a generic view paints the list. Time is seconds in the narrator's voice and every moment comes from a word. The look is fixed: lineless, one strong light, long shadows, no outlines, no filters. Nothing is borrowed from other video templates.
>
> **2. Read these first, in order, then start.** `src/films/[film]/STATE.md` and `board.md`; the style frame `[path]` and the frames of the example films in `docs/img/`, as pictures; `docs/perform.md`; `docs/draw.md` sections [n] if you will draw anything new; the model sequence `[src/films/md or ggsp ...]` (take, frame and sequence object); `docs/engine.md` for signatures as you need them; `docs/review.md` sections 1 to 5. Do not survey the rest of the repo.
>
> **3. What the film is doing when you take over.** [Two sentences.] The narration over your stretch: "[the exact words]". Word times that matter: [word: seconds, ...]. Get every time from `makeAnchors(WORDS)`; never type one that a word could give.
>
> **4. Your board.** [The rows of the board for this sequence: beat, words, what happens, camera, type, sound cue.] The last frame to aim for, in screen pixels: [what is where]. What must stay clear: the right fifth of the frame (under the Shorts buttons), and type inside x 72-900, y 260-1440.
>
> **5. The join.** You come in from [the sequence before: what its last frame shows] by [kind of join: what is carried]. From `t0` = [x] you draw over it; by `tFull` = [y] you cover the frame. You hand over to [the next] at [z] by [kind]: your last frame must show [what].
>
> **6. The interface to keep.** Files you may create or change: `src/films/[film]/[seq]/*`, and new asset files `src/assets/[...]`. Everything else is read-only; if an engine change seems needed, do without it and say so in your report. Keep these exports and their meaning: [`SEQ` object, its id, times, palette, light].
>
> **7. House rules.** Every colour comes from a palette by name. No randomness, clock or frame numbers. Nothing pops: everything has an entrance and an exit; impacts settle; groups arrive one after another. No dead air: something happens at least every two seconds. Static geometry is built once. On-screen words are only [the exact strings], verbatim, each landing on its word. No logos, no numbers the narrator does not say. People in this sequence: [who, from `CAST`, or none].
>
> **8. Machine rules (this PC can crash).** Render only with `node tools/stills.mjs`, stills only, your own composition `[film]-[seq]`, all the stills of one look in one command, at `@0.5`. No video renders, no browser of your own, no `npx remotion`, no installs or downloads. Write files in one step and start a render in a later one. If the tool prints `waiting: render lock`, another render is running: wait for it. Dry runs, type checks and `node tools/preview.ts` (a rough picture with no browser) are free: run them as often as you like, and stage with the preview before you spend a batch of stills.
>
> **9. How to work.** Design on paper first: where everyone stands, where the camera is at each beat, where the type sits. Then the take and the frame, and the dry run until it ends in `PASSED`: `node tools/check.ts [film] --seq [seq] --cam`. Stage with `node tools/preview.ts [film]-[seq]:<t> ... --sheet <name>` until the picture is right. Then one batch of real stills at the moments that matter, a contact sheet (`node tools/board.mjs`), and a hard look at it beside the style frame. Fix and repeat, at most [four] batches of stills.
>
> **10. Report back.** The files you wrote and what each holds. The last dry-run output, whole. The paths of your final stills and contact sheet. Your cue names, one line each on what should be heard. A score from 1 to 5 on each of the six rubric points (`docs/review.md`, section 8), with what is wrong for anything under 4. Every entry you put in `allow`, and why it is true. Anything you did differently from the board, and why. Anything you could not do. Do not claim a check you did not run.

## What made it work

- The board was specific about time and loose about craft: it said when each thing lands and what the last frame shows, not how to draw it.
- The interface was fixed before the worker started, so its work dropped into place.
- It could not touch shared files, so it could not break another sequence.
- It had to look at its own stills against the style frame, and score itself, before reporting.
- It knew exactly what to report, so the main session could check the work without re-reading the code.

## After it reports

Read the dry-run output and look at its contact sheet yourself. Run `node tools/check.ts <film>` on the whole film (the joins are yours to check). Render the half-size pass with the voice and the audit, then hand the pack from `node tools/pack.mjs` to a fresh reviewer (`docs/review.md`, section 8). Send defects back to the same worker with their times, at most five at once. Update `STATE.md`.
