# Engine reference: what a take is written with

The API behind `perform.md` (the one-page method): every call a take makes, with units, signs, defaults and what each
call leaves behind, so that you need not open the engine source (`src/engine/` in the studio). Sections 1 to 11 cover
`take.ts`; section 12 covers the display list that `frame.ts` returns, the sequence and the film. If a field named
here is not in the source, the source wins.

The `ts` blocks are one small take cut into pieces (the start of Demo 1 in miniature). They run top to bottom as one
file, so a name made in one block is used in later ones; they were run as printed, and the values in comments are what
they gave. The full models: `src/films/md/take.ts` (two actors in a room), `src/films/ggsp/take.ts` (a long travel).

## Contents

- [1. Ground rules](#1-ground-rules) and [2. Imports](#2-imports): units, signs, what Node needs, where everything lives
- [3. Time](#3-time): `makeAnchors`, the `Word` table
- [4. Motion core](#4-motion-core): `Track`, `WEIGHT`, `Path2`, `Blend`, noise
- [5. Actors](#5-actors): channels, idle life, feet, `walkTo`, `turnTo`, `solve`
- [6. Verbs](#6-verbs): every verb, its options, what it moves and what it leaves
- [7. Props](#7-props): `Prop`, grips, carried and set down
- [8. Camera](#8-camera): `keys`, depth, placing things by where the camera will be
- [9. Figures as output](#9-figures-as-output): `buildFigure`, faces, hands
- [10. Type](#10-type): layout, faces, the four blocks, and [11. Small helpers](#11-small-helpers): `geom/vec.ts`
- [12. The display list, the sequence and the film](#12-the-display-list-the-sequence-and-the-film): items, fills, `Sequence`, `Film`

## 1. Ground rules

| Thing | Convention |
|---|---|
| Time | Seconds in the tightened voice, everywhere; no frame numbers in a take (`FPS` is 30; `framesFor(seconds)` only sizes a composition). Every animated value is a function of `t` alone, so any frame renders alone and the same every time: no `Math.random`, no `Date`, nothing carried from frame to frame. Use `hash`, `noise`, `wander`. |
| `at` | In every move and every verb, `at` is when the thing ARRIVES (the contact, the landing on the word). It starts earlier, by its `dur` plus any wind-up. |
| Stage px | x right, y DOWN. `Pt` is `readonly [x, y]`. Angles are radians; positive is clockwise on screen (a prop's `tilt`, a head's `roll`, a wrist). |
| Head-heights | An actor's `scale` is px per head-height (the demos use 172 and 178 and call it `U`). Body measures are in head-heights: `drop`, step length, `armTo` offsets. The cast stand 5.4 to 5.9 tall, eyes 4.8 to 5.2 up, shoulders 4.0 to 4.5 up; an arm is 1.9 to 2.0 long. |
| `yaw` | 0 faces the camera, + faces screen right. A walk uses 1.22 or -1.22: side-on, a little open to us. `"L"` and `"R"` are the character's own left and right; facing right the near side is R, facing left it is L. `lean` and `bend` are + toward screen right, whichever way the body faces. |
| Node | A take is a `.ts` file that plain Node runs, with no browser. Import with a relative path and the `.ts` extension, and import a type as a type (`import type`, or `type X` inside the braces): Node only strips types, so a type imported as a value fails with "does not provide an export". Node cannot import `.tsx`, so a take never imports one. Never give two files names that differ only in case (`take.ts`, `Take.tsx`): Windows cannot tell them apart. |

## 2. Imports

```ts
import { CAST } from "../../assets/cast/cast.ts"; // paths as in src/films/<film>/take.ts
import { buildFigure, stand } from "../../engine/figure/body.ts";
import { HANDS, mixHand, type HandPose } from "../../engine/figure/hand.ts";
import { FACES, mixFace, type Expression } from "../../engine/figure/head.ts";
import { jointAngle } from "../../engine/figure/ik.ts";
import { add, area, dist, lerpPt, type Pt } from "../../engine/geom/vec.ts";
import { LOOKS } from "../../engine/look/looks.ts";
import { Actor } from "../../engine/motion/actor.ts";
import { Foot } from "../../engine/motion/feet.ts";
import { Prop } from "../../engine/motion/prop.ts";
import { Blend, Path2, Track, WEIGHT, hash, noise, wander, type Weight } from "../../engine/motion/track.ts";
import { armTo, callOut, crouch, dustHands, eyesOf, feel, handsOnHips, holdFromStart, lookAhead, lookAt, lookToCamera, nod, pat, pushGlasses, reach, release, shiftWeight, shrug } from "../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../engine/stage/camera.ts";
import { makeAnchors } from "../../engine/time/clock.ts";
import { RUPEE, TYPE_LOOKS, measure, type NumberCue } from "../../engine/type/blockspec.ts";
import { groupIndian, layout, sizeForCap, sizeForWidth } from "../../engine/type/layout.ts";
import { VO, WORDS } from "./words.ts";
```

## 3. Time

Never type a moment that a word can give. The voice is tightened by `tools/words.py` (pauses are trimmed) and every
re-cut moves every later time: an anchor moves with it, a typed number does not. And a word that is not in the voice
throws while the take is built, so a wrong anchor cannot ship. `words.ts` (generated, never edited) exports `VO`
(`file`, `duration`, ...) and `WORDS`, a list of `Word`: `{ w, n, t0, t1, src }`. `w` is the word as spelt in the script,
punctuation and all (`"rupees."`); `n` is the same normalised for matching, lower case with letters and digits only
(`"rupees"`); `t0` and `t1` are its start and end in seconds of the tightened voice; `src` is its start in the untrimmed
voice file.

`makeAnchors(words)` returns `W`. `W(phrase, nth = 1)` is the start of the phrase's first word, `W.end(phrase, nth = 1)`
the end of its last word, `W.mid(phrase, nth = 1)` halfway between. The phrase is split on spaces and normalised like
`n`, so case and punctuation do not matter; `nth` picks the nth time the whole phrase is said. Offsets from an anchor
are normal (`W("rupees") - 0.06`). Name the moments you reuse and return them as `marks`.

```ts
const W = makeAnchors(WORDS); // WORDS[10] is { w: "10,000", n: "10000", t0: 3.26, t1: 3.92, src: 64.96 }
const tPut = W("10,000"); // 3.26  the moment the narrator starts the word
W("no", 2); // 8.5   the second time it is said ("No" and "no" are one word)
W("no funding"); // 8.5   a phrase: the start of its first word
W.end("no funding"); // 9.16  the end of its last word
W.mid("oven"); // 2.47  halfway through it
// W("ovens") throws: word anchor not found: "ovens"
```

## 4. Motion core

`src/engine/motion/track.ts`. Three kinds of value over time, and all three take `at` as the arrival: a `Track` is a
number (every channel of an actor, a machine part, a 0 to 1 switch); a `Path2` is a point that travels on a bowed path,
never a straight line (a hand, a prop, a bird); a `Blend<T>` is a whole pose (a face, a hand shape).

| `Track` | Does |
|---|---|
| `new Track(x0)` | rests at `x0` until its first move |
| `to(target, { at, dur, w?, overshoot?, windup? })` | travels to `target`, arriving at `at` after `dur` seconds; returns the track. `ease(target, at, dur)` is the same with `WEIGHT.mech`. |
| `cruise(target, { start, speed, ramp = 0.45 })` | a long travel at a steady `speed` (units a second), easing in and out over `ramp` seconds; returns the arrival time. One eased `to` over a long way crawls at both ends. |
| `value(t)`, `state(t)`, `end` | the number at `t`; `{ x, v, a }` (value, speed, acceleration) at `t`; where it rests once everything queued has played |

| Option | Default | Meaning |
|---|---|---|
| `at`, `dur` | required | when it arrives, and the travel time. At `at` the value is exactly the target and still moving; the overshoot comes after. |
| `w` | `WEIGHT.body` | the weight of what moves (for `Path2.to` the default is `WEIGHT.hand`) |
| `overshoot` | the weight's | `0` lands dead. Use it for anything that meets a solid surface. |
| `windup` | the weight's | `0` = no wind-up. (It cannot add one to `eye` or `mech`: their wind-up time is 0.) |

A move occupies `at - dur - windupTime` to about `at + settle`: it backs up by `windup` x the distance, travels for
`dur`, passes the target by `overshoot` x the distance and settles. Speed and acceleration are carried across every
join, which is why nothing starts or stops inside one frame.

| `WEIGHT.` | Wind-up | Overshoot | Settle | `zeta` | For |
|---|---|---|---|---|---|
| `eye` | none | 0 | | | where the eyes look: quick, dead stop |
| `head` | 5 % over 0.12 s | 4 % | 0.35 s | 0.6 | head turns and nods |
| `hand` | 8 % over 0.16 s | 6 % | 0.4 s | 0.55 | hands, light things in a hand, glyphs |
| `body` | 5.5 % over 0.2 s | 3 % | 0.55 s | 0.65 | torso and pelvis: a person's own weight |
| `heavy` | 3 % over 0.26 s | 0.8 % | 0.8 s | 0.8 | a load, a body under load: starts slowly, does not bounce |
| `mech` | none | 0 | | | machines, the camera, switches (`held`, `pin`): eased, no life in it |

A `Weight` is plain numbers, `{ overshoot, settle, zeta, windup, windupTime }`: fractions of the distance, seconds, and
`zeta`, the damping of the settle (0.5 wobbles, 1 does not; kept within 0.2 to 1). Write your own when a thing has a
character, as the demos do: a shutter that rattles (`RATTLE`, below), a spanner left swinging on its nut (`SWING`:
overshoot 0.22, settle 0.9, zeta 0.22), concrete meeting concrete (`SLAM`: overshoot 0.014, settle 0.16, zeta 0.5). Or
spread a class and change one number: `{ ...WEIGHT.heavy, overshoot: 0.05 }`.

**Issue the moves of one track in time order.** `to` first throws away every queued move that starts at or after its
own start. In time order that is what lets a move take over from the one before it without a jump, even in mid-travel.
Out of order, the move you wrote first and meant to happen later is deleted without a word, and the value never goes
there. The same holds for `Path2`, `Blend` and foot plants (`walkTo`, `turnTo`); for verbs see section 6.

```ts
const lid = new Track(0); // a number over time: here the angle of a tin's lid, 0 = shut
const tOpen = W("revenue"); // 11.23
lid.to(1.9, { at: tOpen, dur: 0.4, w: WEIGHT.hand }); // it ARRIVES on the word
lid.value(tOpen - 0.4 - 0.16); // 0      still shut: a move starts `dur` plus the wind-up time before `at`
lid.value(tOpen - 0.4); // -0.152 the back of the wind-up (8 % of the travel), as the travel starts
lid.value(tOpen); // 1.9    on the target, still moving
lid.value(tOpen + 0.065); // 2.023  the most it overshoots (6 % of the distance it travelled)
const RATTLE: Weight = { overshoot: 0.016, settle: 0.45, zeta: 0.3, windup: 0, windupTime: 0 }; // light, and it rings
const shutter = new Track(0).to(0.984, { at: 0.32, dur: 0.62, w: RATTLE }); // `to` returns the track
const late = new Track(0).to(0.5, { at: 3, dur: 0.4 }); // written first, happens later
late.to(1, { at: 1, dur: 0.4 }); // starts earlier, so the move to 0.5 is thrown away
late.value(4); // 1, and nothing warned
```

`new Path2(p0)`, then `to(p1, opts)`, `reset(t, p)`, `value(t)`, `velocity(t)` (units a second) and `end`. The options
are those of `Track.to` plus:

| Option | Default | Meaning |
|---|---|---|
| `bow` | 0.14 | how far the path bows off the straight line, as a fraction of its length; 0 = straight |
| `pivot` | `[0, 0]` | the bow curves away from this point. For a hand that is the shoulder. For a prop give it yourself (the carrier's feet or shoulder): the default is the stage origin, which means nothing. |
| `avoid` | none | `{ c, r }[]`: circles to keep clear of; the bow grows (to 0.45 at most) until the path clears them |

The weight works along the path: the wind-up backs along it, the overshoot runs on past the end. A `to` written while
the point is still travelling skips the wind-up and bends into the new path at the speed it has. `reset(t, p)` puts
the value at `p` from `t` on with no travel: only for a moment when the value is not shown (section 7 uses it).

`new Blend<T>(first, mix)`, then `to(pose, at, dur = 0.18)`: positional arguments, and the pose is complete AT `at`.
`mix` is `mixFace`, `mixHand` or your own `(a, b, t) => ...`. Noise, for life that is the same on every render:
`hash(n)` is 0 to 1, fixed for each `n` (variety between items: `hash(i * 3.1 + 1)`); `noise(t, seed = 0)` is smooth,
-1 to 1, with a new random value at each whole number of `t`; `wander(t, seed = 0)` is three octaves of it, a slow
drift: scale `t` for speed, multiply for size, one `seed` per thing.

```ts
const crow = new Path2([-1010, 446]); // a point over time
crow.to([-976, 404], { at: 0.46, dur: 0.14, w: WEIGHT.mech }); // a hop
crow.to([-560, -760], { at: 2.64, dur: 2.2, w: WEIGHT.mech, bow: 0.1, pivot: [-1610, 2600] }); // then away, on an arc
crow.value(1.5); // where it is; crow.velocity(1.5) is its speed, for a tilt or a wing beat
const grip = new Blend<HandPose>(HANDS.grip, mixHand); // a whole pose over time
grip.to(HANDS.splay, 1.08, 0.1); // it IS splay at 1.08, having started 0.1 s before
const lampSway = (t: number) => 6 * wander(t * 0.4, 12); // within 6 px either way, slow, the same on every render
```

`RANGE_WARNINGS` (beside `ORDER_WARNINGS` in `motion/track.ts`) collects every `to` whose travel leaves the stretch between its start and its target by more than 5 %; the dry run prints them. `fromLayer(view, FRAME, depth, REF, point)` in `stage/camera.ts` gives a point of another layer in the actors' coordinates.

## 5. Actors

`src/engine/motion/actor.ts`, `feet.ts`. `new Actor(init)`:

| `ActorInit` | Meaning |
|---|---|
| `ch` | a `Character` (`CAST.rahul`, ... in `src/assets/cast/cast.ts`) |
| `scale` | px per head-height (read back as `a.H`) |
| `groundY` | the ground under the feet, stage px. Give actors who share a floor slightly different values (the demos: 12 to 18 px apart) so each walks a lane of its own. |
| `x`, `yaw` | where the pelvis starts, and which way the body faces |
| `seed`, `life` | `seed` (default 1) separates this actor's idle life from the others': give each its own. `life` (default 1) is how lively the idle is: 0 is a statue; the demos use 0.5 for figures that are shadows on a wall. |

Every channel is public and is a `Track` unless the table says otherwise.

| Channel | Unit and sign | Starts at | Moved by |
|---|---|---|---|
| `x` | pelvis, stage px | `init.x` | `walkTo`, `shiftWeight`; directly for a small shift (hips back in a crouch). The feet do not follow `x`: only `walkTo` and `turnTo` step. |
| `yaw` | rad, 0 = at camera, + = screen right | `init.yaw` | `walkTo`, `turnTo` |
| `lean` | rad, tilt of the whole spine from the pelvis, + = screen right | 0 | `crouch` |
| `bend` | rad, further lean gathered by the neck (a curved back), + = screen right | 0 | `crouch`, `reach` (its `body` lean), `callOut` |
| `drop` | head-heights the pelvis is lowered: the knees bend | 0 | `crouch` |
| `twist`, `hipRoll`, `shRoll` | rad: chest yaw minus pelvis yaw; tilt of the hip line and of the shoulder line, + = the screen-right side drops | 0 | `shiftWeight` (hips). A walk adds its own counter-turn of hips and chest. |
| `headTurn` | rad, head yaw on top of the body's | `-0.18 * yaw` | `lookAt`, `lookToCamera`, `lookAhead` |
| `headPitch` | rad, + = chin down | 0 | the look verbs, `nod`, `callOut`, `pushGlasses` |
| `headRoll`, `neck` | rad: head tilt, + = clockwise; extra neck lean in the picture plane | 0 | `shrug` (roll) |
| `gazeX`, `gazeY` | -1 to 1, + = screen right, + = down | 0 | the look verbs |
| `face` | `Blend<Expression>` | `FACES.neutral` | `feel`, `callOut` |
| `arms.L`, `arms.R` | `ArmCh`, below | hanging | the arm verbs |
| `feet.L`, `feet.R`; `gait` | `Foot`: a list of plants. `Gait`: the look of a step (`swingH`, px the ankle rises in mid-swing; `toeOff` and `strike`, rad, the heel-off and heel-strike angles; `rollT`, `offT`, s) | standing; 0.24 head-heights, 0.6, 0.3, 0.11, 0.22 | `walkTo`, `turnTo`; nothing moves `gait`: change a number before the walk |
| `blinks` | `number[]`: times of extra blinks | `[]` | the look verbs push one; push your own |

`ArmCh` belongs to the verbs. A take touches only `wrist` (rad, the hand bent from the forearm, + = clockwise) and
`shrug` (head-heights of extra shoulder lift). The rest: `rel` (a `Path2`: the hand, in head-heights from the shoulder),
`act` (0 = the arm hangs and swings with the walk, 1 = it follows `rel`), `pin` (0 to 1: how firmly the hand is held on
its pin point), `pins` and `pinPoint(t)` (the pin point in force, or `null`), `hand` (a `Blend<HandPose>`), `swivel` and
`swivelOn` (the elbow's side, when a verb takes it over), `palms` and `layers` (what `palm` and `layer` set, by time).

**Idle life.** With `life` above 0 a standing actor is never still: the pelvis sways, the chest breathes, the head
drifts, hanging arms float (and swing against the legs in a walk), the eyes dart every 1.7 s and blink once in every
3.4 s. Do not key any of that. **A starting pose** is set by replacing a channel before any move is queued on it:
`a.lean = new Track(-0.1)`, `a.drop = new Track(0.46)`, `a.face = new Blend<Expression>(EASY, mixFace)`, and for feet
apart `a.feet.L = new Foot(825)` (the ankle's x).

**Feet.** A foot is a list of plants, `a.feet.L.plants`: each `{ t0, t1, x }` is a touchdown, a lift-off, and the
ankle's x while it stands (the first has `t0 = -Infinity`, the last `t1 = Infinity`). Between two plants the foot
swings; while planted it only rolls from heel to toe, so feet cannot slide. Steps are planned from where the pelvis
travels, and the height of the pelvis comes from how far the legs can reach, which gives a walk its bounce (and lowers
the pelvis if you pull `x` away from planted feet). Every plant after the first is a footfall.

| `a.walkTo(x, opts)` | Default | Meaning |
|---|---|---|
| `start` or `arrive` | one is required | when the body starts to move, or when it comes to rest. With `arrive` the walk is planned backwards. |
| `pace`, `step` | 1.9, 1.45 | steps a second; step length in head-heights for legs of 2.5 (it scales with the character's legs) |
| `face` | 1.22 or -1.22 | the yaw to walk at; by default it faces the way it goes. Give it to walk backwards. |

It returns `{ start, arrive, steps }`. Speed is `step * scale * legs / 2.5 * pace` px a second (`legs` is thigh plus
shin, 2.35 to 2.75 for the cast) and the walk lasts `0.42 + distance / speed`. The body turns to `face` in the first
0.4 s and still faces that way when it stops, so follow a walk with `turnTo`. The actor must be standing where the walk
starts: `walkTo` reads `x` then. The trailing foot closes up a moment after `arrive`. `a.turnTo(yaw, { at, dur = 0.7 })`
turns the body, finished at `at`, with two small steps that re-plant the feet, and returns the actor. The yaw starts to
move `dur + 0.2` s before `at`. A turn from one side to the other passes through 0, that is, through facing us.

`a.solve(t)` gives everything about the actor at `t`: `pose` (the `FigurePose` that `buildFigure` draws; also
`a.pose(t)`), `feet.L` and `.R` (`{ x, lift, pitch, planted, swing }`), `ankles`, `shoulders` and `wrists` (`.L` and `.R`
as stage points; `shoulders` are the joints before an arm pulls on them, so measure a reach from these), and `fwd` (`1`
when the body faces screen right, else `-1`; also `a.fwd(t)`). `a.pelvis(t)` is the pelvis as a stage point, from the
feet and body channels only. Hang a carried prop from `pelvis(t)`, never from `solve(t)`: the hands are pinned to the
prop, so `solve` would ask the prop where it is, which asks the actor, without end.

```ts
const U = 178; // px per head-height
const GY = 1505; // the floor, stage px
const rahul = new Actor({ ch: CAST.rahul, scale: U, groundY: GY + 14, x: -640, yaw: 1.22, seed: 3 });
const vikas = new Actor({ ch: CAST.vikas, scale: U, groundY: GY - 4, x: -960, yaw: 1.22, seed: 5 });
const EASY: Expression = { lidU: 0.96, lidL: 0.9, browRaise: 0.3, browTilt: -0.45, smile: 0.34, open: 0, wide: 0.05, jaw: 0 };
rahul.face = new Blend<Expression>(EASY, mixFace); // his resting face, from the first frame
vikas.lean = new Track(-0.1); // he leans back against the load he carries
const rw = rahul.walkTo(890, { start: -0.1, pace: 2.4, step: 1.6 }); // { start: -0.1, arrive: 2.70, steps: 7 }
const vw = vikas.walkTo(282, { arrive: 2.92, pace: 2.0, step: 1.3 }); // short loaded steps; it works out start: 0.06
rahul.turnTo(-0.95, { at: rw.arrive + 0.5, dur: 0.52 }); // he arrives facing right; turn him to the table
const footfalls = (["L", "R"] as const).flatMap((k) => rahul.feet[k].plants.slice(1).map((p) => ({ t: p.t0, x: p.x })));
```

## 6. Verbs

`src/engine/motion/verbs.ts`. A verb moves the whole body in the order a person does (eyes, head, chest, arm, hand)
and lands its contact on `at`. Arms move only through verbs: there is no way to set an elbow or a knee, the engine
finds them. The spine and head channels are plain tracks, and the model takes move them directly where no verb fits
(`a.drop.to(...)` to straighten up, `a.bend.to(...)` for a heave, `a.headPitch.to(...)` to lift the chin).

- **A verb reads the actor as it is queued when you call it.** Write each actor's performance in time order, and move
  the body before the arm. `crouch` then `reach`, both at the same moment, puts the hand on the point. `reach` then
  `crouch` leaves it off the point (by 90 px in a test), because the reach was measured from the standing shoulder.
- **A verb is several moves, and its first starts well before `at`.** `lookAt` takes the head 0.46 s before `at`. A
  `reach` that looks first takes the eyes and head 0.9 s before `at`, and an earlier `lookAt` that lands inside that
  stretch is deleted (the time-order rule). When looks sit close together, pass `look: false` and place every `lookAt`
  yourself, as the model takes do.
- **Verbs think in the round, then are seen from the camera.** An arm whose forearm would point at the lens cannot be
  drawn folded (`shrug` gives that arm a smaller gesture by itself). For a gesture at the face use the arm on the far
  side of the body, so the hand shows beyond the face and does not cover it. A brow wipe does not read side-on: Demo 1
  used `dustHands`. The right-hand fifth of the frame is under the Shorts buttons: read from the screen-left arm.
- **`headTurn` is relative to the body.** After `turnTo`, or a walk that turns the body, the head has gone round with
  it: call `lookAt` again.

| Head, face, body | `at` is; defaults | Moves | Leaves |
|---|---|---|---|
| `eyesOf(a, t)` | returns where the eyes are at `t`, a stage point: a look target for someone else | nothing | |
| `lookAt(a, target, { at, dur = 0.34, amount = 1 })` | when the head arrives. The eyes get there 0.25 s earlier, with a blink on the way, and drift back toward the middle once the head faces the thing. `amount` scales the head's share. | gaze, `headTurn`, `headPitch`, `blinks` | the head toward the target, never fully away from us: its own yaw ends 0.5 to 1.25 to the target's side (0.8 of the body's for a thing straight above or below), and at most 1.15 from the body's. For a thing behind the actor, turn the body first. |
| `lookToCamera(a, { at, dur = 0.36, yaw?, pitch = 0.03 })` | when the head arrives. `yaw` is the head's own facing (0 = straight at us); by default 0.3 of the body's. | the same | eyes on the lens |
| `lookAhead(a, { at, dur = 0.36 })` | when the head is back | the same | head and eyes at rest |
| `nod(a, { at, amount = 0.16, times = 1 })` | the bottom of the first nod; the next ones follow every 0.34 s, each smaller | `headPitch` | nothing |
| `feel(a, face, { at, dur = 0.2 })` | when the face is complete. `face` is a name in `FACES` or an `Expression`. | `face` | that face |
| `crouch(a, drop, bend, { at, dur = 0.5, w = WEIGHT.body })` | when it is down. `drop` in head-heights; `bend` in radians toward the way the body faces (plus a quarter of it as `lean`). | `drop`, `bend`, `lean` | crouched, until `crouch(a, 0, 0, ...)` or the three channels are moved back |
| `shiftWeight(a, amount, { at, dur = 0.6 })` | when the weight is over. `amount` in head-heights, + = screen right. The feet stay planted. | `x`, `hipRoll` | shifted |

| Arms (`side` is `"L"` or `"R"`) | `at` is; defaults | Returns | Leaves |
|---|---|---|---|
| `reach(a, side, target, opts)` | when the hand arrives at `target`, a stage point. Besides the arm it moves the look channels and `bend`, unless `look` and `body` are false. | | the arm acting: the hand keeps its place from the shoulder, or stays on its pin |
| `release(a, side, { at, dur = 0.5 })` | when the arm hangs again | | pin, hand shape, palm, layer and wrist back to rest |
| `armTo(a, side, [forward, outward, down], opts)` | a `reach` to a place about the body, in head-heights from the shoulder; forward is the way the chest faces. For a gesture that is about the person, not a thing. `look` and `body` default to false. | | as `reach` |
| `holdFromStart(a, side, pin, { hand, palm?, layer?, wrist? })` | no `at`: the hand is on `pin(t)` when the take begins (an actor who walks on carrying something) | | pinned until `release` |
| `pat(a, side, target, { at, times = 2, every = 0.23, lift = 0.11, palm?, wrist?, layer? })` | the first landing; a flat hand, each landing dead on the surface, `lift` head-heights up between them. It is a `reach`, so it looks at the target first. | time of the last landing | the hand pinned on the thing: `release` it |
| `shrug(a, { at, hold = 0.4, amount = 1 })` | the top of it. Both arms and wrists, the shoulders (`amount` scales their lift), a tip of the head (`headRoll`). | `at + hold + 0.5`: the arms hang again | nothing |
| `handsOnHips(a, { at, dur = 0.42, sides = ["L", "R"] })` | when the fists land | | fists on the hips: `release` them |
| `dustHands(a, { at, times = 2, every = 0.3, then = "drop" })` | the first brush. Both arms and wrists; works at any facing and through a turn. `every` is at least 0.26. | `{ hits, end }`: the time of each brush, and when the hands are done | arms dropped, or with `then: "hold"` left there for the next verb |
| `pushGlasses(a, side, { at })` | when the finger touches the bridge. The arm, a blink, a dip of `headPitch`. | `at + 0.14`, the end of the push | the finger at the face and the chin 0.06 lower: follow with a `reach` or `release`, and a look |
| `callOut(a, side, { at, hold = 0.8, then = "drop" })` | when the call starts: the chest lifts (`bend`), the chin comes up (`headPitch`), the mouth opens (`face`), a cupped hand goes up by it. Use the far arm. | `at + hold + 0.5`: the hand is down | the face at `FACES.neutral`, whatever it was: `feel` your resting face back. `then: "hold"` keeps the hand up. |

| `reach` option | Default | Meaning |
|---|---|---|
| `at`, `dur` | required, 0.42 | when the hand arrives, and its travel time. The arm starts `dur + 0.16` s before `at` (the hand's wind-up). |
| `hand` | unchanged | a `HandPose` (`HANDS.grip`, ...), formed a quarter of `dur` before the hand arrives |
| `pin` | none | `true` holds the hand on `target` whatever the body then does; a function `(t) => Pt` holds it on a moving point (pass where the thing is at `at` as the target). Without a pin the hand keeps its place from the shoulder and goes where the body goes. A pinned hand that is nearly out of reach pulls the chest, then the knees, after it. |
| `contact` | false | arrive dead on a solid surface instead of overshooting into it |
| `look` | true | look at the target first (the head is there about `dur + 0.06` s before the hand) |
| `body` | true | let the chest lean into a reach longer than 0.82 of the arm. The lean stays afterwards: take it back with `a.bend.to(0, ...)`. |
| `layer` | automatic | `"front"` or `"back"`: draw the arm in front of or behind the body. Automatic puts the far arm behind. It holds until `release` or another `layer`. |
| `palm` | automatic | `1` or `-1`: the side of the hand the palm is on. `1` is clockwise from the way the hand points: pointing screen right, `1` is palm down and `-1` palm up; pointing left it is the other way round. |
| `w`, `bow` | `WEIGHT.hand`, 0.14 | the weight and the bow of the hand's path (it bows away from the shoulder and keeps clear of the head) |

```ts
const OVEN_AT: Pt = [590, 1087]; // where the oven will stand, on the table
const patAt: Pt = [OVEN_AT[0] + 0.56 * U, OVEN_AT[1] - 1.07 * U]; // a spot on its top
lookAt(rahul, [640, 1050], { at: 2.2 }); // as he walks in: eyes first, a blink, then the head
lookAt(rahul, patAt, { at: rw.arrive + 0.6 }); // again, now that the body has turned
feel(rahul, "grin", { at: tPut + 0.22 });
const tPat = W("rupees") - 0.06;
const patEnd = pat(rahul, "L", patAt, { at: tPat, times: 2, every: 0.24, palm: -1, wrist: -0.42, layer: "front" }); // 4.1
armTo(rahul, "R", [-0.12, 0.16, 1.36], { at: tPat - 0.05, dur: 0.4, hand: HANDS.fist, layer: "back" }); // a fist at his hip
release(rahul, "L", { at: patEnd + 0.62 }); // pat leaves the hand on the thing
const shrugEnd = shrug(rahul, { at: W("no", 2) + 0.1, hold: 0.36 }); // 9.46: both arms hang again
const lidEdge = (t: number): Pt => [760 + 80 * Math.cos(lid.value(t)), 1050 - 80 * Math.sin(lid.value(t))]; // a part that moves
reach(rahul, "L", lidEdge(tOpen - 0.46), { at: tOpen - 0.46, dur: 0.36, hand: HANDS.pinch, palm: -1, pin: lidEdge, contact: true, layer: "front" });
```

## 7. Props

`src/engine/motion/prop.ts`. A `Prop` is a thing people handle: it is where its own path puts it, or where its holder
has it, and `held` blends between the two so that picking up and putting down never jump.

| Member | Meaning |
|---|---|
| `new Prop(at, grips = {})` | `at`: its centre at rest, stage px. `grips`: named points in the prop's own frame, px from its centre. |
| `pos`, `tilt` | a `Path2`, its own path (resting, being lifted, being set down); a `Track`, rad, + = clockwise (the grips turn with it) |
| `held`, `carry` | a `Track`, 0 = on its own path, 1 = carried; `(t) => Pt` or `null`, where the holder has it |
| `at(t)` | its centre now: `pos`, `carry(t)`, or the mix of the two that `held` asks for |
| `grip(name, t)` | a grip as a stage point at `t`: this is what a hand is pinned to. An unknown name throws. |

Handing over: `pos` and `carry` must be in the same place while `held` changes, or the prop slides between them. To
set a carried thing down, start `pos` from where the carrier has it (a `reset`, unseen because it is still held), fade
`held` to 0 in the first tenth of a second, and let `pos` travel to the surface, landing dead on the word. To pick a
thing up, do it the other way round: `pos` lifts it to where the carrier will have it, then `held` goes to 1. The hands
need nothing: they are pinned to grips and the grips move. Not everything is a `Prop`: a machine part is a `Track` and
a function of it (the lid above); a thrown or falling thing is a plain function of `t`: in the hand until the release,
a parabola to a landing time taken from a word, then at rest with a small damped bounce (`piece` in the ggsp take).

```ts
const oven = new Prop(OVEN_AT, { under: [-0.6 * U, 0.03 * U], far: [-0.35 * U, -1.14 * U] });
oven.held = new Track(1); // it starts in his arms
oven.carry = (t: number): Pt => add(vikas.pelvis(t), [1.0 * U, -0.15 * U]); // pelvis(t), not solve(t): see section 5
holdFromStart(vikas, "R", (t) => oven.grip("under", t), { hand: HANDS.cup, palm: -1, layer: "front", wrist: -1.05 });
holdFromStart(vikas, "L", (t) => oven.grip("far", t), { hand: HANDS.relaxed, palm: 1, layer: "back", wrist: 0.25 });
const tGo = tPut - 0.44; // the set-down starts here and lands on the word
crouch(vikas, 0.3, 0.44, { at: tPut, dur: 0.42, w: WEIGHT.heavy });
oven.pos.reset(tGo - 0.06, oven.carry(tGo)); // 1. its own path starts where the carrier has it
oven.held.to(0, { at: tGo + 0.12, dur: 0.12, w: WEIGHT.mech }); // 2. hand over while the two coincide
oven.pos.to(OVEN_AT, { at: tPut, dur: 0.44, w: WEIGHT.heavy, windup: 0, overshoot: 0, bow: 0.2, pivot: [282, GY] }); // 3. down
const tUp = tPut + 1.36; // 4. his hands went down with it; now he lets go and straightens
release(vikas, "R", { at: tUp, dur: 0.46 });
release(vikas, "L", { at: tUp + 0.08, dur: 0.46 });
crouch(vikas, 0, 0, { at: tUp, dur: 0.46 });
lookAt(vikas, eyesOf(rahul, tUp + 0.3), { at: tUp + 0.3 });
```

## 8. Camera

`src/engine/stage/camera.ts`. `new Camera(cx, cy, zoom = 1, seed = 9)`: `cx, cy` is the point of the actors' plane at
the centre of the frame; zoom 1 shows the stage at its own size.

| Member | Meaning |
|---|---|
| `keys([{ t, cx, cy, zoom }, ...])` | the whole move at once: one curve through every framing. Once it is called, `to()` is ignored. |
| `to({ cx?, cy?, zoom? }, at, dur)` | one eased move, arriving at `at`. Only for a take with a single move: overlapping `to` calls swing. |
| `shake(t, amp = 10, dur = 0.35)` | a knock at `t`: the frame jolts by about `amp` px and rings down over `dur` |
| `drift` | default 1: a slight constant wander (a few px, a hair of zoom and roll) so that a held frame is never dead. 0 locks it off. |
| `view(t)` | `{ cx, cy, zoom, roll }` at `t`, drift and shakes included. Everything is placed from this (so never measure a placement during a shake). |

- The curve of `keys` passes through every key and never overshoots between two. A value rests only where it turns
  round, or between two equal keys. So list the framings in order and the camera never stops; repeat a key to rest.
- Key times must increase: two keys with the same `t` turn every value into `NaN`. Before the first key and after the
  last the camera holds them, and at an end key it is still moving: put the first key before 0 and the last after the
  end of the take, or it starts or stops dead.
- Zoom and tilt leave a key together. Where type is written on a wall, a push-in moves `cy` up in the same pair of keys,
  so the writing keeps its place in the frame.

`layerTransform(view, frame, depth, ref)` gives `{ tx, ty, s }`: a point `p` of a layer at that depth is on screen at
`[tx + p[0] * s, ty + p[1] * s]`. `frame` is `{ width, height }`; `ref`, the camera centre the layers are drawn for, is
the middle of the frame. Far layers slide and grow less than near ones, which is the parallax:

| Depth | What goes there | Slides, for 100 px of camera travel at zoom 1 |
|---|---|---|
| -0.3 | things close to the lens: a heap, a stack that passes in front | 143 px |
| -0.12 | a figure crossing between us and the actors | 114 px |
| 0 | the actors' plane: actors, props, the ground | 100 px |
| 0.1 | a wall right behind them, and what is written on it | 91 px |
| 2 to 4 | mid-distance, a skyline | 33 to 20 px |
| 30 | what is written across a sky: it holds still while the camera travels | 3 px |

The table holds at zoom 1 only. In general a layer at depth `k` is drawn at the scale `s = zoom * (1 + k) / (1 + zoom * k)` and slides by `zoom / (1 + zoom * k)` px for each px the camera travels. So when the camera pushes in to zoom 1.6, the actors' plane grows to 1.6 but a works at depth 1.4 only to 1.18, and on a pull-back it shrinks less than the actors do: a tall middle ground climbs up the frame, into the place of the type, on every push-in and tilt. Check where it stands at each framing the type is read in (`node tools/check.ts <film> --cam`, a preview, and the dry run's note about type that stands across two surfaces).

A negative depth must stay above `-1 / zoom`: at zoom 2.3 a layer at -0.3 is already five times its size. Because
layers slide at different speeds, place a thing by where the camera will be when it matters. The two helpers below are
written in the take (copy them): the demos place type, entrances, a passing stack and the x of a sound with them.

```ts
const cam = new Camera(-335, 1000, 0.86);
cam.keys([
  { t: -0.3, cx: -335, cy: 1000, zoom: 0.86 }, // the first key before the take starts...
  { t: 1.5, cx: 110, cy: 980, zoom: 0.93 }, // it travels THROUGH this framing
  { t: 2.95, cx: 528, cy: 958, zoom: 1.0 },
  { t: 4.2, cx: 540, cy: 918, zoom: 1.07 }, // a slow push while the oven lands, tipping up with it
  { t: 5.0, cx: 608, cy: 829, zoom: 1.12 },
  { t: 5.3, cx: 608, cy: 829, zoom: 1.12 }, // two equal keys: a rest
  { t: VO.duration + 0.25, cx: 615, cy: 788, zoom: 1.2 }, // ...and the last after it ends
]);
cam.shake(tPut, 7, 0.35); // the oven lands
const FRAME = { width: 1080, height: 1920 };
const REF = { cx: 540, cy: 960 };
const under = (t: number, k: number, sx: number, sy: number): Pt => {
  const lt = layerTransform(cam.view(t), FRAME, k, REF); // the point of the layer at depth k that is at screen (sx, sy) at t
  return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
};
const onScreen = (t: number, k: number, p: Pt): Pt => {
  const lt = layerTransform(cam.view(t), FRAME, k, REF); // where a point of the layer at depth k is on screen at t
  return [lt.tx + p[0] * lt.s, lt.ty + p[1] * lt.s];
};
const WALL = 0.1; // the depth of the wall the type is written on
const typeAt = under(4.2, WALL, 80, 306); // the wall point that is at screen (80, 306) when the push-in ends
onScreen(W("oven"), WALL, typeAt); // [267, 317]: where that point is 2 s earlier, the camera still arriving
```

## 9. Figures as output

`src/engine/figure/`. `buildFigure(ch, pose, style)` turns a pose into shapes; `style` is `LOOKS[look].people`. The
frame calls it, not the take, but the checks and anything that sits in a hand read what it returns:

| `FigureOut` | Meaning |
|---|---|
| `shapes` | every shape of the figure, back to front. A `Shape` is an `id`, a material name `mat` and a closed outline `pts` (stage px). |
| `layers.behind`, `.body`, `.front` | the same shapes in three layers, so a prop can go between them: the arm drawn behind the body; legs, torso and head; the arm in front |
| `hands.L`, `hands.R` | `hold` (the centre of the palm: a held thing sits here), `tip` (index fingertip), `thumbTip`, `fingers` (the four finger shapes: draw them behind a held thing), `palm` (palm and thumb: draw them in front of it), `shapes` |
| `arms.L`, `arms.R` | `elbow`, `wrist`, `foreAngle` (the direction of the forearm, rad: turn a held thing with it), `reach`, `hand`, `shapes` |
| `legs.L`, `legs.R`, `joints` | `knee`, `ankle`, `toe`, `heel`, `reach`, `shapes`; `pelvis`, `neck`, `headPivot`, `shoulderL`, `shoulderR`, `hipL`, `hipR` |
| `head`, `near` | `shapes`, `centre`, `crown`, `chin`, and `at(x, y)`, a point on the face (head-heights from its middle, seen from the front: x toward the character's left, y down); `"L"` or `"R"`, the side nearer the camera |

`reach` is `{ E, T, stretch, extension }`. `stretch` is 1 when the bones are their own length; a target a little out
of reach stretches an arm to 1.06 at most (a leg to 1.03), and past that the hand falls short. A joint never folds
below 35 degrees (40 for a knee). `jointAngle(S, E, T)` is the angle at the middle joint in degrees, 180 = straight.
For scale: across Demo 1 the sharpest elbow is 38 degrees, the sharpest knee 118, the most stretch 1.1 %, and no
pinned hand is more than 1 px off its pin; a reach that cannot be made shows as stretch at its limit, an elbow at 180
and a pinned hand many px off (the dry run's limits are in `review.md`). `stand(ch, { feet, scale, yaw, headYaw? })`
gives a `FigurePose` for a figure that does not act; change what you need on it (`armL`, `head`, `bend`, ...).

```ts
const style = LOOKS.A.people; // head size, eyes and line work of the look
const fig = buildFigure(rahul.ch, rahul.solve(tOpen).pose, style); // his near hand is on the lid
jointAngle(fig.joints.shoulderL, fig.arms.L.elbow, fig.arms.L.wrist); // 110: degrees at the elbow
fig.arms.L.reach.stretch; // 1: the arm reaches without stretching
dist(fig.arms.L.wrist, rahul.arms.L.pinPoint(tOpen)!); // 0: the wrist is on its pin
const tucked = new Set(fig.hands.L.fingers.map((s) => s.id)); // to put a thing in a hand: fingers behind it, palm in front
const backToFront = [...fig.layers.behind, ...fig.layers.body, ...fig.layers.front.filter((s) => tucked.has(s.id)), /* the thing, */ ...fig.layers.front.filter((s) => !tucked.has(s.id))];
const extra = stand(CAST.iraki, { feet: [742, GY], scale: U, yaw: -1.0 }); // feet: the spot on the ground between them
extra.head = { yaw: -0.3, face: FACES.smile }; // a head's yaw is its own facing, 0 = at us
```

**Faces** are numbers (`Expression`). `FACES` has `neutral`, `smile`, `grin`, `effort`, `surprise`, `worry`, `rue`,
`call`, `talk`, `exhale`, `blink`; `mixFace(a, b, t)` blends two.

| Field | What the number does |
|---|---|
| `lidU`, `lidL` | upper and lower eyelid: 1 open, 0 shut. A low `lidL` is the squint of a smile; `lidU` above 1 is wide-eyed. |
| `browRaise`, `browTilt` | + lifts the brows; + pulls their inner ends down (a frown), - lifts them (worry, strain) |
| `smile`, `wide` | corners of the mouth up (+) or down (-); + stretches the mouth wider, - purses it |
| `open`, `jaw` | how far the mouth is open, 0 to 1 (under 0.07 it is a line, above 0.3 the teeth show); jaw drop, 0 to 1, which lengthens the lower face |

A level brow reads as a frown once the head is turned and tipped down. So define the take's resting faces with the
inner brow ends a little raised (`browTilt` -0.15 to -0.45, `browRaise` about 0.3, as `EASY` above) and set them on
`a.face` from the start; and make effort faces strain (`browTilt` negative, mouth wide and a little open), not anger.
**Hands** are numbers too (`HandPose`: `curl` of the four fingers, 0 straight to 1 closed; `thumb`, -1 lifted away to 1
folded across the palm; `spread`, 0 to 1). `HANDS` has `relaxed`, `open`, `flat`, `fist`, `point`, `grip`, `hook`,
`pinch`, `cup`, `splay`; `mixHand(a, b, t)` blends two.

## 10. Type

Words on screen are verbatim from the narration, and each spoken piece lands on its own word. Never invent a number,
never draw a trademark. Type sits in the top third with the action below it, inside screen x 72 to 900 and y 260 to
1440 (a provisional safe zone) for as long as it shows, and 16 px clear of every head; the dry run measures all that.
`src/engine/type/layout.ts` is pure and runs in Node:

| Function | Gives |
|---|---|
| `layout(text, face, size, { cells?, tracking? })` | a `Line`: `glyphs` (each `{ ch, x, w, cx }`, px from the left edge), `width`, `capHeight`, `xHeight`, `size`, `face`. `tracking` is extra space after each glyph, in em. `cells: true` centres every digit in an equal cell: only for a number that counts or changes. A number that just stands there is set without it. |
| `sizeForCap(face, capPx)`, `sizeForWidth(text, face, widthPx, opts?)` | the font size that gives that cap height; the font size at which the text is that wide |
| `groupIndian(n)` | `150000` gives `"1,50,000"` |

Faces: `FrauncesDisplay`, `FrauncesText`, `FrauncesItalic`, `InterBold`, `InterBlack`, `Baloo`, `Anton`, `PlexMono`.
Each has A to Z, a to z, 0 to 9, the space and `₹ , . – - — % + ’ ' " “ ” ! ? & : / ( ) · …`. Any other character makes
`layout` throw (add it to `NEED` in `tools/fonts.py`, or change the text). A `TypeLook` says which face does what:
`{ number, rupee?, name, label, ink, accent, tracking }`. `TYPE_LOOKS.A` (the chosen look) sets numbers and names in
`FrauncesDisplay`, labels in `InterBlack`, and takes the rupee sign from `InterBlack` because Fraunces draws it poorly.

The take describes each block as data (`NumberCue`, `YearCue`, `NameCue`, `PhraseCue` in `type/blockspec.ts`);
`Blocks.tsx` draws it, animating itself from the time it is given (a block's props are its cue plus `T`, the
`TypeLook`, and `t`). Coordinates are those of the layer the block is drawn in.

| Block | `x`, `y` | Size | Spoken pieces, each `{ text, at }` | Also |
|---|---|---|---|---|
| number | left edge; baseline of the LABEL (the amount hangs under it: its baseline is `y + labelSize + cap`) | `cap`: cap height of the amount. `maxW`: it is made smaller if it would be wider. `labelSize = 50`, the label's font size. | `label`; `parts[]`, the amount in the pieces it is spoken in (`"₹15"`, `"–20,000"`); the rupee sign must lead the first part | `stamp?`, `out?` |
| year | left edge; baseline of the year | `cap`, `maxW`; `place.size = 62`, a font size | `year`; `place?`, small caps under it | `wipeX?`, `out?` |
| name | left edge; baseline of the label (the name's baseline is `y + 50 + cap`) | `cap` of the name, `maxW`; `labelSize = 46` | `label`; `parts[]`, each with its own leading space (`"Shamsulhaq"`, `" Iraki"`) | `out?` |
| phrase | left edge; baseline of the first line | `size`: a FONT size here, not a cap height; the largest that keeps the longest line inside `maxW`, up to `size`. `leading = 1.5` cap heights between baselines. | `lines[]`: `{ lead?, text, at }`, one line per thing said; `lead` is set in the accent colour | `out?` |

How the pieces arrive. Figures (an amount, a year, a stamp) drop: each glyph falls from above, a little large, and
LANDS at `at`, the next one 0.026 s later. Labels, names and phrases rise: each glyph STARTS at `at` and is in place
0.24 s later, glyph after glyph. The rule under a label draws itself from `at + 0.05`. So give a number the moment of
the contact it shares with a sound, and give a label the start of its word.

How a block leaves. At `out` every glyph sinks and fades in about 0.3 s and the rule fades with them; without `out` it
stays to the end. `stamp: { text, at, join }` is a year that lands large where the amount will go, then at `join`
shrinks up in 0.4 s to lead the label; the amount must land after that. `wipeX` hides every glyph whose middle is to
its right, for a thing that passes in front from right to left: give it that thing's x in the block's own layer.

```ts
const T = TYPE_LOOKS.A;
const ovenCue: NumberCue = { x: typeAt[0], y: typeAt[1], cap: 134, maxW: 680, out: 4.2,
  label: { text: "AN OVEN", at: W("oven") }, // starts to rise as the word starts
  parts: [{ text: `${RUPEE}10,000`, at: tPut }] }; // lands with the oven
const amount = measure({ kind: "number", ...ovenCue }, T)[1]; // name "amount.0", at 3.26, cap 121 (680 wide: maxW won), box
amount.cap * layerTransform(cam.view(4.2), FRAME, WALL, REF).s; // 129: its cap height on screen at the end of the push-in
layout("1976", "FrauncesDisplay", sizeForCap("FrauncesDisplay", 252)).width; // 783 px wide at a cap height of 252
sizeForWidth("take a company", "FrauncesDisplay", 790); // 119.2
groupIndian(150000); // "1,50,000"
```

Two more kinds cover what the four do not: `"line"` (plain type printed in the world, a date on a calendar, a board:
`{ kind: "line", text, face: "number" | "name" | "label", cap, x, y, color, align?: "start" | "middle" | "end", tracking? }`, with `y` the
baseline, `cap` the cap height in px and `color` a palette colour; it does not animate, so move it by moving what it is
printed on; its words must still be the narrator's) and
`"glyphs"` (a line whose glyphs the take moves itself, each by `{ dx?, dy?, scale?, opacity?, rotate? }`, as "steel rods"
in the ggsp film). `measure(block, T)` returns one entry per spoken piece (`name`, `text`, `at`, `out`, `box`, `cap`, ...).

## 11. Small helpers

`src/engine/geom/vec.ts`. A `Pt` is `readonly [number, number]`, so build a new one, never assign into it.

| Helper | Gives |
|---|---|
| `V(x, y)`, `add(a, b)`, `sub(a, b)`, `mul(a, k)`, `neg(a)`, `mid(a, b)` | points |
| `lerpPt(a, b, t)`, `mix(a, b, t)` | a point, a number: `a` at 0, `b` at 1 |
| `len(a)`, `dist(a, b)`, `dot(a, b)`, `cross(a, b)` | numbers |
| `unit(a)`, `perp(a)` | `a` at length 1 (`[1, 0]` for a zero vector); `a` turned a quarter clockwise on screen (walking along `a`, it points to your right) |
| `rot(a, ang)`, `rotAbout(a, o, ang)` | `a` turned by `ang` (clockwise on screen), about the origin or about `o` |
| `fromAngle(ang, r = 1)`, `angleOf(a)`, `DEG` | the point at that angle and distance; the angle of a vector; radians in a degree (`35 * DEG`) |
| `clamp(x, lo, hi)`, `smoothstep(a, b, x)` | `x` kept inside a range; 0 at `a`, 1 at `b`, eased between: the usual way to fade something in over a stretch of time |
| `angDiff(a, b)`, `lineHit(p, d, q, e)` | the shortest signed difference between two angles; where the line through `p` along `d` meets the line through `q` along `e`, or `null` |
| `bounds(pts)`, `pointInPoly(p, poly)`, `area(pts)` | a `Box` `{ x0, y0, x1, y1 }`; is `p` inside; signed area, positive when the outline runs clockwise on screen (a shape with area 0 or less is a bad shape) |

## 12. The display list, the sequence and the film

`src/engine/draw/list.ts`, `src/engine/film.ts`. A sequence's `frame(t)` returns a `FrameList`; the generic view
(`src/engine/draw/Display.tsx`, through `src/engine/FilmView.tsx`) paints it and `tools/check.ts` checks it. A film
file never writes SVG.

```ts
import { fade, fill, group, paint, rect, shadow, type as written, type FrameList, type Item } from "../../engine/draw/list.ts";
```

`FrameList` is `{ t, view, items, figures? }`: the time, the camera's `view(t)`, the items back to front, and the figures
in the frame for the checks. `Space` is `"screen"` (fixed to the frame: a sky, a sun) or a layer depth (section 8).
Items that follow one another in the same space share one layer, so list them by depth, far to near.

| Item | Builder | Fields |
|---|---|---|
| paint | `paint(id, space, shapes, { light?, opacity? })` | Shapes for the look's painter. `light` names one of the sequence's lights (default: the sequence's own). Shape ids are unique within one paint item. |
| fill | `fill(id, space, f, paths, { opacity?, rule? })` | Outlines filled with `f`. `rule: "evenodd"` makes a second path cut a hole in the first. |
| shadow | `shadow(id, space, casters, on, { tone?, light?, shift?, ground?, opacity? })` | The casters' outlines in one tone of the material `on` (`tone` defaults to `"shade"`; use `"base"` when the lit part of that surface is a separate, lighter material). `ground: { y, stretch?, drop? }` lays each outline down along the ground away from the light; `shift: [dx, dy]` moves it instead (a shadow on a wall behind). |
| type | `written(id, space, block, over?, overLabel?)` | A type block (section 10) with `kind`: `{ kind: "number", ...cue }`. `over` lists what it stands against, as palette materials or colours, for the contrast check; `overLabel` the same for its small label when that sits against something else. |
| group | `group(id, space, items, { opacity?, clip?, about?, scale? })` | Children share an opacity, a clip (`clip`: outlines that add up) or a scale about a point (`about`, `scale`). Children are drawn in the group's space. |

| `Fill` | Fields |
|---|---|
| `{ kind: "solid", color }` | one colour |
| `{ kind: "linear", x1, y1, x2, y2, stops }` | a gradient along a line, in the layer's own coordinates |
| `{ kind: "radial", cx, cy, r, stops, sy?, box? }` | a round gradient; `sy` squashes it about its centre (a flat band of haze); `box: true` fits it to each path's own box instead of `cx, cy, r` |
| `{ kind: "ribs", x, y, w, pitch, lean, thick, mat, light? }` | the ribs of a steel rod: a pattern anchored at `(x, y)` |

A `Stop` is `{ at, color, a }`: 0 to 1 along the gradient, a colour, an opacity. `tone: { mat, tone, light? }` replaces
the colour with the painter's tone of a material, so a gradient can end in the exact shade of a surface.
`fade(color, a0, a1)` is the usual pair of stops (one colour, two opacities): air, a bloom of light, a darker foreground.
`rect(x, y, w, h)` is an outline for fills and clips. Colours come from a palette by name (`P["room.air.top"]`), never
as literals in a film file: the dry run fails any file under `src/films/<film>/` that holds a hex colour, unless the
file's name contains `palette` or `bible` (the film's own `palette.ts` is where its colours go).

```ts
const items: Item[] = [
  paint("wall", 0.1, room.wall),
  fill("air.top", 0.1, { kind: "linear", x1: 0, y1: top, x2: 0, y2: top + 820, stops: fade(P["room.air.top"], 0.3, 0) }, [rect(x0, y0, w, 820)]),
  written("type.oven", 0.1, { kind: "number", ...tk.type.oven }, ["wall"]),
  paint("floor", 0, room.floor),
  group("cast", 0, [shadow("cast.on", 0, casters, "floor", { tone: "base", ground: { y: GY + 4, stretch: 0.5, drop: 0.3 } })], { clip: [room.floorSun] }),
  paint("actors", 0, [...fig.layers.behind, ...fig.layers.body, ...oven, ...fig.layers.front]),
];
return { t, view, items, figures: [{ name: "vikas", actor: tk.vikas, fig }] };
```

A `FigureRef` is `{ name, fig, actor?, space?, head? }`: `space` is the depth of the layer the figure is drawn in
(default 0); `head: false` for a figure whose head may pass under type (a silhouette close to the lens, a shadow on a wall).

**`Sequence`** (`src/engine/film.ts`):

| Field | Meaning |
|---|---|
| `id` | names the composition `<film>-<id>` |
| `t0`, `tFull`, `end` | seconds of film time. Drawn from `t0`; covers the whole frame from `tFull` (the sequence before it is drawn until 0.05 s after that); over at `end`. For the first sequence and for a hard cut, `tFull` equals `t0`. |
| `palette` | every material the sequence paints with: the palettes of its set, props and cast spread into one |
| `lights`, `light` | its lights by name, and the one an item gets when it names none |
| `background` | a colour painted under everything once the sequence covers the frame |
| `frame(t, look?)` | the display list at `t` |
| `cues` | `{ t, what, x?, space?, gain? }[]`: what should be heard. `x` is in the layer `space` (default 0), or screen px when `space` is `"screen"`. |
| `marks` | the named moments of the take, for the dry run's printout |
| `walkers?` | `{ name, actor, from?, to?, space? }[]`: whose footfalls become `step.<name>` and `scuff` cues |
| `allow?` | `{ id: RegExp, why }[]`: things that may appear or vanish in one frame, each with a true reason (`review.md`) |

**`Film`**: `{ id, title, width, height, fps, duration, look, type, words, sequences, facts? }`. `duration` is
`VO.duration`; `type` is a `TypeLook` (`TYPE_LOOKS.A`, or a copy with the film's own `ink` and `accent`); `facts` lists
each looked-up name or spelling as `{ text, source, confirmed?, says? }` (`says`: what the narrator says when that is
spelt differently from what is written). Films are registered in `src/films/index.ts` (`tools/new-film.mjs` does it), and
every film gets a composition `<id>` and one per sequence, `<id>-<seq>`.

The numbers the dry run holds a film to are in `src/engine/qa/limits.ts` (`LIMITS`): the safe zone, least cap heights,
the gap to a head, the window round a word, contrast, joints, stretch, the path budget.
