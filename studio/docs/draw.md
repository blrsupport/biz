# Drawing: sets, props and characters in look A

Every film needs new sets, props and people, and they must look like the same film as the two approved clips (`md`: a bare rented room in morning light; `ggsp`: a scrapyard in low afternoon sun, then a furnace and a city at dawn). This page is how to design and build them; look at the approved pictures first (`docs/img/md_room.jpg`, `docs/img/ggsp_yard.jpg`, `docs/img/ggsp_steel.jpg`). Nothing is drawn by hand or generated as an image: an asset is code that returns a list of `Shape` (an outline and a material), and one painter turns shapes into SVG, computing shade, light and rim from the material's base colour and the scene's one light.

The look ("A, lineless graphic") is fixed:

- No outlines. Forms are separated by value and by light.
- Each form has a base tone, one core shadow on the side away from the light, and a rim light on the side toward it. Cast shadows are hard and coloured: a shadow is the surface's own unlit tone, never a grey overlay.
- People are 5.4 to 5.9 heads tall with small features, and each has a silhouette of their own.
- A set is a few big shapes under one strong, low light, with long shadows. Soft falloff of light is a gradient, never a filter.
- Paper tooth, grain and vignette are added to the finished video by ffmpeg (`tools/finish.mjs`), never drawn in a frame.

Elsewhere: acting, the camera and its depths, and type are in `engine.md`; the display list and its builders (`src/engine/draw/list.ts`) in `engine.md`, section 12, and `perform.md`; the dry run and stills in `review.md`; what the rig cannot act in `directing.md`, section 9.

Paths are inside the studio. Stage pixels: x right, y DOWN; angles in radians, clockwise on screen. `u` is px per head-height (the demos use 178 and 172 and call it `U`); `GY` is the y of the line the actors stand on (1505 and 1500). Size everything in `u`, so that a set, a prop and a person fit each other at any scale.

## Contents

1. [The Shape](#1-the-shape): fields, the three forms, ids
2. [Outlines](#2-outlines): the helpers
3. [Moving and deriving](#3-moving-and-deriving): `moveShapes`, `turnShapes`, `groundShadow`, `rimRuns`
4. [Colour and light](#4-colour-and-light): palettes, `SceneLight`, how tones are computed, the rules
5. [What the painter draws, and what it costs](#5-what-the-painter-draws-and-what-it-costs)
6. [Sets](#6-sets): the existing ones, and the recipe for a new world
7. [Props](#7-props): the existing ones, and the recipe for a new one
8. [Characters](#8-characters): every field, how the cast differ, and the recipe for a new one
9. [Effects](#9-effects): dust, ghost copies, contact shadows
10. [The worked example](#10-the-worked-example): five listings that were run
11. [What breaks the look](#11-what-breaks-the-look)

## 1. The Shape

`src/engine/draw/shape.ts`. Make every shape with `shape(id, mat, pts, extra = {})`: it stores the outline clockwise, which the rim light relies on.

| Field | Meaning |
|---|---|
| `id` | Name of the part, path-like: `"table/leg0"`, `"press/box.dial"`, `"rahul/armL/hand/f0"`. See the rules below. |
| `pts` | Closed outline in stage px. The last point joins the first: do not repeat it. At least 3 points, a positive area, finite numbers (the dry run fails anything else). |
| `mat` | Material: a key of the palette. A name that is not in the palette makes the painter throw. |
| `form` | `"round"` (the default), `"flat"` or `"plane"`: see below. |
| `depth` | round: how deep the form is, px (default 12). The core shadow is `depth * (0.55 + 0.45 * light.strength)` wide. Use a third to a half of the part's thickness: a 19 px table leg takes 10, a drum 0.3 of its width, a torso `0.19 * u`. |
| `facing` | plane: the outward normal of the face on screen. `[0, -1]` a top, `[1, 0]` a right-hand side, `[-1, 0]` a left-hand side, `[0, 0]` a front. The face takes the light tone when `facing . light.dir` is above 0.35, the base tone above -0.15, the shade tone below; `[0, 0]` is always base. |
| `tone` | flat: `"base"` (default), `"shade"`, `"deep"` or `"light"`. |
| `casts` | `{ pts, reach? }[]`: outlines of parts in front of this one that throw a contact shadow on it (a head on a neck, an arm on a chest). Each is filled with this shape's shade tone, moved `reach` px away from the light (default: 0.9 of the core shadow) and clipped to this shape. Round and plane only; a flat shape ignores it. |
| `rim` | round: multiplies the rim light. In use: 0 on fingers, a moustache, a shirt collar (a rim there reads as piping), 0.5 to 0.8 on small or far parts, 1.2 on a dark mass against a glow. |
| `opacity` | Of the whole shape: stains and mortar lines (0.42 to 0.65), smoke, dust, a streak of reflection (0.2), a far veil (0.17 to 0.4). |
| `color` | A literal `#rrggbb` used instead of the palette (shade and light are still computed from it). A last resort: see the rules. |
| `ink`, `paper` | Looks B and C only; look A ignores them. Existing assets carry them (`ink: 0, paper: false`); leave them out of new ones. |

**The three forms.**

- **round**: anything with volume. A limb, cloth, a head, a sack, a pipe, a drum, a bulb, a table leg. It gets the core shadow, contact shadows and the rim light. It costs three SVG paths, plus one for its rim and one for each cast.
- **plane**: a flat face of a box, lit or not as a whole by `facing`. The top, front and side of a table, an oven, a crate. One path.
- **flat**: one tone, no shading. Every surface of a set (walls, floors, skylines); small details (a button, a tick, a gap between slats); the far legs of a table (`tone: "shade"`); a lit top edge (`tone: "light"`); a hole or the thickness of a plate (`tone: "deep"`); anything far off or close to the lens. One path.

**Rules.**

- **Ids are unique** within the list of shapes that is painted together (the dry run fails "shape ids used twice"), **the same from frame to frame** (the dry run follows every shape by its id to catch things that pop in or jump), and **start with the prefix the builder was given**. Films pick parts by id: `/^notes\//` in an allow-list, `/shoe|bar|cable/` to leave small parts out of the shadow, the ids of four fingers to tuck them behind a held thing.
- **Clockwise.** `shape()` reverses an anticlockwise outline. If you build a `Shape` object yourself, or mirror one, pass the points through `clockwise()` first: on an anticlockwise outline the rim light is worked out on the wrong side and lost.
- **`color` is a last resort.** A colour outside the palette cannot be found or re-lit by changing one palette entry, and a film's own files may not hold colours at all (`tools/check.ts` fails a hex literal there). Its one use so far: scrap that heats up as it falls into the melt, a colour that changes every frame (`mixHex` of two palette colours).
- **A shape is lit as a whole.** A form that stands half in sun and half in shade is two shapes in two materials (section 4), or it is moved to one side of the sun's edge.

## 2. Outlines

`src/engine/geom/outline.ts`, with points from `src/engine/geom/vec.ts` (`Pt` is `readonly [x, y]`). An outline is a closed, dense polyline: about one point every `step` px (default 4) along a curve. Polylines are used instead of Bezier paths for two reasons. They render faster on this engine (measured on the build PC: 600 polylines of 40 points added 0.03 s to a frame, 600 curved paths 0.06 s). And the same points feed everything else with no browser: the area and bounds checks, shadows, the rim light, clipping, a silhouette test. Pass a smaller `step` (2 or 3) for a small part and a larger one (6 to 8) for a big far shape.

| Helper | For |
|---|---|
| `ellipse(c, rx, ry, rotRad = 0, step = 4)` | An ellipse (16 points or more). |
| `squircle(c, rx, ry, k = 3, rotRad = 0, step = 4)` | A superellipse: `k` 2 is an ellipse, higher is boxier (a spectacle lens uses 2.6). |
| `roundedPoly(nodes: { p: Pt; r?: number }[], step = 4)` | A polygon with each corner filleted by its own radius (0 or none keeps it sharp). A radius too large for its edges is cut down. Keeps the winding of the nodes. |
| `roundRect(c, hw, hh, r, rotRad = 0, step = 4)` | A rounded rectangle from its centre and half-sizes. |
| `spline(ctrl, { closed = true, step = 4, tension = 0.5 })` | A smooth curve through the control points: a sack, a mound, a bell, a wing. `closed: false` gives an open curve for `stroke`. |
| `quad(a, c, b, step = 4)` | A quadratic Bezier from `a` to `b`, OPEN, ends included: a piece of an outline, or a centre line for `stroke`. (Several asset files have a local `quad` or `box` for a four-point face; `press.ts` imports this one as `curve`.) |
| `capsule(a, b, ra, rb, step = 4)` | A tapered bar with round ends: a rod, a handle, a pipe, a chain link. |
| `stroke(pts, half: (t) => number, roundEnds = true, step = 3)` | An open polyline thickened into a closed outline; `half(t)` is the half-width at t from 0 to 1 along it: a cable, a rope, a brow, a mouth. |
| `tube(center, halfLeft, halfRight = halfLeft)` | The two sides of a soft shape of varying width round a centre line, as `{ left, right }`; close it with `[...left, ...right.reverse()]`. |
| `limb({ S, E, T, h0, h1, h2, point = 0.3, step = 4 })` | A two-bone limb as one soft shape with a rounded outer joint and a clean crease inside the bend. Returns `{ outline, section(a, b, { bulgeA?, bulgeB? }), at(p), dirAt(p), inner }`; positions run 0 (root), 1 (middle joint), 2 (end). `section` cuts a sleeve or a cuff out of it. |
| `inflate(pts, d)` | Moves every vertex along its outward normal by `d` px (a number, or `(i, normal) => number`); negative shrinks. Needs a clockwise outline. |
| `hull(pts)` | The convex hull of a point set, clockwise. |
| `clipConvex(subject, clip)` | The part of `subject` inside `clip`: the sunlit part of a wall. `clip` must be convex (either winding). For the usual case, the sunlit parts of a set's flat shapes, use `litParts` (section 3). |
| `resample(pts, step)` | An open polyline resampled to even spacing. |
| `place(pts, o, scale = 1, rotRad = 0, flipX = false)` | Scales an outline drawn about the origin (a number or `[sx, sy]`), turns it and moves it to `o`. `flipX` mirrors it, which reverses the winding. |
| `translate(pts, d)` | Moves an outline. |
| `dedupe(pts, eps = 0.05)` | Drops repeated neighbours and a last point that equals the first. |
| `clockwise(pts)` | Reverses an outline that runs anticlockwise. |
| `pathD(pts, closed = true)` | SVG path data, rounded to 0.1 px. Only painters call it. |
| `arc(c, r, a0, a1, step = 4)`, `normalsOf(pts)` | Points on an arc (open); the outward unit normals of a clockwise outline. |

`ellipse`, `squircle`, `roundRect`, `capsule`, `stroke` and `hull` come out clockwise. From `vec.ts` an asset mostly needs `add`, `rot`, `unit`, `DEG`, `area(pts)` (positive when clockwise), `bounds(pts)` and `pointInPoly(p, poly)`.

## 3. Moving and deriving

| Function | What it does |
|---|---|
| `moveShapes(shapes, d)` (`src/engine/draw/xform.ts`) | Moves finished shapes, and their `casts`, by `d`. |
| `turnShapes(shapes, o, ang)` | Turns them about `o` by `ang` rad, clockwise on screen. Build a part upright, then turn it: a lid, a beam on its pivot, a prop carried at a tilt. |
| `groundShadow(pts, groundY, dir, { stretch = 1, drop = 0.1, maxLen = 3.2 })` (`src/engine/draw/derive.ts`) | The shadow an upright outline throws on level ground. A point `h` px above `groundY` slides sideways by `h * k`, with `k = (dir.x / min(-0.15, dir.y)) * stretch` held within plus or minus `maxLen`, and down the screen by `h * drop`. The films use `stretch` 0.4 to 0.5 and `drop` 0.26 to 0.3. It means nothing for a light from below. |
| `rimRuns(pts, dir, width)` | The rim-light slivers of an outline, as closed polygons. The painter calls it; you need it only to count paths. An outline of fewer than 8 points gets no rim at all, and on a long straight edge the rim is only as even as the points are dense: pass a box or any outline with long edges through `dense(pts, step = 12)` (`src/engine/geom/outline.ts`), which adds points along them. |
| `litParts(shapes, patch, suffix = ".sun")` (`derive.ts`) | The parts of flat set shapes inside the sun's patch (a convex outline), as new shapes in each one's sunlit material: `wall` gives `wall.sun`, id `<id>.sun`. Paint them over the unlit ones. Flat shapes only: a round form stands on one side of the sun's edge. |

A film does not call `groundShadow` itself: its frame lists a `shadow` item and the view lays the outlines down (`perform.md`).

## 4. Colour and light

**Palettes.** `Palette` is `Readonly<Record<string, string>>`: material name to base colour. Each asset file exports its own (`ROOM_PALETTE`, `PRESS_PALETTE`, `SCRAP_PALETTE`, `CAST_PALETTE`, ...) and a sequence spreads the ones it uses into one object. Names are lower case with dots, the thing first: `press.frame`, `oven.glass`, `yard.wall`; a variant after another dot or a digit: `wall.sun`, `skin.rahul`, `shirt.green`, `scrap.rust2`; a twin family for the same things close to the lens and in shade: `scrapN.rust`; the colours of sky and air too: `room.air.far`, `yard.sky.top`. A later spread wins without a word, and a few early names are bare and do collide between files (`steel`, `dust` and `sky.mid` have two colours each). So start every new name with the asset's own name, and merge with `mergePalettes(A, B, C)` (`src/engine/draw/shape.ts`), which throws when one name has two colours.

**`SceneLight`** (`src/engine/look/color.ts`). A world has exactly one; a second is only for a part lit by something else (the inside of the furnace).

| Field | Meaning |
|---|---|
| `dir` | Unit vector from a surface toward the key light, in screen space. `unit([-0.82, -0.57])` is up and to the left. |
| `key` | Colour of the key light. Light and rim tones lean toward its hue. |
| `ambient` | Colour of the fill (the sky). Shade tones lean toward its hue, and neutral materials take it. |
| `strength` | 0 to 1, how hard the light is. It scales how dark the shade is and how wide the core shadow is. |
| `rim?` | 0 to 1, how much rim light (0.6 when left out; every light so far sets 1). |

| Light | File | `dir` | `key` | `ambient` | `strength` |
|---|---|---|---|---|---|
| `LIGHT_MORNING` (the room) | `src/assets/lights.ts` | `unit([-0.82, -0.57])` | `#ffd9a0` | `#6a7fa8` | 0.85 |
| `LIGHT_AFTERNOON` (the yard) | `src/assets/lights.ts` | `unit([-0.88, -0.47])` | `#ffc474` | `#5c6da0` | 0.92 |
| `LIGHT_DAWN` (sun low at frame right) | `src/assets/sets/steel.ts` | `unit([0.85, -0.5])` | `#ffd08a` | `#4a6a8a` | 0.8 |
| `LIGHT_FURNACE` (lit from the melt below) | `src/assets/sets/steel.ts` | `unit([0.14, 1])` | `#ffb347` | `#6a2a1a` | 0.9 |

`LIGHT_FURNACE_L` and `_R` are the furnace light as it falls on the two walls (`unit([0.8, 0.6])`, `unit([-0.8, 0.6])`); `STEEL_LIGHTS` names all four for the sequence. A new world's light keeps the family: a warm key, a cool ambient, low (`dir` about 0.85 across and 0.5 up), `strength` 0.8 to 0.92, `rim` 1.

**How tones are computed.** `tonesOf(base, light, LOOK_A.recipe)` gives `{ base, shade, deep, light, rim }`, in OKLCH:

- **shade**: about 0.8 of the base's lightness, a little more chroma. Warm colours (reds through yellows) turn toward red as they darken, so skin, ochre, wood and brick get rich shadows, not grey ones; reds hardly turn, oranges and yellows by up to 12 degrees. Every other colour turns up to 12 degrees toward the ambient hue.
- **Neutrals take the ambient colour.** A material with almost no chroma (white cloth, cement, steel, grey hair) has no hue of its own, so its shade is the ambient's blue: in the room's light the pajama `#e8dcc4` shades to `#a2a2a5`. Dark neutrals take much less of it (black hair stays black). Next to a hot orange wall that blue shade can read lighter than the lit side: give a thing that lives in warm light a base with some colour in it.
- **deep**: darker again (about two-thirds of the base's lightness): creases, contact, holes.
- **light**: 12 % of the way to white, hue up to 8 degrees toward the key.
- **rim**: up to 36 % of the way to white, hue toward the key. Dark cloth takes less of it: a bright line down black trousers reads as piping. Where it still does, set `rim: 0` on the shape.

The numbers are `LOOK_A` in `src/engine/look/looks.ts`: `recipe: { shadeDrop: 0.22, shadeChroma: 1.1, shadeHue: 12, lightLift: 0.12, lightChroma: 0.9, lightHue: 8 }`, `shadeShift: 1`, `rim: 3.2` (px at its widest), `people: { head: 1.08, eyes: "dot", feature: 1.06, ... }`. They are the look: do not change them, and pass `LOOK_A.people` to `buildFigure`. Also in `color.ts`: `contrast(a, b)` (the WCAG ratio, 1 to 21), `mixHex(a, b, t)` (a mix in linear light), `toLch`, `fromLch`, `hueToward(h, target, deg)`.

**The rules that follow.**

1. **Never pick a shade colour by hand.** A palette lists base colours only. A hand-picked shadow does not share the scene's ambient and looks pasted on.
2. **A sunlit surface and the same surface in shade are two materials**: `wall` and `wall.sun`, `floor` and `floor.sun`. Paint the unlit one everywhere and the lit one over it inside the sun's patch (`clipConvex`). In the room the unlit partner has 0.71 to 0.9 of the lit one's lightness, 0.2 to 0.75 of its chroma, and a hue pulled toward the ambient. That is cooler than the lit colour's own computed shade, because a surface the sun does not reach is lit by the sky alone. `unlit(sun, light, { l?, c?, hue? })` in `color.ts` gives a first choice (three-quarters as light, half the colour, the hue turned 40 degrees toward the ambient); look at the pair in a still and change the three numbers until the shade reads as the same wall out of the sun and not as another paint. An orange turns toward mauve this way: if it does not belong, lower `c` or `hue`.
3. **A cast shadow is the unlit surface showing through**, drawn opaque, so two shadows that overlap never double. On a sun patch: fill the casters' shadows with the unlit material's base and clip them to the patch (the room's floor: `shadow(id, 0, casters, "floor", { tone: "base", ground })` inside a `group` with `clip: [room.floorSun]`). On a surface that is all in sun: use that material's own shade tone, the default (the yard: `shadow(id, depth, casters, "yard.wall", { shift: [230, 14] })`, clipped to the wall's face).
4. **Depth is value.** The farther a thing is, the closer its colour is to the sky behind it: against the yard's horizon `sky.far` is 1.06:1 and `sky.mid` 1.36:1. Close to the lens and in shade, a thing has about 0.7 of its lightness and less chroma (`scrapN.*` against `scrap.*`).
5. **A form must stand off what is behind it by value**, because no outline will do it. Print `contrast(base, backdrop)`: in the approved frames the main garments are 1.3:1 to 5.5:1 against the wall behind them. Near 1.0:1 (the jute sack on the yard wall is 1.06:1) a form reads only by its shade side and its rim.

## 5. What the painter draws, and what it costs

`src/engine/draw/Paint.tsx`, `PartA`. Volume is a second copy of the outline, never a gradient or a filter:

| Form | What is written | SVG paths |
|---|---|---|
| flat | The outline in the chosen tone. | 1 |
| plane, no `casts` | The outline in the light, base or shade tone, by `facing`. | 1 |
| plane with `casts` | A clip path; the face; each cast in the shade tone, moved away from the light, clipped. | 2 + casts |
| round | A clip path; the outline in the shade tone; the same outline in the base tone, moved toward the light by the core-shadow width and clipped (the strip left uncovered is the core shadow); each cast; each rim run. | 3 + casts + rim runs (usually 1) |

Measured: a figure is 38 to 54 shapes and 147 to 176 paths; the table 12 shapes and 18 paths; the oven 20 and 32; the press 55 and 72; the beam scale 28 and 40; a heap of 34 pieces 150 and 204; one stretch of the yard 152 flat shapes; the room 29 shapes.

**Budget.** The dry run fails a frame over `LIMITS.paths` (`src/engine/qa/limits.ts`: 2,400). For scale: the yard of `ggsp` peaks near 1,600 paths (about 1,060 shapes) and renders in about 0.13 s a frame at full size (`machine.md`, section 2); its steel world peaks near 250. Points are nearly free; round shapes are what add up (150 of them added about 0.04 s to a frame on the build PC). So:

- Make far, small and near-the-lens things flat. The porter who crosses close to the lens, the shadow figures on the wall and the ghost copies of a thrown piece are all flat.
- List only what is in view (the yard filters its stretches, heaps and specks by what the camera sees).
- Let only big parts cast shadows: `shapes.filter((s) => Math.abs(area(s.pts)) > 420)`, less the small ids.

## 6. Sets

`src/assets/sets/`. What exists:

| Set | Builder | Returns |
|---|---|---|
| The room | `buildRoom(o: RoomOpts)`, `room.ts` | `wall`, `wallSun`, `fittings`, `floor`, `floorSun`, `floorSunShapes`, `junction`, `dadoTop`, `box`, `air` (where the gradients sit), `sun(sunAt)` |
| Its doorway | `buildDoor(o: DoorOpts)`, `door.ts` | `solid`, `view` (the glare outside), `housing`, `opening`, `H`, `at(z, h)`, `shutter(open)`, `threshold(z)` |
| The yard | `buildYard(o: YardOpts)`, `yard.ts` | `skyFar`, `skyMid`, `wall`, `ground`, `wallBox`, `junction`, `wallTop`, `box` |
| The steel world | `steel.ts` | Constants (`PIER_L`, `PIER_R`, `DECK_L`, `DECK_R`, `WALL_L`, `WALL_R`, `CITY_FAR`, `CITY_MID`, `CITY_NEAR`), small builders (`pierCap`, `towerFloor`, `truck`, `rodOutline`, `meltBand`, `crestStrip`, `tieShape`), the sky as stops (`SKY`, `skyAt(y)`, `skyVeil`) |

**Recipe for a new world.** Each step is how the existing sets do it; listings 4 and 5 do them all.

1. **One light.** From the board: the place, the time of day, where the sun is. Write one `SceneLight` and decide which way the shadows fall.
2. **Sizes from `GY` and `u`, and the frame's thirds.** Type goes in the top third, so put sky or plain wall there; the action below it; nothing that matters in the right-hand fifth (the Shorts buttons).
3. **A back plane in a few big flat shapes** (`{ form: "flat" }`; the whole room is 29 shapes). It meets the ground at `junction`, `GY - 0.34 * u` in the room and 0.36 in the yard: a third of a head behind the actors' line, so their feet stand on floor. It runs on `1.2 * u` under the ground, so a camera move opens no gap between two layers. Texture is small, flat and faint: rain stains at opacity 0.42, mortar lines at 0.55 to 0.65, cart ruts at 0.4. `src/assets/sets/dressing.ts` has them ready, with their materials as arguments: `stains`, `brickPatch`, `ruts`, and for a skyline `roofline`, `sawtooth`, `chimney` (with or without smoke), `minaret`, `tank`. Use a few: a bare wall wants three or four stains and one patch of brick, not twenty.
4. **The sun's patch in its own materials** (section 4, rule 2). For each surface the sun partly reaches, add a `.sun` material (`unlit` gives the first choice for its partner in shade) and cut the lit parts out with `litParts(shapes, patch)`; return the lit ground as a polygon too, for the shadows. The room's `sun(sunAt)` gives the patches for any height of the sun's edge (a shutter that rolls up).
5. **Depth behind.** One or two skylines, flat, each paler than the one in front. The yard has roofs and minarets at depth 4, the mills at 2.2 a step darker, and haze over their feet; the dawn city is two veils of one dark material at opacity 0.17 and 0.3, so each takes the colour of the sky behind it. Depths: `engine.md`, section 8.
6. **Something close to the lens**, dark, in a bottom corner: heaps at depth -0.3 (`scrapHeap(id, { ..., near: true, scale: 1.7 })`), a stack of drums that wipes across the frame, the furnace walls at -0.5.
7. **Variation from seeds**: `hash(seed * 3.7 + i)` (`src/engine/motion/track.ts`: 0 to 1, fixed for each number). Never `Math.random`: every frame is rendered by itself and must come out the same.
8. **Return the parts separately, back to front**, so that type and actors can go between them. The frame lists them as display items (`engine.md`, section 12): listing 5 does it in one list; the room's file offers two ready-made halves, `roomBack(room, { id, space, glow?, inner? })` and `roomFloor(room, { id, space, casters, groundY, stretch?, drop? })`, where `inner` is the type on the wall. Light and air are `fill` items with gradients, never shapes: shade down from the top of the room and toward its far end, a warm bloom round the sun, dust at the foot of the yard wall, a darker near floor. Their colours live in the set's palette.
9. **Build it once**, when the module loads: `export const ROOM = buildRoom({...})` in the take, `PIER_L` and `CITY_FAR` in `steel.ts`. Per frame, rebuild only what changes (`ROOM.sun(sunAt)`, `DOOR.shutter(open)`, `pierCap(rise, spread)`). For a long travel, tile stretches side by side, each with its own seed and a few px wider than its share, because a hairline shows at full size where two meet exactly (`YARD` in `src/films/ggsp/take.ts`: four stretches of 1,400 px, `x1 + 4`). List only those in view, and give the builder an id prefix if two stretches will ever share one list.
10. **Check** (listing 5, part 3). Compose a still from the set, a prop and a figure posed from `stand()`: every painted shape passes and the frame is inside the path budget. Then make that list the `frame` of a sequence, run `node tools/check.ts <film> --seq <seq>`, look at it without a browser (`node tools/preview.ts <film>-<seq>:0`, a second or two), fix what is plainly wrong, then render the real still (`node tools/stills.mjs <film>-<seq>:0@0.5`) and put it beside `docs/img/md_room.jpg` and `docs/img/ggsp_yard.jpg`: same edges, same kind of light, same proportion of people to set (`review.md`, section 4).

## 7. Props

`src/assets/props/`. What exists:

| Prop | Call | Returns |
|---|---|---|
| Table, oven (`md.ts`) | `buildTable(id, { x, ground, w, h, u })`, `buildOven(id, { x, base, w, h, u })` | `{ back, front, topY, depth, x0, x1 }`; `{ shapes, topY, x0, x1, grips: { near, far, pat } }` |
| Press (`press.ts`) | `buildPress(id, { x, ground, u }, state)`, `pressPoints(o, state)` | `{ shapes, bolt, spannerEnd, beamEnd, x0, x1, topY }` |
| Tin, notes, calendar (`tin.ts`) | `buildTin(id, { x, base, u, lid, notes })`, `tinPoints(o, lid)`, `buildNotes(id, at, ang, u)`, `buildCalendar(id, { x, y, w, h, flip })` | `{ shapes, lidEdge, inside, topY, x0, x1 }`; `Shape[]`; `{ back, page, yearAt, yearCap }` |
| Beam scale, sack (`scale.ts`) | `buildScale(id, { pivot, u, dir, ang?, poiseAt?, swing? })`, `scalePoints(o)`, `buildSack(id, neck, w, h, swing = 0, seed = 1)` | `{ back, front, handle, poise, hook, longEnd }`; `{ shapes, bottom }` |
| Scrap (`scrap.ts`) | `plate(id, c, w, h, a, mat)`, `pipe(id, c, len, r, a, mat, hole)`, `rim`, `drum`, `gear`, `sheet`, `rods`; `scrapHeap(id, { x, ground, w, h, seed, scale?, near?, count? })`, `drumStack(id, { x, ground, cols, rows, w, h, seed, near? })` | `Shape[]` |
| Crow, bundle, bell (`yardlife.ts`) | `crow(id, c, size, { dir, tilt?, flap?, fold? })`, `bundle(id, c, w, h, tilt = 0, seed = 1, mat = "sil.cloth")`, `bellShadow(id, pivot, u, swing, clap, rope)` | `Shape[]` (all flat but the bundle) |
| Crate (`crate.ts`) | `buildCrate(id, c, w, h, tilt = 0, mat = "wood")` | `Shape[]`; `CRATE_PALETTE` holds its one material, `wood`. |

**Recipe for a new prop.** Each step is a convention of the existing ones; listing 2 follows them all.

1. **Reduce the thing to its few big forms.** Boxes become planes, turned or soft parts are round, details are flat. Size it in head-heights against a person: a seat is at the knee (1.45), a table top a little below the hip (2.3), a doorway 5.9 high.
2. **`buildX(id, spec)` returns shapes, back to front.** `id` is the prefix of every shape id. The spec places the prop by the point it stands on (`x`, and `ground` or `base`) and sizes it by `u`. Return what a take needs as well: `topY`, `x0`, `x1`.
3. **`back` and `front` when something goes between**: the table's far legs, then whoever stands behind it, then its top and near legs. The scale is split the same way: the stirrup that a fist closes over, then the beam.
4. **A box shows a front, a top and a right-hand side**, seen a little from above: planes facing `[0, 0]`, `[0, -1]`, `[1, 0]`, the back edge offset by `D = [0.2 * u, -0.24 * u]` (table, press; the oven and the tin use a smaller one). Keep one such view for every box in a world.
5. **An `xPoints(spec, state)` function gives the points a hand holds without building the drawing** (`pressPoints`, `tinPoints`, `scalePoints`): a hand is pinned to them many times a frame. The builder calls the same function, so the two cannot disagree.
6. **Moving parts take a state of plain numbers**: `PressState { beam, platen, box, spanner, shake }` (`PRESS_BUILT` is the finished machine), the tin's `lid` in radians, the calendar's `flip` from 0 to 1, the scale's `ang`, `poiseAt`, `swing`. Build each part upright and turn it with `turnShapes`.
7. **Many things alike come from a generator with a seed**: `plate`, `pipe`, `rim`, `drum`, `gear`, `sheet`, `rods` each return a few shapes; `scrapHeap` and `drumStack` place them by seed, the same in every frame.
8. **Export `X_PALETTE`**, base colours only, every name starting with the prop's name. A prop carries no words, numbers or marks: the banknotes have no denomination, and the calendar's year is type placed at the `yearAt` it returns.
9. **Check** (listing 5, part 1): `checkShapes` passes; the points are where the drawing is; `contrast` against what will stand behind it is not near 1. Then look at it in a still (the set recipe, step 10).

## 8. Characters

`src/assets/cast/cast.ts` holds the cast (`CAST`, `CAST_PALETTE`); `src/engine/figure/` draws them. A torso and a head are each one lofted form: cross-sections stacked along an axis, so the same form gives the right outline from the front, in profile and everywhere between, and every feature (an eye, a hairline, a row of buttons) is placed on its surface and turns with it. Arms and legs are two-bone limbs: a soft shape round the bone line, cut into sleeve, cuff and skin. You set specs; you never touch a loft. Posing (`stand`, `buildFigure`, what a figure returns) is in `engine.md`, section 9.

A `Character` is `{ id, skin, build, head, outfit }`: `skin` is a material; `build` comes from `makeBuild(o: BuildOpts)`.

| `BuildOpts` | Meaning (1 = the base figure) | In the cast |
|---|---|---|
| `wide`, `deep` | Width and depth of the trunk; `wide` also sets the shoulders and hips. | 0.86 to 1.14; 0.88 to 1.1 |
| `belly`, `chest` | Extra at the belly and at the chest, in head-heights. | 0 to 0.1; 0 to 0.06 |
| `shoulders`, `hips` | Width at the shoulders and at the hips. | 0.95 to 1.1; `hips` never set |
| `limb` | Thickness of the arms and the neck. | 0.86 to 1.12 |
| `torso`, `legs`, `arms` | Lengths. `legs` moves the height most. | 1 to 1.03; 0.94 to 1.1; 1 to 1.05 |
| `head` | Head size against the body. | never set |

The geometry stays sound well outside these ranges (`wide` and `limb` from 0.7 to 1.4 and `legs` from 0.7 to 1.3 were run), but only the ranges above have been looked at in a film. Check the height with `figureHeight(ch.build, LOOK_A.people.head)`: the cast are 5.40 to 5.85.

**`HeadSpec`** is `{ form, face, skin, hair?, beard?, moustache?, cap?, glasses?, browMat? }`. All its numbers are in head-heights, y from -0.5 (the crown) to 0.5 (the chin).

- `form`: `HEAD_BASE` reshaped. `headForm({ wide, jaw, chin, cheek, back, brow })` in `cast.ts` does it (overall width 0.92 to 1.05, jaw width 0.96 to 1.08, how square the chin is 1.1 to 1.5, cheeks 0.95 to 1.04). It is exported from `cast.ts`; a film's own characters still belong in that file, next to the others, so the whole cast shares one palette and one sheet.
- `face`: `{ ...FACE_BASE, ...changes }`.

| `FaceSpec` | `FACE_BASE` | In the cast |
|---|---|---|
| `eyeX` (half the distance between the eyes), `eyeW`, `eyeH` | 0.165, 0.036, 0.05 | 0.15 to 0.165; 0.032 to 0.038; 0.045 to 0.054 |
| `browW`, `browT` (thickness), `browArch` | 0.15, 0.019, 0.018 | 0.15 to 0.165; 0.016 to 0.027; 0.008 to 0.024 |
| `noseLen` (how far it stands out), `noseWing`, `noseTip` | 0.075, 0.058, 0.135 | 0.066 to 0.09; 0.052 to 0.068; 0.135 to 0.14 |
| `mouthW`, `mouthY` | 0.105, 0.305 | 0.092 to 0.115; 0.305 to 0.315 |
| `eyeY`, `browY`, `noseTop`, `noseBase`, `earY`, `earH`, `earW` | -0.005, -0.118, 0.02, 0.182, 0.075, 0.105, 0.15 | never changed |

- `hair`: `{ mat, line, top, side, nape?, wave?, lip? }`. `line` is the hairline as `[degrees round the head from the front, y]` knots; the hair covers everything above it. A list from 0 to 180 is mirrored (a symmetric cut); one from -180 to 180 is not (Rahul's parting). At the front the cast run from -0.25 to -0.37 (a lower number is a higher hairline), about 0.1 at the ears (80 degrees), 0.17 to 0.22 at the nape. `top`, `side`, `nape` are the volume over the skull: 0.02 to 0.09, 0.03 to 0.055, 0.02 to 0.04. `wave: { n, d }` puts soft lumps in the outline (Rahul: 5, 0.18). No `hair` at all is a bald head; then set `browMat`.
- `moustache`: `{ mat, y, w, h, droop }`: 0.215 to 0.22, half-width 0.105 to 0.13, thickness 0.036 to 0.05, how far the ends hang 0.02 to 0.035.
- `beard`: `{ mat, line, end, grow, chin }`: its upper edge as knots from 0 to `end` degrees (Iraki: 100), its thickness (0.035), extra length at the chin (0.1).
- `cap`: `{ mat, line, grow, top }`: its lower edge as knots, its thickness (0.028), extra height at the crown (0.035).
- `glasses`: `{ mat, w, h, lift }`: the frame's material (`frame`), the half-size of a lens (0.1, 0.08), how far it stands off the face (0.045).

**`Outfit`** is `{ top, over?, legs, shoe, belt?, collar? }`. Lengths down the torso run from 0 (the base of the neck) to 1 (the hip line); along a limb from 0 to 1 (elbow or knee) to 2 (wrist or ankle).

| Part | Fields | In the cast |
|---|---|---|
| `top` | `{ mat, hem, sleeve, cuff?, neck?, ease?, placket?, from? }`. A `hem` past 1.17 hangs over the thighs and opens with a stride. `neck: { dip, point? }`: `point` makes a V. `ease`: how much looser than the body. `placket: { to, buttons, mat, tone? }`: the strip of buttons. `cuff: { mat, from, to }`: a rolled sleeve. | `hem` 1.07 to 1.12 (a shirt), 1.46 to 1.5 (a kurta); `sleeve` 0.7 (short), 1.1 (rolled), 1.9 (long); `dip` 0.06 to 0.12; `ease` 0.012 to 0.02 |
| `over` | A second garment over the first, same fields without the sleeve: a waistcoat. | Iraki: `from: 0`, `hem: 0.98`, `neck: { dip: 0.36, point: true }` |
| `legs` | `{ mat, half: [hip, knee, ankle], end }`: half-widths in head-heights, and where the cloth ends. | `half` about `[0.24, 0.18, 0.15]`; `end` 1.93 to 1.95, or 1.12 (bare shins) |
| `shoe`, `collar`, `belt` | `{ mat }`; `{ mat, kind: "band" \| "wing" }` (a kurta's, a shirt's); `{ mat, at, width }` | `belt` is used by none of the cast; listing 3 uses it |

A character needs these materials in the palette: its skin, its hair, each garment, and `FIGURE_PALETTE` (eyes, mouth, teeth, lens, frame), which `CAST_PALETTE` already spreads.

**How the cast are made to differ.** Heights are with look A's head.

| | Build | Head and face | Hair and marks | Clothes |
|---|---|---|---|---|
| `RAHUL` | stout, short legs (5.40) | wide, big eyes, short nose, wide mouth | thick wavy fringe swept across | mustard kurta to the thigh, pale pajama, sandals |
| `VIKAS` | slim, tall, wide shoulders (5.85) | narrow, square chin, small eyes, long nose | short hair, moustache, glasses | blue shirt with rolled sleeves, dark trousers, shoes |
| `IRAKI` | broad, deep chest (5.43) | wide jaw, heavy brows, large nose | skull cap, full beard | white kurta, dark green waistcoat, pajama, sandals |
| `BUYER` | slight (5.63) | narrow, eyes close together, thin brows | thin hair, high hairline, small moustache | pale green short-sleeved shirt, brown trousers |
| `PORTER`, `SON_A`, `SON_B` | lean (5.55); tall (5.85); middling (5.70) | `FACE_BASE` | plain hair of three volumes | every material is `sil` |

The last three are only ever seen as a dark shape (crossing close to the lens, or as shadows on a wall), so they use one material and only the outline matters; the frame drops the marks inside the face and paints the rest flat (`asShadow` in `src/films/ggsp/frame.ts`). `sil` is in `CAST_PALETTE`.

**Tried beyond the cast** (the geometry is sound and each was looked at once as a picture, but none has been in a film): a bald head; a wound turban as a `cap` with `grow: 0.07`, `top: 0.1`; hair to the jaw (hairline knots falling to y 0.36 to 0.46 from 82 degrees round to the back, `side: 0.07`, `nape: 0.1`) with a kurta to the knee (`hem: 1.62`), which reads as a woman in a kurta. **Not possible with these specs**: hair below the jaw, a plait, a bun, anything draped (a sari, a dupatta, a shawl), a skirt or dhoti below the knee, a brimmed hat, a bag on a shoulder. Board round them (`directing.md`, section 9) or say that the engine needs a new part.

**Recipe for a new character.** Listing 3 is one.

1. **Write one line on who this is** and how they differ from everyone they will stand next to: build first, then head shape, hair, marks, clothes.
2. **Pick a build that is still free in the film** and write `makeBuild({...})`. Stout and short is taken (Rahul, Iraki); so is slim and tall (Vikas).
3. **Reshape the head** with `headForm`, then change at least three things on the face away from `FACE_BASE` and from the others: eyes, brows, nose, mouth, and a mark (moustache, beard, glasses, cap).
4. **Draw the hairline** as knots and give the hair its volume.
5. **Dress it**: `top`, `legs`, `shoe`, and `over`, `collar`, `belt` as needed. Give it one colour that nobody else in the film wears.
6. **Add its materials to `CAST_PALETTE`**: skin (the cast run from `#b47850` to `#c98a5e`), hair, each garment.
7. **Check** (listing 5, part 2): sound at 21 turns from -100 to 100 degrees; 5.3 to 5.9 heads; **its black silhouette differs from that of everyone it shares a frame with, and at least three things on its face differ from each of them.** Measured as in the listing (same feet, scale and turn; the share of area in common), two people in one frame overlap by 0.70 (Rahul and Vikas 0.71, Iraki and the buyer 0.70) and the faces of the four speaking characters differ in 5 to 12 things: aim under 0.80. Build moves this number most: the first build tried for listing 3, stout with short legs, scored 0.87 and 0.89 against Rahul and Iraki. Then add it to `CAST` (the cast sheet lists everyone in `CAST` who is drawn in full), render the sheet (`node tools/stills.mjs CastSheet@0.5`), and look at the turns, the faces and the row of black shapes.

## 9. Effects

`src/engine/fx/dust.ts`; the material `dust` must be in the palette (`MD_PROP_PALETTE` and `YARDLIFE_PALETTE` each have one).

- `dustPuff(id, at, size, dir, age = 0.5, seed = 1, mat = "dust")`: a puff kicked out sideways from `at`: one scalloped body along the ground and three motes, all flat. `dir` is -1 (left) or 1; `age` from 0 to 1 grows it (0.45 to 1.2 of `size`) and thins it. A landing uses two, one each way, over about two seconds.
- `motes(id, x0, y0, x1, y1, count, seed = 1, mat = "dust")`: specks that hold still. The films draw their own, which drift:
- **Dust that drifts and is lit only where the sun reaches it** (`src/films/md/frame.ts`, `src/films/ggsp/frame.ts`). Each speck is a flat ellipse of radius 2 to 5 px whose place is `hash` plus a slow sine plus a slow drift, all functions of `t`. Its opacity is how far it is inside the light (`y - sunEdgeY(open, x)` in the room, `inShaft(p)` in the yard) times a slow glint; where that is near zero the speck is not listed. Even specks go behind the actors, odd ones in front.
- **Ghost copies behind a fast thing** (the thrown gear): the same shapes built at `t - 2/60` and `t - 1/60`, made flat, at opacity 0.16 and 0.34, with ids of their own (`thrown.g2`, `thrown.g1`), listed before the thing itself.
- **Contact shadows**: under each foot and each leg of a thing, a flat ellipse of the ground's material in its `deep` tone at opacity 0.42 to 0.46, 5 px below `GY`: radii about `0.43 * u` and `0.07 * u` under a foot, `0.18 * u` and `0.04 * u` under a table leg. Under a walking foot it shrinks and fades as the foot lifts (`footContacts` in both frame files: `lift = min(1, feet.lift / (0.3 * u))`, opacity times `1 - 0.75 * lift`).

Things that appear and vanish within a frame (specks, bursts, ghosts) must be named in the sequence's `allow` list with the reason (`review.md`, section 3).

## 10. The worked example

Five listings: the checks, a stool, a trader called Das, a lane at dusk, and a dry run that tests all three and lists a still scene of them. They were run as printed from `studio/out/docs-scratch/draw/` (three folders below the studio, hence `../../../src/`): `node out/docs-scratch/draw/dryrun.ts` ends in `PASSED`. In a film the assets go to `src/assets/props/`, `src/assets/sets/` and `src/assets/cast/cast.ts`, where the imports start `../../engine/`. Node needs the `.ts` on every import and `type` on every imported type.

**Listing 1, `check.ts`: what every new asset must pass.**

```ts
// check.ts: what every new asset must pass before anything is animated.
import { rimRuns } from "../../../src/engine/draw/derive.ts";
import type { Palette, Shape } from "../../../src/engine/draw/shape.ts";
import { area, type Pt } from "../../../src/engine/geom/vec.ts";
import type { SceneLight } from "../../../src/engine/look/color.ts";
import { LOOK_A } from "../../../src/engine/look/looks.ts";

/** How many SVG paths the look-A painter writes for one shape. */
export function pathCost(s: Shape, light: SceneLight): number {
  const form = s.form ?? "round";
  if (form === "flat" || (form === "plane" && !s.casts?.length)) return 1;
  const rimW = LOOK_A.rim * (s.rim ?? 1) * (light.rim ?? 0.6);
  const rims = form === "round" && rimW > 0.2 ? rimRuns(s.pts, light.dir as Pt, rimW).length : 0;
  return 2 + (form === "round" ? 1 : 0) + (s.casts?.length ?? 0) + rims;
}

/** Sound outlines, known materials, no id twice. Prints one line, then every fault; true when there is none. */
export function checkShapes(label: string, shapes: readonly Shape[], palette: Palette, light: SceneLight): boolean {
  const faults: string[] = [];
  const ids = new Set<string>();
  for (const s of shapes) {
    if (s.pts.length < 3 || !(area(s.pts) > 0) || s.pts.some((p) => !Number.isFinite(p[0] + p[1]))) faults.push(`${s.id}: broken outline (${s.pts.length} points)`);
    if (s.color ? !/^#[0-9a-f]{6}$/i.test(s.color) : !palette[s.mat]) faults.push(`${s.id}: material "${s.mat}" is not in the palette`);
    if (ids.has(s.id)) faults.push(`${s.id}: id used twice`);
    ids.add(s.id);
  }
  console.log(`${label}: ${shapes.length} shapes, ${shapes.reduce((n, s) => n + pathCost(s, light), 0)} paths, ${faults.length} faults`);
  for (const f of faults) console.log(`  !! ${f}`);
  return faults.length === 0;
}
```

**Listing 2, `stool.ts`: a prop.**

```ts
// stool.ts: a prop. A wooden stool seen side-on and a little from above, like the room's table: a front, a top, a right side.
import { shape, type Palette, type Shape } from "../../../src/engine/draw/shape.ts";
import { roundRect } from "../../../src/engine/geom/outline.ts";
import type { Pt } from "../../../src/engine/geom/vec.ts";

/** Base colours only. Every name starts with the prop's own name, so it cannot collide in a film's palette. */
export const STOOL_PALETTE: Palette = { "stool.wood": "#9a6a44", "stool.seat": "#c9a06a", "stool.foot": "#2f2c31" };

/** `x`: middle of the seat's front edge. `ground`: the floor under the front legs. `u`: px per head-height. */
export type StoolAt = { x: number; ground: number; u: number };
const SIZE = { w: 1.0, h: 1.45, seat: 0.11, leg: 0.1 }; // in head-heights, so the stool fits the people
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Where something is set down on it and where a hand lifts it, without building the drawing. */
export function stoolPoints(o: StoolAt): { seat: Pt; grip: Pt } {
  const topY = o.ground - SIZE.h * o.u;
  return { seat: [o.x + 0.08 * o.u, topY - 0.095 * o.u], grip: [o.x + (SIZE.w / 2) * o.u, topY + (SIZE.seat / 2) * o.u] };
}

export function buildStool(id: string, o: StoolAt) {
  const { x, ground, u } = o;
  const D: Pt = [0.16 * u, -0.19 * u]; // from the front edge of the top to its back edge
  const x0 = x - (SIZE.w * u) / 2;
  const x1 = x + (SIZE.w * u) / 2;
  const topY = ground - SIZE.h * u;
  const th = SIZE.seat * u;
  const lw = SIZE.leg * u;
  const legX = [x0 + 0.07 * u, x1 - 0.07 * u - lw];
  // `back` is painted before whatever stands behind the seat: the far legs, one flat tone (the material's own shade)
  const back = legX.map((lx, i) => shape(`${id}/leg.back${i}`, "stool.wood", box(lx + D[0], topY + D[1] + th, lx + D[0] + lw, ground + D[1]), { form: "flat", tone: "shade" }));
  const front: Shape[] = [
    // the seat is a box: each face is a plane, lit or not as a whole by the way it faces
    shape(`${id}/seat.side`, "stool.seat", [[x1, topY], [x1 + D[0], topY + D[1]], [x1 + D[0], topY + D[1] + th], [x1, topY + th]], { form: "plane", facing: [1, 0] }),
    shape(`${id}/seat.top`, "stool.seat", [[x0, topY], [x0 + D[0], topY + D[1]], [x1 + D[0], topY + D[1]], [x1, topY]], { form: "plane", facing: [0, -1] }),
    shape(`${id}/seat.front`, "stool.seat", box(x0, topY, x1, topY + th), { form: "plane", facing: [0, 0] }),
    shape(`${id}/rung`, "stool.wood", box(legX[0] + lw / 2, ground - 0.42 * u, legX[1] + lw / 2, ground - 0.35 * u), { form: "plane", facing: [0, 0] }),
    shape(`${id}/rung.top`, "stool.wood", box(legX[0] + lw / 2, ground - 0.42 * u - 3, legX[1] + lw / 2, ground - 0.42 * u), { form: "flat", tone: "light" }),
  ];
  for (const [i, lx] of legX.entries()) {
    // a turned leg is a round form: `depth` is the width of its core shadow; the rim light comes by itself
    front.push(shape(`${id}/leg${i}`, "stool.wood", roundRect([lx + lw / 2, (topY + th + ground) / 2], lw / 2, (ground - topY - th) / 2, 3), { depth: lw * 0.55 }));
    front.push(shape(`${id}/foot${i}`, "stool.foot", roundRect([lx + lw / 2, ground - 0.03 * u], lw / 2 + 2, 0.04 * u, 3), { form: "flat" }));
  }
  return { back, front, topY, x0, x1, ...stoolPoints(o) };
}
```

**Listing 3, `das.ts`: a character.**

```ts
// das.ts: a new character. In a film it goes into src/assets/cast/cast.ts, next to the others.
import { CAST_PALETTE, headForm } from "../../../src/assets/cast/cast.ts";
import type { Palette } from "../../../src/engine/draw/shape.ts";
import { makeBuild, type Character } from "../../../src/engine/figure/body.ts";
import { FACE_BASE } from "../../../src/engine/figure/head.ts";

/** A trader in his sixties: big and tall, a belly, grey hair gone from the front, a heavy moustache, a shirt tucked into a belt. */
export const DAS: Character = {
  id: "das",
  skin: "skin.das",
  build: makeBuild({ wide: 1.2, deep: 1.12, belly: 0.12, shoulders: 1.08, limb: 1.14, legs: 1.1, torso: 1.04 }),
  head: {
    form: headForm({ wide: 1.07, jaw: 1.1, chin: 1.2, cheek: 1.05 }),
    face: { ...FACE_BASE, eyeX: 0.172, eyeW: 0.033, eyeH: 0.043, browW: 0.17, browT: 0.025, browArch: 0.012, noseLen: 0.084, noseWing: 0.07, mouthW: 0.12, mouthY: 0.312 },
    skin: "skin.das",
    hair: { mat: "hair.grey", line: [[0, -0.43], [35, -0.38], [60, -0.16], [80, 0.09], [100, 0.12], [140, 0.17], [180, 0.19]], top: 0.02, side: 0.04, nape: 0.03 },
    moustache: { mat: "hair.grey", y: 0.218, w: 0.14, h: 0.055, droop: 0.045 },
  },
  outfit: {
    top: { mat: "shirt.cream", hem: 0.97, sleeve: 0.75, neck: { dip: 0.12, point: true }, ease: 0.016, placket: { to: 0.9, buttons: 3, mat: "shirt.cream" } },
    collar: { mat: "shirt.cream", kind: "wing" },
    belt: { mat: "belt", at: 0.97, width: 0.07 },
    legs: { mat: "trousers.grey", half: [0.27, 0.2, 0.165], end: 1.95 },
    shoe: { mat: "sandal" },
  },
};

/** The cast's palette with his own base colours added: skin, hair and each garment. */
export const DAS_PALETTE: Palette = { ...CAST_PALETTE, "skin.das": "#a9714b", "hair.grey": "#8f8b88", "shirt.cream": "#e4d8be", "trousers.grey": "#5a5a66", belt: "#3b2a22" };
```

**Listing 4, `lane.ts`: a set.**

```ts
// lane.ts: a set (a "world"). A lane behind a market at dusk, seen side-on: far roofs in haze, one long plastered wall,
// packed earth. The sun is low at frame RIGHT: it lights the right-hand end of the wall and a strip of ground.
import { buildCrate } from "../../../src/assets/props/crate.ts";
import { litParts } from "../../../src/engine/draw/derive.ts";
import { shape, type Palette, type Shape } from "../../../src/engine/draw/shape.ts";
import { capsule } from "../../../src/engine/geom/outline.ts";
import { unit, type Pt } from "../../../src/engine/geom/vec.ts";
import { unlit, type SceneLight } from "../../../src/engine/look/color.ts";
import { hash } from "../../../src/engine/motion/track.ts";

/** One light for the whole world: a warm key low at the right, a cool ambient. */
export const LIGHT_DUSK: SceneLight = { dir: unit([0.88, -0.47]), key: "#ffb872", ambient: "#5a68a0", strength: 0.9, rim: 1 };

/** The unlit partner of a sunlit surface, as a first choice: what it looks like where only the sky reaches it. */
const shade = (sun: string): string => unlit(sun, LIGHT_DUSK);

// prettier-ignore
export const LANE_PALETTE: Palette = {
  // far to near: the farther a thing is, the closer its colour is to the sky behind it
  "lane.far": "#eccdaa", "lane.mid": "#d6ab8c",
  // each big surface twice, in the sun and in shade: two materials, never one material under a dark overlay
  "lane.wall.sun": "#e6ae7c", "lane.wall": shade("#e6ae7c"),
  "lane.coping.sun": "#f0c796", "lane.coping": shade("#f0c796"),
  "lane.plinth.sun": "#c98f66", "lane.plinth": shade("#c98f66"),
  "lane.ground.sun": "#dcb588", "lane.ground": shade("#dcb588"),
  "lane.pipe": "#b0704e",
  // close to the lens and in shade: about 0.7 of the lightness of the same thing in the open, and less colour
  "laneN.crate": "#4a3833",
  // the sky and the air are gradients laid over the shapes (listing 5); their colours live in the palette too
  "lane.sky.top": "#6f8fa6", "lane.sky.low": "#f6cfa0", "lane.sun.glow": "#ffe0a8", "lane.air.haze": "#f8d9b0", "lane.air.near": "#2a2030",
};

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const flat = { form: "flat" } as const;
export type Lane = ReturnType<typeof buildLane>;

/** `GY`: the line the actors stand on. `u`: px per head-height. `sunX`: where the sun's edge meets the foot of the wall. */
export function buildLane(id: string, o: { GY: number; u: number; x0: number; x1: number; y1: number; wallTop: number; sunX: number; seed?: number }) {
  const { GY, u, x0, x1, y1, wallTop, sunX } = o;
  const seed = o.seed ?? 1;
  const junction = GY - 0.35 * u; // the wall meets the ground a little behind the line the actors stand on
  // a skyline is one outline; its roofs are placed by seed, so it is the same skyline in every frame
  const roofs = (key: string, mat: string, lo: number, hi: number, k: number): Shape => {
    const foot = wallTop + 3 * u; // it runs on below the wall top: a far layer moves less than the wall does
    const pts: Pt[] = [[x0, foot]];
    for (let x = x0, i = 0; x < x1; i++) {
      const w = (0.45 + 1.1 * hash(seed * k + i)) * u;
      const top = wallTop - (lo + (hi - lo) * Math.pow(hash(seed * k * 2.3 + i * 1.7), 1.6)) * u;
      pts.push([x, top], [Math.min(x1, x + w), top]);
      x += w;
    }
    return shape(`${id}/${key}`, mat, [...pts, [x1, foot]], flat);
  };
  // the wall: a few big flat shapes in the unlit materials. It runs on under the ground, so a camera move opens no gap.
  const parts: [string, string, Pt[]][] = [
    ["wall", "lane.wall", box(x0, wallTop, x1, junction + 1.2 * u)],
    ["plinth", "lane.plinth", box(x0, junction - 0.45 * u, x1, junction + 1.2 * u)],
    ["coping", "lane.coping", box(x0, wallTop - 0.1 * u, x1, wallTop + 0.07 * u)],
  ];
  const wall = parts.map(([key, mat, pts]) => shape(`${id}/${key}`, mat, pts, flat));
  // the sun's edge leans with the light; right of it the same parts are painted again in their sunlit materials
  const lean = 0.5 * (junction - wallTop);
  const patch: Pt[] = [[sunX + lean, wallTop - 0.2 * u], [x1, wallTop - 0.2 * u], [x1, junction], [sunX, junction]];
  const wallSun = litParts(wall, patch); // the same shapes cut to the patch, each in its `.sun` material
  // a drainpipe: a round form, so its core shadow and rim come from the light. It stands wholly in the sun: a shape is
  // lit as a whole, so a form that crossed the sun's edge would have to be cut in two there, one piece per material.
  const px = sunX + lean + 2.1 * u;
  const fittings = [shape(`${id}/pipe`, "lane.pipe", capsule([px, wallTop + 0.1 * u], [px, junction - 0.1 * u], 0.07 * u, 0.07 * u), { depth: 0.07 * u })];
  // the sunlit ground: a polygon (shadows are clipped to it) and a shape
  const groundSun: Pt[] = [[sunX, junction], [x1, junction], [x1, y1], [sunX - 0.55 * (y1 - junction), y1]];
  // close to the lens, in the bottom corner that lies under the Shorts buttons: two crates in the dark material
  const near = [...buildCrate(`${id}/crate0`, [x1 - 1.6 * u, y1 - 0.6 * u], 2.4 * u, 1.8 * u, 0.04, "laneN.crate"), ...buildCrate(`${id}/crate1`, [x1 - 1.1 * u, y1 - 2.0 * u], 1.7 * u, 1.2 * u, -0.06, "laneN.crate")];
  // each part by itself, so that type and actors can go between them
  const skyFar = [roofs("far", "lane.far", 0.5, 2.4, 3.7)];
  const skyMid = [roofs("mid", "lane.mid", 0.15, 1.1, 5.3)];
  const ground = [shape(`${id}/ground`, "lane.ground", box(x0, junction, x1, y1), flat)];
  return { skyFar, skyMid, wall, wallSun, fittings, ground, groundSun, groundSunShapes: [shape(`${id}/ground.sun`, "lane.ground.sun", groundSun, flat)], near, junction, o };
}
```

**Listing 5, `dryrun.ts`: the checks, and a still scene.**

```ts
// dryrun.ts: the checks for a new prop, a new character and a new set, and a still scene made of the three.
// Run from the studio folder: node out/docs-scratch/draw/dryrun.ts
import { CAST } from "../../../src/assets/cast/cast.ts";
import { fade, fill, flatItems, group, paint, rect, shadow, type FrameList } from "../../../src/engine/draw/list.ts";
import { shape, type Palette, type Shape } from "../../../src/engine/draw/shape.ts";
import { buildFigure, figureHeight, stand, type Character } from "../../../src/engine/figure/body.ts";
import { FACES, FACE_BASE } from "../../../src/engine/figure/head.ts";
import { ellipse } from "../../../src/engine/geom/outline.ts";
import { DEG, area, bounds, pointInPoly } from "../../../src/engine/geom/vec.ts";
import { contrast } from "../../../src/engine/look/color.ts";
import { LOOK_A } from "../../../src/engine/look/looks.ts";
import { LIMITS } from "../../../src/engine/qa/limits.ts";
import { checkShapes, pathCost } from "./check.ts";
import { DAS, DAS_PALETTE } from "./das.ts";
import { LANE_PALETTE, LIGHT_DUSK, buildLane } from "./lane.ts";
import { STOOL_PALETTE, buildStool, stoolPoints } from "./stool.ts";

const U = 178; // px per head-height
const GY = 1505; // the line the actors stand on
const L = LIGHT_DUSK;
/** one palette for the scene: the palettes of everything in it, spread together */
export const P: Palette = { ...DAS_PALETTE, ...STOOL_PALETTE, ...LANE_PALETTE };
let ok = true;

// ---- 1. the prop: sound shapes, its points where the drawing is, its value against what will stand behind it
const at = { x: 770, ground: GY - 8, u: U };
const stool = buildStool("stool", at);
ok = checkShapes("stool", [...stool.back, ...stool.front], P, L) && ok;
if (Math.abs(stoolPoints(at).grip[0] - stool.x1) > 0.5) (ok = false), console.log("  !! the grip is not on the edge of the seat");
for (const behind of ["lane.wall.sun", "lane.wall"]) console.log(`  stool.wood against ${behind}: ${contrast(P["stool.wood"], P[behind]).toFixed(2)}:1`);

// ---- 2. the character: sound from every side, the family's height, a black shape and a face of his own
const turns: Shape[] = [];
for (let deg = -100; deg <= 100; deg += 10) turns.push(...buildFigure({ ...DAS, id: `das${deg}` }, stand(DAS, { feet: [500, 1000], scale: 100, yaw: deg * DEG }), LOOK_A.people).shapes);
ok = checkShapes("das, 21 turns", turns, P, L) && ok;
const heads = figureHeight(DAS.build, LOOK_A.people.head);
console.log(`  ${heads.toFixed(2)} heads tall`);
if (heads < 5.3 || heads > 5.9) ok = false;
/** a figure as a black shape: the points of a 4 px grid that fall inside it (same feet, scale and turn for everyone) */
const black = (ch: Character): Set<number> => {
  const parts = buildFigure(ch, stand(ch, { feet: [0, 0], scale: 100, yaw: 40 * DEG }), LOOK_A.people).shapes.map((s) => ({ pts: s.pts, b: bounds(s.pts) }));
  const on = new Set<number>();
  for (let y = -700; y < 20; y += 4) for (let x = -240; x < 240; x += 4) if (parts.some((p) => x >= p.b.x0 && x <= p.b.x1 && y >= p.b.y0 && y <= p.b.y1 && pointInPoly([x, y], p.pts))) on.add(y * 1000 + x);
  return on;
};
const mine = black(DAS);
for (const other of Object.values(CAST)) {
  const theirs = black(other);
  let both = 0;
  for (const k of mine) if (theirs.has(k)) both++;
  const alike = both / (mine.size + theirs.size - both);
  // on the face: FaceSpec numbers more than 5 % apart, and marks that one has and the other has not
  const face = (Object.keys(FACE_BASE) as (keyof typeof FACE_BASE)[]).filter((k) => Math.abs(DAS.head.face[k] - other.head.face[k]) > 0.05 * Math.abs(other.head.face[k]));
  const marks = (["moustache", "beard", "glasses", "cap"] as const).filter((k) => !!DAS.head[k] !== !!other.head[k]);
  const fine = alike < 0.8 && face.length + marks.length >= 3;
  console.log(`  against ${other.id.padEnd(6)} black shapes overlap ${alike.toFixed(2)}, ${face.length + marks.length} things on the face differ${fine ? "" : "  !! too alike"}`);
  ok = ok && fine;
}

// ---- 3. the set, and a still scene: set, prop and a posed figure as one display list
/** how far behind (+) or in front of (-) the actors each layer is */
const DEPTH = { far: 4, mid: 2.2, wall: 0.1, near: -0.3 };
// (a stretch is built 4 px wider than its share, so no hairline shows where the next stretch of a long set begins)
const lane = buildLane("lane", { GY, u: U, x0: -160, x1: 1240 + 4, y1: 1980, wallTop: 560, sunX: 150, seed: 4 });
// a figure starts from stand() and is then given the few numbers that make the pose an attitude
const pose = stand(DAS, { feet: [480, GY], scale: U, yaw: 0.95 }); // + faces screen right: toward the sun
pose.lean = 0.03;
pose.head = { yaw: 0.45, pitch: 0.04, face: FACES.smile, gaze: [0.3, 0] };
const das = buildFigure(DAS, pose, LOOK_A.people);
// where something touches the ground: a flat ellipse in the ground's own deep tone
const contact = (id: string, x: number, rx: number): Shape => shape(id, "lane.ground", ellipse([x, GY + 5], rx, rx * 0.2, 0, 4), { form: "flat", tone: "deep", opacity: 0.45 });
const contacts = [contact("contact/das.L", das.legs.L.ankle[0] + 0.2 * U, 0.44 * U), contact("contact/das.R", das.legs.R.ankle[0] + 0.2 * U, 0.44 * U), contact("contact/stool.0", stool.x0 + 0.12 * U, 0.16 * U), contact("contact/stool.1", stool.x1 - 0.12 * U, 0.16 * U)];
// what throws a shadow: the big parts only (a button or a rung costs a path and adds nothing to the picture)
const casters = [...das.shapes, ...stool.back, ...stool.front].filter((s) => Math.abs(area(s.pts)) > 420 && !/foot|rung/.test(s.id));
const { x0, x1, y1, wallTop } = lane.o;
const screen = [rect(-80, -80, 1240, 2080)]; // the 1080 x 1920 frame and a margin
// (exported, so that the frame(t) of a test sequence can return it and a still can be rendered of it)
export const STILL: FrameList = {
  t: 0,
  view: { cx: 540, cy: 960, zoom: 1, roll: 0 },
  items: [
    // the sky and the sun's glow are fixed to the screen: too far off to move with the camera
    fill("sky", "screen", { kind: "linear", x1: 0, y1: 0, x2: 0, y2: wallTop, stops: [{ at: 0, color: P["lane.sky.top"], a: 1 }, { at: 1, color: P["lane.sky.low"], a: 1 }] }, screen),
    fill("sky.glow", "screen", { kind: "radial", cx: 1040, cy: wallTop - 40, r: 900, stops: fade(P["lane.sun.glow"], 0.85, 0) }, screen),
    paint("far", DEPTH.far, lane.skyFar),
    paint("mid", DEPTH.mid, lane.skyMid),
    fill("haze", DEPTH.mid, { kind: "linear", x1: 0, y1: wallTop - 300, x2: 0, y2: wallTop, stops: fade(P["lane.air.haze"], 0, 0.6) }, [rect(x0, wallTop - 300, x1 - x0, 340)]),
    // (type written on the wall would go here, between the wall and what stands in front of it)
    paint("wall", DEPTH.wall, [...lane.wall, ...lane.wallSun, ...lane.fittings]),
    paint("ground", 0, [...lane.ground, ...lane.groundSunShapes]),
    // cast shadows: the unlit ground showing through, and only inside the sun's patch
    group("cast", 0, [shadow("cast.on", 0, casters, "lane.ground", { tone: "base", ground: { y: GY, stretch: 0.45, drop: 0.28 } })], { clip: [lane.groundSun] }),
    fill("air.near", 0, { kind: "linear", x1: 0, y1: lane.junction + 160, x2: 0, y2: y1, stops: fade(P["lane.air.near"], 0, 0.45) }, [rect(x0, lane.junction + 160, x1 - x0, y1 - lane.junction - 160)]),
    paint("contacts", 0, contacts),
    paint("actors", 0, [...stool.back, ...stool.front, ...das.layers.behind, ...das.layers.body, ...das.layers.front]),
    paint("near", DEPTH.near, lane.near),
  ],
  figures: [{ name: "das", fig: das }],
};
let paths = 0;
for (const { item } of flatItems(STILL.items)) {
  if (item.kind === "paint") ok = checkShapes(item.id, item.shapes, P, L) && ok;
  if (item.kind === "shadow" && !P[item.on]) (ok = false), console.log(`  !! ${item.id} falls on "${item.on}", which is not in the palette`);
  paths += item.kind === "paint" ? item.shapes.reduce((n, s) => n + pathCost(s, L), 0) : item.kind === "shadow" ? item.casters.length : 1;
}
console.log(`the still: about ${paths} paths (the budget is ${LIMITS.paths})`);
if (paths > LIMITS.paths) ok = false;
console.log(ok ? "PASSED" : "FAILED");
process.exitCode = ok ? 0 : 1;
```

## 11. What breaks the look

| Do not | Because |
|---|---|
| Outlines: a stroke round a shape, an ink line | The look separates forms by value and light. One outlined thing makes everything else look unfinished. Fix the values instead (section 4, rule 5). |
| Filters and blur | They soften the hard edges that make the look, and one full-frame filter costs 200 to 400 ms, more than the whole frame does without it (`machine.md`, section 2). No display item can carry one, and `tools/check.ts` fails any in a film's files. Soft light is a gradient. |
| Blend modes | The same; and the one textured pass (paper, grain) belongs to ffmpeg after the render. |
| A shade colour picked by hand | It does not come from the scene's light, so it drifts from every computed shade round it. List base colours only. |
| Grey or black shadows laid over a surface | They dirty the colour and double where two overlap. A shadow is the surface's own unlit tone, opaque. (`GroundShadow` in `Paint.tsx` is such an overlay: it is for the sheets, never for a film.) |
| Many small shapes instead of a few big ones | Detail competes with the figures, reads as noise on a phone, and costs paths. Keep detail flat, faint and sparse. |
| Everything the same size | Depth and focus come from scale: a dark mass close to the lens, figures at about half the frame's height, a pale skyline far behind. |
| A weak or overhead light | The look is one strong, low light: long shadows, a clear lit side and shade side. Keep `dir` about 0.85 across and 0.5 up, `strength` 0.8 or more. |
