// Parts shared by every scene: the top line and the narration headline.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { meta } from "./data";
import { C, F } from "./theme";
import { NARRATION, type PhaseId } from "./timeline";

export const SIDE = 100;

export const TopBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 62,
      left: SIDE,
      right: SIDE,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      fontFamily: F.mono,
      fontSize: 27,
    }}
  >
    <span style={{ color: C.model, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      Inside the Loop · chapter 1
    </span>
    <span style={{ color: C.ink3, fontWeight: 500 }}>
      real session · {meta.model} · Claude Code {meta.ccv} · run {meta.run} of {meta.runs}
    </span>
  </div>
);

type Phase = { id: PhaseId; from: number; to: number };

export const Headline: React.FC<{ phases: Phase[] }> = ({ phases }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {phases.map((p) => {
        if (frame < p.from || frame >= p.to) return null;
        return (
          <div
            key={p.id + p.from}
            style={{
              position: "absolute",
              top: 134,
              left: SIDE,
              right: SIDE,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 60,
              lineHeight: 1.12,
              letterSpacing: "-0.015em",
              color: C.ink,
              opacity: interpolate(frame, [p.from, p.from + 8, p.to - 5, p.to], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [p.from, p.from + 10], ["0px 14px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {NARRATION[p.id].en}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const SmallPrint: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 930 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SIDE,
      right: SIDE,
      textAlign: "center",
      fontFamily: F.mono,
      fontSize: 26,
      color: C.ink3,
    }}
  >
    {children}
  </div>
);
