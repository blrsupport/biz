// Every film in this studio. tools/new-film.mjs adds a line here; Root.tsx and the tools read the list.
import type { Film } from "../engine/film.ts";
import { GG_FILM } from "./ggsp/film.ts";
import { MD_FILM } from "./md/film.ts";

export const FILMS: Film[] = [MD_FILM, GG_FILM];

export function filmById(id: string): Film {
  const f = FILMS.find((x) => x.id === id);
  if (!f) throw new Error(`no film "${id}" (have: ${FILMS.map((x) => x.id).join(", ")})`);
  return f;
}
