// Time is seconds everywhere. Frame numbers never appear in a beat.

export const FPS = 30;

export interface Word {
  readonly w: string; // as spelt in the script
  readonly n: string; // normalised: lower case, letters and digits only
  readonly t0: number; // start, seconds in the tightened voice
  readonly t1: number; // end
  readonly src: number; // start in the untrimmed voice file
}

const normTok = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which words of a narration have been used as anchors, by index: these are the words whose timing the film rests on. */
const USED = new WeakMap<readonly Word[], Set<number>>();
export function anchoredWords(words: readonly Word[]): number[] {
  return [...(USED.get(words) ?? [])].sort((a, b) => a - b);
}

/**
 * Word anchors. `W("oven")` is the moment the narrator starts the word "oven";
 * `W("rupees", 2)` the second time it is said; `W("no funding")` the start of a phrase;
 * `W.end("5,000")` the moment a word ends. Throws when the words are not in the voice, so a typo cannot ship.
 */
export function makeAnchors(words: readonly Word[]) {
  const find = (phrase: string, nth: number): [number, number] => {
    const toks = phrase.split(/\s+/).map(normTok).filter(Boolean);
    let seen = 0;
    for (let i = 0; i + toks.length <= words.length; i++) {
      let ok = true;
      for (let k = 0; k < toks.length; k++) {
        if (words[i + k].n !== toks[k]) {
          ok = false;
          break;
        }
      }
      if (ok && ++seen === nth) return [i, i + toks.length - 1];
    }
    throw new Error(`word anchor not found: "${phrase}"${nth > 1 ? ` (#${nth})` : ""}`);
  };
  const used = USED.get(words) ?? new Set<number>();
  USED.set(words, used);
  const W = (phrase: string, nth = 1) => {
    const a = find(phrase, nth)[0];
    used.add(a);
    return words[a].t0;
  };
  W.end = (phrase: string, nth = 1) => {
    const b = find(phrase, nth)[1];
    used.add(b);
    return words[b].t1;
  };
  W.mid = (phrase: string, nth = 1) => {
    const [a, b] = find(phrase, nth);
    used.add(a);
    return (words[a].t0 + words[b].t1) / 2;
  };
  return W;
}

export type Anchors = ReturnType<typeof makeAnchors>;

/** Frames a clip of `seconds` needs. */
export const framesFor = (seconds: number) => Math.ceil(seconds * FPS);
