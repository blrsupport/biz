# Sound: from a voice file to a checked mix

You cannot hear. So nothing here is judged by ear: a sound is chosen by scanning it, every level is a measured target, and the mix writes a report that says what was reached. This page takes one film from a raw voice file to a finished, checked mix without reading the tool sources.

Run every command from the studio folder, the one that holds `tools/` and `src/films/`; every path below is relative to it. `<film>` is the film's folder name under `src/films/`. The two approved demos, `md` (14.05 s) and `ggsp` (24.51 s), are the models: read their `film.json` and `sound.json`. In a studio set up from the skill their sound files are not shipped, so those sheets are there to read, not to run; the numbers and outputs quoted below come from the studio they were built in. The sound tools are light and may run beside a render, but run them one after another: each starts ffmpeg several times, and bursts of new processes are what crashed the build PC (`references/machine.md`). The four Python tools need numpy, Pillow for one picture, and a full ffmpeg in `tools/bin/` or named in `STUDIO_FFMPEG` (`node tools/doctor.mjs` checks all three). A time is in seconds of the tightened voice unless a line says "of the file" or "of the source".

## Contents

1. [The flow](#1-the-flow)
2. [Words and tighten](#2-words-and-tighten)
3. [The cue list](#3-the-cue-list)
4. [Choosing and fetching sounds](#4-choosing-and-fetching-sounds)
5. [Looking inside sounds without ears](#5-looking-inside-sounds-without-ears)
6. [The sound sheet](#6-the-sound-sheet)
7. [The mix](#7-the-mix)
8. [Reading the report](#8-reading-the-report)
9. [Targets and fixes](#9-targets-and-fixes)
10. [Typical levels](#10-typical-levels)
11. [Deliverables and what to tell the user](#11-deliverables-and-what-to-tell-the-user)

## 1. The flow

| # | Step | Command | Writes |
|---|---|---|---|
| 1 | Words and tighten | `python tools/words.py <film>` | `public/audio/<film>/vo-tight.wav`, `src/films/<film>/words.ts`, `out/<film>/words.png` |
| 2 | Cue list, once the animation exists | `node tools/check.ts <film> --cues out/<film>/cues.json` | `out/<film>/cues.json` |
| 3 | Choose and fetch sounds | the Epidemic Sound connector | files in `public/sfx/<film>/` and `public/audio/<film>/` |
| 4 | Scan them | `python tools/sfx_scan.py public/sfx/<film> --json out/<film>/sfx_scan.json` and `python tools/music_scan.py <file> --step 3` | printed lines, and the JSON |
| 5 | Fill in the sound sheet | by hand | `src/films/<film>/sound.json` |
| 6 | Mix | `python tools/audio_mix.py src/films/<film>/sound.json out/<film>/cues.json --out out/<film>` | `mix.wav`, three stems and `mix-report.json` in `out/<film>/` |
| 7 | Read the report, fix the sheet, mix again | the same command | the same files |
| 8 | Deliver | `node tools/deliver.mjs <film>` | `out/<film>/deliver/`: the MP4 with the mix, the effects-only MP3, the tightened voice, `report.md` |

- The film's folder, its first `film.json` and an empty `sound.json` come from `node tools/new-film.mjs` (SKILL.md, stage 1), which also runs step 1 once.
- Step 1 comes before any animation: every beat is anchored to the word times it writes.
- Steps 3 to 5 can start as soon as the cue names are known. The sheet gives sounds to cue names, not to times, so cue times may still move (only the music's `at` and the `keys` curves hold film times).
- If the animation's timing changes, redo steps 2 and 6 (one mix of a 14 s film takes about 20 seconds). If `film.json` changes, the film's length changes: redo everything from step 1.

## 2. Words and tighten

**The user's rule: pauses may be tightened; a word is never cut and never sped up; every trim is listed for them.** The tool keeps the first two. You do the third, from `TRIMS` (section 11). `python tools/words.py <film>` reads `src/films/<film>/film.json`:

| Key | Meaning | Default |
|---|---|---|
| `vo` | The voice file, relative to the studio folder (a new film: `"src/films/<film>/source/vo.mp3"`). | required |
| `timings` | The word timings, relative to the film folder (a new film: `"source/words.srt"`; the demos: `"source/dtw.json"`). A path ending in `.json` is read as whisper's full JSON with DTW token times; anything else as a `.srt`. One word per cue is best; a cue with several words is split by syllables. | required |
| `from`, `to` | The stretch of the source voice to use, in seconds of the source. Only words wholly inside it are kept, so put `from` in the silence before the first word and `to` in the silence after the last. | `0`, end of file |
| `lead` | Seconds of voice kept before the first word (never from before `from`). | `0.10` |
| `tail` | Seconds kept after the last word (never past `to`). The demos use `0.6` and `0.55`. | `0.45` |
| `script` | The exact words of the stretch. When given, it is the authority on spelling and punctuation. | none |
| `fixes` | `{"heard": "correct"}`: respells every timed word equal to `heard` (case and punctuation ignored; the word keeps its own trailing punctuation). | `{}` |
| `fixAt` | `[[seconds, "correct"], ...]`: replaces the one word spoken at that time of the source, whole (write its punctuation too). | `[]` |
| `starts` | `[["word", n, seconds], ...]`: where the nth time that word is said really starts, in seconds of the source. For a word inside a phrase whose fitted start is off (see "The words the film hangs on" below). | `[]` |
| `keepAfter` | `[["word", n], ...]`: leaves the pause after the nth time that word is said in the stretch (counted from 1) at its full length. | `[]` |
| `pause` | Target pause in seconds by kind: `comma` after `, ; :`, `stop` after `. ? !`, `inner` after a word with no punctuation. Name only the kinds you change. | `{"comma": 0.28, "stop": 0.42, "inner": 0.20}` |
| `title` | The film's title, as a label. This tool does not read it. | none |

How good the result is depends on where a word stands. **The first word after a pause is exact**: pauses are read from the audio itself, so that word starts where the sound starts. **A word inside a phrase is an estimate.** No transcriber's word times are reliable to a tenth of a second there (cue times run on through pauses and crush the words before them; whisper's DTW times were found 0.2 s out on a date in a test), so for a `.srt` the tool keeps only the proportions of the cue times inside each stretch of sound, believes a cue only when its length is plausible for the word, and leans the rest of the way on a model of pace (short for the small words of grammar, longer for the last word before a pause). Measured on the two demos against their approved tables: every pause on the right word; word starts 0.05 and 0.07 s off on average, nine words in ten within 0.15 s, the worst 0.2 to 0.3 s. Do not count on that for a new voice: on the next film made (a 16 s stretch, 13 anchored words) seven of the anchors were 0.09 to 0.28 s early and had to be pinned. The fit is good enough for acting and too loose for a number that must land on its word, so the few words a film hangs on are checked by looking (below). Budget ten minutes for it.

### A recording that was cut by hand

A voice file that is a stretch cut out of a longer recording often carries a scrap of the next sentence at its end, or the tail of the one before at its start. The tool cannot hear that it is not ours, and a stray burst can draw the last word onto itself. So it says when a recording is voiced right up to its last sample, or from its first:

```
NOTE: the recording ends in the middle of a sound (voiced to its last sample; the last burst is 15.99-16.50 s, the silence before it 15.59-15.99 s).
      If that burst is the start of a next sentence, set "to" in film.json to a moment inside that silence and run again.
```

Look at that burst (`--look 15.2-16.5`): half a second that ends in mid-sound is a scrap; set `"to"` (or `"from"`) inside the silence and run again. With a plain `.srt`, the words are then fitted only onto the sound inside the stretch. If a word is still left out although its cue lies inside the stretch, the tool prints `NOTE: "<word>" ... is LEFT OUT`: pin it with `starts`. Count the words in the summary line against the script every time: a film that has silently lost its last word is the worst thing this step can do.

### What the tool does

1. Finds where the voice is really voiced, from a 10 ms loudness envelope.
2. Reads the timings, applies `fixes`, `fixAt`, then `script`, and fits the words in order onto the voiced stretches, so every word edge lies on real audio.
3. Treats every gap of 0.12 s or more between two words as a pause. Its kind comes from the last character of the word before it. A pause longer than its target (by more than 0.02 s) has its middle cut out: half the target stays on each side, with a 6 ms fade at the splice. A shorter pause is left alone; none is made longer.
4. Never cuts into a word and never changes speed. Every pause, cut or not, is listed.

### What it writes

- `public/audio/<film>/vo-tight.wav`: the tightened voice, mono, 48 kHz. Its length is the film's length, and it is the clock for everything after.
- `src/films/<film>/words.ts` (never edit it; run the tool again): `VO` (`file`, `duration`, and `srcFrom`, `srcTo`: the piece of the source used); `WORDS` (per word: `w` as written, `n` in lower case without punctuation, `t0`, `t1`, and `src`: its start in the source); `TRIMS` (per pause: `after`, `kind`, `was`, `now`, `kept`, and for a cut pause `srcFrom`, `srcTo`: the piece of the source removed).
- `out/<film>/words.png`: the picture to check by eye.

### Check the result

The tool prints a summary, every pause, then every word. Real output, Demo 2 (lines left out at `[...]`):

```
ggsp: 72 words, source 0.00-25.28 s (25.28 s) -> 24.51 s; removed 0.77 s in 5 pauses
snap: 16 word ends moved, largest 2320 ms; voiced threshold -44.0 dB
  pause after '1976,'          comma  0.31 -> 0.31  (kept)
  pause after 'Ahmedabad.'     stop   0.43 -> 0.43
  pause after 'dust,'          comma  0.47 -> 0.28
[...]
    0.36-  1.44  1976,
```

- Read the word table against the script: every word there, in order, spelt right.
- Read the pauses (`was -> now`). Each pause must sit where a speaker would breathe: after the word that carries the punctuation, or between two phrases. A pause that stands one word early or late (after "it" when the next word is "yet,") means the cue times misled the fit there. Pin the word that really follows the pause with `starts` (its true start is the end of that silence; `-v` prints the silences), and run again.
- Open `out/<film>/words.png` with the Read tool: the loudness of the source above, of the tightened voice below, a red line at every word start. After each silence the next red line must stand where the loudness rises again, and the lower lane must show the same humps as the upper one, only closer together. A hump that has lost its start or its end is a cut word: stop and find out why.
- When a `script` is given, the tool prints every word whose spelling it took from the script (`Shamsulak -> Shamsulhaq; Iraqui -> Iraki`). Read that line: a script that is one word out of step shows up as a run of unrelated pairs.
- `python tools/words.py <film> -v` also prints the silences around the stretch, the words within 3 s of `from`, and each word of the stretch whose end moved more than 0.2 s. Use the first two to set `from` and `to`: Demo 1 printed `silences: ... 60.74-61.62 ...` and `near start: 61.62-61.80 So`, and uses `"from": 61.3`.

### The words the film hangs on

A film rests on a dozen or so words: the ones a number, a name or a contact lands on. Once the takes exist, `node tools/check.ts <film>` lists them ("the takes are anchored to ...") and says which stand inside a phrase. Check each of those once, before the board is fixed if you already know which words matter:

```
python tools/words.py <film> --look "2017"          (--look "no:2" for the second time a word is said)
python tools/words.py <film> --look 12.5-15.6       a range of source seconds: a whole sentence in one go
```

prints the voice in rows of 20 ms: the time in the source and in the film, the loudness, the level in a low, a middle and a high band, what the row looks like (`closure`, `hiss`, `voice`), where the loudness jumps (`<< rises`), and an arrow where each word was fitted. Real output from Demo 2, cut down:

```
 source   film   all dB                                       low   mid  high
  18.50  17.84    30.0 #####################################       30    12    -6  voice
  18.54  17.88    27.2 ##################################          27     7   -15  voice
  18.56  17.90    17.7 ##########################                  18    -7   -22  voice     <- public
  18.58  17.92     2.1 ############                                 2   -18   -36  closure
  18.62  17.96   -15.3                                            -16   -28   -39  closure
  18.64  17.98   -10.0 #                                          -15   -12   -11  hiss
  18.66  18.00    18.7 ###########################                 16    15    -2  voice     << rises
  18.68  18.02    30.8 ######################################      27    28    -0  voice     << rises
```

Here "public" was fitted at 18.56 s, where the lips close for the p; the p bursts at 18.64 and the vowel is up by 18.68. That is within a tenth of a second, so it needs no pin.

How to read it without ears: a closure is a short dip in everything (the silence before p, t, k, b, d, g, and every pause); a hiss is strong in the high band and weak in the low one (s, sh, ch, f, and the burst of a t or k); voice is strong in the low band (a vowel, or m, n, l, r, w). A word that begins with a stop ("twenty", "ten", "public", "buys", "dead") begins as its closure ends, at `<< rises`; a word that begins with s ("steel", "seventeen") begins where the hiss begins. A word that begins with a vowel or with w, l, m, n, r has no closure: look for the small dip, or the change in the middle band, between two stretches of voice, and trust it less. If the arrow is more than about 0.1 s from where the word's sound begins, give the true start (source seconds, the first column) and run the tool again:

```json
"starts": [["2017,", 1, 6.35]]
```

The words on either side are re-spaced round the pin. A pinned start must lie inside the same stretch of sound as the word; a word that is first after a pause needs no pin.

### Keep a pause that carries meaning

Tightening is for dead air. Some pauses are the performance: the pause after a hook, the beat before a key number. Name them in `keepAfter` and they stay whole. Demo 2 keeps the pause after the opening year, `[["1976", 1]]`; Demo 1 keeps the beat before "5,000 rupees", `[["just", 1]]`. A kept pause prints `(kept)` and has `"kept": true` in `TRIMS`.

### A name the timings got wrong

Demo 2's timings heard "Shamsulak Iraqui". Two ways to put it right:

- `script` (what both demos do): paste the exact narration of the stretch. Each script word replaces the timed word in the same position, so spelling and punctuation come from you, and the punctuation decides each pause's kind. The script must have one word for every timed word, split by spaces the same way (write `10,000`, not "ten thousand", if the timings have one word there). The tool stops when fewer than 80 % of the words line up; a slip of one word can pass and shift the spellings beside it, which is why you read the table against the script.
- `fixes`, when there is no script: `{"Shamsulak": "Shamsulhaq", "Iraqui": "Iraki"}`. Use `fixAt` for a word that is wrong in one place only.

## 3. The cue list

The animation exports every contact, impact and footfall as a cue: when it happens, what it is, and where it is on screen. The command in step 2 writes `out/<film>/cues.json`. Real rows from Demo 2 (the file itself has one key per line):

```json
{ "duration": 24.51, "fps": 30, "cues": [
  { "t": 5.751, "what": "step.porter", "pan": -0.15 },
  { "t": 6.42, "what": "clank", "pan": 0.01 },
  { "t": 11.829, "what": "scuff", "pan": -0.28 },
  { "t": 12.14, "what": "call", "pan": 0.15 }
] }
```

| Key | Meaning |
|---|---|
| `duration` | Length of the film in seconds. The mix is made exactly this long, so it must equal `VO.duration` in `words.ts`. A cue list exported before the voice was tightened again cuts or pads the voice; the report notes the mismatch. |
| `fps` | Frame rate of the picture (30). The mix does not use it. |
| `cues[].t` | When the contact happens. |
| `cues[].what` | The cue name: the key looked up under `cues` in the sound sheet. |
| `cues[].pan` | Where it is on screen: 0 is the middle, -0.5 the left edge of the frame, 0.5 the right edge, so nothing is thrown hard to one side. |
| `cues[].gain` | Optional. dB added to the level of every layer, for this one cue. Neither demo uses it. |

Cue names:

- One name per kind of event: `thud`, `clank`, `page`, `bell`. Every cue of one name gets the same layers, so two events that must sound different need two names (`bell.soft` and `bell`, `notes` and `notes.take`).
- Footfalls: `step.<who>` for a full step of one walker (`step.rahul`, `step.buyer`); `scuff` for a small shift of a foot, whoever makes it.
- A name is matched exactly, as text. Dots and spaces are allowed (`metal ring`).
- A cue name with no entry in the sheet is not an error. It stays silent and the report says so under `notes`: `"cues with no sound in the sheet: call, rising chord"`. Demo 2 left those two silent on purpose (a call would fight the narrator; the music plays the rising chord). Read that note after every mix: a name you did not mean to leave silent is a misspelt key, and so, usually, is a sheet entry that no cue uses (`"sheet entries that no cue uses: ..."`).

## 4. Choosing and fetching sounds

Start from the cue list: write down every cue name and how often it comes, and decide for each which sound it gets, or that it stays silent on purpose. Look in `public/sfx/` first: Demo 2 reused Demo 1's banknotes, low hit and courtyard air by path.

**Source and permission.** Sounds come from Epidemic Sound through its connector. The user has given standing permission to search, download and edit there without asking each time; afterwards you list every pick with its preview link (section 11). A download from anywhere else needs the user's yes first.

**How the connector's tools are used.**

- Effects: `SearchSoundEffects` with a search term. Each result has a title, a length and a low-quality preview link (`lqmp3Url`). `DownloadSoundEffect` returns a link to the file (ask for WAV; the demos took only their long ambience beds as MP3). The link is long, signed, and good for a few minutes only, so do not retype it: as the links come in, put them in a list and fetch them all with one command (below). Keep the title and the preview link of everything you fetch: the picks list needs them.
- Music: `SearchRecordings` (set its `vocals` filter to false), and `SearchSimilarToRecording` for more like one that nearly fits. `EditRecording` cuts a track to a length: it starts a job, `PollEditRecordingJob` says when the job is `COMPLETED` or `FAILED`, and `DownloadRecordingEdit` fetches the result. `DownloadRecording` fetches a whole track, uncut.

**Fetching.** Write a list as you go, `out/<film>/fetch.json`:

```json
[
  { "name": "gate_chain", "url": "<the download link>", "title": "Chains, Movement, Metal, Chain, Swing", "preview": "<its lqmp3Url>" },
  { "name": "music_suhana_15300", "url": "<the link from DownloadRecordingEdit>", "title": "Suhana, Aashray Harishankar", "preview": "<lqmp3Url>", "music": true }
]
```

```bash
node tools/fetch.mjs <film> out/<film>/fetch.json
```

saves each under its short name in `public/sfx/<film>/` (music in `public/audio/<film>/`), tries a failed download three times, keeps what is already there, says when a link has expired (ask the connector for a fresh one and run again), and writes `out/<film>/sound_fetched.md` with file, title and preview for each: the picks list is written from that.

**Effects.**

- Realistic recordings only, never cartoon sounds. This is the user's rule for these films.
- Search by what the thing is and what it does, in the library's own words: "Metal, Impact, Metal Scrap", "Footsteps, Human, Dirt, Gravel".
- One recording often holds many events (six hits, twenty steps). Scan it and use `variants`, so repeats of a cue are not the same sound each time.
- Layer an impact: the object itself, what it lands on, and for a heavy thing a low hit underneath with `width: 0`. Demo 1's oven is a toaster put down (-21), a metal lamp put down (-24) and a low hit (-28). Demo 2's sack is a full bag set down (-23), grit (-29) and the chain shaking 0.14 s later (-30).
- Footsteps: one file per surface; for each walker a different run of `variants` and a slightly different `pk`, so two people do not sound like one. Demo 1 has `step.rahul` at -31 with eight slices and `step.vikas` at -29.5 with six of them in another order. `scuff` uses other events of the same file at -36.
- A sound that lands on a key word is pulled down until the voice is 6 dB over it (section 9). The word matters more than the sound.
- A character's voice (a call, a shout) gets no sound: a second voice would fight the narrator.

**Ambience.** One or two beds at about -45 to -47 `pk`, started from well inside the file (the demos use `from: 30` and `from: 26`), because the first seconds of a field recording are rarely its steadiest: the courtyard bed has two louder events in its first 13 s. Use `keys` to open the bed at the start (Demo 1: from -9 dB up to 0 in 0.45 s) and to hand over between two worlds (Demo 2: both yard beds fall to -40 dB by 20 s as the furnace takes over, and the plain air comes back at 22.6 s).

**Music.**

- Instrumental only, no vocals: a singer fights the narrator.
- Find four or five candidates from different genres, save their low-quality previews (in `out/<film>/prev/`, as Demo 2 did) and scan them all with `music_scan.py`. Choose by the numbers (section 5), not by the title.
- Ask `EditRecording` for the film's length in milliseconds (it accepts up to 300 000), so the track has a real ending instead of being cut off. Demo 2 asked for 24.6 s for a 24.51 s film. The length is a wish, not a promise: asked for 15.3 s, the tool once returned 18.1 s. Look for a parameter that forces the length (`forceDuration`) and set it; measure what comes back; and if it is still too long, place the track with `at` so that its ending, not its start, is where the film needs it, or try another length.
- The music must end, not stop. Its last note or its tail should fall in the film's last second; a track still in full flow when the picture ends, pulled down by a fade, sounds like a mistake. If the cut has no ending inside the film, start the music later, choose another cut, or let it go out earlier under a line, on a phrase end that `music_scan.py` shows.
- The edit job can fail. Poll it; do not assume. If a second edit fails after a first one worked, keep the first and shape it in the sheet with `keys` and a short `fadeOut`.
- Music sits at -28 to -31 LUFS with `duck` 3.5 to 4.

**Names.** Short and plain: `public/sfx/<film>/clank_scrap.wav`, `steps_dirt.wav`, `amb_junkyard.mp3`; music as `public/audio/<film>/music_<name>_<milliseconds>.wav` (`music_suhana_24600.wav`). Library titles are long and full of commas, and the short name is what you will read in the sheet and in the report.

## 5. Looking inside sounds without ears

### Effects: `tools/sfx_scan.py`

`python tools/sfx_scan.py <folder or file> [--gap 0.12] [--floor -42] [--all] [--json <path>]` scans one file, or every `.wav` and `.mp3` in a folder, and prints a line for each. Real output:

```
clank_metal_pole_heavy.wav              7.99 s  peak    1.1 dB    6 events: 0.03-0.34(-16)  1.26-1.72(-17)  2.77-3.21(-12)  4.22-4.72(-14)  5.71-6.17(-19)  6.91-7.30(-18)
pat_metal_cabinet_palm.wav              3.51 s  peak   -4.0 dB    3 events: 0.04-0.26(-21)  1.20-1.67(-12)  2.40-2.75(-17)
```

- An event is a stretch louder than the threshold. Read `1.26-1.72(-17)` as: it starts at 1.26 s of the file, ends at 1.72 s, and its loudest 1/24 s is -17 dB (the same measure as `pk` in the sheet).
- The threshold is the higher of `--floor` and 34 dB under the file's loudest moment. Stretches closer together than `--gap` seconds count as one event.
- The line shows the first 14 events; `--all` shows every one. `--json` writes them all, each as `[start, end, level, time of the loudest instant]`.
- `peak` can read above 0 dB, as in the first line. It does not matter: the mix sets every level itself.

From the scan to the sheet:

| What the scan shows | What to write in the sheet |
|---|---|
| One event | `from` 0.02 to 0.03 s before its start, so the fade-in does not eat the attack; `to` after its end, with room for the tail that lies under the floor; `fadeOut` to close it; `lead` = event start - `from`. |
| Several separate events | `variants`, one `[from, to]` pair per event, by the same rule. The clank above became `"variants": [[0.01, 0.5], [5.69, 6.2], [6.89, 7.32]], "lead": 0.02`. |
| Events only 0.02 to 0.1 s long (soft steps: `1.03-1.16(-38)`) | Only the loudest part of each clears the floor. Give the slice the length of the whole sound: Demo 1's steps are 0.29 s each. |
| One long event that is really many (steps on gravel: `1 events: 0.09-37.10(-14)`) | The noise between the sounds is over the threshold. Scan again with a higher floor: `--floor -30` split that file into 40 events, the steps among them (`0.49-0.89(-18)`, `1.97-2.04(-21)`, `2.65-2.88(-25)`). A smaller `--gap` splits a fast run. |
| One long steady sound (sparks, a furnace hum) | Cut what you need with `from` and `to`, or several `variants` from different places; give it a `fadeIn` and a long `fadeOut`. |
| A sound that swells (a whoosh, a flame-up) | `lead` = loudest instant - `from`, so that the peak of the swell lands on the cue; `dt` to move that peak. The flame-up's loudest instant is at 1.325 s of the file, its `from` is 0.23, its `lead` 1.1. |
| An ambience bed with dozens of tiny events | The bed hovers at the floor; ignore those. Look for the few loud events and pick a `from` that leaves a stretch as long as the film without one. The courtyard bed holds between -39 and -44 for the 25 s after 30 s, against -35 and -33 in its first 13 s. |

### Music: `tools/music_scan.py`

`python tools/music_scan.py <file> [more files] [--step 4] [--to <seconds>]` prints one row per step. Real output, Demo 2's track as cut by the edit tool, `--step 3`:

```
music_suhana_24600.wav: 24.6 s
   t     level   low    bright  onsets/s
   0.0   -34.6  -53.8    1498    6.0  #################
   3.0   -31.2  -45.9    1391    5.0  ###################
   6.0   -32.0  -45.1    1553    4.7  ###################
   9.0   -28.4  -41.2    1450    4.0  ####################
  12.0   -25.7  -45.1    1484    3.3  ######################
  15.0   -24.2  -39.0    1281    3.0  ######################
  18.0   -32.6  -50.4     992    0.7  ##################
  21.0   -18.5  -23.9    1848    5.3  #########################
  24.0   -19.9  -42.1    2200    6.6  #########################
```

| Column | Meaning | Read it as |
|---|---|---|
| `level` | Overall level, dB | Compare rows with each other. It is not LUFS. |
| `low` | Level under 160 Hz | Bass. Far under `level` means there is none. |
| `bright` | Middle of the spectrum, Hz | Higher is brighter. Falling, with 0 onsets, is a note dying away. |
| `onsets/s` | New notes or hits per second | How busy it is. 0.0 is a held note or silence. |

Reading the rows above: a thin plucked opening with no bass up to 9 s (level about -32, `low` under -45); a second layer after that, rising to -24; a breath at 18 s where a held note dies away (level -32.6, `bright` 992, 0.7 onsets); the full arrangement with bass from 21 s (level -18.5, `low` -23.9). A second scan with `--step 0.5` pins the second layer at 11.0 s and the arrival at 21.0 s.

What to look for in a track:

- A sparse opening to lie under the first beats, where the voice and the effects set the scene. A candidate that is full from its first second (one of Demo 2's read level -21.6, `low` -25.5 in its first 4 s) leaves no room.
- An arrival, level and `low` jumping together, that can fall on the film's turn. In Demo 2 the full arrangement enters as the yard turns into the steel world, under "steel rods" (20.46 to 21.21 s).
- A real ending. Demo 1's track plays its last note 9.1 s in and then dies away; `"at": 3.37` puts that note on "5,000" (12.53 s).
- Scan the previews to choose the track; scan the edit you downloaded to place it, because the edit rearranges the track. To place it, find the moment in the track with a small `--step`, find the moment in the film in `words.ts`, and set `at` = film moment - track moment.

## 6. The sound sheet

`src/films/<film>/sound.json` gives each cue name its sounds and levels, and sets the voice, the music and the ambience. File paths are relative to the studio folder. Demo 1's sheet, with `cues` cut down to two names:

```json
{
  "lufs": -14.0,
  "ceiling": -1.7,
  "vo": { "file": "public/audio/md/vo-tight.wav", "lufs": -15.0 },
  "music": { "file": "public/audio/md/music_last_pieces_13600.wav", "at": 3.37, "lufs": -28.0, "duck": 3.5, "fadeIn": 0.03,
             "keys": [[0, 0], [12.3, 0], [12.6, 1], [13.4, 1], [13.75, 4.5], [14.05, 4.5]] },
  "amb": { "file": "public/sfx/md/amb_courtyard_distant_traffic.mp3", "from": 30, "pk": -47, "keys": [[0, -9], [0.45, 0], [14.05, 0]] },
  "cues": {
    "thud": [
      { "file": "public/sfx/md/putdown_toaster.wav", "from": 0.03, "to": 0.6, "lead": 0.03, "pk": -21, "fadeOut": 0.15 },
      { "file": "public/sfx/md/putdown_metal_lamp.wav", "from": 0.04, "to": 1.2, "lead": 0.03, "pk": -24, "fadeOut": 0.3 },
      { "file": "public/sfx/md/boom_lowhit.wav", "from": 0.0, "to": 1.2, "pk": -28, "fadeOut": 0.6, "width": 0 }
    ],
    "pat": [{ "file": "public/sfx/md/pat_metal_cabinet_palm.wav", "variants": [[0.02, 0.42], [2.38, 2.82]], "lead": 0.02, "pk": -25, "fadeOut": 0.1 }]
  }
}
```

### Top level

| Key | Meaning | Default | Demo 1; Demo 2 |
|---|---|---|---|
| `lufs` | Loudness target of the finished mix, LUFS | `-14.0` | -14; -14 |
| `ceiling` | Limiter ceiling, dBFS. Keep -1.7 (section 9). | `-1.7` | -1.7; -1.7 |
| `vo` | `{ "file", "lufs" }`: the tightened voice, and its loudness before the final gain | `file` required, `lufs` `-15.0` | -15; -15 |
| `music` | One track (next table). Leave it out for no music. | none | |
| `amb` | One ambience bed, or a list of beds laid over each other. Leave it out for none. | none | 1 bed; 2 beds |
| `cues` | `{ "<cue name>": [layer, ...] }`. Every layer in the list sounds on every cue of that name. | required | 16 names; 29 names |

### `music`

| Key | Meaning | Default | Demo 1; Demo 2 |
|---|---|---|---|
| `file` | The track | required | |
| `at` | Where in the film the piece starts, s | `0.0` | 3.37; 0.0 |
| `from`, `to` | Cut of the track, both in seconds of the file | the whole file | none; `to` 24.51 |
| `lufs` | Loudness the cut piece is set to, before ducking and `keys`, LUFS | `-28.0` | -28; -31 |
| `duck` | dB the music drops while the voice sounds. It falls in about 0.08 s and comes back over about 0.45 s. | `4.0` | 3.5; 4.0 |
| `fadeIn`, `fadeOut` | Fades at the two ends of the cut piece, s | `0.02`, `0.05` | 0.03, default; 0.5, 0.28 |
| `keys` | `[[time, dB], ...]`: a gain curve through film time, on top of everything else. Straight lines between keys, flat before the first and after the last. Times must rise. | none | both use it |

Use `keys` to even a track out under the voice. Demo 2 lifts the thin opening by 9 dB, comes down to +4 when the second layer enters at 11 s, dips to -4 where the full arrangement arrives under "steel rods", and lifts the last chord by 6 dB once the narrator has finished. Demo 1 lifts the dying last note by 4.5 dB after the last word.

A piece that runs past the end of the film is cut there, and `fadeOut` then works at the end of the film; with a `fadeOut` under 0.2 s the report notes it, because a track cut off in full flow sounds like a mistake. Either the track has died away by then (Demo 1), or you ask the edit tool for the film's length, or you give it a `to` and a real `fadeOut` (Demo 2: `"to": 24.51, "fadeOut": 0.28`).

### `amb` (each bed)

| Key | Meaning | Default | Demo 1; Demo 2 |
|---|---|---|---|
| `file` | The bed | required | |
| `from` | Where in the file the bed starts, s. A bed is not looped: the file must hold `from` plus the film's length, or the bed stops early. | `0` | 30; 30 and 26 |
| `pk` | Level: the loudest 1/24 s of the stretch used is set to this, dBFS. It is measured over the whole stretch, before `keys`, so one loud event makes the rest of the bed quieter. | `-46.0` | -47; -46 and -45 |
| `keys` | As for music. -40 is as good as silent. Every bed also gets a fixed 0.05 s fade-in and 0.3 s fade-out at the two ends of the film. | none | all beds use it |

### Cue layers

| Key | Meaning | Default |
|---|---|---|
| `file` | The recording | required |
| `from`, `to` | The slice of the file to play, in seconds of the file | `0.0`, end of file |
| `variants` | `[[from, to], ...]`: slices used in turn, one per cue. Replaces `from` and `to`. | none |
| `lead` | Where in the slice the sound itself begins, s. That instant goes on the cue. | `0.0` |
| `dt` | Seconds added to the cue's time for this layer. Plus is later. | `0.0` |
| `pk` | Level: the loudest 1/24 s of the slice is set to this, dBFS | `-24.0` |
| `fadeIn`, `fadeOut` | Fades at the two ends of the slice, s | `0.004`, `0.06` |
| `width` | Multiplies the cue's `pan`: 1 follows the picture, 0 is always the middle | `1.0` |

- **`lead` and `dt`.** The slice is laid so that the instant `lead` seconds into it falls at `t + dt`; the slice itself starts at `t + dt - lead`. `lead` is about the recording: the hundredths of a second before a hit, or the time a whoosh takes to peak. `dt` is about the film: this layer comes a little after the contact. Demo 2's whoosh has `"lead": 0.36, "dt": 0.75`: its loudest instant falls 0.75 s after the cue. The report lists `t + dt` as `starts`.
- **`variants`.** The first cue of a name takes the first pair, the next cue the next pair, and after the last pair it starts again. Cues are taken in the order of the cue list, and each layer keeps its own count.
- **`pan` and `width`.** Every effect is folded to mono and placed at `pan` x `width` (constant power, held within -1 to 1). Use `width: 0` for a low hit, because bass off to one side only makes the mix lopsided, and for a sound with no place on screen. Use 0.3 to 0.5 for far or large things (the demos: far clang 0.4, whoosh 0.3, bells 0.5). Music and ambience keep their own stereo.
- **`pk`.** The loudest 1/24 s (about 42 ms) of the slice, as RMS, after its fades, in dBFS. It follows how strong a short sound is better than its peak does, and it is the number `sfx_scan.py` prints in brackets. A cue's `gain` is added to it. The whole mix then gets a small final gain (+0.8 dB in both demos).
- A slice that lies past the end of its file plays nothing; the report names it under `notes`.

## 7. The mix

`python tools/audio_mix.py <sheet> <cue list> --out <folder>`: all three are relative to the studio folder, and without `--out` it writes to `out/mix`. The mix is exactly as long as `duration` in the cue list.

| Bus | What is done to it |
|---|---|
| Voice | High-pass at 70 Hz; gentle compression (3 to 1 above -24 dB), so it can be loud without clipping; cut or padded to the film's length; set to `vo.lufs`. |
| Music | Cut (`to`, `from`), faded, set to `lufs`, laid at `at`, lowered by `duck` while the voice sounds, then shaped by `keys`. |
| Ambience | Each bed taken from `from` for the film's length, set to `pk`, shaped by `keys`, faded at both ends. Beds add up. |
| Effects | For every cue, every layer of its name: slice, fades, level to `pk`, pan, laid on the cue. |
| Sum | The four are added. The sum is given a gain and limited at `ceiling`, up to four times over, until its measured loudness is within 0.15 LU of `lufs`. |

It writes into the `--out` folder. Every WAV is 48 kHz, stereo, 16 bit. The three stems carry the final gain, so together they are the mix as it was before the limiter.

| File | What it is |
|---|---|
| `mix.wav` | The finished mix, limited |
| `sfx-only.wav`, `sfx-only.mp3` | Stem: effects and ambience together; no voice, no music |
| `music-only.wav` | Stem: the music after ducking and `keys` |
| `vo-processed.wav` | Stem: the voice after high-pass, compression and level |
| `mix-report.json` | Everything measured, and one row per layer placed |

## 8. Reading the report

The tool prints the report without its `cues` rows; `mix-report.json` holds all of it. Real output, Demo 1 (printed one key per line; drawn together here):

```
"voice": { "before": -25.1, "target": -15.0 }
"music": { "file": "public/audio/md/music_last_pieces_13600.wav", "at": 3.37, "before": -20.6, "target": -28.0, "duck": 3.5 }
"mix":   { "lufs": -14.1, "target": -14.0, "lra": 1.1, "truePeak": -1.5, "gain": 0.8 }
"stems": { "voice": -14.2, "music": -30.5, "effects": -25.7, "air": -53.6 }
"voice clear": { "effects": { "need": 6.0, "worst": 6.3, "at": 3.2, "under": [] },
                 "music":   { "need": 10.0, "worst": 10.2, "at": 9.0, "under": [] } }
"checks": { "loudness ok": true, "true peak ok": true, "longest silence s": 0.0, "no silent window": true,
            "voice over effects ok": true, "voice over music ok": true, "cues placed": 50 }
"notes": []
```

| Part | What it tells you |
|---|---|
| `voice`, `music` | `before`: the loudness the bus came in with. `target`: what it was set to. |
| `mix` | `lufs`: the loudness reached. `truePeak`: the highest true peak, dB. `lra`: loudness range, LU. `gain`: dB given to the sum to reach the target. |
| `stems` | Loudness of each bus in the finished mix, LUFS. `air` is the ambience (`amb` in the sheet). |
| `voice clear` | The mix is read in windows of 0.4 s, one every 0.2 s; only windows that are mostly speech count. In each, margin = voice level - level of the other bus. `effects` means effects and ambience together and needs 6 dB; `music` needs 10 dB. `worst` is the smallest margin, `at` the start of that window, `under` every window below `need`, as `[start, margin]`. |
| `checks` | The pass or fail lines of section 9. `cues placed` counts layers, not cues (Demo 1: 44 cues, 50 layers). |
| `notes` | What needs a look: cue names that have no entry in the sheet; sheet entries that no cue uses (often a misspelt key); slices that lie past the end of their file; music cut off at the end of the film; a cue list that is not as long as the voice (export it again). |
| `cues` (in the file only) | One row per layer placed: the cue's `t` and `what`, the `file`, the slice used (`from`, `to`: this shows which variant each cue got), `starts` (`t + dt`) and the `pk` it was set to. |

A failure looks like this (Demo 1 with its oven thud set 6 dB too loud): `"effects": { "need": 6.0, "worst": 2.7, "at": 3.2, "under": [[3.0, 4.6], [3.2, 2.7]] }`. The windows starting at 3.0 and 3.2 s are 4.6 and 2.7 dB clear instead of 6. To find what sounds there, look in `cues` for rows whose `starts` lies in that window or shortly before it (here the thud, `starts` 3.26). A long sound that began earlier (a bell, a low hit) may be the one.

## 9. Targets and fixes

| Target | Check | When it fails |
|---|---|---|
| Mix at -14 LUFS, give or take 0.5 | `loudness ok` | It rarely fails, because the final gain makes up the difference. The real warning is `mix.gain` far from the demos' +0.8, or `stems.voice` well under -14.2: effects or music then carry the loudness and the voice has been turned down to make room (with four effects set to -4, the gain went to -4.5 and the voice to -19.5). Lower them. |
| True peak at or under -1 dB | `true peak ok` | Lower `ceiling`. The sheets use -1.7, which measured -1.5 and -1.6 in the mix and -1.4 and -1.6 in the delivered MP4s: encoding can raise a peak, so leave that room. If `mix.gain` is negative as well, the effects are overloading the sum: lower them first. |
| No silent window: no stretch under -60 dB for 0.5 s | `no silent window` | There is a hole with no bed. Add a bed, check its `keys`, check that the file is long enough from `from`. |
| Voice at least 6 dB over effects in every window where someone speaks | `voice over effects ok` | Lower that layer's `pk`, by more than the shortfall, because other sounds share the window (6 dB on Demo 1's oven thud moved its margin by 3.6 dB). If it is the tail of an earlier sound, shorten it with `to` and `fadeOut`. If it is the bed, lower its `pk` or dip its `keys`. |
| Voice at least 10 dB over music in every such window | `voice over music ok` | Dip the music's `keys` around that window, or raise `duck`, or lower `lufs` if the music is close everywhere. |

Work this way: write the sheet with the levels of section 10, mix, read `voice clear`, change one thing, mix again. An effect on a key word is pulled down only until its check passes: the demos ended with worst margins of 6.3 and 6.5 dB over effects and 10.2 and 10.5 dB over music. Do not call the mix done until the last run shows every check true and `notes` holds only the cues you left silent on purpose.

## 10. Typical levels

Taken from the two sheets. Effects and beds are `pk` in dBFS; voice and music are LUFS. Start a new sheet from these, then let the report pull down whatever sits on a word.

| Kind of sound | Level in the sheets |
|---|---|
| Voice | `lufs` -15; -14.2 LUFS in the finished mix |
| Music | `lufs` -28 (Demo 1) and -31 (Demo 2), `duck` 3.5 and 4; -30.5 and -30.8 LUFS in the finished mix |
| Ambience beds | -47 (Demo 1); -46 and -45 (Demo 2); about -53 LUFS in the finished mix |
| Footsteps | -29.5 to -33: -31 and -29.5 for two walkers on concrete; -30, -31 and -33 on dirt |
| Scuffs | -36 and -37 |
| Light touches (hand, paper, coin, click) | -25 to -32: pat -25, page -26, coin, notes, spanner, ratchet and hands dusted off -28, clicks -29 to -32, rope -31; a tin lid popping open -23 |
| Small things moving, and air | chain, rattle, cloth, grit -27 to -31; sparks -35; swish, whoosh, wings -25 to -28 |
| Heavy impacts, the main layer | -21 to -24: oven down -21, concrete block -22, scrap -22.5, sack down -23, metal pole -24, deck -24. The shutter rolling up is -19 after a first clack at -26: the loudest effect in either sheet. |
| Layers under an impact | a second object -24 to -27.5; what it lands on -29; a rattle after it -30; a low hit -28 with `width: 0` |
| Sounds with no place on screen | tap -27 and the low hit on the key number -23 (`fadeOut: 0.8`), both `width: 0` |
| Bells and rings | a soft first pull -27; the bell on its word -21.5 (`fadeOut: 1.4`, `width: 0.5`); a rebar ring -25 |
| Fire | flame-up -24.8 with a furnace hum under it at -33, both `width: 0` |
| Far off | distant clang -28 (`width: 0.4`); a crow -26 |

## 11. Deliverables and what to tell the user

`node tools/deliver.mjs <film>` joins the finished picture with `out/<film>/mix.wav` (as AAC, 48 kHz, stereo) and copies the effects-only MP3 and the tightened voice next to the MP4, in `out/<film>/deliver/`. It measures the loudness and the true peak of the encoded file once more, which is why the sheets keep `ceiling` at -1.7, and writes a `report.md` there with the mix numbers and the trims.

Give the user:

1. The MP4 with the full mix.
2. The effects-only MP3: effects and ambience, no voice, no music. It lets them rebalance by ear in an editor. It lines up with the tightened voice, not with the original recording: both start at 0 and are as long as the film.
3. The tightened voice.
4. The list of trims, from `TRIMS`: every pause where `now` is less than `was` (after which word, from how long to how long), the pauses kept on purpose, and the total. Demo 2: after "dust," 0.47 to 0.28 s; after "hand," 0.57 to 0.28 s; after "buyer." 0.60 to 0.42 s; after "scrap" 0.28 to 0.20 s; after "rods" 0.23 to 0.20 s; kept whole: the pause after "1976,"; 0.77 s removed in all; no word cut or sped up.
5. The list of sounds with preview links. Save it as `out/<film>/sound_picks.md`, the name the delivery report looks for (Demo 2's is the model; a copy is kept at `src/films/ggsp/sound_picks.md`): one line with the source, the date, "no vocals" and "levels set by measurement"; the music with its artist, how it was cut, where it sits and its preview link, and the tracks looked at and not used; a table `Moment | Sound | Preview` in the order the sounds are heard, with the moment in the film's own words ("the piece lands"), the library title and the `lqmp3Url`; then what was fetched and not used, what was reused from an earlier film, and what was left silent and why. Enter the same fetches in the film's `STATE.md` under "Fetched from outside".
6. The numbers reached: loudness, true peak, and the two worst voice margins.

Say plainly that the mix was balanced by measurement, not by ear. The user's ear is the last check: ask them to name anything too loud or too soft, then change that sound's `pk` and mix again.
