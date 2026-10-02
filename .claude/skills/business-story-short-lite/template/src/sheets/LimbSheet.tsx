// Limb sheet: an arm reaching in twelve directions at three distances, the elbow swivel swept through its range,
// and the hand poses. If an elbow flips, a crease folds or a finger tangles, it shows here before any animation.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Paint, type PaintCtx } from "../engine/draw/Paint";
import type { Shape } from "../engine/draw/shape.ts";
import { HANDS, buildHand, type HandName } from "../engine/figure/hand.ts";
import { poleSwivel } from "../engine/figure/ik.ts";
import { buildArm } from "../engine/figure/limbs.ts";
import { add, fromAngle, type Pt } from "../engine/geom/vec.ts";
import { LOOKS, type LookId } from "../engine/look/looks.ts";
import { TextLine } from "../engine/type/Glyphs";
import { DEMO_PALETTE, LIGHT_MORNING } from "./ToneSheet";

const W = 1900;
const H = 1560;
const HEAD = 62;

function arm(id: string, S: Pt, target: Pt, swivel: number, sleeve: number, mat: string): Shape[] {
  return buildArm({
    id,
    S,
    target,
    upper: HEAD,
    fore: HEAD * 0.9,
    swivel,
    half: [HEAD * 0.2, HEAD * 0.155, HEAD * 0.115],
    sleeve,
    matSleeve: mat,
    matSkin: "skin.rahul",
    hand: { pose: HANDS.relaxed, bend: 0, palmSide: 1, size: HEAD * 0.55 },
  }).shapes;
}

const Reaches: React.FC<{ look: LookId; y: number }> = ({ look, y }) => {
  const ctx: PaintCtx = { look: LOOKS[look], light: LIGHT_MORNING, palette: DEMO_PALETTE, zoom: 1 };
  const shapes: Shape[] = [];
  const L = HEAD * 1.9;
  [0.45, 0.8, 1.08].forEach((frac, row) => {
    for (let k = 0; k < 12; k++) {
      const S: Pt = [90 + k * 152, y + 130 + row * 250];
      const target = add(S, fromAngle((k * 30 - 90) * (Math.PI / 180), L * frac));
      const sw = poleSwivel(S, target, [0.3, 0.95]);
      shapes.push(...arm(`r${look}${row}_${k}`, S, target, sw, row === 2 ? 2 : 1.2, row === 2 ? "kurta" : "shirt"));
    }
  });
  return (
    <g>
      <TextLine text={`Look ${look}: reach in 12 directions at 45 %, 80 % and 108 % of arm length (elbow leans down and out, never flips)`} face="InterBold" size={24} x={30} y={y} fill="#3a3028" />
      <Paint shapes={shapes} ctx={ctx} uid={`reach${look}`} />
    </g>
  );
};

const Swivels: React.FC<{ y: number }> = ({ y }) => {
  const ctx: PaintCtx = { look: LOOKS.A, light: LIGHT_MORNING, palette: DEMO_PALETTE, zoom: 1 };
  const shapes: Shape[] = [];
  const n = 9;
  for (let k = 0; k < n; k++) {
    const S: Pt = [110 + k * 200, y + 70];
    const target: Pt = [S[0] + 40, S[1] + 62];
    shapes.push(...arm(`s${k}`, S, target, -1 + (2 * k) / (n - 1), 1.2, "shirt"));
  }
  return (
    <g>
      <TextLine text="Elbow swivel from -1 to +1 with the hand held still (the middle one is the elbow toward camera)" face="InterBold" size={24} x={30} y={y} fill="#3a3028" />
      <Paint shapes={shapes} ctx={ctx} uid="swivel" />
    </g>
  );
};

const Hands: React.FC<{ look: LookId; y: number; palmSide: 1 | -1 }> = ({ look, y, palmSide }) => {
  const ctx: PaintCtx = { look: LOOKS[look], light: LIGHT_MORNING, palette: DEMO_PALETTE, zoom: 1 };
  const names = Object.keys(HANDS) as HandName[];
  const shapes: Shape[] = [];
  names.forEach((n, i) => {
    const hand = buildHand({ id: `h${look}${palmSide}${i}`, mat: "skin.rahul", wrist: [70 + i * 186, y + 80], angle: 0, size: 120, pose: HANDS[n], palmSide, girth: look === "B" ? 1.12 : 1 });
    shapes.push(...hand.shapes);
  });
  return (
    <g>
      <Paint shapes={shapes} ctx={ctx} uid={`hands${look}${palmSide}`} />
      {names.map((n, i) => (
        <TextLine key={n} text={n} face="InterBold" size={20} x={70 + i * 186} y={y + 190} fill="#3a3028" />
      ))}
    </g>
  );
};

export const LimbSheet: React.FC = () => (
  <AbsoluteFill style={{ background: "#e9dcc3" }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Reaches look="A" y={40} />
      <Swivels y={830} />
      <TextLine text="Hand poses (palm down, palm up) in look A, then look B" face="InterBold" size={24} x={30} y={1010} fill="#3a3028" />
      <Hands look="A" y={1010} palmSide={1} />
      <Hands look="A" y={1190} palmSide={-1} />
      <Hands look="B" y={1370} palmSide={1} />
    </svg>
  </AbsoluteFill>
);

export const LIMB_SHEET_SIZE = { width: W, height: H };
