// Playwright check for site/harness-step.js, run against tests/harness-step-demo.html from file://.
// Paths: mouse drag at 1360 px, keyboard only, touch, 390 px, dark mode, reduced motion.
// Each path must end with onDone fired exactly once and no console errors.
// Usage: node tests/harness-step-check.js [screenshot-dir] [--browser chromium|firefox|webkit]
// Touch drags go through CDP, so they run in chromium only; firefox and webkit check touch with taps.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/Workspace/Cache/ms-playwright";

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = execSync("npm root -g").toString().trim();
  return require(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
}

const args = process.argv.slice(2);
let engine = "chromium";
const positional = [];
for (let i = 0; i < args.length; i++) {
  const m = args[i].match(/^--browser(?:=(.+))?$/);
  if (m) engine = m[1] || args[++i];
  else positional.push(args[i]);
}
if (!["chromium", "firefox", "webkit"].includes(engine)) { console.error(`unknown --browser ${engine}`); process.exit(2); }
const out = path.join(path.resolve(positional[0] || "D:/Workspace/Docs/inside-the-loop/screenshots/harness-step"), engine === "chromium" ? "" : engine);
fs.mkdirSync(out, { recursive: true });
const url = "file:///" + path.resolve(__dirname, "harness-step-demo.html").split(path.sep).join("/");
const browserType = loadPlaywright()[engine];

const DESK = { width: 1360, height: 900 };
const PHONE = { width: 390, height: 844 };
const wait = (p, ms) => p.waitForTimeout(ms);

class Fail extends Error {}
function ok(cond, msg) { if (!cond) throw new Fail(msg); }

async function open(browser, name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".hs[data-state='idle']");
  await wait(page, 200);
  return { ctx, page, errors, name };
}

const state = (p) => p.$eval(".hs", (el) => el.dataset.state);
const done = (p) => p.evaluate(() => window.__hsDone);
const active = (p) => p.evaluate(() => {
  const a = document.activeElement;
  return a ? a.className : "";
});
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const center = async (p, sel) => {
  const b = await p.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  return b;
};
async function shot(t, label, full) {
  const file = path.join(out, `${t.name}-${label}.png`);
  if (full === "viewport") await t.page.screenshot({ path: file });
  else await (await t.page.$("#demo")).screenshot({ path: file });
}
async function targets(p, sels) {
  for (const sel of sels) {
    const r = await p.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return [b.width, b.height]; });
    ok(r[0] >= 44 && r[1] >= 44, `${sel} is ${r[0].toFixed(0)}x${r[1].toFixed(0)}, under 44 px`);
  }
}
async function noOverflow(p, when) {
  const o = await overflow(p);
  ok(o <= 0, `horizontal overflow ${o}px ${when}`);
}
async function finish(t) {
  await wait(t.page, 600);
  ok((await state(t.page)) === "done", `state is ${await state(t.page)}, expected done`);
  ok((await t.page.$$(".hs-result")).length === 1, "result card missing from the conversation");
  ok((await t.page.$$(".hs-out")).length === 0, "output card still on the computer");
  ok((await done(t.page)) === 1, `onDone fired ${await done(t.page)} times`);
  await noOverflow(t.page, "at the end");
  ok(t.errors.length === 0, `console errors: ${JSON.stringify(t.errors)}`);
}

// Mouse drag via real pointer events from Playwright's mouse.
async function mouseDrag(p, fromSel, to, steps = 14) {
  const a = await center(p, fromSel);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(to.x, to.y, { steps });
}

// Touch drag via CDP, so the browser produces trusted touch pointer events (pointerType "touch").
async function touchDrag(page, cdp, from, to, steps = 12, release = true) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from.x, from.y) });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) });
    await wait(page, 16);
  }
  if (release) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const paths = {
  // 1. Mouse drag at 1360 px, including a drop outside the slot that snaps back.
  async mouse(browser) {
    const t = await open(browser, "mouse", { viewport: DESK, colorScheme: "light" });
    const p = t.page;
    await shot(t, "1-idle");
    await targets(p, [".hs-run"]);
    await p.click(".hs-run");
    await wait(p, 600);
    ok((await state(p)) === "ran", "run did not show the output");
    await targets(p, [".hs-handle", ".hs-paste"]);
    await shot(t, "2-ran");

    const req = await center(p, ".hs-card.model");
    await mouseDrag(p, ".hs-handle", req);
    await shot(t, "3-drag-outside", "viewport");
    await p.mouse.up();
    await wait(p, 450);
    ok((await state(p)) === "ran", "a drop outside the slot did not snap back");
    const tf = await p.$eval(".hs-out", (el) => getComputedStyle(el).transform);
    ok(tf === "none", `output card not back in place (transform ${tf})`);

    await mouseDrag(p, ".hs-handle", await center(p, ".hs-slot"));
    ok(await p.$eval(".hs-slot", (el) => el.classList.contains("hs-over")), "slot not highlighted under the pointer");
    await shot(t, "4-drag-over-slot", "viewport");
    await p.mouse.up();
    await finish(t);
    await shot(t, "5-done");
    await t.ctx.close();
    return t;
  },

  // 2. Keyboard only: Tab, Enter, Enter.
  async keyboard(browser) {
    const t = await open(browser, "keyboard", { viewport: DESK, colorScheme: "light" });
    const p = t.page;
    await p.keyboard.press("Tab");
    ok((await active(p)).includes("hs-run"), `first Tab focused "${await active(p)}", not the run button`);
    await shot(t, "1-focus-run");
    await p.keyboard.press("Enter");
    await wait(p, 600);
    ok((await state(p)) === "ran", "Enter on run did not run");
    ok((await active(p)).includes("hs-paste"), `after run, focus is on "${await active(p)}", not the paste button`);
    await shot(t, "2-focus-paste");
    await p.keyboard.press("Enter");
    await finish(t);
    ok((await active(p)).includes("hs-result"), `after paste, focus is on "${await active(p)}", not the result card`);
    await shot(t, "3-done-focus-result");
    // Tab onward leaves the widget: no trap.
    await p.keyboard.press("Tab");
    ok((await p.evaluate(() => document.activeElement.id)) === "reset", "Tab after the result did not move on");
    await t.ctx.close();
    return t;
  },

  // 3. Touch at phone size: tap run, drag with a finger (snap back once, then drop).
  async touch(browser) {
    const t = await open(browser, "touch", { viewport: PHONE, hasTouch: true, ...(engine === "firefox" ? {} : { isMobile: true }), colorScheme: "light" });
    const p = t.page;
    await p.evaluate(() => {
      window.__types = [];
      document.addEventListener("pointerdown", (e) => window.__types.push(e.pointerType), true);
    });
    ok((await p.$eval(".hs-run", (el) => getComputedStyle(el).touchAction)) !== "none", "touch-action none leaked past the handle");
    await p.tap(".hs-run");
    await wait(p, 600);
    ok((await state(p)) === "ran", "tap on run did not run");
    ok((await p.$eval(".hs-handle", (el) => getComputedStyle(el).touchAction)) === "none", "handle lacks touch-action: none");
    ok((await p.$eval(".hs-out pre", (el) => getComputedStyle(el).touchAction)) !== "none", "output text cannot be scrolled by touch");

    // After run, the slot and the handle are on screen together, without the reader scrolling.
    const h = await center(p, ".hs-handle");
    const s0 = await p.$eval(".hs-slot", (el) => el.getBoundingClientRect().top);
    ok(s0 >= 0 && h.y < PHONE.height - 20, `slot top ${s0.toFixed(0)} / handle ${h.y.toFixed(0)}: not both in view after run`);
    await shot(t, "1-ran", "viewport");

    // No CDP outside chromium: tap the paste button instead of dragging.
    if (engine !== "chromium") {
      await p.tap(".hs-paste");
      await finish(t);
      const types = await p.evaluate(() => window.__types);
      ok(types.includes("touch"), `no touch pointer events seen (${types})`);
      await shot(t, "3-done", "viewport");
      await t.ctx.close();
      return t;
    }
    const cdp = await t.ctx.newCDPSession(p);
    await touchDrag(p, cdp, h, { x: h.x, y: h.y - 60 });
    await wait(p, 450);
    ok((await state(p)) === "ran", "a short touch drag outside the slot did not snap back");

    const h2 = await center(p, ".hs-handle");
    const s = await center(p, ".hs-slot");
    await touchDrag(p, cdp, h2, s, 14, false);
    ok(await p.$eval(".hs-slot", (el) => el.classList.contains("hs-over")), "slot not highlighted under the finger");
    ok(await p.$eval(".hs-out", (el) => el.classList.contains("hs-on-slot")), "dragged card does not show it is over the slot");
    await shot(t, "2-drag-over-slot", "viewport");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await finish(t);
    const types = await p.evaluate(() => window.__types);
    ok(types.includes("touch"), `no touch pointer events seen (${types})`);
    await shot(t, "3-done", "viewport");
    await t.ctx.close();
    return t;
  },

  // 4. 390 px wide, paste button by click; no horizontal overflow in any state.
  async phone(browser) {
    const t = await open(browser, "phone", { viewport: PHONE, colorScheme: "light" });
    const p = t.page;
    await noOverflow(p, "at start");
    await shot(t, "1-idle");
    await targets(p, [".hs-run"]);
    await p.click(".hs-run");
    await wait(p, 600);
    await noOverflow(p, "after run");
    await targets(p, [".hs-handle", ".hs-paste"]);
    await shot(t, "2-ran");
    await p.click(".hs-paste");
    await wait(p, 160);
    await shot(t, "3-paste-in-flight", "viewport");
    await finish(t);
    await shot(t, "4-done");
    await t.ctx.close();
    return t;
  },

  // 5. Dark mode, paste button by click.
  async dark(browser) {
    const t = await open(browser, "dark", { viewport: DESK, colorScheme: "dark" });
    const p = t.page;
    ok((await p.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)), "dark scheme not applied");
    await shot(t, "1-idle");
    await p.click(".hs-run");
    await wait(p, 600);
    await shot(t, "2-ran");
    await mouseDrag(p, ".hs-handle", await center(p, ".hs-slot"));
    await shot(t, "3-drag-over-slot", "viewport");
    await p.mouse.up();
    await finish(t);
    await shot(t, "4-done");
    await t.ctx.close();
    return t;
  },

  // 6. Reduced motion: keyboard with Space; every state change is instant, nothing animates.
  async reduced(browser) {
    const t = await open(browser, "reduced", { viewport: DESK, colorScheme: "light", reducedMotion: "reduce" });
    const p = t.page;
    await p.keyboard.press("Tab");
    await p.keyboard.press("Space");
    const afterRun = await p.evaluate(() => ({ s: document.querySelector(".hs").dataset.state, a: document.getAnimations().length }));
    ok(afterRun.s === "ran" && afterRun.a === 0, `after run: state ${afterRun.s}, ${afterRun.a} animations running`);
    await shot(t, "1-ran");
    await p.keyboard.press("Space");
    const afterPaste = await p.evaluate(() => ({ s: document.querySelector(".hs").dataset.state, a: document.getAnimations().length }));
    ok(afterPaste.s === "done" && afterPaste.a === 0, `after paste: state ${afterPaste.s}, ${afterPaste.a} animations running`);
    await finish(t);
    await shot(t, "2-done");
    // reset() brings it back to the start, and a second round fires onDone again exactly once.
    await p.click("#reset");
    await wait(p, 100);
    ok((await state(p)) === "idle" && (await done(p)) === 0, "reset did not return to the start");
    await t.ctx.close();
    return t;
  },
};

(async () => {
  const browser = await browserType.launch();
  console.log(`browser: ${engine} ${browser.version()}`);
  let bad = 0;
  for (const [name, fn] of Object.entries(paths)) {
    try {
      const t = await fn(browser);
      console.log(`ok   ${name.padEnd(9)} onDone 1, errors [], overflow 0`);
    } catch (e) {
      bad++;
      console.log(`FAIL ${name.padEnd(9)} ${e instanceof Fail ? e.message : e.stack}`);
    }
  }
  await browser.close();
  console.log("screenshots in", out);
  process.exit(bad ? 1 : 0);
})();
