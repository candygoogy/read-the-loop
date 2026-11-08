// The real game, drawn by its own draw() onto a canvas, one game step per video frame.
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SmallPrint } from "../Chrome";
import { games, simulate, type Version } from "../game";
import { useLocale } from "../locale";
import { C } from "../theme";

const SCALE = 1.85;
const LEAD = 12; // frames the serve waits, so the eye finds the ball first
const TRAIL = 9;

export const GameScene: React.FC<{ version: Version; tone: string }> = ({ version, tone }) => {
  const frame = useCurrentFrame();
  const { ui, f } = useLocale();
  const { durationInFrames } = useVideoConfig();
  const game = games[version];
  const states = simulate(version, durationInFrames);
  const t = Math.max(0, frame - LEAD);
  const state = states[t];
  const ref = useRef<HTMLCanvasElement>(null);
  const w = game.WIDTH * SCALE;
  const h = game.HEIGHT * SCALE;

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(SCALE * 2, 0, 0, SCALE * 2, 0, 0); // drawn at 2x, shown at 1x, for sharp edges
    game.draw(ctx, structuredClone(state), game.LIGHT);
  }, [game, state]);

  // Where the ball was over the last few frames; a re-serve breaks the trail.
  const trail: { x: number; y: number; a: number }[] = [];
  for (let k = 1; k <= TRAIL && t - k >= 0; k++) {
    const a = states[t - k + 1].ball;
    const b = states[t - k].ball;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 40) break;
    trail.push({ x: b.x, y: b.y, a: 1 - k / (TRAIL + 1) });
  }

  const p = state.paddle;
  const left = (1920 - w) / 2;
  const top = 236;

  return (
    <AbsoluteFill>
      <div
        data-obstacle
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          borderRadius: 10,
          border: `2px solid ${C.rule}`,
          boxShadow: `0 18px 40px -24px ${C.ink}55`,
          overflow: "hidden",
          opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <canvas ref={ref} width={w * 2} height={h * 2} style={{ width: w, height: h, display: "block" }} />
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {trail.map((d, i) => (
            <circle
              key={i}
              cx={d.x * SCALE}
              cy={d.y * SCALE}
              r={state.ball.radius * SCALE * 0.75}
              fill={C.model}
              opacity={d.a * 0.45}
            />
          ))}
        </svg>
      </div>

      {/* The paddle's right half, measured from the paddle in the game state. */}
      <div
        style={{
          position: "absolute",
          left: left + (p.x + p.width / 2) * SCALE,
          width: (p.width / 2) * SCALE,
          top: top + h + 10,
          height: 14,
          borderLeft: `3px solid ${tone}`,
          borderRight: `3px solid ${tone}`,
          borderBottom: `3px solid ${tone}`,
        }}
      />
      <div
        data-fit
        data-maxlines={1}
        style={{
          position: "absolute",
          left: left + (p.x + p.width / 2) * SCALE - 400,
          width: (p.width / 2) * SCALE + 800,
          top: top + h + 30,
          textAlign: "center",
          fontFamily: f.mono,
          wordSpacing: f.ws,
          fontWeight: 600,
          fontSize: 28,
          whiteSpace: "nowrap",
          color: tone,
        }}
      >
        {ui.game[version]}
      </div>

      <SmallPrint top={top + h + 76}>
        {ui.gameNote(version)}
      </SmallPrint>
    </AbsoluteFill>
  );
};
