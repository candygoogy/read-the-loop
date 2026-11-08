// Screenshots of every page in PAGES (at the bottom) at desktop, phone and dark mode, plus checks on
// each: console errors, horizontal overflow, and that every local link resolves to a file. Chapter 1
// also checks (desktop) that both game iframes load from file:// and take keyboard input.
// Usage: node scripts/screenshot.js [out-dir]. Writes <out-dir>/<page>/<size>-<state>.png.
// Exits 1 if any check fails.
// Uses a local `playwright` if installed, otherwise the one bundled with the global @playwright/cli.
const path = require("path");
const fs = require("fs");
const { fileURLToPath } = require("url");
const { execSync } = require("child_process");

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/Workspace/Cache/ms-playwright";

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = execSync("npm root -g").toString().trim();
  return require(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
}

const out = path.resolve(process.argv[2] || "shots");
const site = path.resolve(__dirname, "..", "site");
const urlOf = (file) => "file:///" + path.join(site, file).split(path.sep).join("/");
const { chromium } = loadPlaywright();

const SIZES = {
  desk: { viewport: { width: 1360, height: 900 }, colorScheme: "light" },
  phone: { viewport: { width: 390, height: 844 }, colorScheme: "light", mobile: true },
  dark: { viewport: { width: 1360, height: 900 }, colorScheme: "dark" },
};

const wait = (p, ms) => p.waitForTimeout(ms);

// Go to a step through the slider, as a reader would.
async function step(p, i) {
  await p.evaluate((v) => { const r = document.getElementById("scrub"); r.value = v; r.dispatchEvent(new Event("input")); }, i);
  await wait(p, 900);
}
const stepIndex = (p, title) => p.evaluate((t) => {
  // Step titles come from the copy, so find steps by walking the slider.
  const r = document.getElementById("scrub");
  for (let i = 0; i <= +r.max; i++) {
    r.value = i; r.dispatchEvent(new Event("input"));
    if (document.getElementById("step-title").textContent.includes(t)) return i;
  }
  return -1;
}, title);

// Left edge of the paddle in the game canvas, from its pixels (the paddle is the widest run of the
// accent colour on its row). Read inside the frame, whose own origin Playwright can enter.
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
  // Click towards the left so the paddle has room to move right.
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

// Every link to a local file (file://, ignoring #fragments) must point at a file that exists.
async function checkLinks(p, problems) {
  const hrefs = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
  const local = [...new Set(hrefs.filter((h) => h.startsWith("file:")).map((h) => h.split("#")[0]))];
  const missing = local.filter((h) => !fs.existsSync(fileURLToPath(h)));
  console.log(`  links: ${local.length} local, ${missing.length} missing`);
  missing.forEach((h) => problems.push(`link does not resolve: ${h}`));
}

// ---------- states, one function per page ----------
// Each gets the page, the size's name, `shot(label, selector?)`, the page's problems list and its output folder.

async function contentsStates(p, { name, shot, dir }) {
  await shot("top");
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

async function loopStates(p, { name, shot, problems, dir }) {
  // The top: masthead and the game, not yet loaded.
  await shot("top");
  // The broken game, playing (first rally).
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
  await p.locator(".hs-paste").click();
  await p.waitForSelector('.hs[data-state="done"]');
  await wait(p, 300);
  await shot("round1-done", "#player");
  // After round 1 the session moves on by itself.
  await wait(p, 1600);
  const moved = await p.evaluate(() => +document.getElementById("scrub").value);
  if (moved !== round1 + 1) problems.push(`after round 1 the player is at step ${moved}, expected ${round1 + 1}`);
  await p.locator("#play").click(); // pause the reading-pace play it started

  // The failing test and the final answer.
  const fail = await stepIndex(p, "fails");
  await step(p, fail);
  await shot("failing-test", "#player");
  await step(p, await p.evaluate(() => +document.getElementById("scrub").max));
  await shot("final-answer", "#player");

  // Live mode, part way through (the harness is running the first test run around here).
  await step(p, 0);
  await p.locator("#live").click();
  await wait(p, 11000);
  await shot("live", "#player");
  const clock = await p.locator("#clock").textContent();
  const liveTitle = await p.locator("#step-title").textContent();
  const neutral = await p.evaluate(() => window.COPY.steps.waiting.title());
  console.log(`  live clock at ~11 s: ${clock}, title "${liveTitle}"`);
  if (liveTitle !== neutral) problems.push(`live mode shows "${liveTitle}" before the result arrived`);
  await p.locator("#prev").click(); // a manual control pauses it
  const paused = await p.evaluate(() => document.getElementById("live").getAttribute("aria-pressed"));
  if (paused !== "false") problems.push("live mode did not pause on a manual control");

  // The fixed game.
  const after = p.locator('.game[data-game="after"]');
  await after.scrollIntoViewIfNeeded();
  await after.locator(".game-play").click();
  await wait(p, 900);
  await shot("game-after", '.game[data-game="after"]');

  if (name === "desk") {
    await checkGame(p, '.game[data-game="before"]', problems);
    await checkGame(p, '.game[data-game="after"]', problems);
    await p.screenshot({ path: path.join(dir, "desk-full.png"), fullPage: true });
  }
}

// ---------- the pages ----------
// To add a chapter: one entry, with its file under site/ and a states function.
const PAGES = [
  { name: "contents", file: "index.html", sizes: ["desk", "phone", "dark"], states: contentsStates },
  { name: "loop", file: "loop/index.html", sizes: ["desk", "phone", "dark"], states: loopStates },
];

(async () => {
  const browser = await chromium.launch();
  let bad = false;
  for (const page of PAGES) {
    const dir = path.join(out, page.name);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${page.name} (${page.file})`);
    for (const name of page.sizes) {
      const { viewport, colorScheme, mobile } = SIZES[name];
      const ctx = await browser.newContext({ viewport, colorScheme, hasTouch: !!mobile, isMobile: !!mobile });
      const p = await ctx.newPage();
      const errors = [];
      const problems = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await p.goto(urlOf(page.file));
      await p.evaluate(() => document.fonts.ready);
      await wait(p, 600);
      const shot = (label, el) => (el ? p.locator(el).screenshot({ path: path.join(dir, `${name}-${label}.png`) })
        : p.screenshot({ path: path.join(dir, `${name}-${label}.png`) }));

      await page.states(p, { name, shot, problems, dir });
      await checkLinks(p, problems);

      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      console.log(`${page.name} ${name}`, "overflow", overflow, "errors", errors, problems.length ? "problems " + JSON.stringify(problems) : "");
      if (overflow > 0 || errors.length || problems.length) bad = true;
      await ctx.close();
    }
  }
  await browser.close();
  console.log("screenshots in", out);
  process.exit(bad ? 1 : 0);
})();
