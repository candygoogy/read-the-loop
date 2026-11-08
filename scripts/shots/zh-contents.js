// The contents page in Chinese (site/zh/index.html): screenshot states and checks, picked up by
// scripts/screenshot.js. Checks its language, the language switch both ways, that the chapters link
// to their zh pages where chapters.js lists zh (to English otherwise), the zh titles from chapters.js,
// the zh captions under the pictures, and the issues link.
const path = require("path");

const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

async function zhChecks(p, problems) {
  const z = await p.evaluate(() => {
    const C = window.CHAPTERS;
    const rel = (h) => h.split("/site/")[1];
    return {
      lang: document.documentElement.lang,
      canonical: document.querySelector('link[rel="canonical"]').href,
      alt: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href])),
      switch: [...document.querySelectorAll(".lang-switch a")].map((a) => `${a.textContent} ${rel(a.href)}${a.getAttribute("aria-current") ? " (current)" : ""}`),
      toc: [...document.querySelectorAll("ol.toc > li")].map((li) => {
        const a = li.querySelector("h3 a");
        const c = C.list.find((x) => String(x.n) === li.dataset.ch);
        return { n: c.n, title: a.textContent, want: (c.titles && c.titles.zh) || c.title, href: rel(a.href), zh: (c.langs || []).includes("zh"), slug: c.slug };
      }),
      later: [...document.querySelectorAll("ol.toc-later h3")].map((h) => h.textContent),
      caps: [...document.querySelectorAll(".toc-cap")].map((f) => f.textContent),
      issues: [...document.querySelectorAll('a[data-repo="issues"]')].map((a) => a.href),
      repo: C.repo,
    };
  });
  const bad = (m) => problems.push(`zh contents: ${m}`);
  if (z.lang !== "zh-CN") bad(`lang ${z.lang}`);
  if (z.canonical !== "https://loop.candygoogy.dev/zh/") bad(`canonical ${z.canonical}`);
  if (z.alt.en !== "https://loop.candygoogy.dev/" || z.alt["zh-CN"] !== z.canonical) bad(`hreflang ${JSON.stringify(z.alt)}`);
  if (String(z.switch) !== "English index.html,中文 zh/index.html (current)") bad(`language switch [${z.switch.join(" | ")}]`);
  z.toc.forEach((c) => {
    const want = c.zh ? `zh/${c.slug}/index.html` : `${c.slug}/index.html`;
    if (c.href !== want) bad(`chapter ${c.n} links ${c.href}, expected ${want}`);
    if (c.title !== c.want) bad(`chapter ${c.n} title "${c.title}", expected "${c.want}"`);
  });
  if (!z.caps.length || z.caps.some((t) => /\b(calls|tokens|the cache|characters)\b/.test(t))) bad(`captions not in Chinese: ${JSON.stringify(z.caps)}`);
  if (!z.issues.length || z.issues.some((h) => h !== `${z.repo}/issues`)) bad(`issues link ${z.issues}`);
  console.log(`  zh: switch [${z.switch.join(" | ")}], out [${z.toc.map((c) => `${c.n} ${c.href}`).join(", ")}], coming [${z.later.join(", ")}]`);
  z.caps.forEach((c) => console.log(`  caption: ${c}`));
}

async function states(p, { name, shot, problems, dir }) {
  await zhChecks(p, problems);
  await shot("top");
  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}
async function exercise(p) {
  if (await p.locator(".toc-item").count()) await p.locator(".toc-item").first().hover();
}

module.exports = { name: "zh-contents", file: "zh/index.html", sizes: ["desk", "phone", "dark"], states, exercise };
