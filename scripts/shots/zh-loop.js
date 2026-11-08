// Chapter 1 in Chinese (site/zh/loop/): screenshot states and checks, picked up by scripts/screenshot.js.
// The same walk as the English chapter 1 in screenshot.js, finding steps by their zh titles (read from
// window.COPY, so nothing here depends on the wording), plus checks that only a translated page needs:
// its language, the language switch both ways, the colophon's issues link, the games and stills
// loading from the site root, and no English label left in the player.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

async function step(p, i) {
  await p.evaluate((v) => { const r = document.getElementById("scrub"); r.value = v; r.dispatchEvent(new Event("input")); }, i);
  await wait(p, 900);
}
// The step whose title is the copy's title for `key` (window.COPY.steps[key]; only for steps whose
// title takes no values).
const stepOfKey = (p, key) => p.evaluate((key) => {
  const want = window.COPY.steps[key].title();
  const r = document.getElementById("scrub");
  for (let i = 0; i <= +r.max; i++) {
    r.value = i; r.dispatchEvent(new Event("input"));
    if (document.getElementById("step-title").textContent === want) return i;
  }
  return -1;
}, key);

// Left edge of the paddle in the game canvas, from its pixels (as in screenshot.js).
async function paddleX(frame) {
  return frame.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const scale = c.width / 480;
    const y = Math.round((320 - 24 + 5) * scale);
    const row = g.getImageData(0, y, c.width, 1).data;
    let best = [0, -1], start = -1;
    for (let x = 0; x <= c.width; x++) {
      const i = x * 4;
      const on = x < c.width && row[i] > 150 && row[i + 1] < 120 && row[i + 2] < 100;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { if (x - start > best[0]) best = [x - start, start]; start = -1; }
    }
    return best[1] / scale;
  });
}

async function checkGame(p, sel, problems) {
  const fig = p.locator(sel);
  await fig.scrollIntoViewIfNeeded();
  if (await fig.locator(".game-play").count()) await fig.locator(".game-play").click();
  const handle = await fig.locator("iframe").elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForSelector("canvas");
  await wait(p, 400);
  const box = await handle.boundingBox();
  await p.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
  const focused = await frame.evaluate(() => document.activeElement && document.activeElement.tagName);
  const x0 = await paddleX(frame);
  await p.keyboard.down("ArrowRight");
  await wait(p, 500);
  await p.keyboard.up("ArrowRight");
  const x1 = await paddleX(frame);
  const scroll = await frame.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const ok = focused === "CANVAS" && x1 > x0 + 20 && scroll <= 0;
  console.log(`  game ${sel}: focus ${focused}, paddle ${x0.toFixed(0)} -> ${x1.toFixed(0)}, frame scroll ${scroll}`, ok ? "ok" : "FAIL");
  if (!ok) problems.push(`game ${sel} keyboard check failed`);
}

// What a Chinese page must have once its scripts ran.
async function zhChecks(p, problems) {
  const z = await p.evaluate(() => {
    const C = window.CHAPTERS;
    const alt = Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href]));
    const still = document.querySelector(".game-still");
    return {
      lang: document.documentElement.lang,
      locale: window.COPY.locale,
      canonical: document.querySelector('link[rel="canonical"]').href,
      alt,
      switch: [...document.querySelectorAll(".lang-switch a")].map((a) => [a.textContent, a.href, a.getAttribute("aria-current")]),
      issues: [...document.querySelectorAll('a[data-repo="issues"]')].map((a) => a.href),
      repo: C.repo,
      still: still && still.src,
      traceLinks: [...document.querySelectorAll("#trace-links a")].map((a) => a.href),
      // Labels the page draws itself (not the recording): none may be the English copy's.
      labels: [document.getElementById("step-num").textContent, document.getElementById("step-who").textContent,
        document.getElementById("play").textContent, document.getElementById("live").textContent,
        document.getElementById("context-label").textContent, document.getElementById("legend").textContent],
      kickerLink: document.querySelector(".kicker a").href,
      navLinks: [...document.querySelectorAll(".chapter-nav a")].map((a) => a.href),
    };
  });
  const bad = (m) => problems.push(`zh: ${m}`);
  if (z.lang !== "zh-CN" || z.locale !== "zh-CN") bad(`lang ${z.lang}, copy locale ${z.locale}`);
  if (z.canonical !== "https://loop.candygoogy.dev/zh/loop/") bad(`canonical ${z.canonical}`);
  if (z.alt.en !== "https://loop.candygoogy.dev/loop/" || z.alt["zh-CN"] !== z.canonical) bad(`hreflang ${JSON.stringify(z.alt)}`);
  const sw = z.switch.map(([t, h, c]) => `${t} ${h.split("/site/")[1]}${c ? " (current)" : ""}`);
  if (String(sw) !== "English loop/index.html,中文 zh/loop/index.html (current)") bad(`language switch [${sw.join(" | ")}]`);
  if (!z.issues.length || z.issues.some((h) => h !== `${z.repo}/issues`)) bad(`issues link ${z.issues}`);
  if (!z.still || !/\/site\/img\/game-start-/.test(z.still)) bad(`game still ${z.still}`);
  if (!z.traceLinks.length || z.traceLinks.some((h) => !/\/site\/data\/trace-02-run\d\.js$/.test(h))) bad(`trace links ${z.traceLinks}`);
  if (!/\/site\/zh\/index\.html$/.test(z.kickerLink)) bad(`kicker links ${z.kickerLink}`);
  if (z.labels.some((t) => /[A-Za-z]{4,}/.test(t.replace(/Claude Code|token/g, "")))) bad(`English left in the player labels: ${JSON.stringify(z.labels)}`);
  console.log(`  zh: switch [${sw.join(" | ")}], issues ${z.issues.length}, nav [${z.navLinks.map((h) => h.split("/site/")[1]).join(", ")}]`);
}

async function states(p, { name, shot, problems, dir }) {
  await zhChecks(p, problems);
  await shot("top");
  await p.locator('.game[data-game="before"] .game-play').click();
  await wait(p, 900);
  await shot("game-before", '.game[data-game="before"]');

  // Round 1, before the reader runs it, and once it's done.
  const round1 = await p.evaluate(() => {
    const r = document.getElementById("scrub");
    for (let i = 0; i <= +r.max; i++) { r.value = i; r.dispatchEvent(new Event("input")); if (document.querySelector("#cards .hs")) return i; }
    return -1;
  });
  if (round1 < 0) problems.push("round 1 widget not found");
  await step(p, round1);
  await p.locator("#player").scrollIntoViewIfNeeded();
  await shot("round1-idle", "#player");
  await p.locator(".hs-run").click();
  await wait(p, 600);
  await shot("round1-ran", "#player");
  await p.locator(".hs-paste").click();
  await p.waitForSelector('.hs[data-state="done"]');
  await wait(p, 300);
  await shot("round1-done", "#player");
  await wait(p, 1600);
  const moved = await p.evaluate(() => +document.getElementById("scrub").value);
  if (moved !== round1 + 1) problems.push(`after round 1 the player is at step ${moved}, expected ${round1 + 1}`);
  await p.locator("#play").click(); // pause the reading-pace play it started

  // The code coming back, the failing test and the final answer.
  const read = await stepOfKey(p, "c2res");
  await step(p, read);
  await shot("code-back", "#player");
  const fail = await stepOfKey(p, "c3res");
  if (fail < 0) problems.push("failing-test step not found");
  await step(p, fail);
  await shot("failing-test", "#player");
  await step(p, await p.evaluate(() => +document.getElementById("scrub").max));
  await shot("final-answer", "#player");

  // Live mode, part way through.
  await step(p, 0);
  await p.locator("#live").click();
  await wait(p, 11000);
  await shot("live", "#player");
  const clock = await p.locator("#clock").textContent();
  const liveTitle = await p.locator("#step-title").textContent();
  const neutral = await p.evaluate(() => window.COPY.steps.waiting.title());
  console.log(`  live clock at ~11 s: ${clock}, title "${liveTitle}"`);
  if (liveTitle !== neutral) problems.push(`live mode shows "${liveTitle}" before the result arrived`);
  await p.locator("#prev").click();
  const paused = await p.evaluate(() => document.getElementById("live").getAttribute("aria-pressed"));
  if (paused !== "false") problems.push("live mode did not pause on a manual control");

  const after = p.locator('.game[data-game="after"]');
  await after.scrollIntoViewIfNeeded();
  await after.locator(".game-play").click();
  await wait(p, 900);
  await shot("game-after", '.game[data-game="after"]');

  await p.locator(".stats").scrollIntoViewIfNeeded();
  await shot("stats", ".stats");
  await p.locator("section.next").scrollIntoViewIfNeeded();
  await shot("next", "section.next");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  if (name === "desk") {
    await checkGame(p, '.game[data-game="before"]', problems);
    await checkGame(p, '.game[data-game="after"]', problems);
  }
  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

async function exercise(p) {
  await p.locator("#player").scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) { await p.locator("#next").click(); await wait(p, 150); }
  await p.locator("#prev").click();
  await step(p, await p.evaluate(() => +document.getElementById("scrub").max));
  await p.locator('.game[data-game="before"] .game-play').click();
  await wait(p, 600);
}

async function motion(p, capture) {
  const fail = await stepOfKey(p, "c3res");
  await step(p, fail - 1);
  await p.locator("#player").scrollIntoViewIfNeeded();
  await capture("zh-ch1-step", "#player", () => p.locator("#next").click());
}

module.exports = { name: "zh-loop", file: "zh/loop/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
