// The loop on the recording: You -> model -> request -> harness runs it -> result back, once per call,
// with the conversation drawn to scale underneath.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SIDE } from "../Chrome";
import { callViews, ctx, lastCtx, meta, secs, type Card, type Line } from "../data";
import type { UI } from "../i18n";
import { useLocale } from "../locale";
import { C } from "../theme";
import type { Slot } from "../timeline";

// Moments inside a call's slot, in frames from its start.
const REQ_IN = 4;
const HARNESS_ON = 20;
const RESULT_IN = 28;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

type Where = { kind: "prompt"; f: number } | { kind: "call"; i: number; f: number };

const where = (frame: number, promptDur: number, slots: Slot[]): Where => {
  if (frame < promptDur) return { kind: "prompt", f: frame };
  for (let i = slots.length - 1; i >= 0; i--) if (frame >= slots[i].from) return { kind: "call", i, f: frame - slots[i].from };
  return { kind: "prompt", f: frame };
};

// ---------- the loop diagram ----------

const ROW_Y = 300;
const PILL_H = 74;

const Pill: React.FC<{ x: number; w: number; label: string; colour: string; on: boolean; sub?: string }> = ({
  x,
  w,
  label,
  colour,
  on,
  sub,
}) => {
  const { f } = useLocale();
  return (
  <div style={{ position: "absolute", left: x, top: ROW_Y, width: w }}>
    <div
      data-obstacle
      data-fit
      data-maxlines={1}
      style={{
        height: PILL_H,
        borderRadius: PILL_H / 2,
        border: `3px solid ${colour}`,
        background: on ? colour : C.card,
        color: on ? C.paper : colour,
        opacity: on ? 1 : 0.55,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: f.mono,
        wordSpacing: f.ws,
        fontWeight: 600,
        fontSize: 32,
      }}
    >
      {label}
    </div>
    {sub ? (
      <div data-fit data-maxlines={1} style={{ marginTop: 6, marginLeft: -100, marginRight: -100, textAlign: "center", whiteSpace: "nowrap", fontFamily: f.mono, wordSpacing: f.ws, fontSize: 24, color: C.ink2 }}>
        {sub}
      </div>
    ) : null}
  </div>
  );
};

const Arrow: React.FC<{ x1: number; x2: number; y: number; colour: string; on: boolean; label: string; above?: boolean }> = ({
  x1,
  x2,
  y,
  colour,
  on,
  label,
  above = true,
}) => {
  const dir = Math.sign(x2 - x1);
  const { f } = useLocale();
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <line x1={x1} y1={y} x2={x2 - dir * 14} y2={y} stroke={colour} strokeWidth={on ? 5 : 3} opacity={on ? 1 : 0.35} />
        <polygon
          points={`${x2},${y} ${x2 - dir * 18},${y - 10} ${x2 - dir * 18},${y + 10}`}
          fill={colour}
          opacity={on ? 1 : 0.35}
        />
      </svg>
      <div
        data-fit
        data-maxlines={1}
        style={{
          position: "absolute",
          left: Math.min(x1, x2),
          width: Math.abs(x2 - x1),
          top: above ? y - 40 : y + 8,
          textAlign: "center",
          fontFamily: f.mono,
          wordSpacing: f.ws,
          fontWeight: on ? 600 : 400,
          fontSize: 24,
          color: colour,
          opacity: on ? 1 : 0.5,
        }}
      >
        {label}
      </div>
    </>
  );
};

// ---------- cards ----------

const toneColour = (t: Line["tone"]) =>
  t === "del" ? C.ink3 : t === "add" ? C.result : t === "fail" ? C.model : t === "pass" ? C.result : t === "dim" ? C.ink2 : C.ink;

const CardBox: React.FC<{ colour: string; label: string; opacity: number; lift: number; children: React.ReactNode }> = ({
  colour,
  label,
  opacity,
  lift,
  children,
}) => {
  const { f } = useLocale();
  return (
  <div
    data-obstacle
    style={{
      opacity,
      translate: `0px ${lift}px`,
      background: C.card,
      border: `2px solid ${C.rule}`,
      borderLeft: `10px solid ${colour}`,
      borderRadius: 14,
      padding: "12px 28px 14px",
    }}
  >
    <div
      data-fit
      data-maxlines={1}
      style={{
        fontFamily: f.mono,
        wordSpacing: f.ws,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: colour,
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    {children}
  </div>
  );
};

// Recorded lines are shown as recorded (cut with an ellipsis if too long); a `pasted` line is our summary.
const CodeLines: React.FC<{ lines: Line[] }> = ({ lines }) => {
  const { ui, f } = useLocale();
  return (
    <div style={{ fontFamily: f.mono, fontSize: 27, lineHeight: 1.34 }}>
      {lines.map((l, i) =>
        l.pasted ? (
          <div key={i} data-fit data-maxlines={1} style={{ whiteSpace: "pre", wordSpacing: f.ws, color: toneColour(l.tone) }}>
            {ui.pastedBack(l.pasted.file, l.pasted.lines)}
          </div>
        ) : (
          <div
            key={i}
            data-recorded
            style={{ whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis", color: toneColour(l.tone) }}
          >
            {l.text}
          </div>
        ),
      )}
    </div>
  );
};

// The model's own words, with `code` spans set in mono.
const Prose: React.FC<{ text: string; size?: number }> = ({ text, size = 36 }) => {
  const { f } = useLocale();
  return (
  <div data-recorded style={{ fontFamily: f.body, fontSize: size, lineHeight: 1.38, color: C.ink }}>
    {text.split(/(`[^`]+`)/).map((part, i) =>
      part.startsWith("`") ? (
        <code key={i} style={{ fontFamily: f.mono, fontSize: size * 0.86, background: C.paper2, padding: "0 6px", borderRadius: 5 }}>
          {part.slice(1, -1)}
        </code>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </div>
  );
};

const appear = (f: number, at: number) => ({
  opacity: interpolate(f, [at, at + 8], [0, 1], clamp),
  lift: interpolate(f, [at, at + 12], [18, 0], { ...clamp, easing: ease }),
});

// ---------- context bar ----------

const BAR_Y = 882;
const BAR_H = 48;
const BAR_W = 1920 - 2 * SIDE;
const px = (tokens: number) => (tokens / lastCtx) * BAR_W;

const ContextBar: React.FC<{ w: Where }> = ({ w }) => {
  const { ui, f } = useLocale();
  // How many tokens the conversation holds right now, and whether the model is reading it.
  let size = ctx[0];
  let grow = 0; // 0..1 of the newest round, while it comes in
  let reading = -1; // 0..1 sweep while a call reads
  let readingFade = 0;
  let label = ui.firstWillRead(ctx[0]);
  if (w.kind === "call") {
    const v = callViews[w.i];
    size = ctx[w.i];
    reading = interpolate(w.f, [0, 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    readingFade = interpolate(w.f, [16, 26], [1, 0], clamp);
    label = ui.callReads(v.n, ctx[w.i]);
    if (v.result && w.i + 1 < ctx.length && w.f >= RESULT_IN) {
      grow = interpolate(w.f, [RESULT_IN, RESULT_IN + 12], [0, 1], { ...clamp, easing: ease });
      label = ui.conversationNow(ctx[w.i + 1], ctx[w.i + 1] - ctx[w.i]);
    }
  }
  const nextSize = w.kind === "call" && w.i + 1 < ctx.length ? ctx[w.i + 1] : size;
  const segments: { from: number; to: number; i: number }[] = [];
  for (let i = 1; i < ctx.length; i++) {
    const to = ctx[i];
    if (to <= size) segments.push({ from: ctx[i - 1], to, i });
    else if (to === nextSize && grow > 0) segments.push({ from: ctx[i - 1], to: ctx[i - 1] + (to - ctx[i - 1]) * grow, i });
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: BAR_Y - 46,
          left: SIDE,
          right: SIDE,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: f.mono,
          wordSpacing: f.ws,
          fontSize: 26,
        }}
      >
        <span data-fit style={{ color: C.ink2 }}>{ui.barCaption}</span>
        <span data-fit style={{ color: C.ink, fontWeight: 600 }}>{label}</span>
      </div>
      <div
        data-obstacle
        style={{
          position: "absolute",
          top: BAR_Y,
          left: SIDE,
          width: BAR_W,
          height: BAR_H,
          borderRadius: 8,
          background: C.paper2,
          border: `2px solid ${C.rule}`,
          overflow: "hidden",
        }}
      >
        <div
          data-fit
          data-maxlines={1}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: px(ctx[0]),
            background: C.sys,
            color: C.paper,
            fontFamily: f.mono,
            wordSpacing: f.ws,
            fontWeight: 500,
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
          }}
        >
          {ui.barSetup}
        </div>
        {segments.map((s) => (
          <div
            key={s.i}
            style={{
              position: "absolute",
              left: px(s.from),
              width: px(s.to) - px(s.from),
              top: 0,
              bottom: 0,
              background: C.result,
              opacity: s.i % 2 ? 1 : 0.72,
              borderLeft: `2px solid ${C.paper}`,
            }}
          />
        ))}
      </div>
      {/* While a call runs, a line under the bar sweeps over everything the model reads. */}
      {reading >= 0 ? (
        <div
          style={{
            position: "absolute",
            top: BAR_Y + BAR_H + 8,
            left: SIDE,
            height: 7,
            borderRadius: 4,
            width: px(size) * reading,
            background: C.model,
            opacity: readingFade,
          }}
        />
      ) : null}
    </>
  );
};

// ---------- the scene ----------

export const LoopScene: React.FC<{ promptDur: number; slots: Slot[] }> = ({ promptDur, slots }) => {
  const frame = useCurrentFrame();
  const { ui, f: fonts } = useLocale();
  const w = where(frame, promptDur, slots);
  const v = w.kind === "call" ? callViews[w.i] : null;
  const f = w.f;

  const youOn = w.kind === "prompt";
  const modelOn = w.kind === "call" && (f < HARNESS_ON || v!.final || f >= RESULT_IN + 8);
  const harnessOn = w.kind === "call" && !v!.final && f >= HARNESS_ON && f < RESULT_IN + 8;
  const reqOn = w.kind === "call" && !v!.final && f >= 12 && f < RESULT_IN;
  const resOn = w.kind === "call" && !v!.final && f >= RESULT_IN;

  const clock =
    w.kind === "prompt"
      ? ui.startOfRecording
      : ui.secondsIn(v!.result && f >= RESULT_IN && v!.resultMs !== null ? secs(v!.resultMs) : secs(v!.tMs));

  const youX = SIDE;
  const modelX = 520;
  const harnessX = 1080;
  const pillW = 260;

  return (
    <AbsoluteFill>
      <Pill x={youX} w={200} label={ui.you} colour={C.you} on={youOn} />
      <Arrow x1={youX + 200} x2={modelX} y={ROW_Y + PILL_H / 2} colour={C.you} on={youOn} label={ui.yourMessage} />
      <Pill x={modelX} w={pillW} label={ui.model} colour={C.model} on={modelOn} sub={w.kind === "call" && f < HARNESS_ON ? ui.modelSub : undefined} />
      <Arrow x1={modelX + pillW} x2={harnessX} y={ROW_Y + 20} colour={C.model} on={reqOn} label={ui.request} />
      <Arrow x1={harnessX} x2={modelX + pillW} y={ROW_Y + PILL_H - 20} colour={C.result} on={resOn} label={ui.result} above={false} />
      <Pill
        x={harnessX}
        w={pillW + 40}
        label={ui.harness}
        colour={C.result}
        on={harnessOn}
        sub={harnessOn ? ui.harnessRuns : v?.final && f >= HARNESS_ON ? ui.harnessStops : undefined}
      />

      <div style={{ position: "absolute", top: ROW_Y - 6, right: SIDE, textAlign: "right", fontFamily: fonts.mono, wordSpacing: fonts.ws }}>
        <div data-fit data-maxlines={1} style={{ fontSize: 40, fontWeight: 600, color: C.ink }}>
          {v ? ui.callOf(v.n, callViews.length)[0] : ui.beforeCall1}
          {v && ui.callOf(v.n, callViews.length)[1] ? (
            <span style={{ fontSize: 28, fontWeight: 500, color: C.ink2 }}>{ui.callOf(v.n, callViews.length)[1]}</span>
          ) : null}
        </div>
        <div data-fit data-maxlines={1} style={{ fontSize: 26, color: C.ink2, marginTop: 4 }}>{clock}</div>
      </div>

      <div style={{ position: "absolute", top: 420, left: SIDE, right: SIDE, display: "flex", flexDirection: "column", gap: 14 }}>
        {w.kind === "prompt" ? (
          <CardBox colour={C.you} label={ui.typedInto} {...appear(f, 2)}>
            <Prose text={meta.prompt} size={38} />
          </CardBox>
        ) : v!.final ? (
          <CardBox colour={C.model} label={cardLabel(ui, v!.request)} {...appear(f, REQ_IN)}>
            <Prose text={v!.request.lines[0].text} size={36} />
          </CardBox>
        ) : (
          <>
            <RequestCard card={v!.request} f={f} />
            {v!.result ? <ResultCard card={v!.result} f={f} /> : null}
          </>
        )}
      </div>

      <ContextBar w={w} />
    </AbsoluteFill>
  );
};

const cardLabel = (ui: UI, card: Card) =>
  card.label.kind === "asks"
    ? ui.asks(card.label.count ?? 1)
    : card.label.kind === "pastes"
      ? ui.pastes
      : card.label.kind === "noRequest"
        ? ui.noRequest
        : ui.typedInto;

const RequestCard: React.FC<{ card: Card; f: number }> = ({ card, f }) => (
  <CardBox colour={C.model} label={cardLabel(useLocale().ui, card)} {...appear(f, REQ_IN)}>
    <CodeLines lines={card.lines} />
  </CardBox>
);

const ResultCard: React.FC<{ card: Card; f: number }> = ({ card, f }) => (
  <CardBox colour={C.result} label={cardLabel(useLocale().ui, card)} {...appear(f, RESULT_IN)}>
    <CodeLines lines={card.lines} />
  </CardBox>
);
