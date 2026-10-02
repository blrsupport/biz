// An actor: a character plus the channels that move it. `pose(t)` is a pure function of time.
//
// Layers, bottom to top:
//   1. locomotion and idle life: feet, pelvis, breath, weight shift, arm swing, blinks
//   2. acting: channels moved by verbs (lean, turn, head, arms along bowed paths, hands, face)
//   3. contacts: a hand pinned to a point in the world stays on it whatever the body does
import type { ArmPose, FigurePose } from "../figure/body.ts";
import { hipHeight, skeleton, type Character } from "../figure/body.ts";
import { HANDS, mixHand, type HandPose } from "../figure/hand.ts";
import { FACES, mixFace, type Expression } from "../figure/head.ts";
import { footShape } from "../figure/limbs.ts";
import { add, clamp, len, lerpPt, mix, sub, unit, type Pt } from "../geom/vec.ts";
import { Foot, planWalk, type FootState, type Gait } from "./feet.ts";
import { Blend, hash, Path2, Track, wander, WEIGHT } from "./track.ts";

export type Side = "L" | "R";
const SG = { L: 1, R: -1 } as const;

export interface ActorInit {
  ch: Character;
  /** px per head-height */
  scale: number;
  /** the ground under the feet, stage px */
  groundY: number;
  x: number;
  /** which way the body faces, radians: 0 = at the camera, + = screen right */
  yaw: number;
  /** separates this actor's idle life from the others' */
  seed?: number;
  /** how lively the idle is (0 = statue, 1 = normal) */
  life?: number;
}

export class ArmCh {
  /** hand position while acting: head-heights from the shoulder, screen-aligned (x right, y down) */
  rel: Path2;
  /** 0 = the arm hangs and swings with the body, 1 = it follows `rel` */
  act = new Track(0);
  /** 0..1: how firmly the hand is held on its pin */
  pin = new Track(0);
  pins: { t: number; at: (t: number) => Pt }[] = [];
  swivel = new Track(0);
  /** 0 = automatic elbow, 1 = `swivel` decides */
  swivelOn = new Track(0);
  hand: Blend<HandPose> = new Blend<HandPose>(HANDS.relaxed, mixHand);
  wrist = new Track(0);
  shrug = new Track(0);
  palms: { t: number; palm: 1 | -1 | 0 }[] = [];
  layers: { t: number; layer: "front" | "back" | "auto" }[] = [];

  constructor(rest: Pt) {
    this.rel = new Path2(rest);
  }

  pinPoint(t: number): Pt | null {
    let cur: ((t: number) => Pt) | null = null;
    for (const p of this.pins) if (t >= p.t) cur = p.at;
    return cur ? cur(t) : null;
  }
}

export interface Solved {
  pose: FigurePose;
  feet: { L: FootState; R: FootState };
  /** ankle positions, stage px */
  ankles: { L: Pt; R: Pt };
  /** shoulder positions before the arms pull on them, stage px */
  shoulders: { L: Pt; R: Pt };
  /** wrist targets, stage px */
  wrists: { L: Pt; R: Pt };
  /** +1 when the body faces screen right */
  fwd: 1 | -1;
}

interface Base {
  x: number;
  yaw0: number;
  fwd: 1 | -1;
  fL: FootState;
  fR: FootState;
  /** pelvis height before smoothing */
  y: number;
}

export class Actor {
  readonly ch: Character;
  readonly H: number;
  readonly groundY: number;
  readonly seed: number;
  life: number;

  x: Track;
  /** pelvis dropped by this many head-heights (a crouch) */
  drop = new Track(0);
  yaw: Track;
  twist = new Track(0);
  lean = new Track(0);
  bend = new Track(0);
  hipRoll = new Track(0);
  shRoll = new Track(0);
  /** head yaw on top of the body's, pitch (+ = chin down) and tilt */
  headTurn: Track;
  headPitch = new Track(0);
  headRoll = new Track(0);
  neck = new Track(0);
  gazeX = new Track(0);
  gazeY = new Track(0);
  face: Blend<Expression> = new Blend<Expression>(FACES.neutral, mixFace);
  arms: { L: ArmCh; R: ArmCh };
  feet: { L: Foot; R: Foot };
  gait: Gait;
  /** extra blinks on top of the idle ones */
  blinks: number[] = [];
  private readonly standH: number;
  private readonly legMax: number;

  constructor(o: ActorInit) {
    this.ch = o.ch;
    this.H = o.scale;
    this.groundY = o.groundY;
    this.seed = o.seed ?? 1;
    this.life = o.life ?? 1;
    const B = o.ch.build;
    const H = o.scale;
    this.x = new Track(o.x);
    this.yaw = new Track(o.yaw);
    this.headTurn = new Track(-0.18 * o.yaw);
    this.arms = { L: new ArmCh([0, 1.8]), R: new ArmCh([0, 1.8]) };
    this.feet = { L: new Foot(o.x + this.stance(1, o.yaw)), R: new Foot(o.x + this.stance(-1, o.yaw)) };
    this.standH = hipHeight(B) * H;
    this.legMax = (B.thigh + B.shin) * H * 0.9985;
    this.gait = { swingH: 0.24 * H, toeOff: 0.6, strike: 0.3, rollT: 0.11, offT: 0.22, toe: B.foot * 0.55 * H, heel: B.foot * 0.2 * H, ankle: B.ankle * H };
  }

  /** Where a foot stands relative to the pelvis for a given facing, px. */
  stance(sg: 1 | -1, yaw: number): number {
    const B = this.ch.build;
    return (sg * (B.hip * 0.95 * Math.cos(yaw) - 0.1 * Math.sin(yaw)) - 0.1 * Math.sin(yaw)) * this.H;
  }

  /** Which way the body faces on screen at time t. */
  fwd(t: number): 1 | -1 {
    return Math.sin(this.yaw.value(t)) >= 0 ? 1 : -1;
  }

  /** The foot's facing as the leg builder wants it (-1..1). */
  private footFace(sg: 1 | -1, yaw: number): number {
    return Math.sin(yaw + sg * 0.22);
  }

  footState(side: Side, t: number): FootState {
    const sg = SG[side];
    const fs = footShape(this.ch.build.foot * this.H, this.footFace(sg, this.yaw.value(t)));
    return this.feet[side].state(t, { ...this.gait, toe: fs.toe, heel: fs.heel }, fs.sgn);
  }

  /** Blink amount 0..1 at t: idle blinks every few seconds plus any that were asked for. */
  private blink(t: number): number {
    let b = 0;
    const bump = (c: number) => {
      const u = Math.abs(t - c) / 0.075;
      if (u < 1) b = Math.max(b, 1 - u * u * (3 - 2 * u));
    };
    for (const c of this.blinks) bump(c);
    if (this.life > 0) {
      // one blink in each 3.4 s window, at a place the seed decides
      const period = 3.4;
      const i = Math.floor(t / period);
      for (const k of [i - 1, i]) bump(k * period + 0.4 + hash(k * 7.13 + this.seed * 3.7) * (period - 0.8));
    }
    return b;
  }

  /** Feet and pelvis at time t: the pelvis is as high as standing allows and never higher than either leg can reach. */
  private base(t: number): Base {
    const B = this.ch.build;
    const H = this.H;
    const yaw0 = this.yaw.value(t);
    const fwd: 1 | -1 = Math.sin(yaw0) >= 0 ? 1 : -1;
    const fL = this.footState("L", t);
    const fR = this.footState("R", t);
    const sway = wander(t * 0.16, this.seed) * this.life;
    const x = this.x.value(t) + sway * 0.035 * H * Math.cos(yaw0);
    const want = this.groundY - this.standH + this.drop.value(t) * H;
    const limit = (f: FootState, sg: 1 | -1) => {
      const dx = f.x - (x + sg * B.hip * Math.cos(yaw0) * H);
      return this.groundY - B.ankle * H - f.lift - Math.sqrt(Math.max(1, this.legMax * this.legMax - dx * dx));
    };
    // soft maximum of the three (y grows downward, so the lowest pelvis wins)
    const k = 0.05 * H;
    const cands = [want, limit(fL, 1), limit(fR, -1)];
    const m = Math.max(...cands);
    const y = m + k * Math.log(cands.reduce((s, c) => s + Math.exp((c - m) / k), 0)) - k * Math.log(1 + 2 * Math.exp(-3));
    return { x, yaw0, fwd, fL, fR, y };
  }

  /**
   * The pelvis at time t, stage px, from the feet and the body channels alone (no hands involved),
   * so a carried prop can hang off it without going round in a circle.
   */
  pelvis(t: number): Pt {
    const b0 = this.base(t);
    return [b0.x, this.smoothY(t, b0)];
  }

  /** The pelvis height averaged over a few frames, which rounds the corner where one leg takes over from the other. */
  private smoothY(t: number, b0: Base): number {
    let y = b0.y * 6;
    y += (this.base(t - 0.033).y + this.base(t + 0.033).y) * 4;
    y += this.base(t - 0.066).y + this.base(t + 0.066).y;
    return y / 16;
  }

  /** The pose at time t, with the working that props and checks need. */
  solve(t: number): Solved {
    const B = this.ch.build;
    const H = this.H;
    const life = this.life;
    const sd = this.seed;
    const b0 = this.base(t);
    const { x, yaw0, fwd, fL, fR } = b0;
    const y = this.smoothY(t, b0);
    const side = Math.abs(Math.sin(yaw0));
    const breath = Math.sin(2 * Math.PI * 0.26 * t + sd * 1.7);
    const sway = wander(t * 0.16, sd) * life;
    const vx = this.x.state(t).v;

    // ---- the walk shows in the hips: they turn toward the leading leg and the chest turns against them
    const spread = clamp(((fL.x - fR.x) * fwd) / (1.5 * H), -1.2, 1.2);
    const moving = clamp(Math.abs(vx) / (2.2 * H), 0, 1);
    const yaw = yaw0 - spread * 0.1 * side * moving;
    const twist = this.twist.value(t) + spread * 0.17 * side * moving;
    const lean = this.lean.value(t) + side * 0.05 * clamp(vx / (3.2 * H), -1, 1);
    let bend = this.bend.value(t) + breath * 0.008 * life;
    const hipRoll = this.hipRoll.value(t) + sway * 0.02 * Math.cos(yaw0) + ((fR.lift - fL.lift) / (H * 9)) * Math.cos(yaw0);
    const ankleY = (f: FootState) => this.groundY - B.ankle * H - f.lift;
    const hipX = (sg: 1 | -1) => x + sg * B.hip * Math.cos(yaw) * H;

    // ---- arms: rest pose, acting pose, pinned contact
    const pose0 = { at: [x, y] as Pt, scale: H, yaw, twist, lean, bend, hipRoll, shoulderRoll: this.shRoll.value(t) - hipRoll * 0.6 };
    let sk = skeleton(B, pose0);
    // a pinned hand that is nearly out of reach pulls the chest (and if need be the knees) toward it
    const armLen = (B.upperArm + B.foreArm) * H;
    let drop2 = 0;
    for (const key of ["L", "R"] as const) {
      const a = this.arms[key];
      const pin = clamp(a.pin.value(t), 0, 1);
      if (pin <= 0) continue;
      const p = a.pinPoint(t);
      if (!p) continue;
      const d = sub(p, sk.shoulder(SG[key]));
      const over = (len(d) - 0.9 * armLen) * pin;
      if (over > 0) {
        const u = unit(d);
        bend += clamp((u[0] * over) / (0.6 * B.torso * H), -0.45, 0.45);
        drop2 = Math.max(drop2, clamp((u[1] * over) / H, 0, 0.5) * 0.7);
      }
    }
    const pose1 = { ...pose0, bend, at: [x, y + drop2 * H] as Pt };
    if (bend !== pose0.bend || drop2 > 0) sk = skeleton(B, pose1);
    const wristOf = (key: Side): Pt => {
      const sg = SG[key];
      const a = this.arms[key];
      const S = sk.shoulder(sg);
      const f = key === "L" ? fL : fR;
      // the arm swings against the leg on its own side
      const swing = clamp((-(f.x - hipX(sg)) * fwd) / H, -1.1, 1.1) * 0.62 * moving;
      const yc = sk.yawC;
      const down = (B.upperArm + B.foreArm) * (0.972 - 0.05 * Math.abs(swing));
      const rest: Pt = [(0.1 + swing) * Math.sin(yc) + sg * 0.07 * Math.cos(yc) + wander(t * 0.21, sd + 11 + sg) * 0.015 * life, down];
      const act = clamp(a.act.value(t), 0, 1);
      const relPt = act > 0 ? lerpPt(rest, a.rel.value(t), act) : rest;
      let w = add(S, [relPt[0] * H, relPt[1] * H]);
      const pin = clamp(a.pin.value(t), 0, 1);
      if (pin > 0) {
        const p = a.pinPoint(t);
        if (p) w = lerpPt(w, p, pin);
      }
      return w;
    };
    const wL = wristOf("L");
    const wR = wristOf("R");

    const armPose = (key: Side, w: Pt): ArmPose => {
      const a = this.arms[key];
      let palm: 1 | -1 | 0 = 0;
      for (const p of a.palms) if (t >= p.t) palm = p.palm;
      let layer: "front" | "back" | "auto" = "auto";
      for (const p of a.layers) if (t >= p.t) layer = p.layer;
      const on = clamp(a.swivelOn.value(t), 0, 1);
      const out: ArmPose = { to: w, world: true, hand: a.hand.value(t), wrist: a.wrist.value(t), shrug: a.shrug.value(t) + (0.5 + 0.5 * breath) * 0.012 * life };
      if (palm !== 0) out.palm = palm;
      if (layer !== "auto") out.layer = layer;
      if (on > 0.001) out.swivelMix = { value: a.swivel.value(t), amount: on };
      return out;
    };

    // ---- head and face
    const blink = this.blink(t);
    const e = this.face.value(t);
    const dart = life > 0 ? (hash(Math.floor(t / 1.7 + sd) * 3.3) - 0.5) * 0.5 : 0;
    const pose: FigurePose = {
      ...pose1,
      armL: armPose("L", wL),
      armR: armPose("R", wR),
      legL: { to: [fL.x, ankleY(fL)], world: true, pitch: fL.pitch, face: this.footFace(1, yaw0) },
      legR: { to: [fR.x, ankleY(fR)], world: true, pitch: fR.pitch, face: this.footFace(-1, yaw0) },
      neck: this.neck.value(t),
      head: {
        yaw: yaw + twist * 0.5 + this.headTurn.value(t) + wander(t * 0.13, sd + 5) * 0.035 * life,
        pitch: this.headPitch.value(t) + wander(t * 0.17, sd + 6) * 0.02 * life - breath * 0.004 * life,
        roll: this.headRoll.value(t) + wander(t * 0.11, sd + 7) * 0.015 * life,
        gaze: [clamp(this.gazeX.value(t) + dart * 0.5, -1, 1), clamp(this.gazeY.value(t), -1, 1)],
        face: { ...e, lidU: e.lidU * (1 - 0.93 * blink), lidL: mix(e.lidL, 0.3, blink) },
      },
    };
    return {
      pose,
      feet: { L: fL, R: fR },
      ankles: { L: [fL.x, ankleY(fL)], R: [fR.x, ankleY(fR)] },
      shoulders: { L: sk.shoulder(1), R: sk.shoulder(-1) },
      wrists: { L: wL, R: wR },
      fwd,
    };
  }

  pose(t: number): FigurePose {
    return this.solve(t).pose;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Locomotion
  // -------------------------------------------------------------------------------------------------------------

  /**
   * Walk to x. Give `arrive` (when the body comes to rest) or `start`.
   * `pace` is steps per second; `step` is the step length in head-heights for a leg of average length.
   */
  walkTo(x1: number, o: { arrive?: number; start?: number; pace?: number; step?: number; face?: number }): { start: number; arrive: number; steps: number } {
    const H = this.H;
    const B = this.ch.build;
    const pace = o.pace ?? 1.9;
    const stepLen = ((o.step ?? 1.45) * H * (B.thigh + B.shin)) / 2.5;
    const speed = stepLen * pace;
    const ramp = 0.42;
    const tGuess = o.start ?? (o.arrive as number) - 1;
    const D = Math.abs(x1 - this.x.value(tGuess));
    const dir = x1 >= this.x.value(tGuess) ? 1 : -1;
    const T = D >= speed * ramp ? ramp + D / speed : 2 * (D / Math.max(D / ramp, speed * 0.45));
    const tA = o.start ?? (o.arrive as number) - T;
    // face the way we go, a little open to the camera
    const yawGo = o.face ?? dir * 1.22;
    if (Math.abs(this.yaw.value(tA) - yawGo) > 0.12) this.yaw.to(yawGo, { at: tA + 0.4, dur: 0.5, w: WEIGHT.body, overshoot: 0, windup: 0 });
    const tB = this.x.cruise(x1, { start: tA, speed, ramp });
    const end = { L: x1 + this.stance(1, yawGo), R: x1 + this.stance(-1, yawGo) };
    const plan = planWalk(this.feet, (t) => this.x.value(t), tA, tB, end, stepLen);
    return { start: tA, arrive: tB, steps: plan.steps };
  }

  /** Turn the body to face `yaw`, re-planting the feet. The turn is finished at `at`. */
  turnTo(yaw: number, o: { at: number; dur?: number }): this {
    const dur = o.dur ?? 0.7;
    const t0 = o.at - dur;
    const from = this.yaw.value(t0);
    this.yaw.to(yaw, { at: o.at, dur, w: WEIGHT.body, windup: 0.02 });
    const x = this.x.value(t0);
    // two small steps: the foot on the side we turn toward goes first
    const first: Side = yaw > from ? "L" : "R";
    const second: Side = first === "L" ? "R" : "L";
    this.feet[first].step(t0 + 0.06, t0 + 0.06 + dur * 0.42, x + this.stance(SG[first], yaw));
    this.feet[second].step(t0 + dur * 0.5, t0 + dur * 0.95, x + this.stance(SG[second], yaw));
    return this;
  }
}
