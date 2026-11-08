// Checks, before rendering, that the video's two claims about the game hold when the real game code runs the way
// the video runs it (fresh state, paddle never moved, one 1/30 s step per frame), and prints the totals the
// end card shows, straight from the trace. Then it renders a few frames of each cut with the layout probe on
// (src/probe.tsx) and checks the Chinese-UI cut (HeroZhUI) against the English one (Hero): the same numbers on
// screen, no text overflowing its box or running into another, and every Chinese character covered by a loaded web
// font (no tofu). That part bundles the video and needs a network connection for the fonts.
// Usage: node scripts/check.ts [--no-layout]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, FPS, NARRATION, zhCaptions } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "../..");
const DT = 1 / 30;

type Ball = { x: number; y: number; vx: number; vy: number; radius: number };
type Paddle = { x: number; y: number; width: number; height: number };
type State = { ball: Ball; paddle: Paddle };

// The same wrapper as src/game.ts: run the file unchanged, take module.exports.
const load = (version: string) => {
  const src = fs.readFileSync(path.join(repo, `site/game/run2/${version}/game.js`), "utf8");
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", `${src}\n;return { draw, LIGHT };`)(module);
  return module.exports as { createState: () => State; step: (s: State, dt: number) => State };
};

// Follow the first serve until it reaches the paddle's height, then report what happened there.
const firstServe = (version: string) => {
  const game = load(version);
  const s = game.createState();
  const p = s.paddle;
  for (let f = 1; f < 120; f++) {
    const before = { ...s.ball };
    game.step(s, DT);
    if (before.vy > 0 && s.ball.vy < 0) return { frame: f, x: before.x, p, outcome: "bounces" };
    if (s.ball.y - s.ball.radius > p.y + p.height) return { frame: f, x: s.ball.x, p, outcome: "falls through" };
  }
  throw new Error(`${version}: the first serve never reached the paddle`);
};

let ok = true;
for (const [version, expected] of [["before", "falls through"], ["after", "bounces"]] as const) {
  const r = firstServe(version);
  const centre = r.p.x + r.p.width / 2;
  const rightHalf = r.x >= centre && r.x <= r.p.x + r.p.width;
  const pass = r.outcome === expected && rightHalf;
  ok &&= pass;
  console.log(
    `${pass ? "ok  " : "FAIL"} ${version}: at frame ${r.frame} the ball (x ${r.x.toFixed(1)}) ${r.outcome}; ` +
      `paddle ${r.p.x}..${r.p.x + r.p.width}, right half ${rightHalf ? "yes" : "no"}; expected: ${expected}`,
  );
}

const trace = JSON.parse(fs.readFileSync(path.join(repo, "data/trace-02-run2.json"), "utf8"));
const ctx: number[] = trace.calls.map((c: { context_tokens: number }) => c.context_tokens);
const edit = trace.calls.flatMap((c: { output: { tool?: string }[] }) => c.output).find((o: { tool?: string }) => o.tool === "Edit");
console.log(`trace: model_calls ${trace.totals.model_calls} (calls listed: ${trace.calls.length}), duration_s ${trace.totals.duration_s}`);
console.log(`trace: context_tokens ${ctx.join(" + ")} = ${ctx.reduce((a, b) => a + b, 0)}`);
console.log(`trace: Edit replaces ${edit.input.old_string.split("\n").length} line(s) with ${edit.input.new_string.split("\n").length}`);
// The Chinese subtitles: each line once, in order, with its own text, and on every frame the line of that frame's
// phase (the same lookup Subtitles.tsx uses, so the burned-in cut and the SRT agree).
const tl = buildTimeline(trace);
const caps = zhCaptions(trace);
const texts = caps.map((c) => c.text);
const unique = new Set(texts).size === texts.length;
const ordered = caps.every((c, i) => i === 0 || c.startMs >= caps[i - 1].endMs);
const own = caps.every((c, i) => c.text === NARRATION[tl.phases[i].id].zh);
let wrongFrames = 0;
for (let f = 0; f < tl.total; f++) {
  const ms = (f / FPS) * 1000;
  const shown = caps.findIndex((c) => ms >= c.startMs && ms < c.endMs);
  const phase = tl.phases.findIndex((p) => f >= p.from && f < p.to);
  if (shown !== phase) wrongFrames++;
}
const subsOk = unique && ordered && own && wrongFrames === 0;
ok &&= subsOk;
console.log(
  `${subsOk ? "ok  " : "FAIL"} subtitles: ${caps.length} lines, unique ${unique}, in order ${ordered}, own text ${own}, ` +
    `frames showing another phase's line: ${wrongFrames}`,
);

// ---------- layout of the cuts ----------
if (!process.argv.includes("--no-layout")) ok = (await checkLayout()) && ok;
if (!ok) process.exit(1);

async function checkLayout(): Promise<boolean> {
  // Frames where everything has settled: one per scene, three per call (model reading, harness running, result
  // back), two for the last call (its reply, then "nothing to run").
  const B = tl.scenes.loop.from;
  const frames = [30, B + 40];
  tl.callSlots.forEach((s, i) => {
    const last = i === tl.callSlots.length - 1;
    for (const at of last ? [10, 30] : [18, 24, 42]) frames.push(B + s.from + at);
  });
  frames.push(tl.scenes.fixed.from + 60, tl.scenes.totals.from + 70);

  // Remotion writes its scratch files to the OS temp folder; keep them next to the video instead.
  const tmp = path.join(here, "../out/tmp");
  fs.mkdirSync(tmp, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
  const { bundle } = await import("@remotion/bundler");
  const { openBrowser, renderStill, selectComposition } = await import("@remotion/renderer");
  const { webpackOverride } = await import("../webpack-override.ts");

  console.log(`layout: bundling, then probing frames ${frames.join(", ")} of Hero and HeroZhUI`);
  const serveUrl = await bundle({
    entryPoint: path.join(here, "../src/index.ts"),
    outDir: path.join(here, "../out/check-bundle"),
    webpackOverride,
  });
  const browser = await openBrowser("chrome");
  type Probe = { frame: number; fit: string[]; tofu: string[]; numbers: string[] };
  const probe = async (id: string) => {
    const inputProps = { probe: true };
    const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
    const out: Probe[] = [];
    for (const frame of frames) {
      let got: Probe | null = null;
      await renderStill({
        composition,
        serveUrl,
        frame,
        inputProps,
        puppeteerInstance: browser,
        onBrowserLog: (log) => {
          if (log.text.startsWith("PROBE ")) got = JSON.parse(log.text.slice(6));
        },
      });
      if (!got) throw new Error(`${id}: no probe result for frame ${frame}`);
      out.push(got);
    }
    return out;
  };
  const en = await probe("Hero");
  const zh = await probe("HeroZhUI");
  await browser.close({ silent: true });

  let pass = true;
  const report = (good: boolean, what: string, bad: string[]) => {
    console.log(`${good ? "ok  " : "FAIL"} ${what}${bad.length ? `\n       ${bad.join("\n       ")}` : ""}`);
    pass &&= good;
  };
  const numDiff = zh.flatMap((z, i) =>
    z.numbers.join(" ") === en[i].numbers.join(" ")
      ? []
      : [`frame ${z.frame}: en [${en[i].numbers.join(" ")}] zh [${z.numbers.join(" ")}]`],
  );
  const count = zh.reduce((n, z) => n + z.numbers.length, 0);
  report(numDiff.length === 0, `zh-ui numbers: the same ${count} numbers as the English cut on ${frames.length} frames`, numDiff);
  const fitZh = zh.flatMap((z) => z.fit.map((m) => `frame ${z.frame}: ${m}`));
  report(fitZh.length === 0, `zh-ui layout: no text overflowing, wrapping past its lines or overlapping`, fitZh);
  const tofuZh = [...new Set(zh.flatMap((z) => z.tofu))];
  report(tofuZh.length === 0, `zh-ui fonts: every non-ASCII character of our text has a loaded web font`, tofuZh);
  const fitEn = en.flatMap((e) => e.fit.map((m) => `frame ${e.frame}: ${m}`));
  report(fitEn.length === 0, `en layout: no text overflowing, wrapping past its lines or overlapping`, fitEn);
  // The English cut's own non-ASCII characters (· and →) are reported, not required: that cut is not changed here.
  const tofuEn = [...new Set(en.flatMap((e) => e.tofu))];
  console.log(`info en fonts: characters without a loaded web font: ${tofuEn.length ? tofuEn.join(", ") : "none"}`);
  return pass;
}

