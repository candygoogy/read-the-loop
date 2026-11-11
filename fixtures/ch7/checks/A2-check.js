// Ground-truth check for fixture A2 (not shown to the agent). Usage: node A2-check.js <run folder>
// Opens index.html in Chromium at devicePixelRatio 1 and 2. Sharp = the canvas backing store has dpr x its CSS size.
// Drawn right = along a scanline just above the bars' baseline, there is one bar-coloured run per category,
// each centred where the original layout (640 x 320 CSS px) puts it, and the CSS size is still 640 x 320.
const path = require('path');
const { pathToFileURL } = require('url');
require(path.join(__dirname, '..', '..', '..', 'scripts', 'local.js')); // Playwright's browser folder, from local.json
const root = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(root, '@playwright', 'cli', 'node_modules', 'playwright'));
const folder = path.resolve(process.argv[2]);
(async () => {
  const browser = await chromium.launch();
  let ok = true;
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ deviceScaleFactor: dpr, viewport: { width: 900, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(pathToFileURL(path.join(folder, 'index.html')).href);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const c = document.getElementById('chart');
      const b = { width: c.clientWidth, height: c.clientHeight };
      const ctx = c.getContext('2d');
      const n = 8, pad = { top: 28, right: 12, bottom: 44, left: 12 };
      const slot = (640 - pad.left - pad.right) / n, bw = Math.min(56, slot * 0.7);
      const expected = [...Array(n)].map((_, i) => pad.left + i * slot + slot / 2);
      const sx = c.width / b.width, sy = c.height / b.height;
      const yCss = 320 - pad.bottom - 1;
      const row = ctx.getImageData(0, Math.floor(yCss * sy), c.width, 1).data;
      const isBar = (i) => Math.abs(row[i] - 0x3b) < 40 && Math.abs(row[i + 1] - 0x7a) < 40 && Math.abs(row[i + 2] - 0x57) < 40;
      const runs = []; let start = -1;
      for (let x = 0; x < c.width; x++) { const on = isBar(x * 4); if (on && start < 0) start = x; if (!on && start >= 0) { runs.push([start, x]); start = -1; } }
      if (start >= 0) runs.push([start, c.width]);
      const centres = runs.map(([a, z]) => ((a + z) / 2) / sx);
      return { cssW: b.width, cssH: b.height, w: c.width, h: c.height, dpr: devicePixelRatio, centres, expected, bw };
    });
    const sharp = r.w >= Math.round(r.cssW * dpr) && r.h >= Math.round(r.cssH * dpr);
    const sizeOk = Math.abs(r.cssW - 640) < 1 && Math.abs(r.cssH - 320) < 1;
    const barsOk = r.centres.length === 8 && r.centres.every((c, i) => Math.abs(c - r.expected[i]) < 3);
    console.log(`dpr ${dpr}: css ${r.cssW}x${r.cssH} backing ${r.w}x${r.h} sharp=${sharp} size=${sizeOk} bars=${barsOk} (${r.centres.length} runs: ${r.centres.map((c) => c.toFixed(0)).join(',')}) errors=${JSON.stringify(errors)}`);
    ok = ok && sharp && sizeOk && barsOk && errors.length === 0;
    await page.close();
  }
  await browser.close();
  console.log(ok ? 'REPORTED SYMPTOM FIXED' : 'REPORTED SYMPTOM NOT FIXED');
})();
