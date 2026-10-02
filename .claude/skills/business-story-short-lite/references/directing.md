# Directing: from a narration to a board

The board is the film on one page: the narration cut into sequences, each sequence into beats, each beat with what happens, where the camera is, what is written and what is heard. The user approves it before anything is animated, because it is the cheapest place to change an idea. Everything later (the takes, the sound sheet, the review) is checked against it.

## Contents

1. Read the narration
2. Cut it into sequences (worlds)
3. Join the sequences
4. Write the beats
5. The hook
6. The camera
7. Type on screen
8. What may not be shown
9. People, and what the rig cannot do yet
10. Sound on the board
11. The board's format, with an example
12. Before Stop A

## 1. Read the narration

Run `node tools/script.ts <film>`. It prints each sentence with its start and end in the tightened voice, the pauses, every number and every capitalised name. Read it for five things:

- **The hook**: what the first two seconds say. The picture has to be worth stopping for by then.
- **The turns**: the "but", the "then", the "one day". A turn is where a world changes or a new one begins.
- **The numbers and names**: each is a type moment that lands on its word.
- **The pauses**: a pause of 0.3 s or more is room for an action with no words over it (a thud, a look, a breath).
- **The last line**: the film ends on a held, living frame that the last words describe.

Then say in one sentence what the film is about. If a beat does not serve that sentence, it is decoration.

## 2. Cut it into sequences (worlds)

A sequence is one place at one time under one light, played as one continuous take. People and things come and go; the camera travels; nothing cuts. This is the single biggest difference between this skill's films and the ones they replaced. The user's verdict on a film of joined clips was "a bunch of individual clips joined", and on a continuous one, "the best video you have ever made for me".

- **One world per place and time.** A new sequence only when the story really moves: another place, another year, the inside of an idea (the furnace in `ggsp`).
- **8 to 25 seconds each.** Shorter and the film turns back into clips. Longer and one worker cannot hold it.
- **Fewer, richer worlds.** A 100-second film wants five to eight sequences, not fifteen. If the story returns to a place, return to that world (changed: later light, more things in it), do not build a new one.
- **Give every world a light with a reason.** Low morning sun through a doorway for a beginning; late afternoon for a trade that is ending its day; a furnace glow; dawn for what comes next. Across the film the lights should make an arc the viewer can feel. Write it as one line per sequence: time of day, key colour, where the sun is.
- **Decide who is in each world** and where they stand. Keep the cast small. Extras are silhouettes.

## 3. Join the sequences

A join is planned, with something carried across it. The next sequence starts drawing on top of the old one at its `t0`, and has covered the frame by its `tFull`; in between, both are on screen. The kinds that work:

| Join | What carries across | Example |
|---|---|---|
| Carry | The camera follows one thing out of a world and into the next | `ggsp`: the camera drifts from the trader to his shadow on the wall, and the shadow becomes his sons |
| Morph | A colour or a light grows until it fills the frame, and the next world is inside it | `ggsp`: scrap lifts into a glow that rises up the frame; the furnace is inside the glow |
| Pass | Something close to the lens crosses the frame and wipes the old world away | `ggsp`: a stack of drums passes in front of the year and takes it with it |
| Match | The last shape of one world is the first shape of the next (a round tin, a round moon; a rising rod, a rising tower) | `ggsp`: rods rise out of the melt and concrete closes round them |
| Through | The camera goes through an opening (a doorway, a window, a page) | `md` opens through a shutter that rolls up |

A hard cut is allowed only where the board asks for one, on a strong word. Never a white flash, never a cross-fade of two unrelated pictures: the old films did both and it read as slideshow.

Write for each join: which kind, what is carried, and on which word it happens.

## 4. Write the beats

A beat is one thing happening, pinned to the words that are spoken over it.

- **One action per phrase, landing on its word.** The contact (the thud, the click, the hand arriving) falls on the noun or the number: the oven meets the table on "10,000", not somewhere near it. Work back from the contact: the walk, the wind-up and the reach happen before the word.
- **Use the body.** The old films had half-figures who blinked. Here people walk in, carry weight, crouch, reach, turn, look at each other. Give each person something to do with their hands in every beat, and give the second person a reaction (a look, a nod, a shift of weight) a moment later than the first.
- **Something new at least every two seconds; every second in the first three.** New means an action, a move of the camera that reveals something, or a piece of type landing. A hold is allowed where the words want it, never longer than 1.25 s, and it must be alive (breath, a blink, drifting dust, the camera still creeping).
- **Stage for a phone.** The thing that matters is large and in the left four-fifths of the frame: the right fifth sits under the Shorts buttons. In a wide shot a standing figure is at least 22 % of the frame's height; when a face matters, the head is. Type is in the top third, the action below it.
- **Play it side-on.** The rig acts across the frame, like a stage. People face left or right or turn part-way to us. See section 9.
- **Light does story work.** A shutter that lets the sun in, a shadow that grows, a factory that warms from grey to gold. These are beats.
- **Every thing in the frame would really be there.** A beat sometimes needs a device (a switch to throw, a bell to ring, a board to read). Put it where such a thing lives: a main switch is on a wall or a pillar, not on a pole in the road. A prop that was invented for the beat and stands where nothing like it would stand is the first thing a viewer doubts.
- **A world has been lived in.** For each world, write down three things that say what kind of place it is and what has happened to it (for a shut factory: a torn notice on the gate, weeds along the plinth, a broken pane). And let the light touch it: in a low sun, people throw shadows on the wall behind them as well as on the ground. A plain wall with two figures in front of it is a diagram, not a place.

## 5. The hook

The first frame is already moving, and by half a second something has happened. In `ggsp` the year stands huge inside the yard at 0.36 s, dust crosses a shaft of sun and a crow lifts off the wall, all before the first sentence is done. Do not open on a title card, a logo, a slow fade or an empty set. A wall with a crow on it is an empty set: a bird, a swinging chain and drifting dust are life in a frame, not a reason to look at it. Unless the sentence is about a place with nobody in it, someone is in frame and doing something inside the first second or two; if the story's people cannot be there yet, the opening still needs somebody (a porter crossing, a hand that throws something, a watchman locking up). A film that kept its people out until the seventh second was sent back for exactly that.

## 6. The camera

One plan per sequence, keyed once: a list of framings the camera travels through without stopping. It pushes in on what matters, travels with a walk, pulls back to show everything at once, and rests (still drifting) where the viewer has to read.

- A move starts before the last one has landed, so there is never a dead stop between two moves.
- Depth sells the travel: a wall just behind the actors, a skyline far behind, something dark close to the lens that slides past quickly.
- Where type is on a wall, the camera may not push past it; plan the framing so the type keeps its place.
- A close-up is a push, not a cut.

## 7. Type on screen

What gets type: **numbers, names, dates, and the two or three words that carry a turn.** Nothing else. No subtitles, no sentences.

- **Verbatim.** The words are the narrator's own, in the narrator's order. "an oven" then "₹10,000". Never a label the narrator did not say ("COST", "STEP 1").
- **Each spoken piece lands on its own word.** A range is two pieces: "₹15" on "15", "–20,000" on "20,000". A name is as many pieces as it is spoken in.
- **Big.** An amount or a year at least 90 px tall on screen (the demos use 120 to 250); a name or phrase at least 70 px; a small caps label over it at least 24 px.
- **In the top third, inside the safe zone** (x 72 to 900, y 260 to 1440), and never over a head: at least 16 px clear, for as long as it shows.
- **It leaves by design.** With its beat (it sinks away as the camera moves on), or taken by something that passes in front of it. Only one block on screen at a time, as a rule; a new one arrives after the old one has left.
- **Long enough to read**: about a second, plus a quarter second per word.
- **Written on the world.** On the wall behind the actors, or across the sky, so that the camera's move and the light belong to it. Across a sky it goes at a great depth so it holds still while the camera travels.
- **On one calm ground.** Type that crosses the edge between a sky and a roofline is hard to read whatever its contrast. A tall middle ground (a works, a skyline) climbs up the frame when the camera pushes in, so decide for every framing in which the type shows what lies behind it, and keep glows and suns out from under it. The dry run measures what is really drawn behind each piece and notes one that stands across two surfaces.

The four blocks (amount under a label; a year with a place under it; a name under a lead-in; a phrase) are described in `perform.md` and `engine.md`.

## 8. What may not be shown

- **Nothing the narration does not say.** No invented number, date, weight, price tag, chart, ledger line or shop sign with words on it. The old films drew a price tag of "₹2,400" that nobody says; this user's rule is that such a thing never appears.
- **No trademark, redrawn or approximated.** If the story names a brand and the user has given no logo file, show the thing (a shopfront, a showroom, a product) plainly, with no mark.
- **Real people are stylised, never caricatured.** Build, hair, glasses and clothes carry the likeness.
- **Spellings that had to be looked up** are listed for the user to confirm before they go on screen.

## 9. People, and what the rig cannot do yet

The rig is a full body, about 5.4 heads tall, that acts side-on to three-quarter. Board around what it does not do:

| Not available | Do instead |
|---|---|
| Lip sync | Nobody speaks on screen. A call or a shout is a gesture (`callOut`) with no sound. |
| Walking toward or away from the camera | Enter and leave across the frame, or through a doorway in a side wall |
| Running | A brisk walk; or carry the hurry with the camera |
| Sitting on the floor, kneeling, lying | Standing, leaning, crouching at a table or a machine |
| Children | A shadow, a silhouette at a distance, a pair of small shoes by a door; or tell that part through objects |
| Animals | A bird as a simple shape that flies (the crow in `ggsp`) |
| Crowds | Three to five silhouettes in one flat tone, at a distance or close to the lens |
| A face in close-up for long | A push to head and shoulders for a second or two, with a look or a change of expression |
| Draped or long things: a sari, a dupatta, a shawl, a skirt or dhoti below the knee, hair below the jaw, a plait, a bun, a brimmed hat, a bag on a shoulder | The rig dresses people in a shirt or kurta, a waistcoat, trousers or pajama, a cap or turban, hair to the jaw. A woman is drawn with hair to the jaw and a kurta to the knee. If the story needs more than that, say on the board that the engine needs a new part, and ask the user before building one. |

Faces are small and simple in this look; the posing does the acting. Plan beats that read in silhouette.

## 10. Sound on the board

Write the cue for every beat: every contact, impact, footfall and start of a movement that should be heard, and one line of ambience per world. Mark where the music is sparse, where it arrives (usually on the turn), and which word its last note lands on. The details are in `sound.md`; the board only has to say what is heard and when.

## 11. The board's format, with an example

`tools/new-film.mjs` leaves a `board.md` with these tables to fill in. This is the board of the first demo as it was built (one sequence, 14 s):

**Sequence:** a bare rented room seen side-on. A steel shutter in the left wall, a two-tone back wall with a calendar and a switchboard, a cement floor, a hanging bulb, a steel table, a hand press half built. Low morning sun comes in through the doorway and throws long shadows to the right. Rahul (designer: rounder, mustard kurta) and Vikas (engineer: taller, glasses, blue shirt).

| Beat | Words (verbatim) | What happens | Camera | Type | Sound |
|---|---|---|---|---|---|
| 1 | "So they start with almost nothing." | The shutter rolls up and a wedge of light runs across the floor. Rahul walks in empty-handed and looks round. Vikas follows, leaning back against the weight of the oven in his arms. | Travels right with them, slow push | none | shutter, two sets of footsteps |
| 2 | "An oven for about 10,000 rupees" | Vikas sets the oven on the table: knees bend, the table takes the weight on "10,000". Rahul pats it twice. | Settles to a medium two-shot | "AN OVEN" on "oven", then **₹10,000** with the thud | thud, rattle, two pats |
| 3 | "and a machine they build for 15 to 20,000 rupees." | Vikas turns to the press. A beam is pushed home on "build"; the spanner is pulled on "15" and again on "20,000", each pull jolting a part into place. He dusts his hands off. | Travels left with him and pushes in on his hands | "A MACHINE THEY BUILD", then **₹15** and **–20,000**, each on its word | clank, ratchet, clank, ratchet, clank |
| 4 | "No investors, no funding." | Pull back: the two of them between the oven and the press, everything they own in one frame. Rahul shrugs. Vikas, fists on hips, takes stock. | Pulls back and centres | **No investors.** then **No funding.**, each on its "no" | two soft knocks |
| 5 | "And in 2020, the company's revenue was just 5,000 rupees." | The calendar page turns to 2020. Rahul opens the cash tin on "revenue" and holds up a few notes. After the pause the number lands; one breathes out, the other pushes his glasses up; they look at each other. | Pushes in to the two of them and the tin | **2020** lands large, then shrinks to lead "REVENUE"; **₹5,000** on its word | page, tin lid, a coin, notes, one low note |

Note what the board does: every row names the word an action lands on; every number has a type moment; nothing is on screen that is not said; each beat hands the camera to the next.

For a film of several sequences, add the table of sequences above the beats: number, name, seconds, the world and its light, and how it hands over to the next (kind of join, what is carried, on which word).

## 12. Before Stop A

Send the user, together:

1. The board as short tables (not the file).
2. The cast sheet (`node tools/stills.mjs CastSheet`) with any new characters on it.
3. One style frame per world: a still of that sequence at its key moment, with its type.
4. The time estimate. A sequence in a new world takes about an hour to an hour and a half to build, review and score (a 15 s one, with its sound, took 77 minutes from a cold start, of which 35 were three rounds of review and fixes); one that reuses a world, half that. Workers building sequences side by side shorten the wait but share one browser. Say the total, and what they will see first and when.
5. The questions: spellings to confirm, anything the narration implies but does not say, anything you have left out and why.

Before you send it, read the board once as the viewer:

- Is somebody doing something inside the first two seconds, and in every stretch of three seconds after that?
- Would every thing in the frame really be there?
- Does each world have its three telling details, and do people throw shadows on what is behind them?
- Does each person have something different to do with their hands in each beat?
- Is every word on screen the narrator's, and does each piece of type have one calm ground behind it in every framing it shows in?

Then wait for a go-ahead.
