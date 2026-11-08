// Screenshots of every page in PAGES (at the bottom) at desktop, phone and dark mode, plus checks on
// each: console errors, horizontal overflow, and that every local link resolves to a file. Chapter 1
// also checks (desktop) that both game iframes load from file:// and take keyboard input.
// Usage: node scripts/screenshot.js [out-dir] [page] [--browser chromium|firefox|webkit].
// Writes <out-dir>/<page>/<size>-<state>.png (chromium, the default) or <out-dir>/<browser>/<page>/... .
// Screenshots show settled states: before each one, window.Motion.settle() finishes every animation
// and shows anything waiting to be revealed on scroll.
// Then two passes per page:
// - reduced motion: the page with prefers-reduced-motion: reduce, scrolled and used (the page's
//   `exercise`); fails if any animation or transition runs.
// - motion frames: the page's `motion(p, capture)` scenes, each paused and stepped through its
//   animations, written to <out-dir>/motion/<scene>-<n>.png.
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

// Arguments: positional [out-dir] [page], and --browser <name> (or --browser=<name>) anywhere.
const args = process.argv.slice(2);
let engine = "chromium";
const positional = [];
for (let i = 0; i < args.length; i++) {
  const m = args[i].match(/^--browser(?:=(.+))?$/);
  if (m) engine = m[1] || args[++i];
  else positional.push(args[i]);
}
if (!["chromium", "firefox", "webkit"].includes(engine)) {
  console.error(`unknown --browser ${engine}: use chromium, firefox or webkit`);
  process.exit(2);
}
const out = path.join(path.resolve(positional[0] || "shots"), engine === "chromium" ? "" : engine);
const site = path.resolve(__dirname, "..", "site");
const urlOf = (file) => "file:///" + path.join(site, file).split(path.sep).join("/");
const browserType = loadPlaywright()[engine];

const SIZES = {
  desk: { viewport: { width: 1360, height: 900 }, colorScheme: "light" },
  phone: { viewport: { width: 390, height: 844 }, colorScheme: "light", mobile: true },
  dark: { viewport: { width: 1360, height: 900 }, colorScheme: "dark" },
};

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

// Count every animation and transition that starts, from before the page's own scripts run.
const COUNT_ANIMATIONS = () => {
  window.__motion = [];
  const note = (what) => window.__motion.push(what);
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (...a) { note(`animate() on ${this.tagName.toLowerCase()}.${this.getAttribute("class") || ""}`); return orig.apply(this, a); };
  for (const type of ["animationstart", "transitionrun"]) {
    document.addEventListener(type, (e) => note(`${type} ${e.animationName || e.propertyName} on ${e.target.tagName.toLowerCase()}.${e.target.getAttribute("class") || ""}`), true);
  }
};

// Pause what's running, step through it, and screenshot each step: `trigger` starts the motion.
async function capture(p, dir, label, selector, trigger, frames = 6) {
  await settle(p);
  await wait(p, 150);
  await trigger();
  const span = await p.evaluate(() => {
    const as = document.getAnimations().filter((a) => a.playState === "running" && a.effect && isFinite(a.effect.getComputedTiming().endTime));
    as.forEach((a) => a.pause());
    window.__frames = as.map((a) => [a, a.currentTime || 0]);
    return Math.max(0, ...as.map((a) => a.effect.getComputedTiming().endTime - (a.currentTime || 0)));
  });
  for (let i = 0; i < frames; i++) {
    const t = (span * i) / (frames - 1);
    await p.evaluate((t) => new Promise((done) => {
      window.__frames.forEach(([a, c0]) => { a.currentTime = c0 + t; });
      requestAnimationFrame(() => requestAnimationFrame(done));
    }), t);
    await p.locator(selector).screenshot({ path: path.join(dir, `${label}-${i + 1}.png`) });
  }
  await p.evaluate(() => window.__frames.forEach(([a]) => { try { a.finish(); } catch {} }));
  console.log(`  motion ${label}: ${frames} frames over ${Math.round(span)} ms`);
}

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
  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}
async function contentsExercise(p) {
  if (await p.locator(".toc-item").count()) await p.locator(".toc-item").first().hover();
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
    await settle(p);
    await p.screenshot({ path: path.join(dir, "desk-full.png"), fullPage: true });
  }
}
async function loopExercise(p) {
  await p.locator("#player").scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) { await p.locator("#next").click(); await wait(p, 150); }
  await p.locator("#prev").click();
  await step(p, await p.evaluate(() => +document.getElementById("scrub").max));
  await p.locator('.game[data-game="before"] .game-play').click();
  await wait(p, 600);
}
// Chapter 1's step change: a model step to the harness step after it, where a round lands.
async function loopMotion(p, capture) {
  const fail = await stepIndex(p, "fails");
  await step(p, fail - 1);
  await p.locator("#player").scrollIntoViewIfNeeded();
  await capture("ch1-step", "#player", () => p.locator("#next").click());
}

// ---------- the pages ----------
// To add a chapter: a file scripts/shots/<name>.js that exports
// { name, file, sizes, states(p, { name, shot, problems, dir }) } with its file under site/. It's picked up here, so chapters
// built in parallel never edit this file. `node scripts/screenshot.js <out> <name>` checks one page only.
const PAGES = [
  { name: "contents", file: "index.html", sizes: ["desk", "phone", "dark"], states: contentsStates, exercise: contentsExercise },
  { name: "loop", file: "loop/index.html", sizes: ["desk", "phone", "dark"], states: loopStates, exercise: loopExercise, motion: loopMotion },
];
const shotsDir = path.join(__dirname, "shots");
if (fs.existsSync(shotsDir)) {
  for (const f of fs.readdirSync(shotsDir).filter((x) => x.endsWith(".js")).sort()) PAGES.push(require(path.join(shotsDir, f)));
}
const only = positional[1];
if (only) PAGES.splice(0, PAGES.length, ...PAGES.filter((p) => p.name === only));

(async () => {
  const browser = await browserType.launch();
  console.log(`browser: ${engine} ${browser.version()}`);
  let bad = false;
  for (const page of PAGES) {
    const dir = path.join(out, page.name);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${page.name} (${page.file})`);
    for (const name of page.sizes) {
      const { viewport, colorScheme, mobile } = SIZES[name];
      // Firefox has no mobile emulation (isMobile); it still gets the phone viewport and touch.
      const ctx = await browser.newContext({ viewport, colorScheme, hasTouch: !!mobile, ...(engine === "firefox" ? {} : { isMobile: !!mobile }) });
      const p = await ctx.newPage();
      const errors = [];
      const problems = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await p.goto(urlOf(page.file));
      await p.evaluate(() => document.fonts.ready);
      await wait(p, 600);
      const shot = async (label, el) => {
        await settle(p);
        await wait(p, 50);
        return el ? p.locator(el).screenshot({ path: path.join(dir, `${name}-${label}.png`) })
          : p.screenshot({ path: path.join(dir, `${name}-${label}.png`) });
      };

      await page.states(p, { name, shot, problems, dir });
      await checkLinks(p, problems);

      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      console.log(`${page.name} ${name}`, "overflow", overflow, "errors", errors, problems.length ? "problems " + JSON.stringify(problems) : "");
      if (overflow > 0 || errors.length || problems.length) bad = true;
      await ctx.close();
    }

    // Reduced motion: scroll the whole page and use it; nothing may animate.
    {
      const ctx = await browser.newContext({ ...SIZES.desk, reducedMotion: "reduce" });
      await ctx.addInitScript(COUNT_ANIMATIONS);
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(urlOf(page.file));
      await p.evaluate(() => document.fonts.ready);
      for (let y = 0, h = await p.evaluate(() => document.documentElement.scrollHeight); y < h; y += 500) {
        await p.evaluate((y) => window.scrollTo(0, y), y);
        await wait(p, 60);
      }
      if (page.exercise) await page.exercise(p);
      await wait(p, 300);
      const ran = await p.evaluate(() => window.__motion.concat(document.getAnimations().map((a) => `still running: ${a.animationName || a.transitionProperty || "animation"}`)));
      const hidden = await p.evaluate(() => document.querySelectorAll(".rv").length);
      console.log(`${page.name} reduced-motion: ${ran.length} animations, ${hidden} hidden for reveal, errors ${JSON.stringify(errors)}`);
      ran.slice(0, 8).forEach((r) => console.log(`  ${r}`));
      if (ran.length || hidden || errors.length) bad = true;
      await ctx.close();
    }

    // Motion frames.
    if (page.motion) {
      const mdir = path.join(out, "motion");
      fs.mkdirSync(mdir, { recursive: true });
      const ctx = await browser.newContext(SIZES.desk);
      const p = await ctx.newPage();
      await p.goto(urlOf(page.file));
      await p.evaluate(() => document.fonts.ready);
      await wait(p, 400);
      await page.motion(p, (label, sel, trigger) => capture(p, mdir, label, sel, trigger));
      await ctx.close();
    }
  }
  await browser.close();
  console.log("screenshots in", out);
  process.exit(bad ? 1 : 0);
})();
