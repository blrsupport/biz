// Acting verbs. A verb never sets one joint: it moves the whole body in the order a person does
// (eyes, head, chest, arm, hand), sized by weight class, and lands its contact on the time it is given.
// Beats call verbs; they do not touch channels.
import { skeleton } from "../figure/body.ts";
import { HANDS, mixHand, type HandPose } from "../figure/hand.ts";
import { FACES, type Expression, type FaceName } from "../figure/head.ts";
import { add, clamp, dot, len, mul, perp, rot, sub, unit, type Pt } from "../geom/vec.ts";
import type { Actor, Side } from "./actor.ts";
import { Blend, Track, WEIGHT, type Weight } from "./track.ts";

const SG = { L: 1, R: -1 } as const;

/** Where the eyes are at time t, stage px: on top of the spine as it is bent and leant at that moment. */
export function eyesOf(a: Actor, t: number): Pt {
  const B = a.ch.build;
  const s = a.solve(t);
  const sk = skeleton(B, s.pose);
  const f = sk.frame(0);
  const up = rot(f.up, B.neckLean * Math.sin(sk.yawC) + (s.pose.neck ?? 0));
  return add(f.p, mul(up, (B.neck + 0.3 * B.head) * a.H));
}

/**
 * Look at a point. The eyes go first, the head follows and overshoots a little, and the eyes settle back.
 * `at` is when the head arrives.
 */
export function lookAt(a: Actor, target: Pt, o: { at: number; dur?: number; amount?: number }): void {
  const dur = o.dur ?? 0.34;
  const e = eyesOf(a, o.at);
  const dx = target[0] - e[0];
  const dy = target[1] - e[1];
  const H = a.H;
  const body = a.yaw.value(o.at);
  const amount = o.amount ?? 1;
  // side-on staging: a head never turns fully away from the camera
  const yawAbs = Math.abs(dx) < 0.35 * H ? body * 0.8 : Math.sign(dx) * (0.5 + 0.75 * clamp(Math.abs(dx) / (4 * H), 0, 1));
  const turn = clamp((yawAbs - body) * amount, -1.15, 1.15);
  const pitch = clamp(Math.atan2(dy, Math.abs(dx) + 1.2 * H) * 0.9 * amount, -0.32, 0.45);
  const gx = clamp(dx / (2.5 * H), -1, 1);
  const gy = clamp(dy / (2.5 * H), -1, 1);
  a.gazeX.to(gx, { at: o.at - dur * 0.75, dur: 0.07, w: WEIGHT.eye });
  a.gazeY.to(gy, { at: o.at - dur * 0.75, dur: 0.07, w: WEIGHT.eye });
  a.blinks.push(o.at - dur * 0.55);
  a.headTurn.to(turn, { at: o.at, dur, w: WEIGHT.head });
  a.headPitch.to(pitch, { at: o.at + 0.03, dur, w: WEIGHT.head });
  // once the head faces the thing, the eyes sit nearly centred again
  a.gazeX.to(gx * 0.3, { at: o.at + 0.12, dur: 0.22, w: WEIGHT.eye });
  a.gazeY.to(gy * 0.3, { at: o.at + 0.12, dur: 0.22, w: WEIGHT.eye });
}

/**
 * Look at us. The eyes come round first, the head follows as far as `yaw` (the head's facing, 0 = straight at the
 * camera; by default part of the way round from where the body faces). `at` is when the head arrives.
 */
export function lookToCamera(a: Actor, o: { at: number; dur?: number; yaw?: number; pitch?: number }): void {
  const dur = o.dur ?? 0.36;
  const body = a.yaw.value(o.at) + a.twist.value(o.at) * 0.5;
  const yaw = o.yaw ?? body * 0.3;
  // the eyes lead toward the lens, which is on the side the head has still to turn to
  const lead = body >= 0 ? -1 : 1;
  a.gazeX.to(lead * 0.75, { at: o.at - dur * 0.75, dur: 0.07, w: WEIGHT.eye });
  a.gazeY.to(0.05, { at: o.at - dur * 0.75, dur: 0.07, w: WEIGHT.eye });
  a.blinks.push(o.at - dur * 0.55);
  a.headTurn.to(yaw - body, { at: o.at, dur, w: WEIGHT.head });
  a.headPitch.to(o.pitch ?? 0.03, { at: o.at + 0.03, dur, w: WEIGHT.head });
  a.gazeX.to(lead * 0.34, { at: o.at + 0.12, dur: 0.22, w: WEIGHT.eye });
}

/** A nod: the chin dips and comes back. `at` is the bottom of it. */
export function nod(a: Actor, o: { at: number; amount?: number; times?: number }): void {
  const k = o.amount ?? 0.16;
  const base = a.headPitch.value(o.at - 0.2);
  for (let i = 0; i < (o.times ?? 1); i++) {
    const t = o.at + i * 0.34;
    a.headPitch.to(base + k * (1 - 0.3 * i), { at: t, dur: 0.15, w: WEIGHT.head, windup: 0 });
    a.headPitch.to(base, { at: t + 0.2, dur: 0.18, w: WEIGHT.head, windup: 0 });
  }
}

/**
 * Call out: the chest lifts, the chin comes up, the mouth opens and a hand goes up beside it.
 * Use the arm on the far side of the body: the hand then shows beyond the face instead of covering it.
 * `at` is when the call starts; it is held for `hold` seconds. Returns when the hand is back down.
 */
export function callOut(a: Actor, side: Side, o: { at: number; hold?: number; then?: "drop" | "hold" }): number {
  const hold = o.hold ?? 0.8;
  const H = a.H;
  const f = a.fwd(o.at);
  const e = eyesOf(a, o.at);
  // (the wrist sits under the chin, just clear of the face, and the hand stands up from it past the mouth)
  const mouth: Pt = [e[0] + f * 0.5 * H, e[1] + 0.6 * H];
  reach(a, side, mouth, { at: o.at, dur: 0.3, hand: HANDS.cup, palm: f > 0 ? -1 : 1, look: false, body: false, bow: 0.2, layer: "back" });
  a.arms[side].wrist.to(-f * 0.42, { at: o.at, dur: 0.28, w: WEIGHT.hand });
  const bend = a.bend.value(o.at - 0.3);
  const pitch = a.headPitch.value(o.at - 0.3);
  a.bend.to(bend - f * 0.07, { at: o.at + 0.04, dur: 0.3, w: WEIGHT.body });
  a.headPitch.to(pitch - 0.1, { at: o.at + 0.02, dur: 0.24, w: WEIGHT.head });
  a.face.to(FACES.call, o.at + 0.04, 0.14);
  // the mouth works while the call lasts, then shuts
  a.face.to(FACES.talk, o.at + hold * 0.45, 0.12);
  a.face.to(FACES.call, o.at + hold * 0.7, 0.12);
  const done = o.at + hold;
  a.face.to(FACES.neutral, done + 0.16, 0.16);
  a.bend.to(bend, { at: done + 0.4, dur: 0.4, w: WEIGHT.body });
  a.headPitch.to(pitch, { at: done + 0.36, dur: 0.3, w: WEIGHT.head });
  if (o.then !== "hold") release(a, side, { at: done + 0.5, dur: 0.44 });
  return done + 0.5;
}

/** Look ahead again (the way the body faces). */
export function lookAhead(a: Actor, o: { at: number; dur?: number }): void {
  const dur = o.dur ?? 0.36;
  a.gazeX.to(0, { at: o.at - dur * 0.7, dur: 0.07, w: WEIGHT.eye });
  a.gazeY.to(0, { at: o.at - dur * 0.7, dur: 0.07, w: WEIGHT.eye });
  a.headTurn.to(-0.18 * a.yaw.value(o.at), { at: o.at, dur, w: WEIGHT.head });
  a.headPitch.to(0, { at: o.at, dur, w: WEIGHT.head });
}

export interface ReachOpts {
  /** when the hand arrives */
  at: number;
  dur?: number;
  /** hand shape on the way and on arrival */
  hand?: HandPose;
  /** hold the hand on the point (or on a moving point) after it arrives */
  pin?: boolean | ((t: number) => Pt);
  /** look at the thing first (default true) */
  look?: boolean;
  w?: Weight;
  /** arrive dead on a solid surface instead of overshooting */
  contact?: boolean;
  bow?: number;
  palm?: 1 | -1;
  /** let the chest lean into a long reach (default true) */
  body?: boolean;
  layer?: "front" | "back";
}

/** Reach a hand to a point in the world. */
export function reach(a: Actor, side: Side, target: Pt, o: ReachOpts): void {
  const B = a.ch.build;
  const H = a.H;
  const sg = SG[side];
  const arm = a.arms[side];
  const w = o.w ?? WEIGHT.hand;
  const dur = o.dur ?? 0.42;
  const wind = w.windup > 0 ? w.windupTime : 0;
  const tStart = o.at - dur - wind;
  const armLen = (B.upperArm + B.foreArm) * H;

  if (o.look !== false) lookAt(a, target, { at: tStart + 0.1, dur: 0.3 });

  // the chest leans into a long reach, and leads the hand by a few frames
  if (o.body !== false) {
    const S = a.solve(o.at).shoulders[side];
    const d = sub(target, S);
    const over = len(d) / armLen - 0.82;
    if (over > 0) {
      const dirX = Math.sign(d[0]) || 1;
      a.bend.to(a.bend.value(o.at) + dirX * clamp(over * 1.5, 0, 0.5), { at: o.at - 0.04, dur: dur * 1.05, w: WEIGHT.body });
    }
  }

  // start the path from where the hand really is (hanging, or held on a pin that may have moved since),
  // then hand over to the acting channel. The reset sits a little before the start so the path sees a hand at rest.
  const s0 = a.solve(tStart);
  const from: Pt = [(s0.wrists[side][0] - s0.shoulders[side][0]) / H, (s0.wrists[side][1] - s0.shoulders[side][1]) / H];
  const idle = arm.act.value(tStart) < 0.5;
  const pinned = arm.pin.value(tStart) > 0.01;
  if (idle || pinned) arm.rel.reset(tStart - 0.03, from);
  // (an arm that was on its way back to hanging is taken over again)
  if (idle || arm.act.end < 0.5) arm.act.to(1, { at: tStart + 0.1, dur: 0.1, w: WEIGHT.mech });
  if (pinned) arm.pin.to(0, { at: tStart + 1 / 30, dur: 1 / 30, w: WEIGHT.mech });
  const S1 = a.solve(o.at).shoulders[side];
  const to: Pt = [(target[0] - S1[0]) / H, (target[1] - S1[1]) / H];
  // keep clear of the head: it sits above and a little ahead of the shoulder
  const head: Pt = [-sg * B.shoulder * Math.cos(a.yaw.value(o.at)), -(B.neck + 0.55 * B.head)];
  arm.rel.to(to, { at: o.at, dur, w, bow: o.bow, overshoot: o.contact ? 0 : undefined, avoid: [{ c: head, r: 0.55 * B.head }] });
  if (o.hand) arm.hand.to(o.hand, o.at - dur * 0.25, dur * 0.6);
  if (o.palm) arm.palms.push({ t: tStart, palm: o.palm });
  if (o.layer) arm.layers.push({ t: tStart, layer: o.layer });
  // an elbow that a gesture had taken over goes back to finding its own side
  if (arm.swivelOn.end > 0.001) arm.swivelOn.to(0, { at: o.at, dur, w: WEIGHT.mech });
  if (o.pin) {
    const fn = typeof o.pin === "function" ? o.pin : () => target;
    // (a hand that was held on something else must have let go of it before the new hold counts)
    arm.pins.push({ t: pinned ? tStart + 1 / 30 : tStart, at: fn });
    arm.pin.to(1, { at: o.at, dur: dur * 0.5, w: WEIGHT.mech });
  }
}

/** The elbow side that leans toward `pole` for an arm reaching from S to `target` (same rule as the automatic elbow). */
function swivelToward(S: Pt, target: Pt, pole: Pt): number {
  const u = unit(sub(target, S));
  return Math.tanh(2.2 * dot(perp(u), pole)) / Math.tanh(2.2);
}

/** Take the elbow over: it eases to the side that leans toward `pole` by `at`. Any later reach or release gives it back. */
function elbowToward(a: Actor, side: Side, target: Pt, pole: Pt, o: { at: number; dur: number }): void {
  const arm = a.arms[side];
  const sw = swivelToward(a.solve(o.at).shoulders[side], target, pole);
  if (arm.swivelOn.value(o.at - o.dur) < 0.01) arm.swivel = new Track(sw);
  else arm.swivel.to(sw, { at: o.at, dur: o.dur, w: WEIGHT.mech });
  arm.swivelOn.to(1, { at: o.at, dur: o.dur, w: WEIGHT.mech });
}

/** Let the arm go back to hanging at the side. `at` is when it gets there. */
export function release(a: Actor, side: Side, o: { at: number; dur?: number }): void {
  const B = a.ch.build;
  const sg = SG[side];
  const arm = a.arms[side];
  const dur = o.dur ?? 0.5;
  const yc = a.yaw.value(o.at) + a.twist.value(o.at);
  const rest: Pt = [0.1 * Math.sin(yc) + sg * 0.07 * Math.cos(yc), (B.upperArm + B.foreArm) * 0.972];
  // a hand that was held on something leaves from where that thing is now, not from where it was first reached
  const t0 = o.at - dur;
  if (arm.pin.value(t0) > 0.01) {
    const s0 = a.solve(t0);
    const tReset = Math.min(t0, o.at - dur * 0.75 - 0.14) - 0.03;
    arm.rel.reset(tReset, [(s0.wrists[side][0] - s0.shoulders[side][0]) / a.H, (s0.wrists[side][1] - s0.shoulders[side][1]) / a.H]);
  }
  arm.pin.to(0, { at: o.at - dur * 0.75, dur: 0.14, w: WEIGHT.mech });
  arm.rel.to(rest, { at: o.at, dur, w: WEIGHT.hand, windup: 0, overshoot: 0.05 });
  arm.hand.to(HANDS.relaxed, o.at - dur * 0.3, dur * 0.6);
  arm.act.to(0, { at: o.at + 0.3, dur: 0.28, w: WEIGHT.mech });
  arm.swivelOn.to(0, { at: o.at, dur: dur, w: WEIGHT.mech });
  arm.palms.push({ t: o.at - dur * 0.4, palm: 0 });
  arm.layers.push({ t: o.at, layer: "auto" });
  arm.wrist.to(0, { at: o.at, dur, w: WEIGHT.hand });
}

/**
 * Put a hand somewhere relative to the body: [forward, outward, down] in head-heights from the shoulder.
 * For gestures that are about the person, not about a thing in the room.
 */
export function armTo(a: Actor, side: Side, relBody: readonly [number, number, number], o: ReachOpts): void {
  const sg = SG[side];
  const S = a.solve(o.at).shoulders[side];
  const yc = a.yaw.value(o.at) + a.twist.value(o.at);
  const target: Pt = [S[0] + (relBody[0] * Math.sin(yc) + sg * relBody[1] * Math.cos(yc)) * a.H, S[1] + relBody[2] * a.H];
  reach(a, side, target, { look: false, body: false, ...o });
}

/** Change expression, finishing at `at`. */
export function feel(a: Actor, face: FaceName | Expression, o: { at: number; dur?: number }): void {
  a.face.to(typeof face === "string" ? FACES[face] : face, o.at, o.dur ?? 0.2);
}

/** Shift the weight: the pelvis slides a little and the hips tilt. `amount` in head-heights, + = screen right. */
export function shiftWeight(a: Actor, amount: number, o: { at: number; dur?: number }): void {
  const dur = o.dur ?? 0.6;
  a.x.to(a.x.value(o.at - dur) + amount * a.H, { at: o.at, dur, w: WEIGHT.body, windup: 0 });
  a.hipRoll.to(-amount * 0.35 * Math.cos(a.yaw.value(o.at)), { at: o.at, dur, w: WEIGHT.body, windup: 0 });
}

/**
 * A hand that is already holding something when the take begins (an actor who walks on carrying a prop).
 * `pin` is where the grip is at time t.
 */
export function holdFromStart(a: Actor, side: Side, pin: (t: number) => Pt, o: { hand: HandPose; palm?: 1 | -1; layer?: "front" | "back"; wrist?: number }): void {
  const arm = a.arms[side];
  arm.act = new Track(1);
  arm.pin = new Track(1);
  arm.pins.push({ t: -1e9, at: pin });
  arm.hand = new Blend<HandPose>(o.hand, mixHand);
  if (o.palm) arm.palms.push({ t: -1e9, palm: o.palm });
  if (o.layer) arm.layers.push({ t: -1e9, layer: o.layer });
  if (o.wrist) arm.wrist = new Track(o.wrist);
}

/**
 * Pat something: the hand comes down on `target` at `at`, lifts and comes down again `times` in all.
 * Each landing is a contact (the hand stops dead on the surface).
 */
export function pat(a: Actor, side: Side, target: Pt, o: { at: number; times?: number; every?: number; lift?: number; palm?: 1 | -1; wrist?: number; layer?: "front" | "back" }): number {
  const times = o.times ?? 2;
  const every = o.every ?? 0.23;
  const lift = (o.lift ?? 0.11) * a.H;
  const end = o.at + (times - 1) * every;
  const bounce = (t: number): Pt => {
    if (t <= o.at || t >= end) return target;
    const u = ((t - o.at) % every) / every;
    const k = 1 - 0.35 * Math.floor((t - o.at) / every);
    return [target[0], target[1] - lift * k * Math.sin(Math.PI * u)];
  };
  reach(a, side, target, { at: o.at, dur: 0.34, hand: HANDS.flat, palm: o.palm, layer: o.layer, contact: true, pin: bounce });
  if (o.wrist !== undefined) a.arms[side].wrist.to(o.wrist, { at: o.at, dur: 0.3, w: WEIGHT.hand });
  return end;
}

/**
 * A shrug: shoulders up, elbows in at the sides, forearms up and out with the palms open to the sky, head tipped.
 * The pose is thought of in the round and then seen from where the camera is: an arm whose forearm would point
 * at the camera cannot be drawn folded, so that arm only turns its palm out at the hip.
 * `at` is the top of it; it is let go after `hold`. Returns when the arms are back at the sides.
 */
export function shrug(a: Actor, o: { at: number; hold?: number; amount?: number }): number {
  const k = o.amount ?? 1;
  const hold = o.hold ?? 0.4;
  const done = o.at + hold + 0.5;
  const yc = a.yaw.value(o.at) + a.twist.value(o.at);
  const sn = Math.sin(yc);
  const cs = Math.cos(yc);
  // [forward, outward, down] of the wrist from the shoulder, head-heights
  const full = [0.56, 0.76, 0.51] as const;
  const low = [0.3, 0.46, 1.04] as const;
  for (const side of ["L", "R"] as const) {
    const sg = SG[side];
    const arm = a.arms[side];
    const S = a.solve(o.at).shoulders[side];
    const seen = (r: readonly [number, number, number]): Pt => [r[0] * sn + sg * r[1] * cs, r[2]];
    const open = Math.hypot(...seen(full)) >= 0.74;
    const d = seen(open ? full : low);
    const out = d[0] >= 0 ? 1 : -1;
    const target: Pt = [S[0] + d[0] * a.H, S[1] + d[1] * a.H];
    reach(a, side, target, { at: o.at, dur: 0.3, hand: HANDS.open, bow: 0.22, palm: out > 0 ? -1 : 1, look: false, body: false });
    if (open) elbowToward(a, side, target, [-sg * 0.5 * cs, 1], { at: o.at, dur: 0.28 });
    arm.wrist.to(out * (open ? 0.5 : -0.9), { at: o.at, dur: 0.3, w: WEIGHT.hand });
    arm.shrug.to(0.11 * k, { at: o.at - 0.02, dur: 0.24, w: WEIGHT.body, windup: 0 });
    arm.shrug.to(0, { at: done, dur: 0.4, w: WEIGHT.body, windup: 0 });
    release(a, side, { at: done, dur: 0.48 });
  }
  const roll = a.headRoll.value(o.at);
  a.headRoll.to(roll + 0.13 * (a.fwd(o.at) > 0 ? 1 : -1), { at: o.at, dur: 0.3, w: WEIGHT.head });
  a.headRoll.to(roll, { at: done, dur: 0.4, w: WEIGHT.head });
  return done;
}

/** Fists on the hips, elbows out and back: taking stock. `at` is when the hands land. */
export function handsOnHips(a: Actor, o: { at: number; dur?: number; sides?: readonly Side[] }): void {
  const dur = o.dur ?? 0.42;
  const B = a.ch.build;
  const yc = a.yaw.value(o.at) + a.twist.value(o.at);
  const p = a.pelvis(o.at);
  for (const side of o.sides ?? (["L", "R"] as const)) {
    const sg = SG[side];
    const hip: Pt = [p[0] + (sg * (B.hip + 0.2) * Math.cos(yc) - 0.06 * Math.sin(yc)) * a.H, p[1] - 0.2 * a.H];
    // seen from the front both fists show on the hips; side-on the far arm is behind the body
    const far = sg * Math.sin(yc) > 0;
    const layer = far && Math.abs(Math.sin(yc)) > 0.8 ? "back" : "front";
    reach(a, side, hip, { at: o.at, dur, hand: HANDS.fist, look: false, body: false, contact: true, bow: 0.16, layer });
    elbowToward(a, side, hip, [sg * Math.cos(yc) - 0.9 * Math.sin(yc), 0.1], { at: o.at, dur });
  }
}

/**
 * Dust the hands off: they come together in front of the body and brush across each other, `times` in all.
 * It works at any facing, and through a turn: seen from the front the hands sit side by side, from the side one
 * above the other. `at` is the first brush. Returns the time of each brush and when the hands are done.
 * `then: "hold"` leaves the hands where they finish for the next verb to take; by default the arms drop.
 */
export function dustHands(a: Actor, o: { at: number; times?: number; every?: number; then?: "drop" | "hold" }): { hits: number[]; end: number } {
  const times = o.times ?? 2;
  const every = Math.max(0.26, o.every ?? 0.3);
  const H = a.H;
  const t0 = o.at - 0.09;
  const yawAt = (t: number) => a.yaw.value(t) + a.twist.value(t);
  const f = Math.sin(yawAt(o.at)) >= 0 ? 1 : -1;
  const near: Side = f > 0 ? "R" : "L";
  const far: Side = near === "L" ? "R" : "L";
  const s = a.solve(o.at);
  const mid: Pt = [(s.shoulders.L[0] + s.shoulders.R[0]) / 2, (s.shoulders.L[1] + s.shoulders.R[1]) / 2];
  const end = o.at + (times - 1) * every + 0.09;
  // -0.5 = drawn back and up, +0.5 = through and down; one sweep down for each brush, a quicker one back between
  const sweep = (t: number): number => {
    if (t <= t0) return -0.5;
    if (t >= end) return 0.5;
    const k = Math.floor((t - t0) / every);
    const u = (t - t0 - k * every) / every;
    const down = 0.18 / every;
    const e = (x: number) => x * x * (3 - 2 * x);
    return u < down ? -0.5 + e(u / down) : 0.5 - e((u - down) / (1 - down));
  };
  const handAt = (side: Side, k: number) => (t: number): Pt => {
    const yc = yawAt(t);
    const sn = Math.sin(yc);
    const w = sweep(t) * k;
    return [mid[0] + (sn * 0.6 + SG[side] * Math.cos(yc) * 0.11 + sn * 0.22 * w) * H, mid[1] + (0.6 + (side === near ? -0.05 : 0.06) * Math.abs(sn) + 0.24 * w) * H];
  };
  const nearAt = handAt(near, 1);
  const farAt = handAt(far, -0.7);
  // which way each hand points on screen: both forward when side-on, toward each other when seen from the front
  const yc0 = yawAt(o.at);
  const points = (side: Side) => (-SG[side] * Math.cos(yc0) + f * Math.abs(Math.sin(yc0)) * 1.2 >= 0 ? 1 : -1);
  const sideOn = Math.abs(Math.sin(yc0)) > 0.75;
  reach(a, far, farAt(t0), { at: t0, dur: 0.3, hand: HANDS.flat, palm: points(far) > 0 ? -1 : 1, layer: sideOn ? "back" : undefined, look: false, body: false, contact: true, pin: farAt });
  reach(a, near, nearAt(t0), { at: t0, dur: 0.32, hand: HANDS.flat, palm: (sideOn ? points(near) : -points(near)) > 0 ? 1 : -1, layer: "front", look: false, body: false, contact: true, pin: nearAt, bow: 0.2 });
  a.arms[near].wrist.to(points(near) * 0.3, { at: t0, dur: 0.3, w: WEIGHT.hand });
  a.arms[far].wrist.to(-points(far) * 0.3, { at: t0, dur: 0.3, w: WEIGHT.hand });
  if (o.then !== "hold") {
    // then the arms drop (a later verb may take them over before they get there)
    release(a, near, { at: end + 0.44, dur: 0.4 });
    release(a, far, { at: end + 0.5, dur: 0.4 });
  }
  const hits: number[] = [];
  for (let i = 0; i < times; i++) hits.push(o.at + i * every);
  return { hits, end };
}

/** Push the glasses up the nose with one finger. `at` is when the finger touches the bridge. */
export function pushGlasses(a: Actor, side: Side, o: { at: number; back?: (() => void) | null }): number {
  const e = eyesOf(a, o.at);
  const H = a.H;
  const arm = a.arms[side];
  // the bridge of the nose is on the front of the face, which is turned as far as the head is
  const face = Math.sin(a.solve(o.at).pose.head.yaw) * 0.36 * a.ch.build.head * H;
  const touch: Pt = [e[0] + face * 0.75, e[1] + 0.56 * H];
  reach(a, side, touch, { at: o.at, dur: 0.38, hand: HANDS.point, look: false, body: false, contact: true, bow: 0.16, layer: "front" });
  // the push itself: a short nudge upward, then a beat with the finger resting there
  reach(a, side, [touch[0], touch[1] - 0.07 * H], { at: o.at + 0.14, dur: 0.12, hand: HANDS.point, look: false, body: false, contact: true, bow: 0 });
  a.blinks.push(o.at + 0.1);
  a.headPitch.to(a.headPitch.value(o.at) + 0.06, { at: o.at + 0.16, dur: 0.16, w: WEIGHT.head });
  arm.wrist.to(0, { at: o.at, dur: 0.3, w: WEIGHT.hand });
  return o.at + 0.14;
}

/** Crouch: lower the pelvis by `drop` head-heights and bend the back by `bend` radians toward the facing side. */
export function crouch(a: Actor, drop: number, bend: number, o: { at: number; dur?: number; w?: Weight }): void {
  const dur = o.dur ?? 0.5;
  const f = a.fwd(o.at);
  a.drop.to(drop, { at: o.at, dur, w: o.w ?? WEIGHT.body });
  a.bend.to(f * bend, { at: o.at + 0.03, dur, w: o.w ?? WEIGHT.body });
  a.lean.to(f * bend * 0.25, { at: o.at, dur, w: o.w ?? WEIGHT.body });
}
