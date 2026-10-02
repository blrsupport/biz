# Review: how a sequence is checked

Nothing in a film is trusted because it was written carefully. Every sequence goes through the same gate, in this order, and does not move on until it passes: the dry run, a look at stills, a half-size pass with the voice, the motion audit, and a review by fresh eyes. The numbers come from the two approved demo clips, so a sequence that passes is at least as careful as those.

## Contents

1. The dry run (`tools/check.ts`)
2. What each failure means, and the usual fix
3. The `allow` list
4. Looking at stills
5. Defects that have come up before
6. The half-size pass and the motion audit
7. Reading a frame strip
8. The review by fresh eyes: rubric and brief
9. The whole film

## 1. The dry run

```bash
node tools/check.ts <film> [--seq <seq>] [--cam] [--pops] [--cues out/<film>/cues.json]
```

It builds every frame of every sequence in Node, exactly as the view will draw it, and inspects the display list. No browser starts, so it takes seconds; run it after every change. A line that starts with `!!` is a failure (exit code 1). A line that starts with `?` is something to look at.

What it prints, in order:

| Line | What it tells you |
|---|---|
| `marks ...` | The named moments of the take. Check each against the word it should be on. |
| `N frames built ...; bad shapes; missing from the palette` | Every outline has 3 or more points, a positive area and finite numbers; every material and light exists. |
| `most in one frame: shapes, paths` | The cost of the heaviest frame. The budget is 2,400 paths. |
| one line per figure | Sharpest elbow and knee (35 degrees or more), most stretch of a limb (6 % or less), a pinned hand's distance from its pin (3 px or less), how far a planted foot moved between two frames (1.5 px or less). |
| `with someone in view, the largest figure is at least N %` | Staging: in a wide shot a figure wants 22 % of the frame's height or more. |
| one line per figure with an actor | How long it is in view, in what share of that time something of it moves (a hand, the head, the hips), and its longest spell of breath alone. Over 4 s is flagged; the longest in the example films is 3.1 s. |
| one line per piece of type | Its text; when it lands and how far that is from its word; where it is on screen and whether that is inside the safe zone; its cap height; the nearest head; its contrast against what the sequence says is behind it (`over`), and the contrast measured against what the display list really draws behind it (nine points of the piece, every other frame, with the time and the thing where it is lowest). |
| `appearances, disappearances and jumps ...` | Things that pop in or out inside the frame in one frame, or move more than 170 px between two frames. |
| `allowed N time(s): reason` | The exceptions the sequence declared, with the reason for each. |
| `cuts in at N s` | This sequence covers the frame from its first frame, so nothing is carried across from the one before: a hard cut. Fine when the board chose a cut; otherwise the hand-over has not been built yet (`perform.md`, joining two sequences). |
| `longest stretch with no cue, no type landing and no named mark` | Over 2.5 s is flagged for a look. |
| `the takes are anchored to N word(s)` | The words the film's timing rests on, and which of them stand inside a phrase. Those are estimates: check the ones that carry type or a contact with `python tools/words.py <film> --look <word>` (`sound.md`). |
| `moves written out of time order` | A move or a verb written later in the file that starts earlier removes the one written before it, silently. Each is listed with its file and line. Reorder them, or confirm the removal was meant. (The two example films carry a few from before this check existed.) |
| `facts` | Names and spellings, and which the user has confirmed. |
| `source rules` | The film's own files hold no randomness, clock, filter, blend, blur, frame number, view code or stray colour. |

`--cam` adds, twice a second, where the camera is, what it frames, and where each actor is on screen: read it to place type and to see who is in frame. `--cues` writes the cue list for the sound mix.

Write the output to a file with `--out out/<id>/check.txt`, never with a shell redirect: a redirect to a file Windows has locked fails before the dry run starts, and the `PASSED` you then read is an older run's. `tools/deliver.mjs` likewise refuses a mix whose sound sheet or cue list has changed since it was made, because a mix that fails half way leaves the older `mix.wav` behind.

A line `backs up N % of its distance before it sets off` means a long move was given an overshoot: see `perform.md`.

## 2. What each failure means, and the usual fix

| Failure | Cause | Fix |
|---|---|---|
| bad shapes | An outline collapsed (a width or a radius went to zero or negative, often at the start or end of a move) | Clamp the value, or do not list the shape while it has no size |
| not in the palette | A material name is misspelt, or a prop's palette was not merged into the sequence's | Spread the asset's palette into the sequence's palette |
| an elbow or knee folds too far | A hand or foot target is too close to the shoulder or hip | Move the target out, or lean the body away |
| a limb is stretched | A target is out of reach | Step the actor closer, lean or crouch the body toward it (`body: true` on `reach` does this), or move the thing |
| a pinned hand is off its pin | The pin moved out of reach while the hand was pinned | As above; or release the hand earlier |
| a planted foot moves | A turn or a shift was keyed while that foot carried the weight | Let `turnTo` re-plant; do not move `x` by hand during a stance |
| type is not in the narration | The text is not the narrator's words in the narrator's order | Use the words as spoken. A looked-up spelling goes in the film's `facts` with `says` |
| type lands off its word | `at` was typed as a number, or taken from the wrong occurrence | `W("word")`, or `W("word", 2)` for the second time it is said |
| type outside the safe zone | The camera carries the wall the type is on | Place it with `under(t, depth, screenX, screenY)` for the moment it is read; put sky type at depth 30; end the block before the camera moves on |
| type too small | The block is sized for a closer framing than the camera has when it lands | Raise `cap` or `size`, or land it after the push |
| type near a head | An actor stands or rises into it | Move the block, shorten its stay, or delay the actor's move |
| contrast too low | Accent colour against a mid-tone | Move the block onto a lighter or darker part of the world, or give the film's type a darker accent |
| contrast too low against what is drawn behind it | A glow, a gradient, a far roof or a shadow lies behind the type that its `over` list does not name | Take it out from under the type (pull the glow down, lower the roofline, move the type), or change the type's colour. For a number, a name or a phrase this fails; for a small label it is a note |
| type stands across two surfaces (a note) | Half of a piece is on sky and half on a building, or a hard edge runs through it | Give it one calm ground: move it, or move what is behind it; remember a far layer climbs when the camera pushes in |
| a figure only breathes for N s (a note) | Someone in view has no verb for a long stretch | A look, a shift of weight, a hand that does something; or take them out of frame |
| things appear or vanish | A prop is listed from one frame to the next with no entrance | Give it one: slide, grow, fade, carry it in, bring it from behind something. If it truly is hidden, name it in `allow` |
| moves of more than 170 px a frame | A value jumps (a `reset`, two moves issued out of order), or something really is that fast | Fix the jump; or, for a real whip close to the lens, add ghost copies and name it in `allow` |
| over the path budget | Too many shaded shapes in view | Make far and small shapes `flat`, drop what is out of view, merge detail |
| colours written as literals | A hex colour in a take or frame file | Put it in the asset's palette or the film's `palette.ts` and use its name |

## 3. The `allow` list

A sequence may declare things that are allowed to appear or vanish in one frame: `allow: [{ id: /^door\//, why: "the shutter's slats roll up into the housing, which is drawn in front of them" }]`. The dry run cannot see that one thing is hidden behind another, so this is how the sequence tells it.

Each entry needs a true reason of one of these kinds: it is hidden behind something drawn later; it is an impact (dust, a splash, a spark); it leaves or enters at an edge the check cannot see; it is edge-on for a frame (a turning page). "It is small" or "nobody will notice" is not a reason: give the thing an entrance. The reasons are printed in the report and the reviewer reads them.

## 4. Looking at stills

Two ways to see a frame, and each has its job:

- **`node tools/preview.ts <film>-<seq>:0.3 <film>-<seq>:3.26 ... --sheet <name>`** draws the display list with Pillow, with no browser, in about a second a frame. Type is set plainly and does not animate, and there is no finishing pass. Use it for staging while you work: where everyone stands, what covers what, tangents, where the type sits against heads, whether a thing is big enough. Run it as often as you like.
- **Real stills** are the film. Use them to judge the look, faces and hands, type as it lands, and anything close. Batch them in one command (one browser).

```bash
node tools/stills.mjs <film>-<seq>:0.3@0.5 <film>-<seq>:3.26@0.5 ...
node tools/board.mjs --out <name> --labels "0.3|3.26|..." out/stills/<...>.png ...
```

The moments: the first frame; for each action its wind-up, its contact and its settle; each piece of type just after it lands; each camera rest; the join frames (the last before the hand-over, the middle of it, the first after); the last frame. For a face or a hand, render a crop at full size (`@1`) rather than guessing.

Put the sheet beside the approved style frame (this film's, and the five frames of the example films in `docs/img/`) and ask, of each still:

- Could this be cut next to the style frame? Same edges, same light direction, same palette, same proportions of people to set.
- What do I look at first? Is that the thing the words are about? Is it large enough on a phone?
- Does every pose read in silhouette? Are both hands doing something? Is weight on a foot?
- Is anything touching the frame edge, another shape or the type by accident (a tangent)?
- Is the right fifth of the frame free of anything that matters?
- Is the type the narrator's exact words, big, level, clear of heads?
- Does the light fall the way the shadows say?

One look at a sheet, one pass of fixes, then move on. Re-inspecting the same sheet three times is how hours go.

## 5. Defects that have come up before

Check for these by name; each cost a round on the demos.

**Staging and type**
- Type written at a moderate depth slid out of the safe zone as the camera travelled. Type across a sky goes at depth 30; type on a wall is placed for the framing in which it is read.
- A phrase overlapped a wall top that rose as the camera tilted. Delay the tilt or end the phrase earlier.
- A person stood where a prop needed to read (a buyer over a scale's beam). Print `--cam` and separate them.
- A second person showed at the frame edge in a beat that was not theirs. Move the action or the camera so the edge is clean.
- A thing that matters was too small for a phone (a bell). If it is the point of the beat, it is at least a twelfth of the frame's width.
- A figure was hidden behind something close to the lens just as it mattered. Re-time the entrance.

**Acting**
- A throw read as a wave, and the thrown piece was lost against a busy heap. Show the wind-up, send it on a high arc, give it ghost copies, and make it darker or lighter than what is behind it.
- A hand at the face (a call, pushing glasses up) was hidden behind the head, then too low, then too far out. Use the arm on the far side of the body; check a full-size crop.
- An arm whose forearm would point at the camera was folded anyway and looked broken. Give that arm a smaller gesture, or use the other arm.
- A level brow read as a frown once the head was turned and tipped down. Resting faces carry the inner ends of the brows a little high.
- A flying thing pointed nose-down because a tilt had the wrong sign. Look at a strip, not one still.
- Someone stood stiff in the middle of a turn. A turn leads with the eyes and head; the body follows; something else (a hand, a shift of weight) overlaps it.

**Camera**
- Overlapping `cam.to()` calls made the camera swing. Key the whole move once with `cam.keys()`.
- Where type is on a wall, a push that changes zoom and tilt at different times makes the type wander. Zoom and tilt leave a key together.
- A gesture that only read from the screen-right arm was lost under the Shorts buttons. It has to read from the body and the screen-left arm.

**Sets and drawing**
- Hairline seams showed between stretches of a tiled set at full size. Build each stretch a few px wider than its share.
- A shadow was drawn as a grey overlay and doubled where two overlapped. A shadow is the surface's own unlit tone.
- A set piece arrived in four or five frames (a pier cap, a deck). Anything that forms on screen takes at least ten frames, with a settle.

**Sound**
- An effect that landed on a key word masked it. It was pulled down until the voice was 6 dB over it.
- A character's call was given a voice and fought the narrator. Calls and shouts are silent gestures.

## 6. The half-size pass and the motion audit

```bash
node tools/render.mjs <film> --scale 0.5 --from <t0> --to <t1> --out <film>_<seq>_draft
node tools/rough.mjs <film> out/video/<film>_<seq>_draft.mp4 --from <t0>
python tools/audit.py "out/video/<film>_<seq>_draft.mp4|<seq>"
```

`rough.mjs` puts the voice on the draft; that file is what the user may be shown. `audit.py` measures the picture the way the old films were measured:

| Measure | Old films | Pass |
|---|---|---|
| Frames with no visible change | 19 to 27 % | under 1 % |
| Held frames inside a move | 14 to 33 % | 0 |
| Time near-still for 0.75 s or more | 15 to 29 % | 8 % or less, and no stretch over 1.25 s |
| Cuts | one every 2.5 s | 0 inside a sequence |
| Full-screen flash frames | 6 | 0 |

A held frame inside a move means something is being animated in steps: find it and put it on a track. A near-still stretch means nothing is happening: add an action, a look, or a camera move that reveals something.

## 7. Reading a frame strip

```bash
node tools/strip.mjs <draft.mp4> --from 3.0 --to 3.6 --every 1 --cols 9
```

lays every frame of a fast action side by side. Read it for: a wind-up before the move (a frame or two the other way); spacing that widens then closes (not equal steps); an arc, not a straight line; parts that arrive one after another (hand, then forearm, then the body settling), not all on one frame; an overshoot and a settle at the end sized to the weight (a heavy thing lands dead, a hand rings a little). If two consecutive frames are identical inside a move, that is the held frame the audit counts.

## 8. The review by fresh eyes

Whoever built a sequence cannot see it any more. Hand the review to a fresh reviewer (a subagent, where they are available; otherwise yourself after the other sequences, with only the pack open).

```bash
node tools/pack.mjs <film> <seq> --clip out/video/<film>_<seq>_draft.mp4 --strips "3.0-3.6,5.1-5.7"
```

writes `out/<film>/pack/<seq>/`: the dry run's output, a contact sheet, the frame strips, the audit, and `pack.md` with the score table.

**The brief for the reviewer** (give it nothing else):

> You are reviewing one sequence of an animated Short. Look at the approved style frames (`docs/img/*.jpg`, and this film's own: [paths]), read `docs/review.md` sections 4, 5 and 8, then open the pack at [path]: the contact sheet, each frame strip, `check.txt`, `audit.txt`. Score the six points of the rubric from 1 to 5. For anything under 4, name at most five defects, each with its time in seconds and what is wrong, most serious first. Check the hard fails. Read the `allowed` lines in `check.txt` and say if any reason does not hold up in the pictures. Do not suggest redesigns; say what is wrong. You did not build this and you owe it nothing.

**The rubric**

| # | Point | 5 looks like | 2 looks like |
|---|---|---|---|
| 1 | Same film | Could be cut next to the style frame: same edges, light, palette, proportions | A different recipe: outlines appear, flat fills, a new palette |
| 2 | Motion | Wind-up, arc, overlap, settle; weight shows; nothing starts or stops in one frame; no held frames inside a move | Pose-to-pose jumps, straight hand paths, everything stops together, sliding feet |
| 3 | Staging | One clear thing to look at; the action reads in silhouette; nothing important under the Shorts buttons | Tangents, key action tiny or covered, two things competing |
| 4 | Type | Verbatim, lands on its word, top third, big enough, clear of heads, leaves by design | Pops on and off, small, over a face, invented wording |
| 5 | Joins | Arrives from the last sequence and hands to the next with something carried across; no cut the board did not ask for | A new clip glued on; palette or light changes at the join |
| 6 | Life | Breath, blinks, weight shifts, drifting dust, a camera that never quite stops; holds are alive | Frozen figures, dead holds over 0.75 s |

**Hard fails, whatever the scores:** a limb through a head or torso; a planted foot that slides; type outside the safe zone; a word or number on screen that the narrator does not say; a redrawn trademark; a flash frame; the voice masked by an effect.

Anything under 4 goes back to the builder with the named defects. Write the six scores in the film's `STATE.md`. A score is a fact about the sequence, not about the effort: do not round up.

## 9. The whole film

After the last sequence passes, look at the film as one thing before the full-size render:

- **The joins.** For each one, three stills: the last frame before the hand-over, the middle of it, the first after. The light and palette may change across a join only if the board says the world changes.
- **The arc of light.** One still from the middle of each sequence, in a row. It should read as a day, or a journey, not as eight unrelated pictures.
- **Type.** Every block in one sheet: same faces, same sizes for the same kind of thing, same accent colour.
- **The audit on the whole clean render**, and the dry run on the whole film (`node tools/check.ts <film>`), which also checks that the sequences cover the film with no gap.
- **Sound**: every check in the mix report true (`sound.md`).

Then deliver, and say the weak spots you know about before the user finds them.
