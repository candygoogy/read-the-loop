// Chapter 6 (site/subagents/) for scripts/screenshot.js: the top, the prompt, the two conversations
// (coloured by kind and by the cache), the handoff (the report folded and opened), the hand-back,
// the tokens by conversation, the points and the end. Checks that the figure has one row per model call
// of the run shown (main and subagent), that the colour switch works by keyboard (desk, dark) and by tap
// (phone), that the report opens and closes by keyboard or tap with aria-expanded kept in step, and
// that the figure's readout gives the subagent's total and the main conversation's growth from the trace.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

// What the page should say, read straight from the trace (not from the page's own code).
const truth = (p) => p.evaluate(() => {
  const T = window.TRACES[2];
  const s = T.subagents[0];
  const at = T.calls.findIndex((c) => c.output.some((o) => o.kind === "tool" && o.tool === "Agent"));
  const nf = new Intl.NumberFormat("en-US");
  return { main: T.calls.length, sub: s.calls.length, peak: nf.format(s.totals.total_tokens), growth: nf.format(T.calls[at + 1].added_since_previous) };
});

async function press(p, sel, how) {
  if (how === "tap") await p.locator(sel).tap();
  else { await p.locator(sel).focus(); await p.keyboard.press(sel.includes("input") ? "Space" : "Enter"); }
  await wait(p, 120);
}

async function states(p, { name, shot, problems, dir }) {
  const how = name === "phone" ? "tap" : "keys";
  await shot("top");
  const t = await truth(p);

  await p.locator(".ask").scrollIntoViewIfNeeded();
  await shot("prompt", "section:has(> #s-intro)");

  await p.locator("#threads").scrollIntoViewIfNeeded();
  await shot("threads", "#threads");
  const rows = await p.locator("#tl .r-call").count();
  if (rows !== t.main + t.sub) problems.push(`figure rows: ${rows}, trace has ${t.main} + ${t.sub} calls`);
  const readout = await p.locator("#threads-readout").textContent();
  if (!readout.includes(t.peak) || !readout.includes(t.growth)) problems.push(`readout "${readout}" lacks ${t.peak} or ${t.growth}`);

  // The colour switch: to the cache and back.
  if (how === "tap") await p.locator('#threads-mode .seg-opt:has(input[value="cache"])').tap();
  else { await p.locator('#threads-mode input[value="kind"]').focus(); await p.keyboard.press("ArrowRight"); }
  await wait(p, 150);
  const mode = await p.locator("#tl").getAttribute("data-mode");
  if (mode !== "cache") problems.push(`colour switch: data-mode is ${mode}, expected cache`);
  if (!(await p.locator("#tl .seg.k-cached").count())) problems.push("cache mode draws no cached parts");
  await shot("threads-cache", "#threads");
  if (how === "tap") await p.locator('#threads-mode .seg-opt:has(input[value="kind"])').tap();
  else await p.keyboard.press("ArrowLeft");
  await wait(p, 150);
  if ((await p.locator("#tl").getAttribute("data-mode")) !== "kind") problems.push("colour switch didn't go back");

  // The handoff: folded, then the whole report, then folded again.
  await p.locator(".handoff").scrollIntoViewIfNeeded();
  await shot("handoff", ".handoff");
  await press(p, "#report-more", how);
  if ((await p.locator("#report-more").getAttribute("aria-expanded")) !== "true" || await p.locator("#report-rest").isHidden()) problems.push("report didn't open");
  await shot("report-open", "#report-card");
  await press(p, "#report-more", how);
  if ((await p.locator("#report-more").getAttribute("aria-expanded")) !== "false" || !(await p.locator("#report-rest").isHidden())) problems.push("report didn't close");

  await p.locator("#handback-card").scrollIntoViewIfNeeded();
  await shot("handback", "#handback-card");

  await p.locator(".split-wrap").scrollIntoViewIfNeeded();
  await shot("cost", "section:has(> #s-cost)");

  await p.locator(".points").scrollIntoViewIfNeeded();
  await shot("points", "section:has(> #s-shows)");

  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: switch the colours both ways, open and close the report.
async function exercise(p) {
  await p.locator("#threads").scrollIntoViewIfNeeded();
  await p.locator('#threads-mode .seg-opt:has(input[value="cache"])').click();
  await p.locator('#threads-mode .seg-opt:has(input[value="kind"])').click();
  await p.locator("#report-more").click();
  await p.locator("#report-more").click();
}

// The colour switch, and the report opening. (Reveal-on-scroll motion can't be captured here:
// capture() settles the page first, which shows everything waiting to be revealed.)
async function motion(p, capture) {
  await p.locator("#threads").scrollIntoViewIfNeeded();
  await capture("ch6-recolour", "#threads", () => p.locator('#threads-mode .seg-opt:has(input[value="cache"])').click());
  await p.locator("#report-card").scrollIntoViewIfNeeded();
  await capture("ch6-report", "#report-card", () => p.locator("#report-more").click());
}

module.exports = { name: "subagents", file: "subagents/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
