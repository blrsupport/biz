// Loads the static font cuts once per browser tab and holds the render until they are ready.
// Each cut is its own family name, so nothing can fall back to a synthesised bold or italic.
import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_METRICS, type FaceName } from "./metrics.ts";

let started = false;

export function loadFonts(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("loading fonts");
  const faces = Object.keys(FONT_METRICS) as FaceName[];
  Promise.all(
    faces.map(async (name) => {
      const face = new FontFace(name, `url(${staticFile("fonts/" + FONT_METRICS[name].file)})`);
      await face.load();
      (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      throw new Error("font failed to load: " + String(e));
    });
}
