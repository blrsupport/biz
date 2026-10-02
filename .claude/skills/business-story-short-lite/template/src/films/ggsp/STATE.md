# GGSP: a scrapyard in 1976: state

The state file of the second example film, as it stood when the user approved it. A new film's `STATE.md` (made by `tools/new-film.mjs`) has the same sections. Read this and `board.md` at the start of every session.

## Scoreboard

| Step | Status |
|---|---|
| Words and tighten (`python tools/words.py ggsp -v`) | done. Source 0 to 25.28 s of the narration, 24.51 s after tightening. The pause after "1976," is kept (the hook); the trims are `TRIMS` in `words.ts` |
| Board | done: `board.md`, two sequences, ten beats, one join (a morph through the furnace glow) |
| Cast sheet and one style frame per world | done: `CastSheet`; style frames `docs/img/ggsp_yard.jpg` and `docs/img/ggsp_steel.jpg` |
| Stop A: the user approves board, cast and style frames | approved |
| Sequences | see the table below |
| Assembly, audit, finishing pass | done. 736 frames, no cuts, rendered in two chunks and joined. Audit: frames with no visible change 0 %, held frames inside a move 0 %, near-still time 4.1 % (the last second, the hold on the flyover; longest 1.0 s). Finish: look A |
| Sound | done. -14.1 LUFS, true peak -1.6 dB; where someone speaks the voice is at least 6.5 dB over the effects and 10.5 dB over the music; 55 cues placed |
| Delivered (Stop B) | approved unchanged |

## Sequences

| Seq | Seconds | Dry run | Stills looked at | Draft with voice sent | Review scores (same film, motion, staging, type, joins, life) | Status |
|---|---|---|---|---|---|---|
| yard | 0 to 20.10 | PASSED | yes | yes | not scored (built before the review pack existed; the user's approval stands in) | approved |
| steel | 19.30 to 24.51 (covers the frame from 20.05) | PASSED | yes | with the yard | built by a fresh worker from a written pack; looked over against the style frame, not scored | approved |

## Decisions taken

- The long yard is four stretches of `buildYard`; the third is the stretch of the approved style frame, so the camera arrives on that frame exactly. Only the stretches and heaps in view are listed.
- Depths: sky and low sun fixed to the screen; far skyline 4; mills 2.2; what is written across the sky 30 (it hardly moves as the camera travels); wall 0.1; actors 0; porter -0.12; heaps close to the lens -0.3.
- The steel world is drawn on top of the yard from its `t0`, and the yard stops being drawn just after the steel world's `tFull`. Each world has its own camera.
- No number is shown when the trader calls one out: the narration gives none.
- Two cue names have no sound on purpose: `call` (a voice would fight the narrator) and `rising chord` (the music does it).
- Render with 2 workers; RAM peaked near 90 % on the long part with other sessions open.

## Departures from the board (the user has been told)

- The sun is at frame left (decided with the style frame), so the buyer comes in from the left and the shadow lies to the right.
- The year and "AHMEDABAD" go behind a stack of drums that passes close to the lens, not behind a heap.
- The piece is thrown by an arm that comes up from below the frame; there is no second full figure.
- The hook is lowered into the tie of the sack with both hands on the stirrup; there is no separate hooking hand.
- The buyer counts the notes while Iraki sets the sack down, and hands them over on "Now"; Iraki pockets them, the scale hanging from his other hand.
- "take a company public" is written across the sky like the other type, not on the wall; the bell is let down into the picture from the top of the wall.

## Known weak spots (told to the user)

- The drum stack passes fast with no motion blur.
- The cap of the pier forms in about five frames, and the deck halves are seen for only four to six frames before they meet.
- The pier faces are plain.
- The buyer has no cloth bag.
- The shadow figures part by a cross-fade.
- The beam of the scale dips about a third of the way back before it swings to level (11 s): a long move with a large overshoot. Found by a note added to the dry run after the film was approved; it reads as the beam wobbling, so it is left.

## Fetched from outside (every download, with its source)

Epidemic Sound, 2 Oct 2026:

- Music: "Suhana" by Aashray Harishankar, cut to 24.6 s with the edit tool so that its quiet plucked opening lies under the yard and its full entry comes at 21.15 s, as the camera rides up with the rods. Chosen by measurement (`tools/music_scan.py`) from five previews.
- Effects: 29, from a crow and its wings to a rolling rebar and a rope under strain. The full list with preview links was given to the user as `sound_picks.md`.

The sound files themselves are not shipped with the skill (they are licensed to the user's account), so this film's mix cannot be rebuilt in a fresh studio; its `sound.json` is there to be read.

## Open with the user

- Nothing on spellings: "Shamsulhaq Iraki" is confirmed (`facts` in `film.ts`: the script, and coverage of the company's draft prospectus).
- The Shorts safe zone is provisional until it is calibrated from a phone screenshot.
