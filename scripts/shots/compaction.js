// Chapter 4 (site/compaction/) for scripts/screenshot.js: the top, the before/after figure in both
// states (switched by keyboard), "What survived?" before and after a guess and with everything
// revealed, the summary with a highlight opened, the sizes figure and the files, the answer and its
// table, the costs and the end. Also checks: the switch moves by keyboard; a guess reveals that event
// only and is scored; "show all" reveals the rest; a highlight opens and closes by keyboard; the page
// logged no "[chapter 4]" check failures (those are console errors, so they also fail the run).
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

async function states(p, { name, shot, problems, dir }) {
  await shot("top");

  // The figure, before and after, switched from the keyboard.
  await p.locator("#squash").scrollIntoViewIfNeeded();
  await shot("squash-before", "#squash");
  await p.locator('#squash-mode input[value="before"]').focus();
  await p.keyboard.press("ArrowRight");
  await wait(p, 900);
  const st = await p.locator("#squash-grid").getAttribute("data-state");
  if (st !== "after") problems.push(`squash switch by keyboard gave state ${st}`);
  await shot("squash-after", "#squash");
  const n = await p.locator("#squash-n").textContent();
  console.log(`  squash after: ${n}`);

  // The game, untouched; then one guess (tap on phone); then all.
  await p.locator(".survive").scrollIntoViewIfNeeded();
  await shot("game-start", ".survive");
  const first = p.locator(".ev").first();
  const opt = first.locator('.opt[data-o="answer"]');
  if (name === "phone") await opt.tap(); else await opt.click();
  await wait(p, 600);
  const revealed = await p.locator(".ev.done").count();
  if (revealed !== 1) problems.push(`one guess revealed ${revealed} events`);
  const score = await p.locator("#score").textContent();
  console.log(`  after one guess: ${score}`);
  await shot("game-one", ".ev:first-child");
  await p.locator("#reveal-all").click();
  await wait(p, 900);
  const all = await p.locator(".ev.done").count();
  const total = await p.locator(".ev").count();
  if (all !== total) problems.push(`"show all" revealed ${all} of ${total}`);
  const outcomes = await p.evaluate(() => [...document.querySelectorAll(".ev")].map((e) => `${e.dataset.k}:${e.dataset.outcome}`));
  console.log(`  outcomes: ${outcomes.join(", ")}`);
  if (await p.locator("#tally").isHidden()) problems.push("tally not shown after all were revealed");
  await shot("game-all", ".survive");

  // The summary: open a highlight from the keyboard, and close it again.
  await p.locator("#summary-doc").scrollIntoViewIfNeeded();
  const hl = p.locator('#summary-body .hl[data-k="fail1"]');
  if (!(await hl.count())) problems.push("summary highlight for the first failure is missing");
  else {
    await hl.focus();
    await p.keyboard.press("Enter");
    await wait(p, 300);
    if (await p.locator("#box-fail1").isHidden()) problems.push("Enter on a highlight did not open its box");
    await hl.scrollIntoViewIfNeeded();
    await shot("summary-open", "#summary-doc");
    await p.keyboard.press(" ");
    await wait(p, 150);
    if (!(await p.locator("#box-fail1").isHidden())) problems.push("Space on an open highlight did not close it");
    await p.keyboard.press(" ");
    await wait(p, 200);
  }
  const marks = await p.locator("#summary-body .hl").count();
  console.log(`  summary highlights: ${marks}`);
  await p.locator("#summary-head").scrollIntoViewIfNeeded();
  await shot("summary-top");

  await p.locator("#sizes").scrollIntoViewIfNeeded();
  await shot("sizes", "#sizes");
  await p.locator("#files").scrollIntoViewIfNeeded();
  await shot("files", "#files");

  await p.locator(".answer").scrollIntoViewIfNeeded();
  await shot("answer", ".answer");
  await p.locator(".matrix-wrap").scrollIntoViewIfNeeded();
  await shot("matrix", ".matrix-wrap");
  const rows = await p.locator("#matrix tbody tr").count();
  if (rows < 5) problems.push(`answer table has ${rows} rows`);

  const costs = p.locator("#costs");
  if (await costs.isHidden()) problems.push("cost figure hidden: prices did not reproduce the recorded cost");
  else { await costs.scrollIntoViewIfNeeded(); await shot("costs", "#costs"); }

  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: switch the figure both ways, guess, show all, open a highlight.
async function exercise(p) {
  await p.locator("#squash").scrollIntoViewIfNeeded();
  await p.locator('#squash-mode input[value="before"]').focus();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowLeft");
  await p.locator(".ev").first().locator(".opt").first().click();
  await p.locator("#reveal-all").click();
  const hl = p.locator("#summary-body .hl").first();
  await hl.scrollIntoViewIfNeeded();
  await hl.click();
}

// The conversation collapsing into what was left, and one event's reveal.
async function motion(p, capture) {
  await p.locator("#squash").scrollIntoViewIfNeeded();
  await capture("ch4-compact", "#squash", () => p.locator('#squash-mode input[value="after"] + span').click());
  await capture("ch4-restore", "#squash", () => p.locator('#squash-mode input[value="before"] + span').click());
  const ev = p.locator('.ev[data-k="fail2"]');
  await ev.scrollIntoViewIfNeeded();
  await capture("ch4-guess", '.ev[data-k="fail2"]', () => ev.locator('.opt[data-o="answer"]').click());
}

module.exports = { name: "compaction", file: "compaction/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
