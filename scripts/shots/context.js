// Chapter 2 (site/context/): screenshot states and checks, picked up by scripts/screenshot.js.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

// Scrub the explorer's slider from the first call to the last with the keyboard, one key press at a
// time at a key-repeat pace, and record every long task (over 50 ms) on the page meanwhile.
async function longTasks(p) {
  await p.locator(".explorer").scrollIntoViewIfNeeded();
  await settle(p);
  const n = await p.evaluate(() => +document.getElementById("ex-scrub").max);
  await p.locator("#ex-scrub").focus();
  await p.keyboard.press("Home");
  await wait(p, 300);
  await p.evaluate(() => {
    window.__long = [];
    window.__lto = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration))));
    window.__lto.observe({ type: "longtask" });
  });
  for (let i = 1; i < n; i++) { await p.keyboard.press("ArrowRight"); await wait(p, 33); }
  await wait(p, 600);
  const at = await p.evaluate(() => +document.getElementById("ex-scrub").value);
  const long = await p.evaluate(() => { window.__lto.disconnect(); return window.__long; });
  return { n, at, long };
}

// Go to a call through the slider, as a reader would.
async function call(p, n) {
  await p.evaluate((v) => { const r = document.getElementById("ex-scrub"); r.value = v; r.dispatchEvent(new Event("input")); }, n);
  await wait(p, 350);
}

async function states(p, { name, shot, problems, dir }) {
  await shot("top");

  const lt = await longTasks(p);
  console.log(`  keyboard scrub 1 -> ${lt.at} of ${lt.n}: ${lt.long.length} long tasks${lt.long.length ? ` (${lt.long.join(", ")} ms)` : ""}`);
  if (lt.at !== lt.n) problems.push(`keyboard scrub ended on call ${lt.at}, expected ${lt.n}`);
  if (lt.long.some((x) => x > 50)) problems.push(`long tasks while scrubbing: ${lt.long.join(", ")} ms`);

  await p.locator("#compare-chart svg").scrollIntoViewIfNeeded();
  await shot("compare", "#ctx-title ~ figure");

  // The explorer, mid-way through the session.
  const n = await p.evaluate(() => +document.getElementById("ex-scrub").max);
  const mid = Math.round(n / 2);
  await p.locator(".explorer").scrollIntoViewIfNeeded();
  await call(p, mid);
  await shot("explorer-mid", ".explorer");
  const where = await p.locator("#ex-call").textContent();
  if (!where.includes(String(mid))) problems.push(`explorer shows "${where}" after moving to call ${mid}`);

  // Phases: eight chips, in order, and each moves the slider to its first call.
  const chips = await p.evaluate(() => [...document.querySelectorAll("#ex-phases button")].map((b) => +b.dataset.n));
  const ordered = chips.every((v, i) => i === 0 || v > chips[i - 1]) && chips[0] === 1 && chips.length === 8;
  if (!ordered) problems.push(`phase starts look wrong: ${chips.join(",")}`);
  console.log(`  phase starts: ${chips.join(", ")}`);
  await p.locator("#ex-phases button").nth(3).click();
  await wait(p, 300);
  const at = await p.evaluate(() => +document.getElementById("ex-scrub").value);
  if (at !== chips[3]) problems.push(`phase chip went to call ${at}, expected ${chips[3]}`);

  // Hover a block (desk/dark) or tap it (phone): the detail shows that round.
  await call(p, n);
  const block = p.locator('#waffle .rnd[data-r="3"]');
  if (name === "phone") await block.locator(".c").first().tap();
  else await block.locator(".c").first().hover();
  await wait(p, 250);
  const detail = await p.locator("#ex-detail .dt-name").textContent();
  if (!/3/.test(detail)) problems.push(`hovering round 3 shows "${detail}"`);
  await shot("explorer-hover", ".explorer");

  // Keyboard: focus a block, move with the arrow keys.
  await p.mouse.move(0, 0);
  await p.locator('#waffle .rnd[tabindex="0"]').focus();
  await p.keyboard.press("Home");
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowRight");
  await wait(p, 200);
  const focused = await p.evaluate(() => document.activeElement.dataset.r);
  if (focused !== "2") problems.push(`arrow keys put focus on round ${focused}, expected 2`);
  await shot("explorer-keys", ".explorer");

  // The start of the session: only the set-up.
  await call(p, 1);
  await shot("explorer-first", ".explorer");
  await call(p, n);

  await p.locator("#kinds-chart svg").scrollIntoViewIfNeeded();
  await shot("kinds", "#fills-title ~ figure");

  // The re-reading chart, with its crosshair on the halfway call.
  const rr = p.locator("#reread-chart svg");
  await rr.scrollIntoViewIfNeeded();
  const box = await rr.boundingBox();
  if (name === "phone") { await rr.focus(); for (let i = 0; i < 20; i++) await p.keyboard.press("ArrowLeft"); }
  else await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await wait(p, 200);
  const tipShown = await p.evaluate(() => !document.querySelector("#reread-chart .tip").hidden);
  if (!tipShown) problems.push("re-reading chart shows no tooltip");
  await shot("reread", "#reread-title ~ figure");
  await p.mouse.move(0, 0);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());

  // The two speed charts, one with a point highlighted from the keyboard.
  await p.locator(".pair").scrollIntoViewIfNeeded();
  await p.locator("#speed-out svg").focus();
  await wait(p, 200);
  await shot("speed", ".pair");
  await p.evaluate(() => document.activeElement && document.activeElement.blur());

  // The table, opened.
  await p.locator(".table-wrap summary").click();
  await wait(p, 200);
  await shot("table", ".table-wrap");
  const rows = await p.locator("#calls-body tr").count();
  if (rows !== n) problems.push(`table has ${rows} rows, expected ${n}`);
  await p.locator(".table-wrap summary").click();

  // The end: outcome, totals, next chapter and the colophon.
  await p.locator("#outcome-title").scrollIntoViewIfNeeded();
  await shot("outcome", "section:has(> #outcome-title)");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: scrub, use a phase chip and the arrow keys.
async function exercise(p) {
  await p.locator(".explorer").scrollIntoViewIfNeeded();
  await p.locator("#ex-scrub").focus();
  for (const k of ["Home", "ArrowRight", "ArrowRight", "End"]) await p.keyboard.press(k);
  await p.locator("#ex-phases button").nth(4).click();
  await p.locator("#ex-next").click();
}

// The grid filling as the slider moves one call, and a phase chip jumping several.
async function motion(p, capture) {
  await p.locator(".explorer").scrollIntoViewIfNeeded();
  await call(p, 21);
  await p.locator("#ex-scrub").focus();
  await capture("ch2-scrub", ".explorer", () => p.keyboard.press("ArrowRight"));
  await capture("ch2-phase", ".explorer", () => p.locator("#ex-phases button").nth(5).click());
}

module.exports = { name: "context", file: "context/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
