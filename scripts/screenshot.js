// Screenshots of the chapter page at desktop, phone and dark mode, plus a check for console errors
// and horizontal overflow. Usage: node scripts/screenshot.js [out-dir]
// Uses a local `playwright` if installed, otherwise the one bundled with the global @playwright/cli.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = execSync("npm root -g").toString().trim();
  return require(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
}

const out = path.resolve(process.argv[2] || "shots");
fs.mkdirSync(out, { recursive: true });
const page = "file:///" + path.resolve(__dirname, "..", "site", "index.html").split(path.sep).join("/");
const { chromium } = loadPlaywright();

const runs = [
  ["desk", { width: 1360, height: 900 }, "light", [0, 1, 4, 5, 7]],
  ["phone", { width: 390, height: 844 }, "light", [2, 5]],
  ["dark", { width: 1360, height: 900 }, "dark", [4]],
];

(async () => {
  const browser = await chromium.launch();
  let bad = false;
  for (const [name, viewport, colorScheme, steps] of runs) {
    const p = await browser.newPage({ viewport, colorScheme });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await p.goto(page);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(out, `${name}-top.png`) });
    const player = await p.$("#player");
    for (const s of steps) {
      await p.evaluate((v) => { const r = document.getElementById("scrub"); r.value = v; r.dispatchEvent(new Event("input")); }, s);
      await p.waitForTimeout(900);
      await player.screenshot({ path: path.join(out, `${name}-step${s + 1}.png`) });
    }
    if (name === "desk") await p.screenshot({ path: path.join(out, "desk-full.png"), fullPage: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(name, "overflow", overflow, "errors", errors);
    if (overflow > 0 || errors.length) bad = true;
  }
  await browser.close();
  console.log("screenshots in", out);
  process.exit(bad ? 1 : 0);
})();
