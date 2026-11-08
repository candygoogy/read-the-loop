// Timing of the video and its hand-written narration (English on screen, Chinese as subtitles).
// No recorded numbers live here: the number of calls and what each call did are read from the trace that is
// passed in. This file has no imports, so `scripts/write-srt.ts` can run it with plain Node.

export const FPS = 30;

// Scene lengths in frames (design choices, not data).
const BROKEN = 120;
const PROMPT = 66;
const FIXED = 105;
const TOTALS = 120;
// A call's slot grows with what it shows: a base, plus a little per request in it.
const CALL_BASE = 48;
const CALL_PER_ITEM = 8;

type TraceLike = {
  calls: { output: { kind: string; tool?: string }[] }[];
};

export type PhaseId = "broken" | "prompt" | "look" | "test" | "fix" | "stop" | "fixed" | "totals";

export const NARRATION: Record<PhaseId, { en: string; zh: string }> = {
  broken: {
    en: "The ball falls through the right half of the paddle.",
    zh: "球从挡板的右半边直接穿了过去。",
  },
  prompt: {
    en: "You ask Claude Code, the harness, to fix it.",
    zh: "你请 Claude Code 修好它。Claude Code 就是外壳程序（harness）。",
  },
  look: {
    en: "The model can't see the game. It asks the harness to look.",
    zh: "模型看不到游戏，只能请外壳程序替它去看。",
  },
  test: {
    en: "It asks the harness to run the tests. A test fails.",
    zh: "它请外壳程序运行测试。有一个测试没有通过。",
  },
  fix: {
    en: "It edits the code, then runs the tests again. They all pass.",
    zh: "它修改了代码，然后再运行一次测试。全部通过。",
  },
  stop: {
    en: "A reply with no request in it. The harness stops.",
    zh: "这次的回复里没有任何请求，外壳程序就停了下来。",
  },
  fixed: {
    en: "After the edit, the same serve bounces off the paddle.",
    zh: "改完之后，同样的发球被挡板弹了回去。",
  },
  totals: {
    en: "An agent is a loop.",
    zh: "智能体就是一个循环。这是这次录制的真实总数。",
  },
};

const toolsIn = (call: TraceLike["calls"][number]) => call.output.filter((o) => o.kind === "tool");

/** Which narration phase a call belongs to, from what the call asked for. */
export const phaseOfCall = (trace: TraceLike, i: number): PhaseId => {
  const tools = toolsIn(trace.calls[i]).map((o) => o.tool);
  if (tools.length === 0) return "stop";
  if (tools.includes("Edit") || tools.includes("Write")) return "fix";
  if (tools.includes("Bash")) return "test";
  return "look";
};

export type Slot = { from: number; dur: number };

export const buildTimeline = (trace: TraceLike) => {
  const callSlots: Slot[] = [];
  let t = PROMPT;
  for (const call of trace.calls) {
    const dur = CALL_BASE + CALL_PER_ITEM * Math.max(1, call.output.length);
    callSlots.push({ from: t, dur });
    t += dur;
  }
  const loop = t;
  const scenes = {
    broken: { from: 0, dur: BROKEN },
    loop: { from: BROKEN, dur: loop },
    fixed: { from: BROKEN + loop, dur: FIXED },
    totals: { from: BROKEN + loop + FIXED, dur: TOTALS },
  };
  const total = scenes.totals.from + TOTALS;

  // Narration phases in absolute frames. Consecutive calls of the same kind share one line.
  const phases: { id: PhaseId; from: number; to: number }[] = [
    { id: "broken", from: 0, to: BROKEN },
    { id: "prompt", from: BROKEN, to: BROKEN + PROMPT },
  ];
  callSlots.forEach((slot, i) => {
    const id = phaseOfCall(trace, i);
    const from = BROKEN + slot.from;
    const to = from + slot.dur;
    const prev = phases[phases.length - 1];
    if (prev.id === id) prev.to = to;
    else phases.push({ id, from, to });
  });
  phases.push({ id: "fixed", from: scenes.fixed.from, to: scenes.fixed.from + FIXED });
  phases.push({ id: "totals", from: scenes.totals.from, to: total });

  return { scenes, callSlots, promptDur: PROMPT, phases, total };
};

/** Frame boundary in whole milliseconds. Rounded down, never to nearest: frame f starts at f * 33.33 ms, and
 * rounding 19566.67 up to 19567 kept the previous subtitle on screen for frame f (both in the burned-in cut and in
 * a player reading the SRT), so the first frame of each line showed the line before it. Rounding down puts every
 * frame in exactly its own phase's subtitle. */
const frameToMs = (frame: number) => Math.floor((frame / FPS) * 1000);

/** Subtitles in the shape of @remotion/captions' Caption type. */
export const zhCaptions = (trace: TraceLike) =>
  buildTimeline(trace).phases.map((p) => ({
    text: NARRATION[p.id].zh,
    startMs: frameToMs(p.from),
    endMs: frameToMs(p.to),
    timestampMs: null,
    confidence: null,
  }));
