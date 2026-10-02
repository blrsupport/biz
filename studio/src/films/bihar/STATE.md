# Bihar Mushroom: state

## Budget (the user's limit is $50 of credit, not meter points)
- Start: user reported $48 left on 2 Oct 2026 (about $2 already spent on setup). Stop line: if the credit falls to $8 with the film not delivered, stop, save state, tell the user what is left and ask.
- Readings: start $48 (2 Oct). Ask again after Stop A, after the build, before the full render.

Read this and board.md at the start of every session. Update it after every sequence. Nothing that matters lives only in a conversation.

## Scoreboard

| Step | Status |
|---|---|
| Words and tighten (`python tools/words.py bihar -v`) | done: 359 words, 112.06 -> 110.33 s, 12 pauses tightened (1.73 s) |
| Board | written (board.md); 6 sequences s1(hook) home shed seed lab today, placeholders made |
| Cast sheet and one style frame per world | |
| Stop A: the user approves board, cast and style frames | |
| Sequences | see the table below |
| Assembly, audit, finishing pass | |
| Sound | |
| Delivered (Stop B) | |

## Sequences

| Seq | Seconds | Dry run | Stills looked at | Draft with voice sent | Review scores (same film, motion, staging, type, joins, life) | Status |
|---|---|---|---|---|---|---|
| s1 | 0.00 - 12.38 | PASSED (2 Oct, phase 1) | s1_p1 (0.5, 2.8, 5.3, 7.6) | | | beats 1-2 built; beat 3 (lens pass to home) is phase 2 |

## Decisions taken
- Two worlds: village (new set, worker A: s1, home, today) and shed/lab (library room re-dressed, worker B: shed, seed, lab).
- Spellings from the user: BIT Sindri, Sanjeev Kumar, Solan, Himachal, SABRI Spawn Lab. In film.ts facts.
- ffmpeg: tools/bin links to the system build (/usr/bin/ffmpeg 6.1.1, full).

## The stage (so the next session need not read the take to find it)

Where each set piece, prop and actor's mark stands, where the light comes from, and which later beat depends on which position.

### Village (s1; home and today will reuse it)
- Set `src/assets/sets/village.ts` (pieces placed per sequence, sized by `u`), props `src/assets/props/village.ts`. Lights `VILLAGE_LIGHTS` (morning left, afternoon right, sunrise left).
- s1 layers: sky (screen), far hills x -1900..320 and city x 780..1900 at depth 4 (horizon y 1012), fields 1.6, house/shed/bananas/straw/trees at 0.35 (foot y 1262, u 112: house x 300, shed x 1000, door x 895..1057), pump 0.12 at x 1160, lane 0 (GY 1500), grass -0.3.
- Marks: trader (IRAKI) x 360 facing right; farmer (BUYER) walks 1190 -> 748, out to 880, back to 712. Sack A rests at 458 and ends in the trader's arms; sack B rests at 232 (for beat 3's swing to the lens).
- Type in the sky at screen y 270-440: heads reach y ~480. Sacks are a stand-in (`wovenSack`) until `mushroom.ts` lands.

## Files this film owns outside its folder

Library files made or changed for this film (under src/assets), and whether another film uses them.

## Which outputs are current

The render, the dry run output and the review pack that describe the film as it stands now, with their times. Anything older is stale: say so or delete it.

## Departures from the board (tell the user)

## Known weak spots (tell the user before they find them)

## Fetched from outside (every download, with its source; for a music track its recording id as well, since signed links expire)

## Open with the user
