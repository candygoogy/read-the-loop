import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Headline, TopBar } from "./Chrome";
import { trace } from "./data";
import { GameScene } from "./scenes/GameScene";
import { LoopScene } from "./scenes/LoopScene";
import { TotalsScene } from "./scenes/TotalsScene";
import { Subtitles } from "./Subtitles";
import { C } from "./theme";
import { buildTimeline, zhCaptions } from "./timeline";

export type HeroProps = { subtitles: "none" | "zh" };

export const timeline = buildTimeline(trace);

export const Hero: React.FC<HeroProps> = ({ subtitles }) => {
  const { scenes, callSlots, promptDur, phases } = timeline;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <TopBar />
      <Headline phases={phases.filter((p) => p.id !== "totals")} />

      <Sequence name="Broken game" from={scenes.broken.from} durationInFrames={scenes.broken.dur}>
        <GameScene version="before" label="right half: the ball falls through" tone={C.model} />
      </Sequence>
      <Sequence name="The loop" from={scenes.loop.from} durationInFrames={scenes.loop.dur}>
        <LoopScene promptDur={promptDur} slots={callSlots} />
      </Sequence>
      <Sequence name="Fixed game" from={scenes.fixed.from} durationInFrames={scenes.fixed.dur}>
        <GameScene version="after" label="right half: the ball bounces" tone={C.result} />
      </Sequence>
      <Sequence name="Totals" from={scenes.totals.from} durationInFrames={scenes.totals.dur}>
        <TotalsScene />
      </Sequence>

      {subtitles === "zh" ? <Subtitles captions={zhCaptions(trace)} /> : null}
    </AbsoluteFill>
  );
};
