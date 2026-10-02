// Tone and shading sheet: the same three objects (ball, bent limb, box) painted by each look under one light,
// plus the computed tones of every material. Nothing here is hand-coloured: shade and light come from the recipe.
import React from "react";
import { AbsoluteFill } from "remotion";
import { GroundShadow, Paint, type PaintCtx } from "../engine/draw/Paint";
import { shape, type Palette, type Shape } from "../engine/draw/shape.ts";
import { ellipse, limb, roundedPoly } from "../engine/geom/outline.ts";
import { unit, type Pt } from "../engine/geom/vec.ts";
import { tonesOf } from "../engine/look/color.ts";
import { LIGHT_MORNING } from "../assets/lights.ts";
import { LOOKS, type LookId } from "../engine/look/looks.ts";
import { TextLine } from "../engine/type/Glyphs";

const W = 1920;
const H = 1500;

export const DEMO_PALETTE: Palette = {
  "skin.rahul": "#c98a5e",
  "skin.vikas": "#b47850",
  "skin.iraki": "#b9794c",
  kurta: "#d9a233",
  shirt: "#3f6fa3",
  trousers: "#3b3a48",
  pajama: "#e8dcc4",
  hair: "#231c1e",
  waistcoat: "#2f5d46",
  cap: "#f2ecdf",
  steel: "#9aa3ad",
  oven: "#c7cad0",
  press: "#b5412f",
  wood: "#8a5a3a",
  jute: "#b99a6b",
  rust: "#9a4a2b",
  wall: "#e6d3b1",
  dado: "#7fa39a",
  floor: "#a2948a",
};

export { LIGHT_MORNING };

function objects(ox: number, oy: number): { all: Shape[]; grounded: Shape[]; groundY: number } {
  const groundY = oy + 330;
  // ball with a smaller ball in front that throws a shadow onto it
  const big = ellipse([ox + 150, groundY - 120], 120, 120);
  const small = ellipse([ox + 60, groundY - 70], 55, 55);
  // a bent arm: sleeve to just past the elbow, then skin, with a simple mitt
  const L = limb({ S: [ox + 300, groundY - 300], E: [ox + 385, groundY - 150], T: [ox + 290, groundY - 40], h0: 40, h1: 32, h2: 23, point: 0.35 });
  const sleeve = L.section(0, 1.25, { bulgeB: 5 });
  const fore = L.section(1.15, 2);
  const hand = ellipse([ox + 276, groundY - 28], 32, 27, 0.6);
  // a box: front, top and side faces
  const bx = ox + 435;
  const bw = 110;
  const bd = 45;
  const corners: Pt[] = [
    [bx, groundY - 190],
    [bx + bw, groundY - 190],
    [bx + bw, groundY],
    [bx, groundY],
  ];
  const front = roundedPoly(corners.map((p) => ({ p, r: 6 })));
  const top: Pt[] = [
    [bx, groundY - 190],
    [bx + bd, groundY - 190 - bd * 0.8],
    [bx + bw + bd, groundY - 190 - bd * 0.8],
    [bx + bw, groundY - 190],
  ];
  const side: Pt[] = [
    [bx + bw, groundY - 190],
    [bx + bw + bd, groundY - 190 - bd * 0.8],
    [bx + bw + bd, groundY - bd * 0.8],
    [bx + bw, groundY],
  ];
  const all: Shape[] = [
    shape("big", "kurta", big, { depth: 46, casts: [{ pts: small, reach: 26 }] }),
    shape("small", "press", small, { depth: 22 }),
    shape("fore", "skin.rahul", fore, { depth: 15 }),
    shape("hand", "skin.rahul", hand, { depth: 12 }),
    shape("sleeve", "shirt", sleeve, { depth: 20 }),
    shape("box.side", "oven", side, { form: "plane", facing: [1, 0] }),
    shape("box.top", "oven", top, { form: "plane", facing: [0, -1] }),
    shape("box.front", "oven", front, { form: "plane", facing: [0, 0] }),
  ];
  return { all, grounded: all, groundY };
}

const Column: React.FC<{ look: LookId; x: number }> = ({ look, x }) => {
  const ctx: PaintCtx = { look: LOOKS[look], light: LIGHT_MORNING, palette: DEMO_PALETTE, zoom: 1 };
  const wall = tonesOf(DEMO_PALETTE.wall, LIGHT_MORNING, ctx.look.recipe);
  const floor = tonesOf(DEMO_PALETTE.floor, LIGHT_MORNING, ctx.look.recipe);
  const o = objects(x + 40, 150);
  return (
    <g>
      <rect x={x} y={120} width={W / 3 - 20} height={380} fill={look === "C" ? "#d9c7a3" : wall.base} />
      <rect x={x} y={120 + 380 - 40} width={W / 3 - 20} height={120} fill={look === "C" ? "#b9a988" : floor.base} />
      <GroundShadow shapes={o.grounded} groundY={o.groundY} ctx={ctx} drop={0.12} />
      <Paint shapes={o.all} ctx={ctx} uid={`tone${look}`} />
      <TextLine text={`${look} — ${LOOKS[look].name}`} face="InterBold" size={30} x={x + 6} y={100} fill="#3a3028" />
    </g>
  );
};

const Swatches: React.FC = () => {
  const names = Object.keys(DEMO_PALETTE);
  const rows: React.ReactNode[] = [];
  (["A", "B", "C"] as LookId[]).forEach((look, li) => {
    const y0 = 700 + li * 250;
    rows.push(<TextLine key={`l${look}`} text={`Tones in look ${look}: light · base · shade · deep`} face="InterBold" size={24} x={40} y={y0 - 14} fill="#3a3028" />);
    names.forEach((n, i) => {
      const t = tonesOf(DEMO_PALETTE[n], LIGHT_MORNING, LOOKS[look].recipe);
      const x = 40 + i * 97;
      rows.push(
        <g key={`${look}${n}`}>
          <rect x={x} y={y0} width={88} height={40} fill={t.light} />
          <rect x={x} y={y0 + 40} width={88} height={60} fill={t.base} />
          <rect x={x} y={y0 + 100} width={88} height={40} fill={t.shade} />
          <rect x={x} y={y0 + 140} width={88} height={26} fill={t.deep} />
          <TextLine text={n.replace("skin.", "s.")} face="InterBold" size={15} x={x} y={y0 + 186} fill="#3a3028" />
        </g>,
      );
    });
  });
  return <>{rows}</>;
};

export const ToneSheet: React.FC = () => (
  <AbsoluteFill style={{ background: "#f3ead8" }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <TextLine text="Shading primitives under one light (morning, from the left)" face="FrauncesText" size={40} x={40} y={52} fill="#1d1a22" />
      <Column look="A" x={20} />
      <Column look="B" x={20 + W / 3} />
      <Column look="C" x={20 + (2 * W) / 3} />
      <Swatches />
    </svg>
  </AbsoluteFill>
);

export const TONE_SHEET_SIZE = { width: W, height: H };
