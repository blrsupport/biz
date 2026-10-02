// The cash tin and the few notes in it, and the wall calendar. Notes are generic: no denomination, portrait or text.
import { shape, type Palette, type Shape } from "../../engine/draw/shape.ts";
import { ellipse, roundRect } from "../../engine/geom/outline.ts";
import { add, rot, type Pt } from "../../engine/geom/vec.ts";

export const TIN_PALETTE: Palette = {
  tin: "#3f6b57",
  "tin.in": "#22342c",
  "tin.clasp": "#caa64a",
  "note.a": "#a9c4ae",
  "note.b": "#cdbadb",
  "note.mark": "#f3efe2",
  "cal.card": "#efe8d8",
  "cal.page": "#fbf8f0",
  "cal.head": "#c8452c",
  "cal.art": "#e9a53c",
  "cal.hill": "#3f6b57",
  "cal.grid": "#b3ac9e",
  "cal.wire": "#3a3438",
};

export interface TinOut {
  shapes: Shape[];
  /** the front edge of the lid near its right-hand end: where a hand lifts it */
  lidEdge: Pt;
  /** the middle of the opening */
  inside: Pt;
  topY: number;
  x0: number;
  x1: number;
}

/** Where a hand lifts the lid, and the middle of the opening, without building the drawing. */
export function tinPoints(o: { x: number; base: number; u: number }, lid: number): { lidEdge: Pt; inside: Pt } {
  const { x, base, u } = o;
  const w = 0.64 * u;
  const y0 = base - 0.3 * u;
  const D: Pt = [0.13 * u, -0.15 * u];
  const free: Pt = [-D[0] * Math.cos(lid), -D[1] * Math.cos(lid) - 0.42 * u * Math.sin(lid)];
  return { lidEdge: [x + w / 2 + D[0] + free[0] - 0.1 * u, y0 + D[1] + free[1]], inside: [x - w / 2 + 0.45 * w + 0.5 * D[0], y0 + 0.5 * D[1]] };
}

/** `x` is the middle of its front, `base` what it stands on; `lid` is how far the lid is open, radians. */
export function buildTin(id: string, o: { x: number; base: number; u: number; lid: number; notes: boolean }): TinOut {
  const { x, base, u } = o;
  const w = 0.64 * u;
  const h = 0.3 * u;
  const D: Pt = [0.13 * u, -0.15 * u];
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = base - h;
  const pt = (a: number, b: number): Pt => [x0 + a * w + b * D[0], y0 + b * D[1]];
  const out: Shape[] = [];
  out.push(shape(`${id}/side`, "tin", [[x1, y0], [x1 + D[0], y0 + D[1]], [x1 + D[0], base + D[1]], [x1, base]], { form: "plane", facing: [1, 0] }));
  out.push(shape(`${id}/in`, "tin.in", [pt(0, 0), pt(0, 1), pt(1, 1), pt(1, 0)], { form: "flat", ink: 0, paper: false }));
  if (o.notes) {
    out.push(shape(`${id}/note.in0`, "note.b", [pt(0.3, 0.3), pt(0.3, 0.9), pt(0.9, 0.9), pt(0.9, 0.3)], { form: "flat", ink: 0, paper: false }));
    out.push(shape(`${id}/note.in1`, "note.a", [pt(0.1, 0.16), pt(0.1, 0.78), pt(0.72, 0.78), pt(0.72, 0.16)], { form: "flat", ink: 0, paper: false }));
  }
  out.push(shape(`${id}/front`, "tin", roundRect([x, (y0 + base) / 2], w / 2, h / 2, 0.02 * u), { form: "plane", facing: [0, 0] }));
  out.push(shape(`${id}/band`, "tin", [[x0 + 2, base - 0.1 * u], [x1 - 2, base - 0.1 * u], [x1 - 2, base - 0.06 * u], [x0 + 2, base - 0.06 * u]], { form: "flat", tone: "shade", ink: 0, paper: false }));
  out.push(shape(`${id}/clasp`, "tin.clasp", roundRect([x, y0 + 0.07 * u], 0.05 * u, 0.045 * u, 2), { form: "flat", ink: 0.4, paper: false }));
  // the lid turns about the back edge of the opening
  const a = o.lid;
  const free: Pt = [-D[0] * Math.cos(a), -D[1] * Math.cos(a) - 0.42 * u * Math.sin(a)];
  const hA = pt(0, 1);
  const hB = pt(1, 1);
  out.push(shape(`${id}/lid`, "tin", [hA, hB, add(hB, free), add(hA, free)], a < 1.1 ? { form: "plane", facing: [0, -1] } : { form: "flat", tone: "shade", ink: 0.8 }));
  if (a < 0.25) out.push(shape(`${id}/lid.lip`, "tin", [add(hA, free), add(hB, free), add(add(hB, free), [0, 0.05 * u]), add(add(hA, free), [0, 0.05 * u])], { form: "flat", tone: "light", ink: 0, paper: false }));
  return { shapes: out, lidEdge: add(add(hB, free), [-0.1 * u, 0]), inside: pt(0.45, 0.5), topY: y0, x0, x1 };
}

/** A few notes held in a hand: a small fan about the point they are pinched at. */
export function buildNotes(id: string, at: Pt, ang: number, u: number): Shape[] {
  const out: Shape[] = [];
  const w = 0.66 * u;
  const h = 0.3 * u;
  [-0.2, 0.02, 0.24].forEach((da, i) => {
    const a = ang + da;
    const c = add(at, rot([w * 0.36, 0], a));
    const mat = i === 1 ? "note.b" : "note.a";
    out.push(shape(`${id}/n${i}`, mat, roundRect(c, w / 2, h / 2, 0.02 * u, a), { form: "flat", tone: i === 0 ? "shade" : "base", ink: 0.5, paper: false }));
    out.push(shape(`${id}/n${i}.panel`, "note.mark", roundRect(c, w / 2 - 0.045 * u, h / 2 - 0.04 * u, 0.012 * u, a), { form: "flat", ink: 0, paper: false, opacity: 0.32 }));
    out.push(shape(`${id}/n${i}.mark`, mat, ellipse(add(c, rot([w * 0.2, 0], a)), 0.07 * u, 0.085 * u, a, 2), { form: "flat", tone: "shade", ink: 0, paper: false, opacity: 0.7 }));
  });
  return out;
}

export interface CalendarOut {
  /** card, picture and the page that will show once the top one has turned */
  back: Shape[];
  /** the page that turns (empty once it has gone over) */
  page: Shape[];
  /** where the year is printed on the new page: middle of its baseline, and its cap height */
  yearAt: Pt;
  yearCap: number;
}

/** A wall calendar. `x` is its middle, `y` its top; `flip` runs 0..1 as the top page turns over. */
export function buildCalendar(id: string, o: { x: number; y: number; w: number; h: number; flip: number }): CalendarOut {
  const { x, y, w, h } = o;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const yb = y + h * 0.43; // the wire binding
  const ph = h - (yb - y) - h * 0.03;
  const flat = { form: "flat", ink: 0, paper: false } as const;
  const back: Shape[] = [
    shape(`${id}/nail`, "cal.wire", ellipse([x, y - h * 0.035], 3, 3, 0, 2), flat),
    shape(`${id}/card`, "cal.card", roundRect([x, y + h / 2], w / 2, h / 2, 4), { form: "plane", facing: [0, 0], ink: 0.8 }),
    shape(`${id}/art`, "cal.art", [[x0 + 5, y + 5], [x1 - 5, y + 5], [x1 - 5, yb - 4], [x0 + 5, yb - 4]], flat),
    shape(`${id}/art.sun`, "cal.page", ellipse([x + w * 0.16, y + h * 0.17], w * 0.11, w * 0.11, 0, 3), flat),
    shape(`${id}/art.hill`, "cal.hill", [[x0 + 5, yb - 4], [x0 + 5, y + h * 0.3], [x - w * 0.1, y + h * 0.22], [x + w * 0.2, y + h * 0.33], [x1 - 5, y + h * 0.27], [x1 - 5, yb - 4]], flat),
  ];
  // one page: paper, a coloured head strip, a faint grid of days
  const sheet = (key: string, k: number, wide: number, tone: "light" | "shade", grid: boolean): Shape[] => {
    const Y = (r: number) => yb + r * ph * k;
    const hw = (w / 2 - 5) * wide;
    const out: Shape[] = [shape(`${id}/${key}`, "cal.page", [[x - hw, Y(0)], [x + hw, Y(0)], [x + hw, Y(1)], [x - hw, Y(1)]], { ...flat, tone })];
    if (tone === "light") {
      out.push(shape(`${id}/${key}.head`, "cal.head", [[x - hw, Y(0.03)], [x + hw, Y(0.03)], [x + hw, Y(0.34)], [x - hw, Y(0.34)]], flat));
      if (grid) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 7; c++) {
            const cx = x - hw + ((c + 0.5) / 7) * 2 * hw;
            const cy = Y(0.45 + r * 0.14);
            out.push(shape(`${id}/${key}.d${r}_${c}`, c === 0 ? "cal.head" : "cal.grid", [[cx - 3.5, cy - 2.5], [cx + 3.5, cy - 2.5], [cx + 3.5, cy + 2.5], [cx - 3.5, cy + 2.5]], { ...flat, opacity: 0.8 }));
          }
        }
      }
    }
    return out;
  };
  back.push(...sheet("next", 1, 1, "light", true));
  const page: Shape[] = [];
  if (o.flip < 1) {
    // the page swings out toward us, up over the binding and away behind the card
    const th = o.flip * 1.5 * Math.PI;
    const k = Math.cos(th);
    if (Math.abs(k) > 0.02) page.push(...sheet("turn", k, 1 + 0.07 * Math.sin(th), th < Math.PI / 2 ? "light" : "shade", o.flip < 0.02));
  }
  const wire: Shape[] = [];
  for (let i = 0; i < 7; i++) wire.push(shape(`${id}/wire${i}`, "cal.wire", ellipse([x0 + 10 + ((w - 20) * i) / 6, yb], 2.6, 3.4, 0, 2), flat));
  return { back, page: [...page, ...wire], yearAt: [x, yb + ph * 0.285], yearCap: ph * 0.19 };
}
