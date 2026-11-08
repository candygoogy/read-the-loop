import React from "react";
import { Composition } from "remotion";
import { Hero, timeline } from "./Hero";
import { FPS } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Hero"
      component={Hero}
      durationInFrames={timeline.total}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ subtitles: "none" as const }}
    />
    <Composition
      id="HeroZh"
      component={Hero}
      durationInFrames={timeline.total}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ subtitles: "zh" as const }}
    />
    {/* Our own on-screen text in Simplified Chinese; what the agent wrote or saw stays in English, as recorded. */}
    <Composition
      id="HeroZhUI"
      component={Hero}
      durationInFrames={timeline.total}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ subtitles: "none" as const, lang: "zh" as const }}
    />
  </>
);
