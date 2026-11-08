// The session's totals, all read from the trace (see data.ts).
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SIDE, SmallPrint } from "../Chrome";
import { fmt, meta, totals } from "../data";
import { C, F } from "../theme";
import { NARRATION } from "../timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const stats = [
  { n: fmt(totals.calls), l: "model calls", c: C.model },
  { n: String(totals.seconds), l: "seconds", c: C.you },
  { n: fmt(totals.tokensRead), l: "tokens read across all calls", c: C.sys },
  { n: `${fmt(totals.linesBefore)} → ${fmt(totals.linesAfter)}`, l: "lines changed, before → after", c: C.result },
];

export const TotalsScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 170,
          left: SIDE,
          right: SIDE,
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 128,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: C.ink,
          opacity: interpolate(frame, [0, 10], [0, 1], clamp),
          translate: interpolate(frame, [0, 14], ["0px 20px", "0px 0px"], { ...clamp, easing: ease }),
        }}
      >
        {NARRATION.totals.en}
      </div>
      <div
        style={{
          position: "absolute",
          top: 330,
          left: SIDE,
          fontFamily: F.body,
          fontSize: 40,
          color: C.ink2,
          opacity: interpolate(frame, [6, 16], [0, 1], clamp),
        }}
      >
        The whole session, from the recording:
      </div>

      <div style={{ position: "absolute", top: 450, left: SIDE, right: SIDE, display: "flex", gap: 40 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              flex: s.n.length > 4 ? 1.35 : 1,
              borderTop: `6px solid ${s.c}`,
              paddingTop: 22,
              opacity: interpolate(frame, [14 + i * 6, 24 + i * 6], [0, 1], clamp),
              translate: interpolate(frame, [14 + i * 6, 30 + i * 6], ["0px 24px", "0px 0px"], { ...clamp, easing: ease }),
            }}
          >
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 116, lineHeight: 1, color: C.ink, whiteSpace: "nowrap" }}>
              {s.n}
            </div>
            <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 30, lineHeight: 1.3, color: C.ink2, marginTop: 16 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ opacity: interpolate(frame, [40, 52], [0, 1], clamp) }}>
        <SmallPrint top={800}>
          Recorded {meta.recorded} with {meta.model} in Claude Code {meta.ccv}, run {meta.run} of {meta.runs}.
        </SmallPrint>
        <SmallPrint top={842}>
          Seconds: Claude Code's own timer. Tokens: what each call read, added up over the calls.
        </SmallPrint>
      </div>
    </AbsoluteFill>
  );
};
