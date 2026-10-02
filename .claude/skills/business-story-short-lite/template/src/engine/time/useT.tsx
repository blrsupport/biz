import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const Shift = createContext(0);

/** Seconds since the composition began, plus any sub-frame shift a blur sampler has asked for. */
export function useT(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps + useContext(Shift);
}

/** Renders its children as they would look `by` seconds from now (used for motion-blur samples). */
export const TimeShift: React.FC<{ by: number; children: React.ReactNode }> = ({ by, children }) => {
  const outer = useContext(Shift);
  return <Shift.Provider value={outer + by}>{children}</Shift.Provider>;
};
