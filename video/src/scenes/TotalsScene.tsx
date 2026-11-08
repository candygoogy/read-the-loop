// The session's totals, all read from the trace (see data.ts).
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SIDE, SmallPrint } from "../Chrome";
import { meta, totals } from "../data";
import type { UI } from "../i18n";
import { useLocale } from "../locale";
import { C } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const statsFor = (ui: UI) => [
  { n: ui.num(totals.calls), l: ui.stats.calls, c: C.model },
  { n: String(totals.seconds), l: ui.stats.seconds, c: C.you },
  { n: ui.num(totals.tokensRead), l: ui.stats.tokens, c: C.sys },
  { n: `${ui.num(totals.linesBefore)} → ${ui.num(totals.linesAfter)}`, l: ui.stats.lines, c: C.result },
];

export const TotalsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { lang, ui, f } = useLocale();
  const stats = statsFor(ui);
  return (
    <AbsoluteFill>
      <div
        data-fit
        data-maxlines={1}
        style={{
          position: "absolute",
          top: 170,
          left: SIDE,
          right: SIDE,
          fontFamily: f.display,
          fontWeight: 700,
          fontSize: 128,
          lineHeight: lang === "zh" ? 1.12 : 1,
          letterSpacing: lang === "zh" ? "0.03em" : "-0.03em",
          color: C.ink,
          opacity: interpolate(frame, [0, 10], [0, 1], clamp),
          translate: interpolate(frame, [0, 14], ["0px 20px", "0px 0px"], { ...clamp, easing: ease }),
        }}
      >
        {ui.totalsTitle}
      </div>
      <div
        data-fit
        data-maxlines={1}
        style={{
          position: "absolute",
          top: 330,
          left: SIDE,
          fontFamily: f.body,
          fontSize: 40,
          color: C.ink2,
          opacity: interpolate(frame, [6, 16], [0, 1], clamp),
        }}
      >
        {ui.totalsSub}
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
            <div data-fit style={{ fontFamily: f.display, fontWeight: 700, fontSize: 116, lineHeight: 1, color: C.ink, whiteSpace: "nowrap" }}>
              {s.n}
            </div>
            <div data-fit data-maxlines={2} style={{ fontFamily: f.mono, wordSpacing: f.ws, fontWeight: 500, fontSize: 30, lineHeight: 1.3, color: C.ink2, marginTop: 16 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ opacity: interpolate(frame, [40, 52], [0, 1], clamp) }}>
        <SmallPrint top={800}>{ui.recorded(meta)}</SmallPrint>
        <SmallPrint top={842}>{ui.timerNote}</SmallPrint>
        {ui.translationNote ? <SmallPrint top={884}>{ui.translationNote}</SmallPrint> : null}
        <SmallPrint top={ui.translationNote ? 926 : 884}>loop.candygoogy.dev</SmallPrint>
      </div>
    </AbsoluteFill>
  );
};
