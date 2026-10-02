// The stage: one camera, layers at different depths. A sequence is one persistent stage; nothing is cut together.
import React, { createContext, useContext } from "react";
import { layerTransform, type Frame, type View } from "./camera.ts";

interface StageCtx {
  view: View;
  frame: Frame;
  ref: { cx: number; cy: number };
}

const Ctx = createContext<StageCtx | null>(null);

export const Stage: React.FC<{ view: View; frame: Frame; refCam?: { cx: number; cy: number }; background?: string; children: React.ReactNode }> = ({ view, frame, refCam, background, children }) => {
  const ref = refCam ?? { cx: frame.width / 2, cy: frame.height / 2 };
  const roll = (view.roll * 180) / Math.PI;
  return (
    <svg width={frame.width} height={frame.height} viewBox={`0 0 ${frame.width} ${frame.height}`} style={{ position: "absolute", left: 0, top: 0, background }}>
      <Ctx.Provider value={{ view, frame, ref }}>
        <g transform={`rotate(${roll.toFixed(4)} ${frame.width / 2} ${frame.height / 2})`}>{children}</g>
      </Ctx.Provider>
    </svg>
  );
};

/** Children are drawn in stage coordinates and placed by the camera for their depth. */
export const Layer: React.FC<{ depth?: number; children: React.ReactNode }> = ({ depth = 0, children }) => {
  const c = useContext(Ctx);
  if (!c) throw new Error("Layer must be inside a Stage");
  const t = layerTransform(c.view, c.frame, depth, c.ref);
  return <g transform={`translate(${t.tx.toFixed(2)} ${t.ty.toFixed(2)}) scale(${t.s.toFixed(5)})`}>{children}</g>;
};

/** Zoom of the actors' plane, for painters that keep line weight constant on screen. */
export function useZoom(depth = 0): number {
  const c = useContext(Ctx);
  if (!c) return 1;
  return layerTransform(c.view, c.frame, depth, c.ref).s;
}
