// Chapter 3 (site/cache/) for scripts/screenshot.js: the top, both charts, the cost toggle in both
// states, the table and the experiment cards. Also checks that the call picker moves by keyboard,
// that a tap or click on the bars picks a call, and that the toggle switches by keyboard.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());
const readout = (p, id) => p.locator(`#${id}-readout`).textContent();

async function states(p, { name, shot, problems, dir }) {
  await shot("top");

  // Chart 1, and its picker by keyboard.
  await p.locator("#reads").scrollIntoViewIfNeeded();
  await shot("reads", "#reads");
  const before = await readout(p, "reads-body");
  await p.locator("#reads-body-pick").focus();
  await p.keyboard.press("ArrowLeft");
  await wait(p, 100);
  const after = await readout(p, "reads-body");
  if (before === after) problems.push("reads picker did not move by keyboard");

  // A tap (phone) or click (desktop) near the left of the bars picks an early call.
  const cols = p.locator("#reads-body .viz-cols");
  const box = await cols.boundingBox();
  if (name === "phone") await p.touchscreen.tap(box.x + box.width * 0.05, box.y + box.height * 0.9);
  else await p.mouse.click(box.x + box.width * 0.05, box.y + box.height * 0.9);
  await wait(p, 100);
  const picked = await p.locator("#reads-body-pick").inputValue();
  if (+picked > 4) problems.push(`tap on the first bars picked call ${picked}`);

  // Chart 2, with the cache, then switched by keyboard to without.
  const costs = p.locator("#costs");
  if (!(await costs.count()) || !(await costs.isVisible())) { problems.push("cost chart hidden: prices did not reproduce the recorded total"); return; }
  await costs.scrollIntoViewIfNeeded();
  await shot("costs-with", "#costs");
  await p.locator('#cost-mode input[value="with"]').focus();
  await p.keyboard.press("ArrowRight");
  await wait(p, 800);
  const mode = await costs.getAttribute("data-mode");
  if (mode !== "without") problems.push(`cost toggle by keyboard gave mode ${mode}`);
  await shot("costs-without", "#costs");
  console.log(`  hero: ${await p.locator("#hero-n").textContent()} (${mode})`);

  // The table, open.
  await p.locator(".viz-table summary").click();
  await wait(p, 200);
  await p.locator(".viz-table").scrollIntoViewIfNeeded();
  await shot("table", ".viz-table");

  // The experiments.
  await p.locator("#trials").scrollIntoViewIfNeeded();
  await shot("trials", "#trials");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: pick calls, switch the cost view both ways.
async function exercise(p) {
  await p.locator("#reads-body-pick").focus();
  await p.keyboard.press("ArrowLeft");
  await p.locator("#costs").scrollIntoViewIfNeeded();
  await p.locator('#cost-mode input[value="with"]').focus();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowLeft");
}

// The cost bars and the total moving between the two views.
async function motion(p, capture) {
  await p.locator("#costs").scrollIntoViewIfNeeded();
  await capture("ch3-toggle", "#costs", () => p.locator('#cost-mode input[value="without"] + span').click());
  await capture("ch3-toggle-back", "#costs", () => p.locator('#cost-mode input[value="with"] + span').click());
}

module.exports = { name: "cache", file: "cache/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
