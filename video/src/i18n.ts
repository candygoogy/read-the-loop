// Every word of our own on screen (narration headlines, diagram labels, captions, the end card), in English and in
// Simplified Chinese. What the agent wrote or saw (the prompt, requests, commands, outputs, file names, the model id)
// is not here: it comes from the trace, unchanged, in both cuts. Chinese terms follow the project's zh glossary.
import { NARRATION, type PhaseId } from "./timeline.ts";

export type Lang = "en" | "zh";

type Meta = { model: string; ccv: string; recorded: string; run: number; runs: number };

export type UI = {
  num: (n: number) => string;
  chapter: string;
  session: (m: Meta) => string;
  headline: (id: PhaseId) => string;
  game: { before: string; after: string };
  gameNote: (version: "before" | "after") => string;
  you: string;
  model: string;
  harness: string;
  yourMessage: string;
  request: string;
  result: string;
  modelSub: string;
  harnessRuns: string;
  harnessStops: string;
  beforeCall1: string;
  /** The call counter: the main part, and a smaller trailing part (Chinese: "（共 5 次）"). */
  callOf: (n: number, of: number) => [string, string];
  startOfRecording: string;
  secondsIn: (s: string) => string;
  typedInto: string;
  asks: (count: number) => string;
  pastes: string;
  noRequest: string;
  pastedBack: (file: string, lines: number) => string;
  barCaption: string;
  barSetup: string;
  firstWillRead: (tokens: number) => string;
  callReads: (n: number, tokens: number) => string;
  conversationNow: (tokens: number, added: number) => string;
  totalsTitle: string;
  totalsSub: string;
  stats: { calls: string; seconds: string; tokens: string; lines: string };
  recorded: (m: Meta) => string;
  timerNote: string;
  /** One line on the end card saying what stays in English and who translated. English cut: none. */
  translationNote: string | null;
};

const enNum = new Intl.NumberFormat("en-US");
const zhNum = new Intl.NumberFormat("zh-CN");

const en: UI = {
  num: (n) => enNum.format(n),
  chapter: "Read the Loop · chapter 1",
  session: (m) => `real session · ${m.model} · Claude Code ${m.ccv} · run ${m.run} of ${m.runs}`,
  headline: (id) => NARRATION[id].en,
  game: { before: "right half: the ball falls through", after: "right half: the ball bounces" },
  gameNote: (v) => `Simulated frame by frame with the game's own code (${v} the edit). Paddle held still.`,
  you: "You",
  model: "Model",
  harness: "Harness",
  yourMessage: "your message",
  request: "request",
  result: "result",
  modelSub: "reads it all, writes a reply",
  harnessRuns: "runs it",
  harnessStops: "nothing to run: stops",
  beforeCall1: "before call 1",
  callOf: (n, of) => [`call ${n} of ${of}`, ""],
  startOfRecording: "the start of the recording",
  secondsIn: (s) => `${s} s into the recording`,
  typedInto: "You · typed into Claude Code",
  asks: (c) => (c > 1 ? `The model asks for ${c} things` : "The model asks"),
  pastes: "The harness pastes back",
  noRequest: "The model writes · no request",
  pastedBack: (file, n) => `${file}: ${enNum.format(n)} lines pasted back`,
  barCaption: "What the model reads on each call, drawn to scale",
  barSetup: "set-up, tool descriptions and your message",
  firstWillRead: (t) => `The first call will read ${enNum.format(t)} tokens`,
  callReads: (n, t) => `Call ${n} reads ${enNum.format(t)} tokens`,
  conversationNow: (t, d) => `The conversation is now ${enNum.format(t)} tokens (+${enNum.format(d)})`,
  totalsTitle: NARRATION.totals.en,
  totalsSub: "The whole session, from the recording:",
  stats: {
    calls: "model calls",
    seconds: "seconds",
    tokens: "tokens read across all calls",
    lines: "lines changed, before → after",
  },
  recorded: (m) => `Recorded ${m.recorded} with ${m.model} in Claude Code ${m.ccv}, run ${m.run} of ${m.runs}.`,
  timerNote: "Seconds: Claude Code's own timer. Tokens: what each call read, added up over the calls.",
  translationNote: null,
};

// The headlines reuse the subtitle wording (NARRATION.zh) so the zh-UI cut and the subtitled cut say the same
// thing. One exception: the prompt line is two sentences in the subtitles and would wrap into the loop diagram as a
// headline, so on screen it is folded into one.
const zhHeadline: Partial<Record<PhaseId, string>> = {
  prompt: "你请外壳程序（harness）Claude Code 把它修好。",
  totals: "智能体就是一个循环。",
};

const zh: UI = {
  num: (n) => zhNum.format(n),
  chapter: "Read the Loop · 第一章",
  session: (m) => `真实会话 · ${m.model} · Claude Code ${m.ccv} · 第 ${m.run} 次运行（共 ${m.runs} 次）`,
  headline: (id) => zhHeadline[id] ?? NARRATION[id].zh,
  game: { before: "右半边：球直接穿了过去", after: "右半边：球被弹了回去" },
  gameNote: (v) => `用游戏自己的代码逐帧模拟（${v === "before" ? "修改前" : "修改后"}），挡板保持不动。`,
  you: "你",
  model: "模型",
  harness: "外壳程序",
  yourMessage: "你的消息",
  request: "请求",
  result: "结果",
  modelSub: "读入全部，写出回复",
  harnessRuns: "执行请求",
  harnessStops: "没有要执行的请求：停下",
  beforeCall1: "第 1 次调用之前",
  callOf: (n, of) => [`第 ${n} 次调用`, `（共 ${of} 次）`],
  startOfRecording: "录制开始",
  secondsIn: (s) => `录制第 ${s} 秒`,
  typedInto: "你 · 在 Claude Code 中输入",
  asks: (c) => (c > 1 ? `模型提出 ${c} 个请求` : "模型提出请求"),
  pastes: "外壳程序贴回结果",
  noRequest: "模型写下回复 · 没有请求",
  pastedBack: (file, n) => `${file}：贴回了 ${zhNum.format(n)} 行`,
  barCaption: "每次调用时模型读入的全部内容，按比例绘制",
  barSetup: "开场设定、工具说明和你的消息",
  firstWillRead: (t) => `首次调用将读入 ${zhNum.format(t)} 个 token（词元）`,
  callReads: (n, t) => `第 ${n} 次调用读入 ${zhNum.format(t)} 个 token`,
  conversationNow: (t, d) => `对话现在共 ${zhNum.format(t)} 个 token（+${zhNum.format(d)}）`,
  totalsTitle: zhHeadline.totals!,
  totalsSub: "这是这次录制的真实总数：",
  stats: {
    calls: "次模型调用",
    seconds: "秒",
    tokens: "所有调用读入的 token 总数",
    lines: "改动的行数，改前 → 改后",
  },
  recorded: (m) =>
    `录制于 ${m.recorded}，使用 ${m.model} 和 Claude Code ${m.ccv}，第 ${m.run} 次运行（共 ${m.runs} 次）。`,
  timerNote: "秒数：Claude Code 自己的计时。token：每次调用读入的量，逐次相加。",
  translationNote: "提示、命令和输出均为录制原文（英文）。中文由 Claude 翻译，欢迎指正。",
};

export const UIS: Record<Lang, UI> = { en, zh };

/** All Chinese text the zh cut can show, for picking the font slices to load. Numbers and names are Latin. */
export const zhText = (): string => {
  const meta: Meta = { model: "", ccv: "", recorded: "", run: 0, runs: 0 };
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (typeof v === "function") parts.push(String((v as (...a: unknown[]) => unknown)(meta, 0)));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  const { headline: _, ...rest } = zh;
  walk(rest);
  for (const id of Object.keys(NARRATION) as PhaseId[]) parts.push(zh.headline(id));
  parts.push(zh.gameNote("before"), zh.gameNote("after"), zh.asks(2), zh.asks(1));
  return parts.join("");
};
