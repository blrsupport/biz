# The machine: rendering safely, and what to do when a tool fails

Read this before the first render on a machine. The engine was built on a small, company-managed Windows PC (four cores, integrated graphics, 16 GB) that blue-screened under careless rendering. The rules below kept it up through two films, and they cost nothing on a bigger machine.

## Contents

1. The rules, and why each exists
2. What things cost
3. Long renders
4. Workers and the one browser
5. Windows traps
6. When something fails

## 1. The rules, and why each exists

| Rule | Why |
|---|---|
| Every render goes through `tools/stills.mjs` or `tools/render.mjs`. Never `npx remotion`, never a browser of your own. | Those two tools go through `tools/lib/browser.mjs`, the only place a browser is launched: Remotion's own headless shell, behind a lock, at below-normal priority. |
| Never the system Chrome. | It starts a storm of helper processes. The crashes on the build PC were traced to the virus scanner's driver faulting while it inspected newly started processes; fewer process starts means fewer chances. |
| One browser at a time. | The lock file `out/.render.lock` makes a second render wait for the first. Do not delete the lock to get past it; if its process is dead the tools take it over by themselves. |
| Stage with `tools/preview.ts`; start the browser when the staging is right. | The preview rasterises the display list with Pillow: no browser, no risk, a second a frame. It is rough (plain type, no finishing), so the look is still judged on real stills. |
| Batch stills: all the stills of one look in a single `stills.mjs` command. | One bundle and one browser start for the whole batch (about 15 s), then a second or two per still. Ten separate commands cost ten starts. |
| Write files in one step; start a render in a later one. | A crash zero-fills files written in the last few seconds. Source that was saved a moment earlier survives. |
| One heavy job at a time. | A render, a transcriber and a long ffmpeg encode each want the whole machine. Type checks, dry runs, Python tools and short ffmpeg jobs are light and may run beside a render. |
| Two workers, the GPU path (`angle`). | Measured: 2, 3 and 4 workers render a heavy frame in the same time, because the screenshot is the bottleneck; more workers only use more memory. Software rendering was eight times slower and held the CPU at 96 %. `render.mjs` picks one worker when memory is already above about 84 %. |
| In PowerShell, never redirect a render's stderr with `2>`. | PowerShell 5.1 turns every stderr line of a native program into an error record and reports failure even when the render succeeded. |
| Do not throttle beyond this. | The user's instruction was normal speed and power, just no crash. Waiting "to be safe" between steps is its own failure: it made them wait hours for the first picture. |

Check the machine's state when in doubt: `node tools/doctor.mjs` prints memory in use and whether everything is in place.

## 2. What things cost

Measured on the build PC at 1080x1920:

| Job | Time |
|---|---|
| Type check | about 10 s |
| Dry run of a 24 s film (`check.ts`) | about 3 s |
| A preview with no browser (`preview.ts`) | about 1 s a frame |
| One still | about 15 s (almost all of it the bundle and the browser start) |
| A batch of 25 stills | about 95 s |
| Half-size pass, 24.5 s (736 frames) | about 75 s |
| Full-size render | 0.13 to 0.25 s a frame with 2 workers: a 24.5 s film in about 100 s, a 150 s film in 10 to 19 min |
| Finishing pass | about real time |
| Mix | a few seconds |

So renders are not what makes a film slow; deliberation is. Render a batch, look once, fix, move on.

What makes a frame expensive: the number of shaded (`round`) shapes, clip groups, and the size of the picture. Dense polylines are cheaper than curves. A frame of about 1,600 paths (the yard of `ggsp`) renders in 0.13 s. The dry run reports the heaviest frame and fails above 2,400 paths.

Never use in a frame, and the display list has no way to: SVG filters (`feTurbulence`, `feGaussianBlur`, `feDisplacementMap`), CSS `filter: blur()` or `drop-shadow`, `backdrop-filter`, `mix-blend-mode`. One full-frame turbulence filter costs 200 to 400 ms a frame. Grain, paper tooth and vignette are added afterwards by `tools/finish.mjs` with ffmpeg.

## 3. Long renders

For anything over about a minute, render in stretches:

```bash
node tools/render.mjs <film> --chunk 20 --out <film>_clean
```

Each 20 s stretch is written to `out/video/<film>_clean.partNN.mp4` and the parts are joined without re-encoding. If the render is interrupted, run the same command again: stretches already on disk are kept. After changing one sequence, delete only the parts that cover it (or use `--fresh` to redo everything).

To re-render one stretch by hand: `--from <s> --to <s> --out <name>`; to join files yourself, list them in a text file (`file 'a.mp4'`, one per line) and run `tools/bin/ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`.

Memory peaked at about 90 % during the longest stretch with other sessions open. If the machine is busy, pass `--workers 1`.

## 4. Workers and the one browser

Workers (subagents) may build sequences side by side, but they share one browser: a worker's `stills.mjs` waits behind the lock until the browser is free. So:

- Tell every worker the machine rules in its pack, word for word.
- A worker renders stills only (its own sequence's composition, `<film>-<seq>`), in batches. The main session renders video.
- Dry runs need no browser, so workers iterate freely on those.
- Workers write only inside their own sequence's folder and the asset files their pack names.

## 5. Windows traps

- **A freshly written file is "locked" (EPERM, EBUSY, "Permission denied").** The virus scanner holds new files for a moment, and a player or a viewer holds a file it has open. The tools wait and try again by themselves (the bundle, stills, the preview's pictures, the Python tools' own files), and a render is written under a name of its own and moved into place at the end, so a locked file of the same name cannot cost the render: if the old file stays locked, the new one is kept beside it and the message says where. For anything else, run it again. If every write fails for minutes and Desktop Commander is available, write through that instead.
- **A command prints only `Node.js v...` and stops.** That is the last line of an error whose beginning was cut off (by `tail`, or by a short output window). The tools now end every failure with a line that starts `FAILED:` and says what failed; if you see only the version line, run the command again without cutting its output and read the error.
- **PowerShell 5.1 text cmdlets corrupt source files.** `Get-Content | ... | Set-Content` reads UTF-8 as ANSI and writes it back with a byte-order mark: every `₹` became `â‚¹`. Never pass a source file through them. Change text with the Edit tool or a small Python script that opens files with `encoding="utf8"`.
- **Two files whose names differ only in case collide** (`blocks.ts` and `Blocks.tsx`): the type check fails with "differs only in casing". Give a data file and a component different names.
- **Long paths.** The headless browser inside `node_modules` can pass the 260-character limit. Keep the studio's own path short.
- **Git Bash rewrites arguments that start with `/`**, breaks long here-documents that contain quotes or non-ASCII text, and halves the backslashes inside them. Write anything longer than a few lines, and anything with a backslash in it, to a script file with the Write tool and run that.
- **Python prints a non-ASCII character and dies with `UnicodeEncodeError`.** Set `PYTHONIOENCODING=utf8`.
- **Waiting.** A blocking `sleep` may be refused by the harness. Start long jobs in the background and carry on with other work until they report.

## 6. When something fails

| Symptom | Cause | Fix |
|---|---|---|
| `Could not find composition with ID ...` | The film is not in `src/films/index.ts`, or the sequence id is misspelt (compositions are `<film>` and `<film>-<seq>`) | Register the film; check the id |
| `material "x" (shape y) is not in the palette` at render | A palette was not merged into the sequence's | Run the dry run: it lists every missing material at once |
| `light "x" is not one of this sequence's lights` | A paint item names a light the sequence does not declare | Add it to `lights`, or drop the name to use the sequence's own |
| `"x" is not in <face>` | A character the type face was not cut with | Add it to `NEED` in `tools/fonts.py` and run it (needs fontTools), or change the text |
| `word anchor not found: "x"` | The word is not in the narration as spelt, or it is the second occurrence | Check `node tools/script.ts <film> --words`; use `W("x", 2)` |
| Stills are blank or missing type | Fonts did not load | `node tools/doctor.mjs`; fonts must be in `public/fonts` |
| The render waits and prints `waiting: render lock held by pid ...` | Another render is running | Let it finish. It gives up by itself after 30 minutes |
| The picture is right but the type check fails with "differs only in casing" | See the trap above | Rename one of the two files |
| `ffmpeg` errors about an unknown filter | The cut-down ffmpeg that ships with Remotion is being used | A full build belongs in `tools/bin/` (see `doctor.mjs`) |
| A sequence renders correctly alone (`<film>-<seq>`) but not in the film | Its `t0`, `tFull` or `end` is wrong, or the one before it ends too early | `node tools/check.ts <film>` reports gaps between sequences |
