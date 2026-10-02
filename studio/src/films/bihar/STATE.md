# Bihar Mushroom: state

**PAUSED 2 Oct 2026, to resume next week when the user's usage resets.** The user scored rough cut 2 (out/video/bihar_rough2.mp4) at 2/10: arms twisting, people acting like robots, the first scene bad. They asked for the build to stop and for proper scenes only. `board.md` is now board v2 (4 worlds, 7 sequences, a lorry bookend, staging rules from cut 2's bugs); v1 is `board_v1.md`. The built sequences follow v1 and will be rebuilt from v2. Open: the user's Vipul film folder (D:\Claude Projects\YT_business_anim\1. Vipul) is the format they want matched; it is on their PC, not in the repo.

## Budget (the user's limit is $50 of credit, not meter points)
- Start: user reported $48 left on 2 Oct 2026 (about $2 already spent on setup). Stop line: if the credit falls to $8 with the film not delivered, stop, save state, tell the user what is left and ask.
- Readings: start $48 (2 Oct); after Stop A $37 (2 Oct; $11 used on setup, board, cast and phase 1 of both worlds); mid-build $22 (2 Oct; $15 on phase 2, well ahead of the table); after rough cut 1 $21; home, lab and today then rebuilt by the main session for rough cut 2. Dropped to the floor: both workers told to wrap up in 6 turns, simplest form for anything unbuilt, no more sheets. Next: after the build, before the full render.
- Phase 2 caps (to stay above the line): about 40 more turns per worker, one preview sheet per sequence, simplest board form where a beat is costly.

Read this and board.md at the start of every session. Update it after every sequence. Nothing that matters lives only in a conversation.

## Scoreboard

| Step | Status |
|---|---|
| Words and tighten (`python tools/words.py bihar -v`) | done: 359 words, 112.06 -> 110.33 s, 12 pauses tightened (1.73 s) |
| Board | written (board.md); 6 sequences s1(hook) home shed seed lab today, placeholders made |
| Cast sheet and one style frame per world | cast out/stills/cast_bihar.png; style frame out/stills/style_spawn2.png (shed 52.3 s); village sheet out/boards/s1_p1.png |
| Stop A: the user approves board, cast and style frames | APPROVED 2 Oct ("yes go ahead"). Phase 2 started. Fix list for the shed worker: bottle held at arm's length into the doorlight (not at his eye), oyster mushrooms as cream fans not white puffs, the split bag on the floor reads oddly, plus its 3 dry-run fails |
| Sequences | see the table below |
| Assembly, audit, finishing pass | whole-film dry run PASSED (3313 frames, 6 seqs); half render out/video/bihar_half.mp4; rough cut with full mix out/video/bihar_rough_sound.mp4 sent; audit: held-in-move 0.4 %, near-still 47 % (longest 10.97 s), 0 cuts |
| Sound | sound.json written; mix PASSES (-14.1 LUFS, TP -1.6, voice over music/effects ok; music dipped at 34.4, 71, 91.6, 106.4). Silent on purpose: birds, glint, lamp, water, steam, hen, horn.far (no sound fetched for them) |
| Delivered (Stop B) | |

## Sequences

| Seq | Seconds | Dry run | Stills looked at | Draft with voice sent | Review scores (same film, motion, staging, type, joins, life) | Status |
|---|---|---|---|---|---|---|
| s1 | 0.00 - 12.38 | PASSED (2 Oct, phase 2) | s1_p1 (phase 1 only) | | | built; beat 3 (trader out, sack B swung past the lens, screen space, covers 12.2) unseen |
| home | 12.28 - 34.74 | PASSED (2 Oct) | none (budget) | | | SIMPLEST: Sanjeev walks in and stands while type lands; no trunk, degree, father, straw, Solan walk or grow bags; ends walking into the big shed's dark doorway, camera pushes in (dark by 34.62) |
| today | 88.47 - 110.33 | PASSED (2 Oct) | none (budget) | | | SIMPLEST: jamb slides off by 88.9; drift over lane with 3 huts + bags, sack stack, SANJEEV_NOW; all 8 type blocks; no porters, trader or silhouettes; turns from the city on "chose" |

| shed | 34.70 - 52.79 | PASSED (2 Oct, phase 2) | out/boards/shed_p1.png (phase 1 only) | | | built; style-frame notes applied (bottle at arm's length, cream oyster fans, no split) but not looked at again |
| seed | 52.79 - 64.91 | PASSED (2 Oct) | none (budget) | | | built from board, unseen; watering with lota; three sacks, third covers lens |
| lab | 64.91 - 88.47 | PASSED (2 Oct) | none (budget) | | | simplest form: reveal, racks/drum, farmers at door, type; no rack push, tray, teaching or bag-carrying; ends on jamb |

## Decisions taken
- Two worlds: village (new set, worker A: s1, home, today) and shed/lab (library room re-dressed, worker B: shed, seed, lab).
- Spellings from the user: BIT Sindri, Sanjeev Kumar, Solan, Himachal, SABRI Spawn Lab. In film.ts facts.
- ffmpeg: tools/bin links to the system build (/usr/bin/ffmpeg 6.1.1, full).

## The stage (so the next session need not read the take to find it)

Where each set piece, prop and actor's mark stands, where the light comes from, and which later beat depends on which position.

**shed / seed / lab (shed worker).** Set `src/assets/sets/shed.ts` (room.ts re-dressed), U 172, GY 1500. Back corner x 330; the doorway is in the left wall (opening x -63..282 at the floor, top y 546-671); light `LIGHT_SHED` from the door at frame left (lab: `LIGHT_LAB`, same door, plus a window in the back wall). Thatch underside above y ~224. Bamboo pole y 650 on posts x 590 / 1530; ropes x 700, 860, 1020, 1180, 1340, bag tops y 684 (upper) and 908 (lower); a fainter row at x 780..1420 on the wall (depth 0.09). Crates by the door x 385 (the bench of `seed`): lota x 304, dull bottle x 372, good bottle x 442, base y ~1156. Hurricane lamp hangs on the near post (base [604, 846]); unlit in shed, lit in seed. Crates at right x 1130 with the cash tin (x 1120); calendar on the wall x 1150, y 360. The fruiting bag is x 700 upper; the dropped bag lies on the floor, tie at [900, 1429], body to its left (grey, not split). At 52.79 Sanjeev stands at x 505 facing left, far hand R at [222, 738] holding the good bottle out into the doorway; seed carries on from the same marks and camera.
seed: night = gradient overlay plus door darkened, lamp glow. Porters' sacks rest inside the door at x 318 and 196; the near-lens sack covers the frame from 64.47 (lab opens on it and lifts it by 65.66).
lab (simplest form): same room whitewashed (`LAB_PALETTE`), window x 1420, racks x 800 and 1180, steaming drum x 500, Sanjeev x 930, two farmer silhouettes at the door x 200 / 70. Exit: the dark jamb (`shedJamb`, slab on the left, edge sliding right) covers the frame by 88.47, so `today` opens on it.

### Village (s1; home and today will reuse it)
- Set `src/assets/sets/village.ts` (pieces placed per sequence, sized by `u`), props `src/assets/props/village.ts`. Lights `VILLAGE_LIGHTS` (morning left, afternoon right, sunrise left).
- Shared lane: `src/films/bihar/s1/lane.ts`. Far hills x -700..900 and city x 780..1900 at depth 4 (horizon y 1012), fields 1.6, house x 300 / bananas / straw / trees at 0.35 (foot y 1262, u 112), pump 0.12 at x 1000, lane 0 (GY 1500), grass -0.3. The small shed is gone from the house layer.
- s1: trader (IRAKI) x 360, out left from 9.0; farmer (BUYER) 1190 -> 748 -> 880 -> 712 -> 332. Sacks are `spawnSack`. Sack B leaves his hands at 10.94 and the screen-space pass (`passItems`) covers the frame by 12.2; home draws its end to 12.78.
- home: afternoon light (sun right). Sanjeev x -260 -> 600, then into the full-size shed (`BIG_SHED`, x 1700, u 261, door x 1478..1857); the camera ends at the door centre, zoom 3.3.
- today: sunrise light; the screen-space `sil` jamb slides right, 88.47-88.9. Huts x -700 / 1250 / 1700 (house layer), sack stack x 230, SANJEEV_NOW x 660.
- Type sits in the sky at screen y 260-440, because heads reach about y 480.

## Files this film owns outside its folder

Library files made or changed for this film (under src/assets), and whether another film uses them.
- `src/assets/props/mushroom.ts` (new, shed worker): `growBag`, `spawnBottle`, `spawnSack`, `MUSHROOM_PALETTE`. Used by shed/seed/lab and imported by the village worker.
- `src/assets/sets/shed.ts` (new, shed worker): `buildShed`, `shedBack`, `shedFloor`, `shedTop`, `shedJamb`, `shedRope`, `SHED_PALETTE`, `LAB_PALETTE`, `LIGHT_SHED`, `LIGHT_LAB`. Reuses `buildRoom` from room.ts.

## Which outputs are current

The render, the dry run output and the review pack that describe the film as it stands now, with their times. Anything older is stale: say so or delete it.

## Departures from the board (tell the user)

## Known weak spots (tell the user before they find them)
- home and today in simplest form: father, trunk, degree, Solan walk, grow bags, porters, trader not built. lab in simplest form. seed and lab never looked at before the render.
- About half the film is near-still (audit 47 %).

## Fetched from outside (every download, with its source; for a music track its recording id as well, since signed links expire)
- `public/audio/bihar/music_suhana_110400.wav`: Epidemic Sound, "Suhana, Aashray Harishankar (edit 110.4 s, recording 4b9e201f-f862-4758-abaf-ccd5a15cc92e)"; preview https://audiocdn.epidemicsound.com/lqmp3/01KTGN2TRQKHA2B5C87WFG6W4M.mp3
- `public/sfx/bihar/steps_dirt_barefoot.wav`: Epidemic Sound, "Footsteps, Human, Barefoot, Dirt, Walk, Close"; preview https://audiocdn.epidemicsound.com/lqmp3/01KK3HYAB8QMJ108KYF2WHF4NC.mp3
- `public/sfx/bihar/sack_down.wav`: Epidemic Sound, "Plastic, Impact, Plastic Bag, Full, Put Down On Wooden Floor"; preview https://audiocdn.epidemicsound.com/lqmp3/01KHTRZQ6BQRB97CW7E52V0K1R.mp3
- `public/sfx/bihar/banknotes.wav`: Epidemic Sound, "Paper, Handle, Money, Banknotes, Handling"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJ3AJDWGCPRANSH3NX8M0MBX.mp3
- `public/sfx/bihar/rope_creak.wav`: Epidemic Sound, "Rope, Creak, Long Rope Creak, Rope Tension, Rope Stretching 05"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJZ5VSSD3WTD8PNF25EA88Y1.mp3
- `public/sfx/bihar/whoosh_cloth.wav`: Epidemic Sound, "Swooshes, Swish, Low, Cloth Movement, Variations"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJZ3D0SKQY47T87RCXCRK9F8.mp3
- `public/sfx/bihar/glass_bottle_down.wav`: Epidemic Sound, "Glass, Impact, Bottle, Milk, Empty, Set Down On Concrete Ground 02"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJ2NHM4DJP1T4968YPR4G5CG.mp3
- `public/sfx/bihar/plastic_rip.wav`: Epidemic Sound, "Objects, Packaging, Cling Film, Plastic Wrap, Rip"; preview https://audiocdn.epidemicsound.com/lqmp3/01KHXAW4R6EKWC0GPWAMZ59WEJ.mp3
- `public/sfx/bihar/door_wood_creak.wav`: Epidemic Sound, "Doors, Wood, Open, Creak 01"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJ68H81PSC655CH9B0JDHEP7.mp3
- `public/sfx/bihar/page_turn.wav`: Epidemic Sound, "Paper, Handle, Notepad, Page Turn 07"; preview https://audiocdn.epidemicsound.com/lqmp3/01KHTMMPCRER0AXDX63H3GQ0XE.mp3
- `public/sfx/bihar/amb_village_morning.mp3`: Epidemic Sound, "Ambience, Town, Village, Morning, Goats, Birds, Distant Voices, Ducks, Amethi, Uttar Pradesh, India 01"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJ7GCPYA0X4M3HVBW5T3PSP3.mp3
- `public/sfx/bihar/amb_village_walla.mp3`: Epidemic Sound, "Ambience, Town, Village, Late Morning, Ducks, Insects, Birds, Walla, In The Background, Amethi, Uttar Pradesh, India 01"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJ7GCQ19BS0C12SFG0C1X18Q.mp3
- `public/sfx/bihar/amb_shed_interior.mp3`: Epidemic Sound, "Ambience, Farm, Shed, Interior, Very Quiet, Calm, Muffled Exterior Birds 01"; preview https://audiocdn.epidemicsound.com/lqmp3/01KJYMRD12EBGPEB3T0YPY5CJ2.mp3
- Music edit: job 20edfa96-c457-4980-992f-046097ade02c, edit 6c994aac-8ac3-49eb-a93d-5247df76f365 (110.4 s, original 70-84 s kept at 81.5 s so its arrival falls at 88.0 s of the edit). Place with `at` 1.5: the arrival lands at 89.5, just before "50" (90.19); the last chord stops at 109.8. Re-fetch: `node tools/fetch.mjs bihar out/bihar/fetch.json` (links expire; ask the connector for fresh ones).

## Open with the user
