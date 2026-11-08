// Renders the preview cards (Open Graph images) into site/og/: one 1200 × 630 PNG per chapter page that
// exists (site/<slug>/index.html), named <slug>.png, and contents.png for the contents page. Also renders
// site/apple-touch-icon.png (180 × 180) from site/favicon.svg.
// The template is scripts/og/card.html. Each card's one line is the chapter's line from the contents page,
// read from site/index.html; its picture and every number in it are drawn from the traces at render time.
// Usage: node scripts/og.js            (Playwright's browser folder can be set in local.json, see scripts/local.js)
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

require("./local.js"); // Playwright's browser folder, from local.json

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = execSync("npm root -g").toString().trim();
  return require(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
}

const site = path.resolve(__dirname, "..", "site");
const toUrl = (file) => "file:///" + file.split(path.sep).join("/");
const card = toUrl(path.join(__dirname, "og", "card.html"));
const outDir = path.join(site, "og");

(async () => {
  const browser = await loadPlaywright().chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) errors.push(`external request: ${r.url()}`); });

  // The one-liners, as the contents page has them.
  await p.goto(toUrl(path.join(site, "index.html")));
  const { lines, dek, list } = await p.evaluate(() => ({
    lines: Object.fromEntries([...document.querySelectorAll("li[data-ch]")].map((li) => [li.dataset.ch, li.querySelector("p").textContent.trim()])),
    dek: document.querySelector(".masthead .dek").textContent.trim(),
    list: window.CHAPTERS.list,
  }));

  fs.mkdirSync(outDir, { recursive: true });
  const cards = [{ slug: "", file: "contents.png", dek }]
    .concat(list.filter((c) => fs.existsSync(path.join(site, c.slug, "index.html"))).map((c) => ({ slug: c.slug, file: `${c.slug}.png`, dek: lines[c.n] })));
  let bad = false;
  for (const c of cards) {
    await p.goto(`${card}?slug=${encodeURIComponent(c.slug)}&dek=${encodeURIComponent(c.dek || "")}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    const check = await p.evaluate(() => {
      const og = document.getElementById("og");
      const fig = document.querySelector(".toc-viz");
      const fits = [...og.children].every((el) => { const r = el.getBoundingClientRect(); return r.right <= 1200.5 && r.bottom <= 630.5; });
      return { fits, picture: !!(fig && fig.querySelector(".toc-art")), caption: fig && fig.textContent.trim(), fonts: [...document.fonts].filter((f) => f.status === "loaded").length };
    });
    const ok = check.fits && check.picture;
    console.log(`${c.file}: ${ok ? "ok" : "FAIL"} picture ${check.picture}, fits ${check.fits}, fonts loaded ${check.fonts}, caption "${check.caption}"`);
    if (!ok) bad = true;
    await p.screenshot({ path: path.join(outDir, c.file) });
  }

  // The home-screen icon: the favicon's loop on the site's paper.
  const svg = fs.readFileSync(path.join(site, "favicon.svg"), "utf8");
  await p.setViewportSize({ width: 180, height: 180 });
  await p.setContent(`<html><body style="margin:0;width:180px;height:180px;display:grid;place-items:center;background:#f3ede2">
    <div style="width:124px;height:124px">${svg.replace("<svg ", '<svg width="124" height="124" ')}</div></body></html>`);
  await p.screenshot({ path: path.join(site, "apple-touch-icon.png") });
  console.log("apple-touch-icon.png: 180 x 180");

  await browser.close();
  if (errors.length) { console.log("errors", errors); bad = true; }
  process.exit(bad ? 1 : 0);
})();
