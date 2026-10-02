// Bihar Mushroom: sequence "today" (simplest form). The village today at sunrise: huts with bags hanging, white
// sacks stacked by the lane, Sanjeev today among them. It opens off the dark door jamb that "lab" ends on, and ends
// on a held, living frame: he turns his back on the far city and looks over his village.
import { CAST } from "../../../assets/cast/cast.ts";
import type { Palette } from "../../../engine/draw/shape.ts";
import type { Cue } from "../../../engine/film.ts";
import type { Pt } from "../../../engine/geom/vec.ts";
import { Actor } from "../../../engine/motion/actor.ts";
import { handsOnHips, lookAt, nod } from "../../../engine/motion/verbs.ts";
import { Camera, layerTransform } from "../../../engine/stage/camera.ts";
import { makeAnchors } from "../../../engine/time/clock.ts";
import type { PhraseCue } from "../../../engine/type/blockspec.ts";
import { DEPTH, LANE, LANE_PALETTE } from "../s1/lane.ts";
import { VO, WORDS } from "../words.ts";

const ANCHOR = makeAnchors(WORDS);
export const TODAY = { ...LANE, fps: 30, t0: Math.round(ANCHOR("by") * 100) / 100, end: VO.duration } as const;
export const TODAY_PALETTE: Palette = LANE_PALETTE;
const { U, GY } = TODAY;
const FRAME = { width: TODAY.W, height: TODAY.HGT };
const REF = { cx: TODAY.W / 2, cy: TODAY.HGT / 2 };

function build() {
  const W = ANCHOR;
  const cues: Cue[] = [];
  const cam = new Camera(560, 950, 1.0);
  cam.keys([
    { t: TODAY.t0 - 0.3, cx: 560, cy: 950, zoom: 1.0 },
    { t: 92.0, cx: 620, cy: 940, zoom: 0.95 },
    { t: 97.0, cx: 500, cy: 950, zoom: 1.04 },
    { t: 102.0, cx: 420, cy: 950, zoom: 1.0 },
    { t: 106.0, cx: 560, cy: 945, zoom: 1.0 },
    { t: TODAY.end + 0.3, cx: 600, cy: 940, zoom: 0.96 },
  ]);
  const under = (t: number, k: number, sx: number, sy: number): Pt => {
    const lt = layerTransform(cam.view(t), FRAME, k, REF);
    return [(sx - lt.tx) / lt.s, (sy - lt.ty) / lt.s];
  };

  const sanjeev = new Actor({ ch: CAST.sanjeevNow, scale: U, groundY: GY, x: 660, yaw: 1.0, seed: 14 });
  lookAt(sanjeev, [1500, 700], { at: TODAY.t0 + 0.4 });
  lookAt(sanjeev, [240, GY - 1.6 * U], { at: W("600") - 0.2 });
  nod(sanjeev, { at: W("kilos") + 0.1, amount: 0.1 });
  handsOnHips(sanjeev, { at: W("1000"), dur: 0.42 });
  lookAt(sanjeev, [-800, 800], { at: W("jharkhand") });
  lookAt(sanjeev, [2000, 760], { at: W("supplying") });
  sanjeev.turnTo(-1.1, { at: W("chose") + 0.2, dur: 0.6 });
  lookAt(sanjeev, [-1200, 900], { at: W("village over") });
  cues.push({ t: TODAY.t0 + 0.1, what: "door.slide" }, { t: W("600"), what: "thud.sack", x: 240 }, { t: W("1000"), what: "pat", x: 640 }, { t: 104.6, what: "birds" });

  const tLand: [string, string, number, number][] = [
    ["n50", "50,000", W("50"), W("today") - 0.3],
    ["kilos", "600 KILOS", W("600"), W("and", 10) > 0 ? W("1000") - 0.6 : 0],
    ["k1000", "1000", W("1000"), W("jharkhand") - 0.4],
    ["jh", "JHARKHAND", W("jharkhand"), W("uttar pradesh") - 0.12],
    ["up", "UTTAR PRADESH", W("uttar pradesh"), W("odisha") - 0.12],
    ["od", "ODISHA", W("odisha"), W("yes") + 0.2],
    ["hr", "HARYANA", W("yes haryana") + 0.41, W("so the state") + 0.6],
    ["vil", "THE VILLAGE", W("village over"), TODAY.end + 0.6],
  ];
  const type: Record<string, PhraseCue> = {};
  for (const [id, text, at, out] of tLand) {
    const p = under(at, DEPTH.type, 92, 430);
    type[id] = { x: p[0], y: p[1], size: 150, maxW: 790, lines: [{ lead: text, text: "", at }], out };
    if (id === "up") {
      const q = under(at, DEPTH.type, 92, 336);
      type[id] = { x: q[0], y: q[1], size: 104, maxW: 790, leading: 1.4, lines: [{ text: "UTTAR", at }, { lead: "PRADESH", text: "", at: W("pradesh") }], out };
    }
  }
  const birds = [0, 1, 2].map((i) => ({ t0: 104.6 + 0.4 * i, y: 200 + 36 * i, speed: 230 + 30 * i, x0: 1180 + 60 * i, size: 22 - 3 * i }));
  return { cam, sanjeev, type, birds, cues, marks: { jambOff: TODAY.t0 + 0.43 } };
}

export type TodayTake = ReturnType<typeof build>;
let take: TodayTake | null = null;
export function todayTake(): TodayTake {
  if (!take) take = build();
  return take;
}
