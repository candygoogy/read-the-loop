// Chapter 5 (site/tools/) for scripts/screenshot.js: the top, the tool entries, the request to scale,
// the allowlist, the permission quiz (first request, an answered one, the summary, the skipped
// summary), the refusals and the commands that ran anyway. Checks that the quiz works by keyboard
// (desk, dark) and by tap (phone), that each verdict matches the recording's `denied` flag, that the
// summary's score is right, and that every refusal in the trace is on the page.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

// What the page should say, read straight from the trace (not from the page's own code).
const truth = (p) => p.evaluate(() => {
  const T = window.TRACES.black;
  const bash = T.calls.flatMap((c, i) => c.output.filter((o) => o.kind === "tool" && o.tool === "Bash").map((o) => ({ call: i + 1, denied: !!o.result.denied })));
  return { denied: bash.filter((x) => x.denied).map((x) => x.call), bash: bash.length };
});

// Answer the current quiz request, by keyboard (focus + Enter) or by tap.
async function answer(p, which, how) {
  const btn = p.locator(`#quiz .q-btn[data-a="${which}"]`);
  if (how === "tap") await btn.tap();
  else { await btn.focus(); await p.keyboard.press("Enter"); }
  await p.waitForSelector("#q-next");
}
async function next(p, how) {
  if (how === "tap") await p.locator("#q-next").tap();
  else await p.keyboard.press("Enter"); // focus is on the next button after answering
  await wait(p, 60);
}

async function states(p, { name, shot, problems, dir }) {
  const how = name === "phone" ? "tap" : "keys";
  await shot("top");
  const t = await truth(p);

  await p.locator("#tools").scrollIntoViewIfNeeded();
  await shot("tools", "#tools");
  const cards = await p.locator("#tool-grid .tool").count();
  const sent = await p.evaluate(() => window.TOOLS.tools.length);
  if (cards !== sent) problems.push(`tool cards: ${cards}, request had ${sent}`);

  await p.locator("#anatomy").scrollIntoViewIfNeeded();
  await shot("anatomy", "#anatomy");
  // Pointing at a part's list dims the other parts (pointer only).
  if (name !== "phone") {
    await p.locator('#req-parts .part[data-k="system"]').hover();
    await wait(p, 250);
    const hl = await p.locator("#anatomy").getAttribute("data-hl");
    if (hl !== "system") problems.push(`hovering the system list set data-hl=${hl}`);
    await shot("anatomy-hover", "#anatomy");
    await p.mouse.move(0, 0);
  }

  await p.locator("#allowlist").scrollIntoViewIfNeeded();
  await shot("allowlist", "section:has(> #s-decide)");

  // The quiz, untouched.
  await p.locator("#quiz").scrollIntoViewIfNeeded();
  await shot("quiz-start", "#quiz");
  const n = await p.locator("#quiz .q-dots li").count();

  // Answer every request: "ask" on the odd ones, "allow" on the even ones. Each verdict must say what
  // the trace says, and the score must count the matches.
  let expectHits = 0;
  for (let k = 0; k < n; k++) {
    const call = +(await p.locator("#quiz .q-call").textContent()).match(/\d+/)[0];
    const pick = k % 2 ? "ask" : "allow";
    await answer(p, pick, how);
    const actual = await p.locator("#quiz .q-verdict").getAttribute("data-actual");
    const wasDenied = t.denied.includes(call);
    if ((actual === "refused") !== wasDenied) problems.push(`quiz: call ${call} shows "${actual}", trace denied=${wasDenied}`);
    if ((pick === "ask") === wasDenied) expectHits++;
    if (k === 0) await shot("quiz-answered", "#quiz");
    if (k === 2) await shot("quiz-ran", "#quiz");
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.id);
    if (how === "keys" && focused !== "q-next") problems.push(`after answering, focus is on #${focused}, not the next button`);
    await next(p, how);
  }
  await settle(p);
  const score = await p.locator("#quiz .q-summary h3").textContent();
  if (!score.includes(String(expectHits))) problems.push(`quiz score "${score}", expected ${expectHits} matches`);
  console.log(`  quiz: ${n} requests, score "${score.trim()}"`);
  await shot("quiz-done", "#quiz");

  // Again, then skip: the summary with nothing answered.
  await p.locator("#q-again").click();
  await wait(p, 100);
  const back = await p.locator("#quiz .q-head h3").textContent();
  if (!/1/.test(back)) problems.push(`"start again" shows "${back}"`);
  await p.locator("#q-skip").click();
  await wait(p, 100);
  await shot("quiz-skipped", "#quiz");

  // Every refusal in the trace is listed.
  const listed = await p.locator("#refusals .refusal").count();
  if (listed !== t.denied.length) problems.push(`refusals listed: ${listed}, trace has ${t.denied.length}`);
  await p.locator("#refusals").scrollIntoViewIfNeeded();
  await shot("refusals", "#refusals");
  const marked = await p.locator("#refusals mark").count();
  console.log(`  refusals: ${listed} listed, ${marked} named parts marked; Bash requests ${t.bash}`);

  await p.locator("#ran-anyway").scrollIntoViewIfNeeded();
  await shot("puzzle", "section:has(> #s-puzzle)");

  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: answer a few requests, finish by skipping, start again; hover the request's parts.
async function exercise(p) {
  await p.locator("#quiz").scrollIntoViewIfNeeded();
  await answer(p, "allow", "keys");
  await next(p, "keys");
  await answer(p, "ask", "keys");
  await next(p, "keys");
  await p.locator("#q-skip").click();
  await p.locator("#q-again").click();
  await p.locator('#req-parts .part[data-k="tools"]').hover();
}

// A verdict arriving, the next request, and the summary's rows. (Reveal-on-scroll motion can't be
// captured here: capture() settles the page first, which shows everything waiting to be revealed.)
async function motion(p, capture) {
  await p.locator("#quiz").scrollIntoViewIfNeeded();
  await capture("ch5-verdict", "#quiz", () => p.locator('#quiz .q-btn[data-a="allow"]').click());
  await capture("ch5-next", "#quiz", () => p.locator("#q-next").click());
  // The summary's rows arriving, after skipping.
  await capture("ch5-summary", "#quiz", () => p.locator("#q-skip").click());
}

module.exports = { name: "tools", file: "tools/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
