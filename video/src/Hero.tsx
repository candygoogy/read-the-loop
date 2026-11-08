import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Headline, TopBar } from "./Chrome";
import { trace } from "./data";
import { GameScene } from "./scenes/GameScene";
import { LoopScene } from "./scenes/LoopScene";
import { TotalsScene } from "./scenes/TotalsScene";
import { Subtitles } from "./Subtitles";
import type { Lang } from "./i18n";
import { LocaleProvider } from "./locale";
import { LayoutProbe } from "./probe";
import { C } from "./theme";
import { buildTimeline, zhCaptions } from "./timeline";

/** subtitles: burned-in Chinese subtitles (HeroZh). lang: the language of our own on-screen text (HeroZhUI: zh).
 * probe: measure the layout and log it, for scripts/check.ts; never set in a real render. */
export type HeroProps = { subtitles: "none" | "zh"; lang?: Lang; probe?: boolean };

export const timeline = buildTimeline(trace);

export const Hero: React.FC<HeroProps> = ({ subtitles, lang = "en", probe = false }) => {
  const { scenes, callSlots, promptDur, phases } = timeline;
  return (
    <LocaleProvider lang={lang}>
    <AbsoluteFill style={{ background: C.paper }}>
      <TopBar />
      <Headline phases={phases.filter((p) => p.id !== "totals")} />

      <Sequence name="Broken game" from={scenes.broken.from} durationInFrames={scenes.broken.dur}>
        <GameScene version="before" tone={C.model} />
      </Sequence>
      <Sequence name="The loop" from={scenes.loop.from} durationInFrames={scenes.loop.dur}>
        <LoopScene promptDur={promptDur} slots={callSlots} />
      </Sequence>
      <Sequence name="Fixed game" from={scenes.fixed.from} durationInFrames={scenes.fixed.dur}>
        <GameScene version="after" tone={C.result} />
      </Sequence>
      <Sequence name="Totals" from={scenes.totals.from} durationInFrames={scenes.totals.dur}>
        <TotalsScene />
      </Sequence>

      {subtitles === "zh" ? <Subtitles captions={zhCaptions(trace)} /> : null}
      {probe ? <LayoutProbe /> : null}
    </AbsoluteFill>
    </LocaleProvider>
  );
};
