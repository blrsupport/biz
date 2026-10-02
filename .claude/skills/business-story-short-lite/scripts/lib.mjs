// Shared by new-studio.mjs and update-studio.mjs: the record of which library files a studio got from the skill.
//
// A studio's library (src/assets) grows with every film, so an update may not overwrite it blindly. The record
// (.skill.json in the studio) holds, for each library file the skill delivered, a hash of what was delivered. At the
// next update a file whose hash still matches has not been touched by the studio and can safely take the skill's
// newer version; one that no longer matches is the studio's own work and is kept.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const RECORD = ".skill.json";

export const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

export const hashOf = (file) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 20);

/** forward slashes, so that a record written on one system reads on another */
export const key = (rel) => rel.split("\\").join("/");

export function readRecord(studio) {
  const p = join(studio, RECORD);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeRecord(studio, library) {
  const sorted = Object.fromEntries(Object.entries(library).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(studio, RECORD), JSON.stringify({ skill: "business-story-short", note: "which library files came from the skill, and what they were (scripts/update-studio.mjs reads this); do not edit", library: sorted }, null, 2) + "\n");
}
