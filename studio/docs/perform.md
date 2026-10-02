# How a sequence is written

A sequence is one continuous take in one world. It is three small files of data and no view code:

| File | Holds | Model to read first |
|---|---|---|
| `take.ts` | The performance: actors, props, the camera, what is written, sound cues. Every moment taken from a word. It never draws. | `src/films/md/take.ts` |
| `frame.ts` | `frame(t)`: everything drawn at time t, as a display list, back to front. | `src/films/md/frame.ts` |
| `index.ts` | The `Sequence` object the film lists: times, palette, light, frame, cues, exceptions. | `src/films/md/film.ts` |

One generic view paints the list; `node tools/check.ts` checks the same list in Node before any browser starts. `engine.md` has every signature; this page is the method.

## Ground rules

- **Time is seconds in the tightened voice, and every moment comes from a word.** `const W = makeAnchors(WORDS); W("oven")` is when "oven" begins; `W("no", 2)` the second time it is said; `W.end("scrap")` when a word ends; `W("no funding")` the start of a phrase. An anchor that is not in the narration throws, so a typo cannot ship. Type a number only for small acting between two words.
- **Every animated value is a pure function of time.** No `Math.random`, no clock, no frame numbers: a frame must come out the same whenever it is rendered. Use `hash`, `noise`, `wander`.
- **Nothing pops.** A value moves with `track.to(target, { at, dur, w })`. `at` is when it ARRIVES (the contact), so a thing lands on its word by construction; `w` is a weight class (`WEIGHT.eye | head | hand | body | heavy | mech`) that sets wind-up, overshoot and settle.
- **Write each actor's performance in time order.** A move written later that starts earlier silently removes the one written before it. The dry run lists every case with its line.
- **A hand travels on a bowed path, never a straight line; a thing that is held follows its holder** (`Prop`).
- **Conventions.** Yaw 0 faces the camera, + faces screen right. Facing right, the near side is R; facing left it is L. Lean and bend are + toward screen right. Sizes are in `U`, px per head-height; `GY` is the ground line.

## Acting: call verbs, do not set joints

| Verb | What the body does |
|---|---|
| `a.walkTo(x, { arrive | start, pace, step })` | plans the steps; feet never slide; returns `{ start, arrive }` |
| `a.turnTo(yaw, { at, dur })` | turns the body, re-planting both feet |
| `lookAt(a, point, { at })` | eyes first, then head, a blink on the way |
| `lookToCamera(a, { at })`, `nod(a, { at })` | to us; a dip of the chin |
| `feel(a, face, { at, dur })` | changes expression (a named face or one defined in the take) |
| `reach(a, side, point, { at, hand, pin, contact, layer, body })` | hand to a point in the world; `pin` holds it there, or on a moving point |
| `release(a, side, { at })` | lets the arm hang again |
| `armTo(a, side, [forward, outward, down], { at })` | a gesture about the body, not about a thing |
| `holdFromStart(a, side, pin, { hand })` | a hand already holding something when the take begins |

A pin holds the **wrist**, not the palm: to cup something, aim a palm's width to the side of it and look at a still. A thing that is part of a wall or another layer (a switch, a padlock on a gate) is not in the actors' coordinates; ask for its place with `fromLayer(cam.view(t), FRAME, DEPTH.wall, REF, point)` from `engine/stage/camera.ts` and reach for, and pin to, that. There are few verbs for idle hands (`handsOnHips`, a hand on a prop, a hold); a hand folded across the chest or behind the back with `armTo` usually reads as broken side-on, so look at a still before keeping one.
| `crouch(a, drop, bend, { at, w })`, `shiftWeight(a, amount, { at })` | knees and back; pelvis over one foot |
| `pat`, `shrug`, `handsOnHips`, `dustHands`, `pushGlasses`, `callOut` | whole small actions, each landing on `at` |

How to make it read as acting rather than moving:

- **Eyes lead.** A `lookAt` a quarter second before the body turns or the hand reaches.
- **The second person reacts a beat later** than the first, with something smaller.
- **Work back from the contact.** The word gives the contact time; the walk has to have arrived, and the wind-up begun, before it. `walkTo(..., { arrive })` and `at` on every verb do the arithmetic.
- **Weight shows.** A heavy thing is carried low against the body with a lean back; setting it down bends the knees, the surface gives a few px and rings, the camera takes a small `shake`.
- **Faces.** A level brow reads as a frown on a turned, tipped head. Define the take's resting faces with the inner brow ends a little raised, and effort faces that are strain, not anger. Faces are plain numbers (`Expression`); blend with `mixFace`.
- **Limits.** Verbs think in the round and are then seen from the camera. An arm whose forearm would point at the lens cannot be folded: give that arm a smaller gesture, or use the other arm. For a gesture at the face, use the arm on the far side of the body.
- **A raised hand is the hardest thing to get right side-on.** The near arm raised crosses the face; the far arm raised straight up seems to grow out of the crown. Raise the far arm forward and up, in front of the face, hand at about brow height and a hand's width ahead of the nose, and look at it in a preview at its highest point before building on it. The whole-action verbs (`callOut`, `pushGlasses`, `shrug`, `handsOnHips`, `dustHands`, `pat`) have been looked at from every facing: prefer them to a raw `armTo`.
- **`reach` after `crouch`.** A reach leans the body toward its target by itself, and that lean replaces the bend the crouch gave. For a hand that works while the body stays down, pass `body: false`.
- **Two people never stand alike.** Two figures with both arms hanging and the same open hands read as two copies of one puppet. Give every idle hand a place to be, and a different one for each person: on a hip, behind the back, holding something (a folded paper, a strap, the other wrist), at the glasses, in a fist at the side. Change it between beats. The dry run prints how much each figure acts while in view and its longest spell of breath alone.

A move takes its overshoot from its weight, and has to arrive at the speed that overshoot needs. Over a long travel (a second or more) it can only gain that speed by backing up first, and a board that should lower itself jumps up out of frame instead. The dry run lists such moves ("backs up N % of its distance"). Lower slowly with `overshoot: 0`, then give the last short stretch its own move with the overshoot.

## Camera

`cam.keys([{ t, cx, cy, zoom }, ...])` once, for the whole take: a curve that keeps travelling through its keys and never overshoots. Two equal keys in a row give a rest; even then the camera drifts a little, so a held frame is alive. Do not chain `cam.to()` calls: overlapping ones swing. `cam.shake(t, amp, dur)` for a knock.

Layers are placed by depth: 0 the actors' plane, 0.1 a wall just behind them, 2 to 4 a skyline, 30 for type written across a sky (so it holds still while the camera travels), negative for things close to the lens (they slide past fast). Place a thing by where the camera will be when it is seen: a helper `under(t, depth, screenX, screenY)` returns the layer point that is at that screen point at time t (see `src/films/ggsp/take.ts`).

Where type is on a wall, zoom and tilt leave a key together, and the camera tips up as it pushes in, so the type keeps its place.

## Type

Describe each block as data in the take, each piece with the word it lands on, and list it in the frame with `written(...)`:

```ts
// take.ts
const type = {
  oven: { x: 104, y: 306, cap: 134, maxW: 680, label: { text: "AN OVEN", at: W("oven") }, parts: [{ text: "₹10,000", at: tPut }], out: 4.2 } as NumberCue,
};
// frame.ts
written("type.oven", WALL_DEPTH, { kind: "number", ...tk.type.oven }, ["wall"]),
```

| Block | Use | Pieces |
|---|---|---|
| `number` | an amount under a small caps label | `label`, `parts` (the amount in the pieces it is spoken in), optional `stamp` (a year that lands large, then shrinks to lead the label) |
| `year` | a year, very large, with a place under it | `year`, `place`; `wipeX` when something passing in front takes it away |
| `name` | a name under a small caps lead-in | `label`, `parts` |
| `phrase` | a few words, one line per thing said | `lines` (`lead` is set in the accent colour) |
| `line` | something printed in the world (a date on a calendar) | static text; still has to be the narrator's words |

The last argument of `written` says what the type stands against (palette materials or colours), for the contrast check. The dry run also measures the type against what the display list really draws behind it (nine points of each piece, every other frame) and fails a number, a name or a phrase that falls short there, so a glow, a gradient or a roof that slides in behind the type is caught before a render; it also notes type that straddles two surfaces. Coordinates are in the layer the block is drawn in. Rules: verbatim; each piece on its own word; top third; inside x 72-900, y 260-1440 while it is read; 16 px clear of every head; an `out` so it leaves by design.

## The frame: a display list

`frame(t)` returns `{ t, view, items, figures }`. `items` is everything drawn, back to front. There are five kinds, built with small helpers from `src/engine/draw/list.ts`:

| Item | Helper | What it draws |
|---|---|---|
| paint | `paint(id, space, shapes, { light?, opacity? })` | Shapes, shaded by the look's painter under the sequence's light. Everything solid. |
| fill | `fill(id, space, fill, paths, { opacity?, rule? })` | Light and air: outlines filled with a flat colour or a gradient (`linear`, `radial`). Never shaded. |
| shadow | `shadow(id, space, casters, on, { ground?, shift?, tone?, opacity? })` | Cast shadows: the casters' outlines in the unlit tone of the material `on`. `ground` lays them down along the floor; `shift` moves them onto a wall behind. |
| type | `written(id, space, block, over?)` | A type block. |
| group | `group(id, space, items, { opacity?, clip?, about?, scale? })` | Items that share an opacity, a clip, or a scale about a point. |

`space` is a layer depth, or `"screen"` for something fixed to the frame (a sky, a sun). Items that follow one another in the same space share a layer, so order the list by depth, far to near: sky, skyline, type, wall, floor and actors, things close to the lens.

How to build it well:

- **Static geometry is built once**, at module load (a room, a yard, a table). Only what moves is built per frame.
- **List only what is in view.** For a long travel, cull set pieces by the camera's view (see `seen` in `src/films/ggsp/frame.ts`).
- **Ids are stable from frame to frame and unique within an item.** The dry run follows each id to catch pops.
- **A figure is painted in three layers** (`fig.layers.behind`, `body`, `front`) so a prop can go between them: a carried box is in front of the body and behind the near arm; fingers under it go behind it.
- **Shadows are part of the world.** A cast shadow on a sunlit floor is clipped to the sun patch (`group` with `clip`); under every foot and every leg of furniture goes a soft contact shadow (a flat ellipse in the floor's `deep` tone) that fades as the foot lifts.
- **Air is a gradient.** A warm bloom near the light, shade toward the far end, a darker foreground: `fill` items with `fade(colour, a0, a1)` stops over the wall and the floor. Their colours live in the set's palette.
- **Whatever enters or forms takes at least ten frames, and settles.** The dry run fails a thing that appears inside the frame within one frame. The eye is stricter: a board that drops in five frames, a pier that closes in four, reads as a pop too, and every reviewer has named it. From first seen to in place is a third of a second or more, on a `Track` with a weight class so that it arrives with a little overshoot and comes to rest (`drop.to(1, { at: W("auction"), dur: 0.5, w: WEIGHT.body })`, then place the thing from `drop.value(t)`). Let it come from somewhere: over an edge of the frame, from behind something drawn later, out of a hand.
- **A light that comes on is a second copy that fades up.** Draw the lit version of the panes, the lamp or the glow as its own item inside a `group` whose `opacity` is a `Track` going from 0 to 1 over ten frames or more, and list it only while that opacity is above 0.01. A light that is simply listed from one frame to the next is a pop. Lights that run through a building come on one after another: one track per window, a tenth of a second apart.
- **Life.** Dust that drifts and is lit only where the sun reaches it; a camera that never quite stops; actors' idle breath and blinks come free from `Actor`.
- **`figures`** lists each figure in the frame (`{ name, actor, fig, space?, head? }`) for the joint, foot and type-against-head checks. `head: false` for a silhouette whose head may pass under type.
- **No colour literals here.** A colour comes from a palette by name. The dry run fails a film file that holds one.

## The sequence, and joining two of them

```ts
export const ROOM: Sequence = {
  id: "room", t0: 0, tFull: 0, end: VO.duration,
  palette: PALETTE, lights: { morning: LIGHT_MORNING }, light: "morning", background: PALETTE.wall,
  frame: roomFrame, cues: tk.cues, marks: tk.marks,
  walkers: [{ name: "rahul", actor: tk.rahul }],          // their footfalls become sound cues
  allow: [{ id: /^door\//, why: "the shutter's slats roll up into the housing, which is drawn in front of them" }],
};
```

A sequence is drawn from its `t0`. It has covered the whole frame by its `tFull`, and the sequence before it is drawn until just after that. So an incoming sequence that is not the first begins transparent and covers the frame by design: a glow that rises, a shape that grows, something that sweeps across. Until `tFull`, list only what should show over the old world. `src/films/ggsp/steel.ts` is the model.

`node tools/new-seq.mjs <film> <seq> --from "<word>"` adds a sequence as a placeholder that already compiles and is registered in `film.ts`. It arrives with `tFull` equal to `t0`, which is a hard cut, and the dry run says so in a note ("cuts in at ... s"). Leave it that way only when the board chose a cut. Otherwise give `tFull` its later time, let the sequence before it run on past it (`end`), and build the hand-over.

The film is the list of sequences in order (`film.ts`), with its `facts`: each name or spelling that had to be looked up, its source, and whether the user has confirmed it.

## Sound cues

`cues.push({ t, what, x })` at every contact, impact and start of a movement that should be heard: `what` is the kind of event (one name per kind: "thud", "clank", "page"), `x` where it is in the actors' plane (for the stereo position). Footfalls of `walkers` are added by the tool. `node tools/check.ts <film> --cues out/<film>/cues.json` writes the list; `sound.json` says which sound each name gets and how loud.

## Before any render

```bash
node_modules/.bin/tsc --noEmit
node tools/check.ts <film> --seq <seq> --cam
```

The dry run must end in `PASSED` (what each line means: `review.md`). Then look: `node tools/preview.ts <film>-<seq>:<t> ... --sheet <name>` draws the display list with no browser in about a second a frame, which is enough to stage by. When the staging is right, real stills at half size in one batch, a look at the contact sheet beside the style frame, fixes, and only then a half-size pass with the voice.
