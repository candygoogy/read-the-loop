// Parts shared by every scene: the top line and the narration headline.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { meta } from "./data";
import { useLocale } from "./locale";
import { C } from "./theme";
import type { PhaseId } from "./timeline";

export const SIDE = 100;

export const TopBar: React.FC = () => {
  const { ui, f } = useLocale();
  return (
  <div
    style={{
      position: "absolute",
      top: 62,
      left: SIDE,
      right: SIDE,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      fontFamily: f.mono,
      wordSpacing: f.ws,
      fontSize: 27,
    }}
  >
    {/* "chapter 1" / "第一章": the chapter number is ours, not the trace's, so the numbers check skips it. */}
    <span data-fit data-nonum style={{ color: C.model, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {ui.chapter}
    </span>
    <span data-fit style={{ color: C.ink3, fontWeight: 500 }}>
      {ui.session(meta)}
    </span>
  </div>
  );
};

type Phase = { id: PhaseId; from: number; to: number };

export const Headline: React.FC<{ phases: Phase[] }> = ({ phases }) => {
  const frame = useCurrentFrame();
  const { lang, ui, f } = useLocale();
  return (
    <AbsoluteFill>
      {phases.map((p) => {
        if (frame < p.from || frame >= p.to) return null;
        return (
          <div
            key={p.id + p.from}
            data-fit
            data-maxlines={2}
            style={{
              position: "absolute",
              top: 134,
              left: SIDE,
              right: SIDE,
              fontFamily: f.display,
              fontWeight: 600,
              fontSize: 60,
              lineHeight: lang === "zh" ? 1.3 : 1.12,
              letterSpacing: lang === "zh" ? "0.01em" : "-0.015em",
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
            {ui.headline(p.id)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const SmallPrint: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 930 }) => {
  const { f } = useLocale();
  return (
  <div
    data-fit
    data-maxlines={1}
    style={{
      position: "absolute",
      top,
      left: SIDE,
      right: SIDE,
      textAlign: "center",
      fontFamily: f.mono,
      wordSpacing: f.ws,
      fontSize: 26,
      color: C.ink3,
    }}
  >
    {children}
  </div>
  );
};
