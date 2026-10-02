# Minus Degre: starting with almost nothing: state

The state file of the first example film, as it stood when the user approved it. A new film's `STATE.md` (made by `tools/new-film.mjs`) has the same sections. Read this and `board.md` at the start of every session.

## Scoreboard

| Step | Status |
|---|---|
| Words and tighten (`python tools/words.py md -v`) | done. Source 61.52 to 75.98 s of the narration, 14.05 s after tightening. Three pauses shortened, one kept on purpose (after "just", before "5,000") |
| Board | done: `board.md`, one sequence, five beats |
| Cast sheet and one style frame per world | done: `CastSheet`; the style frame is `docs/img/md_room.jpg` |
| Stop A: the user approves board, cast and style frames | approved (the look itself was chosen here, from three) |
| Sequences | see the table below |
| Assembly, audit, finishing pass | done. 422 frames, no cuts. Audit: frames with no visible change 0 %, held frames inside a move 0 %, near-still time 0 %. Finish: look A |
| Sound | done. -14.1 LUFS, true peak -1.5 dB; where someone speaks the voice is at least 6.3 dB over the effects and 10.2 dB over the music |
| Delivered (Stop B) | approved unchanged |

## Sequences

| Seq | Seconds | Dry run | Stills looked at | Draft with voice sent | Review scores (same film, motion, staging, type, joins, life) | Status |
|---|---|---|---|---|---|---|
| room | 0 to 14.05 | PASSED, 422 frames | yes: every wind-up, contact and settle, and strips of the set-down and the spanner | yes, two rough cuts | not scored (it was built before the review pack existed; the user's approval stands in) | approved |

## Decisions taken

- One continuous take, no cut-in on the spanner: the push gets close enough.
- Type sits on the back wall in the top third; the action stays below it. Each number leaves with its beat, so the wide shot carries only "No investors. / No funding."
- Resting faces have the inner brow ends a little raised (`EASY_R`, `EASY_V` in `take.ts`): a level brow reads as a frown once the head is turned and tipped down.
- Music enters on the oven landing and its last note lands on "5,000".

## Departures from the board (the user has been told)

- The press stands left of the table, so the camera travels left for beat 3; Vikas turns to it instead of walking.
- The oven lands on "10,000" (the walk-in needs the time), so thud and number land together; "AN OVEN" appears on "oven".
- Vikas dusts his hands off instead of wiping his brow: a brow wipe cannot be drawn well side-on with this rig.

## Known weak spots (tell the user before they find them)

- The three small red labels (AN OVEN, A MACHINE THEY BUILD, REVENUE) measure only about 2:1 against the grey-green wall, under the 3:1 a label wants. This was found by a check added after the film was approved (the dry run now measures type against what is really drawn behind it, and lists these three as notes). The amounts under them measure 5:1 to 9:1. A darker accent, or labels in the ink colour, would mend it; that is the user's call, since the film is approved as it stands.
- Six moves in `take.ts` are written out of time order (the dry run lists them); the performance is the approved one, so they are left.

## Fetched from outside (every download, with its source)

Epidemic Sound, 2 Oct 2026:

- Music: "Last Pieces" by Spectacles Wallet and Watch, cut to 13.6 s with the edit tool. Tried and not used: "Small Suggestion", same artist (it builds in its second half).
- Effects: Large Metal Garage Door, Open; Footsteps, Sneakers, Concrete, Walk, Close; Toaster, Put Down On Worktop; Table Lamp, Metal, Antique, Down On Table 02; Metal Cabinet, Smack, Slap, Hand Palm; Metal, Impact, Heavy, Metal Pole; Metal Frame, Very Small; Ratchet Wrench Fast Turn Click; Metal Tool, Small, Down On Metal Surface; Clap, Single, Hands Rubbing Together; Tin Box, Small, Empty, Lid, Pop Open; Coin, Drop Into Metal Tin, Onto Others; Money, Banknotes, Handling; Room Tone, Courtyard, Distant Traffic, Oslo.
- From the user's own earlier project: a page flip, a tap and a low hit.

The sound files themselves are not shipped with the skill (they are licensed to the user's account), so this film's mix cannot be rebuilt in a fresh studio; its `sound.json` is there to be read.

## Open with the user

- Spelling of the engineer brother's name (Vikas or Vikash). No names are shown in this film.
