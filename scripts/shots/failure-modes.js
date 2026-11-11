// Chapter 7 (site/failure-modes/) for scripts/screenshot.js: the top, the four cases, what we planted,
// the grid of runs (a run chosen by keyboard or tap), the result, the six cleanup runs, the build
// script, the agent's own words on what it couldn't check, the points and the end. Checks, against
// window.RUNS07 and the cleanup traces (not against the page's own code): one tile per run, the
// arrow keys and a tap move the choice with aria-pressed and the roving tabindex kept in step, the
// detail panel names the chosen run and lists its refused requests, the six cleanup cards are all
// there, every refusal text the cards quote is the trace's own, and the totals in the stats match.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

const truth = (p) => p.evaluate(() => {
  const R = window.RUNS07;
  const nf = new Intl.NumberFormat("en-US");
  const keys = Object.keys(window.TRACES);
  const firstRefusal = keys.map((k) => {
    const T = window.TRACES[k];
    for (const c of T.calls) for (const o of c.output) if (o.kind === "tool" && o.result && o.result.denied) return o.result.text.split(/(?<=\.)\s/)[0];
    return null;
  }).filter(Boolean);
  return { runs: R.runs.length, refused: nf.format(R.totals.refused), totalRuns: nf.format(R.totals.runs), traces: keys.length, firstRefusal,
    byKey: Object.fromEntries(R.runs.map((r) => [`${r.fixture}/${r.run}`, { fixture: r.fixture, run: r.run, refused: r.refused }])) };
});

async function choose(p, how, idx) {
  if (how === "tap") await p.locator(`#groups .tile[data-i="${idx}"]`).tap();
  else {
    await p.locator('#groups .tile[tabindex="0"]').focus();
    await p.keyboard.press("ArrowRight");
  }
  await wait(p, 150);
}

async function states(p, { name, shot, problems, dir }) {
  const how = name === "phone" ? "tap" : "keys";
  await shot("top");
  const t = await truth(p);

  await p.locator("#modes").scrollIntoViewIfNeeded();
  await shot("cases", "#modes");
  const cases = await p.locator("#modes .mode").count();
  if (cases !== 4) problems.push(`cases: ${cases}, expected 4`);
  const archives = await p.locator('#modes a[href*="web.archive.org"]').count();
  if (archives < 4) problems.push(`only ${archives} archive links in the cases`);

  await p.locator("#planted").scrollIntoViewIfNeeded();
  await shot("planted", "#planted");

  await p.locator("#runs-fig").scrollIntoViewIfNeeded();
  await shot("runs", "#runs-fig");
  const tiles = await p.locator("#groups .tile").count();
  if (tiles !== t.runs) problems.push(`grid tiles: ${tiles}, RUNS07 has ${t.runs} runs`);
  const tabbable = await p.locator('#groups .tile[tabindex="0"]').count();
  if (tabbable !== 1) problems.push(`grid: ${tabbable} tiles in the tab order, expected 1`);

  // Choose the second tile (keyboard: arrow right from the first; phone: tap it), then a cleanup run.
  await choose(p, how, 1);
  const pressed = await p.locator('#groups .tile[aria-pressed="true"]').getAttribute("data-i");
  if (pressed !== "1") problems.push(`grid: tile ${pressed} pressed after moving to tile 1`);
  const focusOk = await p.evaluate(() => document.activeElement && document.activeElement.dataset.i);
  if (how === "keys" && focusOk !== "1") problems.push(`grid: focus on tile ${focusOk}, expected 1`);
  const want = t.byKey[await p.locator('#groups .tile[data-i="1"]').getAttribute("data-run")];
  const title = await p.locator("#detail .d-title").textContent();
  if (!title.includes(want.fixture) || !title.includes(`Run ${want.run}`)) problems.push(`detail title "${title}" isn't ${want.fixture} run ${want.run}`);
  const items = await p.locator("#detail .ref-list li").count();
  if (items !== want.refused) problems.push(`detail lists ${items} refused requests, RUNS07 has ${want.refused}`);
  await shot("runs-chosen", "#runs-fig");

  // A run with three refusals, chosen by keyboard (End, then back along the row) or by tap.
  const order = await p.locator("#groups .tile").evaluateAll((els) => els.map((e) => e.dataset.run));
  const many = order.findIndex((k) => t.byKey[k].refused === 3);
  if (how === "tap") await p.locator(`#groups .tile[data-i="${many}"]`).tap();
  else {
    await p.keyboard.press("Home");
    for (let i = 0; i < many; i++) await p.keyboard.press("ArrowRight");
  }
  await wait(p, 150);
  const items3 = await p.locator("#detail .ref-list li").count();
  if (items3 !== 3) problems.push(`detail for tile ${many} lists ${items3} refused requests, expected 3`);
  await p.locator("#detail").scrollIntoViewIfNeeded();
  await shot("detail", "#detail");
  if (how === "keys") {
    await p.locator('#groups .tile[tabindex="0"]').focus();
    await p.keyboard.press("ArrowDown");
    await wait(p, 120);
    const after = await p.locator('#groups .tile[aria-pressed="true"]').getAttribute("data-i");
    if (after === String(many)) problems.push("grid: ArrowDown didn't move the choice");
  }

  await p.locator("section:has(> #s-result)").scrollIntoViewIfNeeded();
  await shot("result", "section:has(> #s-result)");

  await p.locator("#reason-card").scrollIntoViewIfNeeded();
  await shot("guard", "#reason-card");
  await p.locator("#clean-fig").scrollIntoViewIfNeeded();
  await shot("cleanup", "#clean-fig");
  const cards = await p.locator(".ccard").count();
  if (cards !== t.traces) problems.push(`cleanup cards: ${cards}, ${t.traces} traces loaded`);
  const quoted = await p.locator(".ccard .cc-quote").allTextContents();
  quoted.forEach((q, i) => { if (!t.firstRefusal.some((f) => q.includes(f))) problems.push(`cleanup card ${i + 1} quotes a refusal not in its trace: ${q}`); });

  await p.locator("#build-card").scrollIntoViewIfNeeded();
  await shot("build", "#build-card");
  await p.locator("#said").scrollIntoViewIfNeeded();
  await shot("said", "section:has(> #s-honest)");

  await p.locator(".points").scrollIntoViewIfNeeded();
  await shot("points", "section:has(> #s-shows)");
  const stat = await p.locator('[data-v="refused"]').textContent();
  if (stat !== t.refused) problems.push(`stats: refused "${stat}", RUNS07 ${t.refused}`);

  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: choose a few runs by click and by keyboard.
async function exercise(p) {
  await p.locator("#runs-fig").scrollIntoViewIfNeeded();
  await p.locator('#groups .tile[data-i="3"]').click();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowDown");
  await p.locator(".ccard").first().scrollIntoViewIfNeeded();
}

// A run chosen: the detail panel's new content rising in.
async function motion(p, capture) {
  await p.locator("#runs-fig").scrollIntoViewIfNeeded();
  await capture("ch7-detail", "#runs-fig", () => p.locator('#groups .tile[data-i="10"]').click());
}

module.exports = { name: "failure-modes", file: "failure-modes/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
