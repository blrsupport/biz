// A prop that people handle. It is either where its own path puts it (resting, being lifted or set down)
// or where its holder carries it; `held` blends between the two, so picking up and putting down never jump.
import { lerpPt, rot, type Pt } from "../geom/vec.ts";
import { Path2, Track } from "./track.ts";

export class Prop {
  /** centre of the prop, stage px */
  pos: Path2;
  /** tilt, radians */
  tilt = new Track(0);
  /** 0 = on its own path, 1 = carried */
  held = new Track(0);
  /** where the holder has it, when carried */
  carry: ((t: number) => Pt) | null = null;
  /** grip points in the prop's own frame (px from its centre) */
  grips: Record<string, Pt>;

  constructor(at: Pt, grips: Record<string, Pt> = {}) {
    this.pos = new Path2(at);
    this.grips = grips;
  }

  at(t: number): Pt {
    const own = this.pos.value(t);
    const h = this.held.value(t);
    if (h <= 0 || !this.carry) return own;
    return lerpPt(own, this.carry(t), Math.min(1, h));
  }

  /** A grip point on screen at time t. */
  grip(name: string, t: number): Pt {
    const g = this.grips[name];
    if (!g) throw new Error(`prop has no grip "${name}"`);
    const c = this.at(t);
    const r = rot(g, this.tilt.value(t));
    return [c[0] + r[0], c[1] + r[1]];
  }
}
