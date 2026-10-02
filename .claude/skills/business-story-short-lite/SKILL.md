---
name: business-story-short-lite
description: The low-token version of business-story-short, for when a film must not cost more than about 5 points of the weekly usage meter. Use it when the user says "lite", "cheap", "low token", "save usage" or names business-story-short-lite; otherwise the full skill applies. Same engine, look and checks. Turn a recorded narration (a voice file plus a word-level .srt) into a finished vertical YouTube Short that tells a business, founder, company or IPO story in studio-style 2D animation. Lineless characters act with weight, sets have real light and shadow, the camera travels through one continuous world, key numbers and names appear as large designed type that lands on its word, and the film ships with a full sound mix at YouTube loudness. Everything is drawn in code (Remotion + SVG), so no artwork and no image generation is needed. Use this whenever the user hands over a voiceover and wants an animated Short, reel or explainer about a company, a founder, a product or a deal, or any true story told by a narrator; when they say "make the short for this VO", "animate this business story", "turn this narration into a reel", or "same style as the Minus Degre or GGSP shorts"; and when they ask to revise, extend or re-mix a film made with this skill. It does not write scripts, and it is not for podcast or interview clips (podcast-toon-short does those).
---

# Business-story Short (lite)

This skill makes a 1080x1920, 30 fps animated Short from a narration the user has already recorded. It delivers three files: the film with a full mix, an effects-only MP3, and the tightened voice.

Two clips set the bar, and both were approved by the user unchanged. Their full source is inside every studio this skill scaffolds, as working examples:

- **`md`** (14 s): two brothers start a workshop in a bare rented room. One continuous take: the shutter rolls up, they walk in, an oven is set down on "10,000", a hand press is built, a cash tin is opened on "revenue".
- **`ggsp`** (24.5 s): a scrapyard in Ahmedabad in 1976. The camera travels the length of the yard to a trader weighing a sack on a beam scale, his shadow on the wall becomes his two sons ringing a bell, the scrap lifts into a furnace glow, and steel rods rise into a flyover and a tower at dawn. Two worlds, no cut.

Five frames of the two are in `references/img/` (in a studio, `docs/img/`). Look at them before designing anything: they are the look.

Measured against the older films they replaced: no held frames inside a move (those had 23 to 33 %), no dead holds, no cuts inside a world, every number on screen within a tenth of a second of its word, and a mix at -14 LUFS. A new film is held to the same numbers by `tools/check.ts`, `tools/audit.py` and `tools/audio_mix.py`. Passing them is the floor, not the goal: the goal is that a still from the new film could be cut next to a still from these two.

## The budget (what makes this the lite skill)

This is `business-story-short` with the same engine, tools, look, checks and house rules. Only the way the work is organised changes, so that one film of 1.5 to 3 minutes costs **no more than 5 points of the weekly usage meter**. The full skill's first long film (128 s, ten parallel workers) cost about 25 to 30 points; that is why this version exists.

**What 5 points is.** Measured on this user's plan on 2 Oct 2026: one meter point is about 1.7 million weighted tokens, where a token of output counts 5, a token of newly read context 1.25 and a token of context re-read on a later turn 0.1. So the film has about **8.5 million weighted tokens**, which at this pipeline's usual mix is about 55 million raw tokens: roughly 0.15 million written, 2.5 million read for the first time, and 45 to 50 million re-read. Almost all of it is the last kind, and that is simply **turns x context size**. Hence the two numbers that are actually counted: **about 400 model turns in the whole film, at an average context near 120 thousand tokens.**

| Stage | Who | Turns | Points |
|---|---|---|---|
| Words, board, cast sheet, Stop A | main session | 40 | 0.6 |
| Sets, props and every sequence | up to 3 world workers, 70 turns each | 210 | 2.4 |
| One half-size render of the whole film, review, one fix pass | main session | 60 | 0.9 |
| Sound | one worker on the smaller model, or the main session | 35 | 0.5 |
| Full render, finish, mix, deliver, report | main session | 15 | 0.2 |
| Reserve | | 40 | 0.4 |

**How it is kept.**

1. Read the meter before anything else (the app's usage tool; if there is none, ask the user for the figure on their usage card). Write the start figure and the line (start + 5) at the top of `STATE.md`. Read it again after Stop A, after the build, and before the full-size render, and write each reading down. Tell the user the reading in every update.
2. Count turns as well, because the meter moves in whole points. Each worker's brief states its cap; a worker that reaches its cap stops, writes what is left in its hand-back, and the main session decides.
3. If the spend is a point ahead of the table at any reading, drop to the floor: no further workers, no further stills, the main session finishes the remaining sequences in their simplest board form and goes straight to the one render.
4. At start + 4.5 with the film not delivered: stop, save state, tell the user what is left and what it would cost. Never cross the line without a yes.
5. A round of notes after delivery is not inside the 5 points. Say so at delivery: a round of up to six notes costs about half a point to one point.

**The habits that save the tokens** (each of these was a measured leak in the full build):

- **Never more than two workers at a time, never more than three in a film, and no worker per sequence.** A worker owns a world: its set, its props and every sequence that plays in it. Every fresh worker pays once to read the pages; ten of them paid ten times.
- **No reviewer agents.** The main session reviews the whole film once, from sheets cut out of the one half-size render.
- **Workers do not start the browser.** They use the dry run and `tools/preview.ts` (at most two preview sheets a sequence). The main session renders.
- **A worker reads three things**: `docs/perform.md`, the nearest example take, and its world's set file. It looks up `docs/engine.md` with a search, not by reading it through. It does not read `directing.md`, `review.md`, `sound.md` or `machine.md`.
- **Output goes to files.** Use `--out` on every check and audit and read only the failing lines. Never print a whole report, a whole take or a long log into the conversation. Write a file whole in one step; do not grow it edit by edit.
- **Hand-backs are 100 words**: what passes, what does not, what the next person must know.
- **The main session keeps its context small.** State goes to `STATE.md` at each stage; compact or start a fresh session from the files at Stop A and again before the review. Do not look at more than one image per sequence before the render.
- **Reuse before drawing.** Take sets, props and cast from `src/assets/` first. A new set or a new character is the dearest thing in a film.

**The size of a lite film.** These limits go on the board, and the user sees them at Stop A:

- at most 3 worlds and 6 sequences, joined by at most 5 planned hand-overs, each taken from `src/assets/props/joins.ts` where the studio has it;
- at most 2 new sets, 6 new props and 4 new named people; everything else from the library, re-dressed;
- one clear action per sentence, staged large; crowds, vehicles in motion and anything needing a new rig part only if the story cannot be told without it;
- one music track, one ambience bed per world, at most 25 effects, taken from `public/sfx/` first and at most 10 fetched new.

## The five ideas everything rests on

1. **Drawings are data.** A character, a prop or a set is code that returns a list of shapes (an outline and a material). One painter turns shapes into SVG and computes shade, light and rim from the scene's single light. So nothing can be coloured or shaded off-style by hand.
2. **One world, one take.** A sequence is one persistent stage with one light. People and things enter and leave it; the camera travels and never cuts. The user called a film made of joined clips "a bunch of individual clips joined", and a continuous one "the best video you have ever made for me". Sequences are joined by a planned hand-over (a carry, a morph, a pass-through), never glued.
3. **A frame is a display list.** A sequence's `frame(t)` returns an ordered list of items, back to front, and nothing else. The one generic view paints the list and the dry run checks the very same list, so what is checked is what is drawn. There is no item for a filter, a blur or a blend mode, so none can appear.
4. **People move through acting verbs.** `walkTo`, `reach`, `lookAt`, `crouch`, never joint angles. A verb moves the whole body: eyes lead, then head, chest, arm and hand, with wind-up, overlap and settle sized by weight. A cut-out puppet rig was rejected by this user for "stiff physics, arms crossing"; the verbs exist so that cannot come back.
5. **Every moment comes from a word.** Time is seconds in the tightened voice, and a take asks for it by word: `W("oven")`. Nothing is timed by frame number, and a number is typed only for small acting between two words.

## House rules

These come from this user's own praise and rejections. Breaking one has cost a full redo before.

1. **On-screen words are the narrator's own.** Key numbers, names and short phrases, verbatim, as large designed type timed to the voice. No full subtitles. Never invent a number, a label, a date or a chart axis. `tools/check.ts` fails any string that is not in the narration.
2. **Names and spellings are confirmed.** Every name that goes on screen is listed in the film's `facts` with its source. Ask the user about any spelling you had to look up, and when you deliver, say which ones are still unconfirmed.
3. **Never redraw a trademark.** Real logos come from the user as files. Without one, show the thing (a shopfront, a product) with no mark.
4. **Only versions with the voice are shown or delivered.** No picture-only renders go to the user.
5. **Pauses may be tightened; a word is never cut or sped up.** List every trim when you deliver.
6. **State a time estimate up front, then show something early.** This user judges by what they can see. In the first ten minutes: the estimate and the narration cut into beats. Inside the first half hour: the board with a cast sheet and a first picture of each world (a preview sheet will do). Then a rough cut with the voice as soon as one sequence exists. Do not hold everything for the end.
7. **A review stop after the board and at delivery, with a done / left scoreboard in every update.**
8. **Claude cannot hear.** Levels are set by measurement. Say so when delivering and ask the user to listen.
9. **Sound comes from Epidemic Sound** through its connector, realistic recordings, instrumental music, no vocals. This user has given standing permission to search, download and edit there without asking each time; list every pick afterwards with its preview link. Anything fetched from elsewhere needs a yes first.
10. **Do not read or borrow from other video-making skills** (coded-reel and the like). This engine was built from first principles on purpose.

## Limits to say up front

Tell the user when the story runs into one of these, on the board, not after the build:

- **People act across the frame**, side-on to three-quarter, like a stage. No lip sync, no running, no sitting on the floor. Children, animals and crowds appear only as silhouettes or shadows.
- **Clothes and hair**: shirt, kurta, waistcoat, trousers, pajama, a cap or a turban, hair to the jaw. Nothing draped or long yet (a sari, a dupatta, a shawl, a skirt, long hair, a bun). `references/directing.md`, section 9, has the workarounds.
- **Type is Latin letters, digits and the rupee sign.** The faces are cut with those; another script needs a font added first (`tools/fonts.py`).
- **The film is exactly as long as the tightened voice.** There is no outro after the last word yet, so music has to end on or just after it; a logo or end card needs the narration to leave room.
- **Built and tested on Windows** with Node 22.18 or newer and Python 3. The tools are written to run on macOS and Linux as well, but that has not been tried.

## What to collect before starting

| Need | Notes |
|---|---|
| The voice file | mp3, wav or m4a. Used as recorded: it is tightened, never re-voiced. |
| A word-level .srt | One word per cue is best. Word times drift into pauses; `tools/words.py` snaps them to the audio. |
| The script text, if they have it | It becomes the authority on spelling and punctuation (`script` in `film.json`). Without it, numbers may arrive as words ("ten thousand") and names garbled: ask. |
| Names and spellings | People, companies, places. Confirm each one that will appear on screen. |
| Logos | Only as files from the user. Otherwise none are shown. |
| Anything off-limits, and a length | Default: the whole narration. |

## How quality is held across a whole film

The full skill holds the bar with a fresh worker and a fresh reviewer per sequence. The lite skill cannot afford either, so it leans on the three things that cost almost nothing:

- **State is in files.** `src/films/<film>/STATE.md` holds the scoreboard, the meter readings, the decisions and the open questions; `board.md` is the plan the user approved. Read both at the start of every session and update `STATE.md` at every stage.
- **The machines judge first.** The dry run (`tools/check.ts`), the motion audit (`tools/audit.py`) and the mix report are exactly the full skill's, with the same thresholds. Nothing is delivered that fails one.
- **One hard look at the whole film.** After the single half-size render, cut eight frames per sequence into a sheet (`tools/grab.mjs`, `tools/board.mjs`) and read each against `references/review.md`'s rubric and defect list. Ask the audit for its near-still stretches and look at those moments too. Then one fix pass: at most six fixes, the worst first, each in the sequence it belongs to, and only the changed stretches rendered again.
- **A world worker, not a sequence worker** (`references/worker-pack.md` for the form of the pack; the caps and the reading list above replace its own).
- **Without workers:** the main session builds world by world and starts a fresh session from the files after each world.

What this gives up, and the user is told so at the start: no second pair of eyes on each sequence, so weak staging in one sequence can reach the delivered film and is then fixed from the user's notes; one style frame instead of one per world; one draft with the voice before delivery instead of one per sequence.

## The pipeline

Paths like `scripts/...` and `references/...` are in this skill's folder. Everything else is inside the studio: one project folder that holds the engine, the asset library and every film made with it. The same reference pages are copied into the studio's `docs/` so workers can read them there.

### 0. The studio (once per machine)

```bash
node <skill>/scripts/new-studio.mjs "<parent folder>/studio" --deps-from "<an existing studio or Remotion 4.0.529 project>"
```

Without a project to copy `node_modules` from, use `--install` instead (it downloads Remotion, React and the headless browser, about 500 MB: tell the user what will be fetched and get a yes first). Then, inside the studio:

```bash
node tools/doctor.mjs
```

It checks Node, Python and its libraries, ffmpeg, the headless browser, the fonts and the two example films, and prints what is missing and how to get it. Do not go on until it passes. Read `references/machine.md` before the first render: on a small PC a careless render can crash the machine.

If a studio already exists on the machine, use it: its library has every set, prop and character made so far. After the skill itself has been updated, bring the studio up to date with `node <skill>/scripts/update-studio.mjs "<studio>"` (it replaces the engine, the tools and the docs, adds new library pieces, and leaves every film and every library file the studio has changed alone).

### 1. A new film: words and timing

```bash
node tools/new-film.mjs <id> --vo "<voice file>" --srt "<words.srt>" --title "<title>" [--script "<script.txt>"]
python tools/words.py <id> -v
```

`new-film` makes `src/films/<id>/` with a starter sequence that already passes the checks. `words.py` finds where the voice is actually voiced, snaps every word onto it, tightens the pauses and writes `words.ts` (the word table every take is timed from), `public/audio/<id>/vo-tight.wav` and `out/<id>/words.png`. Look at the picture: every red line should sit at the start of a burst of sound. Read any line that starts `NOTE:` (a recording cut by hand may carry a scrap of the next sentence, which can swallow the last word), and count the words in the summary against the script. Keep the pauses that carry meaning (the hook, the beat before a key number) with `keepAfter`.

A word that follows a pause is timed exactly, from the audio. A word inside a phrase is an estimate, good to about a tenth of a second and sometimes worse. So the handful of words that will carry a number, a name or a contact get one look each: `python tools/words.py <id> --look "<word>"` prints the voice's loudness round the word, and a wrong start is pinned in `film.json`. How to read it: `references/sound.md`, "The words the film hangs on".

### 2. The board

Read `references/directing.md` first. Then:

```bash
node tools/script.ts <id>
```

prints the narration sentence by sentence with its times, the pauses, and every number and capitalised name (the candidates for type and for `facts`). Write `src/films/<id>/board.md`: the film cut into sequences (worlds), each sequence into beats, each beat a row with its words, what happens, the camera, the type and the sound cue. Decide the joins between sequences now.

A film starts with one placeholder sequence, `s1`. Once the board says how many worlds there are, give each further one its placeholder, named for its world and starting on its first word:

```bash
node tools/new-seq.mjs <id> <seq> --from "<word>"
```

That fixes every sequence's files, exports and start time before anything real is built, so the film compiles and passes its dry run from the first minute, and a worker can be handed one sequence without touching another. (Rename `s1` by hand if its name bothers you; nothing depends on it.)

### 3. The look of this film

The look is fixed (lineless, one light, long shadows); what changes per film is its worlds and its people. Read `references/draw.md` once. Choose each world's set from the library where one fits; note on the board which sets and people are new. Render the cast sheet, and **one** style frame: the film's most important moment. The other worlds are shown as preview sheets (`tools/preview.ts`, no browser).

```bash
node tools/stills.mjs CastSheet <id>-<seq>:<seconds>@0.5
```

### Stop A: the user approves the board, the cast and the one style frame

Send the board (as a short table, not the file), the cast sheet, the style frame and the preview sheets together, with the time estimate, the meter reading and the lite limits the board had to respect (what was simplified to fit). This is the cheapest place to change a staging idea or a character. Wait for a go-ahead. Then save state and continue in a fresh or compacted session.

### 4. Build each world

One worker per world (at most two at once), or the main session world by world. For each world, in this order:

1. **Assets** it still needs, as library pieces under `src/assets/` with no film-specific text baked in.
2. For each of its sequences, **`take.ts`** (actors, props, camera keys, type and sound cues, every moment from a word) and **`frame.ts`** (the display list for time t), each written whole.
3. **The dry run**, to a file, until it passes:
   ```bash
   node tools/check.ts <id> --seq <seq> --out out/<id>/check_<seq>.txt
   ```
4. **One preview sheet** of the moments that matter (first frame, each contact, last frame), no browser, and one correction pass from it:
   ```bash
   node tools/preview.ts <id>-<seq>:1.2 <id>-<seq>:3.26 ... --sheet <name>
   ```
5. A 100-word hand-back and a line in `STATE.md`.

No stills, no per-sequence draft, no per-sequence review. When every world has handed back, the main session runs the whole-film dry run, then:

```bash
node tools/render.mjs <id> --scale 0.5 --chunk 20 --out <id>_half
node tools/rough.mjs <id> out/video/<id>_half.mp4
python tools/audit.py "out/video/<id>_half.mp4|<id>" --out out/<id>/audit_half.json
```

Send the rough cut to the user at once (it has the voice on it) and carry on: sheets, the one hard look, the one fix pass (see "How quality is held").

### 5. Assemble and finish

```bash
node tools/check.ts <id> --cues out/<id>/cues.json
node tools/render.mjs <id> --chunk 20 --out <id>_clean        # once, after the fix pass; read the meter first
python tools/audit.py "out/video/<id>_clean.mp4|<id>" --out out/<id>/audit.json
node tools/finish.mjs out/video/<id>_clean.mp4 --look A --out <id>_finished
```

`--chunk 20` renders in 20-second stretches and joins them without re-encoding, so an interrupted render picks up where it stopped (`references/machine.md`). The finishing pass adds paper tooth, grain and a vignette with ffmpeg; nothing of the kind is ever drawn inside a frame.

### 6. Sound

Read `references/sound.md` (or hand it, with the cue list and the limits above, to one worker on the smaller model, capped at 35 turns). Choose and fetch the sounds, scan them, write `src/films/<id>/sound.json`, then:

```bash
python tools/audio_mix.py src/films/<id>/sound.json out/<id>/cues.json --out out/<id>
```

until every check in its report is true. Sound changes never need a re-render of the picture.

### 7. Deliver

```bash
node tools/deliver.mjs <id>
```

It joins the finished picture and the mix, verifies the file (size, frame rate, codecs, length, loudness) and puts the three deliverables and `report.md` in `out/<id>/deliver/`. Send the files and tell the user, plainly:

- the scoreboard, and what was measured (the audit and the mix numbers);
- every trim made to the voice;
- every sound used, with preview links, and anything else that was fetched;
- which spellings or figures they have not confirmed;
- that the mix was balanced by measurement, not by ear;
- the weak spots you know about. Say them before they find them;
- the meter at the start and now, and what a round of notes will cost.

### Stop B: the user reviews the film

Apply notes in the sequence they belong to (one capped worker per world touched, or the main session), re-run its dry run, re-render only the stretch that changed. Read the meter before and after.

### 8. After approval

Offer to fold what the film added back into the skill: new sets, props and cast as library pieces, new lessons into the reference pages, the film itself as a third example. Then refresh the installed copy and the zip.

## Commands (inside the studio)

| Task | Command |
|---|---|
| Health check | `node tools/doctor.mjs` |
| New film | `node tools/new-film.mjs <id> --vo <file> --srt <file> --title "<title>"` |
| One more sequence | `node tools/new-seq.mjs <id> <seq> --from "<word>[:n]"` |
| Words and tighten | `python tools/words.py <id> -v` |
| Where a word really starts | `python tools/words.py <id> --look "<word>"` (or a range of source seconds: `--look 12.5-15.6`) |
| Narration by sentence | `node tools/script.ts <id>` |
| Type check | `node_modules/.bin/tsc --noEmit` |
| Dry run | `node tools/check.ts <id> [--seq <seq>] [--cam] [--pops] [--cues out/<id>/cues.json] [--out out/<id>/check.txt]` (use `--out`, not a shell redirect) |
| Quick look, no browser | `node tools/preview.ts <Comp>:<seconds>[=name] ... [--sheet <name>]` (rough: plain type, no finishing) |
| Stills | `node tools/stills.mjs <Comp>:<seconds>[@scale][=name] ...` (one browser for the whole batch) |
| Contact sheet | `node tools/board.mjs --out <name> --labels "a|b|c" <img> <img> ...` |
| Frame strip of an action | `node tools/strip.mjs <clip.mp4> --from 3.0 --to 3.6 --every 1` |
| Full-size frames out of a finished clip | `node tools/grab.mjs <clip.mp4> 1.0 4.2 12.75 [--name <prefix>]` (no browser) |
| Render | `node tools/render.mjs <Comp> [--scale 0.5] [--from s] [--to s] [--chunk 20] [--out name]` |
| Rough cut with the voice | `node tools/rough.mjs <id> <picture.mp4> [--from s]` (`--from`: where the stretch starts in the film) |
| Motion audit | `python tools/audit.py "<clip>|<label>" ... [--out out/<id>/audit.json]` |
| Review pack | `node tools/pack.mjs <id> <seq>` |
| Finishing pass | `node tools/finish.mjs <clip.mp4> --look A --out <name>` |
| Fetch a list of sounds | `node tools/fetch.mjs <id> out/<id>/fetch.json` |
| Scan effects / music | `python tools/sfx_scan.py public/sfx/<id>` / `python tools/music_scan.py <file>` |
| Mix | `python tools/audio_mix.py src/films/<id>/sound.json out/<id>/cues.json --out out/<id>` |
| Deliver | `node tools/deliver.mjs <id>` |
| Old and new side by side | `node tools/compare.mjs "<old.mp4>|<from>|<to>" <new.mp4> --out <name>` |
| Same picture before and after a refactor | `python tools/same.py out/stills before_ after_` |

Compositions: `<id>` is a whole film, `<id>-<seq>` one sequence by itself, and `CastSheet`, `ToneSheet`, `LimbSheet`, `TypeSpecimen` are the sheets.

## Rendering without crashing the machine

Short version (the long one, with the reasons and the Windows traps, is `references/machine.md`):

- Every render goes through `tools/stills.mjs` or `tools/render.mjs`. They use Remotion's own headless browser, one at a time behind a lock, and never the system Chrome. Do not call `npx remotion` yourself.
- Iterate with `tools/preview.ts` (no browser, about a second a frame) and the dry run; start the browser when the staging is right.
- Write files in one step and start a render in a later one.
- Batch all the stills of one look into a single command.
- One heavy job at a time. Type checks, dry runs and Python tools may run beside a render.
- In PowerShell never redirect a render's stderr with `2>`.

## Reference pages

Read a page when its stage begins, not all of them at the start.

| Page | Read it when |
|---|---|
| `references/directing.md` | Turning a narration into sequences, beats, joins and type moments (stage 2) |
| `references/draw.md` | Designing a set, a prop or a character in this look (stage 3 and whenever an asset is added) |
| `references/perform.md` | Writing a take and its frame: the one-page method (stage 4) |
| `references/engine.md` | Looking up a signature: tracks, actors, verbs, props, camera, type, the display list |
| `references/review.md` | Checking a sequence: what each check means, the rubric, the review pack, defects seen before |
| `references/worker-pack.md` | Handing a sequence to a fresh worker |
| `references/sound.md` | Tightening the voice, choosing sounds by measurement, the sound sheet, the mix (stages 1 and 6) |
| `references/machine.md` | Before the first render on a machine, and whenever a tool fails |

The two example films are the best reference of all: `src/films/md/` (two actors, one room, props that are carried, set down and opened) and `src/films/ggsp/` (a long camera travel through depth layers, a figure who walks in, shadows that act, a second world joined by a morph). Read the one closest to the sequence you are about to build before you write it.
