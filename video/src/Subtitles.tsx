// Burned-in Chinese subtitles. The captions use @remotion/captions' Caption type and come from timeline.ts,
// the same source as hero-zh.srt.
import type { Caption } from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/NotoSansSC";
import React, { useState } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./theme";
import { slicesFor } from "./zhFonts";

const useZhFont = (captions: Caption[]) =>
  useState(
    () =>
      loadFont("normal", {
        weights: ["500"],
        // The slice keys ("[45]" etc.) aren't in the font's subset type, but loadFont accepts them.
        subsets: ["latin", ...slicesFor(captions.map((c) => c.text).join(""))] as "latin"[],
      }).fontFamily,
  )[0];

export const Subtitles: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const fontFamily = useZhFont(captions);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cap = captions.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!cap) return null;
  const fade = interpolate(ms, [cap.startMs, cap.startMs + 150, cap.endMs - 120, cap.endMs], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 34 }}>
      <div
        style={{
          opacity: fade,
          fontFamily,
          fontWeight: 500,
          fontSize: 46,
          lineHeight: 1.35,
          color: C.paper,
          background: C.ink,
          padding: "10px 30px 12px",
          borderRadius: 10,
          maxWidth: 1600,
          textAlign: "center",
        }}
      >
        {cap.text}
      </div>
    </AbsoluteFill>
  );
};
