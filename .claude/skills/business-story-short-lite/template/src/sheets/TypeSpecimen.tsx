// Type specimen: the on-screen numbers of both demos in every face, with the digit cells drawn,
// so a missing rupee sign, a fallback font or uneven digits is visible at a glance.
import React from "react";
import { AbsoluteFill } from "remotion";
import { TextLine } from "../engine/type/Glyphs";
import { layout, type FaceName } from "../engine/type/layout.ts";

const W = 1800;
const H = 2300;
const NUMBERS = ["₹10,000", "₹15–20,000", "₹5,000", "1976"];
const DISPLAY: { face: FaceName; note: string }[] = [
  { face: "FrauncesDisplay", note: "Look A — Fraunces Black, optical size 144" },
  { face: "Baloo", note: "Look B — Baloo 2 ExtraBold" },
  { face: "Anton", note: "Look C — Anton" },
];

const Cells: React.FC<{ text: string; face: FaceName; size: number; x: number; y: number }> = ({ text, face, size, x, y }) => {
  const line = layout(text, face, size, { cells: true });
  return (
    <g>
      {line.glyphs.map((g, i) =>
        /[0-9]/.test(g.ch) ? (
          <rect key={i} x={x + g.x} y={y - line.capHeight - 6} width={g.w} height={line.capHeight + 12} fill="none" stroke="#c9b28a" strokeWidth={1} />
        ) : null,
      )}
      <line x1={x} x2={x + line.width} y1={y} y2={y} stroke="#c9b28a" strokeWidth={1} />
      <line x1={x} x2={x + line.width} y1={y - line.capHeight} y2={y - line.capHeight} stroke="#c9b28a" strokeWidth={1} />
    </g>
  );
};

export const TypeSpecimen: React.FC = () => {
  let y = 70;
  const rows: React.ReactNode[] = [];
  DISPLAY.forEach(({ face, note }, r) => {
    rows.push(
      <TextLine key={`n${r}`} text={note} face="InterBold" size={30} x={60} y={y} fill="#6b5d4a" />,
    );
    y += 40;
    let x = 60;
    const size = 150;
    NUMBERS.forEach((t, k) => {
      const w = layout(t, face, size, { cells: true }).width;
      if (x + w > W - 40) {
        x = 60;
        y += size * 1.05;
      }
      rows.push(<Cells key={`c${r}${k}`} text={t} face={face} size={size} x={x} y={y + size * 0.9} />);
      rows.push(<TextLine key={`t${r}${k}`} text={t} face={face} size={size} x={x} y={y + size * 0.9} fill="#1d1a22" cells />);
      x += w + 70;
    });
    y += size * 1.05 + 20;
    // the same numbers, proportional (no cells), one size down
    x = 60;
    NUMBERS.forEach((t, k) => {
      rows.push(<TextLine key={`p${r}${k}`} text={t} face={face} size={96} x={x} y={y + 80} fill="#7a2e1f" />);
      x += layout(t, face, 96).width + 60;
    });
    y += 150;
  });
  const samples: { face: FaceName; size: number; text: string; tracking?: number }[] = [
    { face: "InterBlack", size: 54, text: "NO INVESTORS.  NO FUNDING.", tracking: 0.08 },
    { face: "InterBold", size: 48, text: "AN OVEN   ·   A MACHINE THEY BUILD   ·   REVENUE", tracking: 0.1 },
    { face: "FrauncesText", size: 72, text: "Shamsulhaq Iraki" },
    { face: "FrauncesItalic", size: 72, text: "take a company public" },
    { face: "FrauncesDisplay", size: 90, text: "Ahmedabad   steel rods" },
    { face: "Baloo", size: 80, text: "No investors. No funding." },
    { face: "Anton", size: 96, text: "AHMEDABAD  1976  STEEL RODS", tracking: 0.03 },
    { face: "PlexMono", size: 44, text: "revenue  2020  ₹5,000  ₹15–20,000" },
  ];
  samples.forEach((s, k) => {
    y += s.size * 1.35;
    rows.push(<TextLine key={`s${k}`} text={s.text} face={s.face} size={s.size} x={60} y={y} fill="#1d1a22" tracking={s.tracking} />);
  });
  return (
    <AbsoluteFill style={{ background: "#f3ead8" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {rows}
      </svg>
    </AbsoluteFill>
  );
};

export const TYPE_SPECIMEN_SIZE = { width: W, height: H };
