// Checks, before rendering, that the video's two claims about the game hold when the real game code runs the way
// the video runs it (fresh state, paddle never moved, one 1/30 s step per frame), and prints the totals the
// end card shows, straight from the trace.
// Usage: node scripts/check.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
if (!ok) process.exit(1);
