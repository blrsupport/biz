// The numbers the dry run holds a film to. They are the levels the two approved demo clips reach, so a film that
// passes here is at least as careful as those. Change one only with a reason, and say so in the film's STATE.md.

export const LIMITS = {
  /** Where type may sit on a 1080x1920 Short: clear of the title, the caption and the buttons at the right. */
  safe: { x0: 72, x1: 900, y0: 260, y1: 1440 },
  /** Least cap height on screen, px: an amount or a year; a name or a phrase; a small caps label. */
  cap: { number: 90, words: 70, label: 24 },
  /** Least gap between a piece of type and anyone's head, px on screen. */
  headGap: 16,
  /** A piece of type lands no earlier than this before its words begin, and no later than this after they end, seconds. */
  early: 0.1,
  late: 0.15,
  /** Least contrast (WCAG ratio) between type and what it stands against: body type, and small accents. */
  /**
   * `seen`: the same contrast, measured against what the display list really draws behind the type, may fall to this
   * share of the limit before it fails (the measurement takes a shaded surface as its base tone, so it is given some slack).
   * `ground`: two points behind one piece of type that differ by more than this ratio mean it straddles two surfaces.
   */
  contrast: { ink: 4.5, accent: 3.0, seen: 0.9, ground: 1.6 },
  /** Sharpest elbow or knee, degrees; most stretch of a limb beyond its length; a pinned hand's distance from its pin, px. */
  joint: 35,
  stretch: 1.06,
  pin: 3,
  /** A planted foot may not move more than this between two frames, px. */
  footSlip: 1.5,
  /** Nothing moves further than this between two frames while it stays inside the frame, px on screen. */
  jump: 170,
  /** A thing counts as popping in when it appears inside the frame larger than this (px2) and more solid than this. */
  pop: { area: 900, opacity: 0.4 },
  /** SVG paths in one frame. The yard of the second demo peaks near 1,600 and renders in about 0.13 s a frame. */
  paths: 2400,
  /** When someone is in view, the largest figure is at least this share of the frame's height. */
  subject: 0.22,
  /**
   * Acting. `move`: a figure counts as moving in a frame when a hand, the head or the hips travel more than this
   * share of its height (breath and idle sway stay below it). `still`: a figure in view that only breathes for longer
   * than this many seconds is worth a look (the longest in the two example films is 3.1 s, a man watching the sun go down).
   */
  acting: { move: 0.0025, still: 4 },
  /** A stretch with no marked moment (cue, piece of type, named mark) longer than this is worth a second look, seconds. */
  quiet: 2.5,
} as const;
