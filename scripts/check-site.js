// Launch checks for the whole site, from file://. Exits 1 if any fails.
// 1. Requests: opens every .html page under site/ (and the test demo and the preview-card template),
//    scrolls it to the end, and logs every request it makes. Anything other than file:, data: or blob:
//    fails. The full log goes to <out-dir>/requests.txt.
// 2. Meta tags on the contents page, every chapter page and 404.html, in every language: lang, title,
//    description, canonical, hreflang alternates, Open Graph and Twitter tags, theme colours, icons; the
//    preview image must exist and be 1200 × 630 (pages in another language reuse the English card).
// 3. Releases (site/chapters.js, drawn by site/lib/release.js): no links to unpublished chapters, the
//    preview note only on unpublished ones, the end notice only on published ones, the contents page
//    sorted right, the language switch on every page that exists in two languages (and only there),
//    linking each of them. Then the same with chapters.js changed in the browser: a release date,
//    chapter 4 published, and a chapter losing its translation.
// 4. Hosting files: sitemap.xml up to date, robots.txt.
// Usage: node scripts/check-site.js [out-dir]
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { chapters, sitemap } = require("./sitemap.js");

const local = require("./local.js"); // this machine's folders, from local.json

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = execSync("npm root -g").toString().trim();
  return require(path.join(root, "@playwright", "cli", "node_modules", "playwright"));
}

const repo = path.resolve(__dirname, "..");
const site = path.join(repo, "site");
const out = path.resolve(process.argv[2] || local.shots);
const toUrl = (file) => "file:///" + file.split(path.sep).join("/");
const C = chapters();
const LOCAL = /^(file|data|blob):/;
const problems = [];
const fail = (msg) => problems.push(msg);

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const f = path.join(dir, d.name);
    return d.isDirectory() ? htmlFiles(f) : d.name.endsWith(".html") ? [f] : [];
  });
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}

// Languages: the code chapters.js uses, and what the page's <html lang> says.
const HTML_LANG = { en: "en", zh: "zh-CN" };
const langsOf = (slug) => (slug ? (C.list.find((c) => c.slug === slug) || {}).langs || ["en"] : C.langs || ["en"]);
const urlOf = (slug, l) => `${C.site}/${l !== "en" ? l + "/" : ""}${slug ? slug + "/" : ""}`;

// What every page's head must say. `slug` is "" for the contents page, null for the 404 page.
function expectedHead(slug, lang = "en") {
  if (slug === null) return { title: `Page not found · ${C.name}`, noindex: true, lang: "en" };
  const ch = C.list.find((c) => c.slug === slug);
  const title = ch && (lang === "en" ? ch.title : (ch.titles || {})[lang]);
  const langs = langsOf(slug);
  return {
    lang: HTML_LANG[lang] || lang,
    title: ch ? `${title} · ${C.name}` : null,
    canonical: urlOf(slug, lang),
    image: `${C.site}/og/${slug || "contents"}.png`,
    type: slug ? "article" : "website",
    // Chinese says the same in fewer characters.
    description: lang === "zh" ? [30, 120] : [70, 170],
    alternates: langs.length > 1 ? Object.fromEntries(langs.map((l) => [HTML_LANG[l] || l, urlOf(slug, l)]).concat([["x-default", urlOf(slug, "en")]])) : {},
  };
}

async function checkHead(p, rel, slug, lang = "en") {
  const want = expectedHead(slug, lang);
  const h = await p.evaluate(() => {
    const m = (sel) => { const e = document.querySelector(sel); return e ? e.getAttribute("content") || e.getAttribute("href") : null; };
    return {
      lang: document.documentElement.lang,
      alternates: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((e) => [e.getAttribute("hreflang"), e.getAttribute("href")])),
      title: document.title,
      description: m('meta[name="description"]'),
      canonical: m('link[rel="canonical"]'),
      ogTitle: m('meta[property="og:title"]'),
      ogDescription: m('meta[property="og:description"]'),
      ogUrl: m('meta[property="og:url"]'),
      ogType: m('meta[property="og:type"]'),
      ogImage: m('meta[property="og:image"]'),
      ogImageAlt: m('meta[property="og:image:alt"]'),
      twitter: m('meta[name="twitter:card"]'),
      robots: m('meta[name="robots"]'),
      themes: [...document.querySelectorAll('meta[name="theme-color"]')].map((e) => [e.getAttribute("media"), e.getAttribute("content")]),
      icon: (() => { const e = document.querySelector('link[rel="icon"]'); return e && [e.href, e.type]; })(),
      touch: (() => { const e = document.querySelector('link[rel="apple-touch-icon"]'); return e && e.href; })(),
      h1: document.querySelectorAll("h1").length,
      fontLinks: document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]').length,
    };
  });
  const bad = (what) => fail(`${rel}: ${what}`);
  if (h.lang !== want.lang) bad(`lang "${h.lang}", expected "${want.lang}"`);
  if (want.title && h.title !== want.title) bad(`title "${h.title}", expected "${want.title}"`);
  if (!want.title && !h.title.startsWith(C.name)) bad(`title "${h.title}" doesn't start with ${C.name}`);
  const [dMin, dMax] = want.description || [70, 170];
  if (!h.description || h.description.length < dMin || h.description.length > dMax) bad(`description length ${h.description && h.description.length}`);
  if (h.h1 !== 1) bad(`${h.h1} h1 elements`);
  if (h.fontLinks) bad("Google Fonts link");
  if (h.themes.length !== 2 || !h.themes.some(([m]) => /light/.test(m)) || !h.themes.some(([m]) => /dark/.test(m))) bad(`theme-color ${JSON.stringify(h.themes)}`);
  if (!h.icon || h.icon[1] !== "image/svg+xml" || !fs.existsSync(new URL(h.icon[0]))) bad("svg icon missing");
  if (!h.touch || !fs.existsSync(new URL(h.touch)) || String(pngSize(new URL(h.touch))) !== "180,180") bad("apple-touch-icon missing or not 180 x 180");
  if (want.noindex) {
    if (h.robots !== "noindex") bad("404 page is not noindex");
    return h;
  }
  if (h.canonical !== want.canonical) bad(`canonical ${h.canonical}, expected ${want.canonical}`);
  if (JSON.stringify(h.alternates) !== JSON.stringify(want.alternates)) bad(`hreflang ${JSON.stringify(h.alternates)}, expected ${JSON.stringify(want.alternates)}`);
  if (h.ogUrl !== h.canonical) bad("og:url differs from canonical");
  if (h.ogTitle !== h.title) bad("og:title differs from title");
  if (h.ogDescription !== h.description) bad("og:description differs from description");
  if (h.ogType !== want.type) bad(`og:type ${h.ogType}`);
  if (h.twitter !== "summary_large_image") bad(`twitter:card ${h.twitter}`);
  if (!h.ogImageAlt) bad("og:image:alt missing");
  if (h.ogImage !== want.image) bad(`og:image ${h.ogImage}, expected ${want.image}`);
  else {
    const local = path.join(site, h.ogImage.slice(C.site.length + 1));
    if (!fs.existsSync(local)) bad(`og:image file missing: ${local}`);
    else if (String(pngSize(local)) !== "1200,630") bad(`og:image is ${pngSize(local)}, not 1200 x 630`);
  }
  return h;
}

// The release state a page shows, after its scripts ran.
const releaseState = (p) => p.evaluate(() => {
  const C = window.CHAPTERS;
  const root = new URL("./", document.querySelector('script[src$="chapters.js"]').src);
  const unpub = C.list.filter((c) => !c.published).map((c) => new URL(`${c.slug}/`, root).href);
  return {
    badLinks: [...document.querySelectorAll("a[href]")].map((a) => a.href.split("#")[0]).filter((h) => h !== location.href.split("#")[0] && unpub.some((u) => h === u || h === u + "index.html")),
    pageLinks: [...document.querySelectorAll('a[href^="#"]')].length,
    preview: document.querySelectorAll(".preview").length,
    robots: (document.querySelector('meta[name="robots"]') || {}).content || null,
    coming: (document.querySelector(".coming") || {}).innerText || null,
    nav: [...document.querySelectorAll(".chapter-nav .cn > *")].map((e) => `${e.tagName === "A" ? "link" : "text"}: ${e.innerText.replace(/\s+/g, " ").trim()}`),
    toc: [...document.querySelectorAll("ol.toc > li")].map((li) => `${li.dataset.ch}${li.querySelector("h3 a") ? " linked" : ""}`),
    later: [...document.querySelectorAll("ol.toc-later > li")].map((li) => `${li.dataset.ch}${li.querySelector("a") ? " linked" : ""}${li.querySelector(".toc-art") ? " +picture" : ""} ${(li.querySelector(".toc-when") || {}).textContent || ""}`.trim()),
    lang: [...document.querySelectorAll(".lang-switch a")].map((a) => `${a.textContent} ${a.getAttribute("href")}${a.getAttribute("aria-current") ? " (current)" : ""}`),
    langLinks: [...document.querySelectorAll(".lang-switch a")].map((a) => [a.getAttribute("hreflang"), a.href.slice(root.href.length), !!a.getAttribute("aria-current")]),
    credit: !!document.querySelector(".site-credit a[href]") || !!document.querySelector("footer a[data-repo][href]"),
    ch3: (document.querySelector('li[data-ch="3"] h3 a') || {}).href || null,
  };
});

// Change chapters.js in the browser, before the page reads it.
const tweak = (fn) => `(() => {
  let v;
  Object.defineProperty(window, "CHAPTERS", { configurable: true, get: () => v, set: (x) => { (${fn})(x); v = x; } });
})()`;

(async () => {
  const browser = await loadPlaywright().chromium.launch();
  const pages = htmlFiles(site).concat([path.join(repo, "tests", "harness-step-demo.html"), path.join(repo, "scripts", "og", "card.html")]);
  const log = [];
  let total = 0;

  console.log("1-3. requests, meta tags, release state");
  for (const file of pages) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const p = await ctx.newPage();
    const reqs = [];
    const errors = [];
    p.on("request", (r) => reqs.push(`${r.resourceType()} ${r.url()}`));
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(toUrl(file) + (rel.endsWith("card.html") ? "?slug=cache&dek=x" : ""));
    await p.evaluate(() => document.fonts.ready);
    for (let y = 0, h = await p.evaluate(() => document.documentElement.scrollHeight); y < h; y += 700) {
      await p.evaluate((y) => window.scrollTo(0, y), y);
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(400);
    const external = reqs.filter((r) => !LOCAL.test(r.split(" ")[1]));
    total += reqs.length;
    log.push(`## ${rel} (${reqs.length} requests)`, ...reqs, "");
    external.forEach((r) => fail(`${rel}: request outside the site: ${r}`));
    errors.forEach((e) => fail(`${rel}: error ${e}`));
    const fonts = reqs.filter((r) => r.startsWith("font ")).map((r) => path.basename(r)).join(", ");
    let line = `${rel}: ${reqs.length} requests, ${external.length} outside the site; fonts: ${fonts || "none"}`;

    // site/index.html, site/<slug>/index.html, and the same under site/<lang>/ for another language.
    const m = rel.match(/^site\/(?:(zh)\/)?(?:([^/]+)\/)?index\.html$/);
    const lang = (m && m[1]) || "en";
    const slug = rel === "site/404.html" ? null : m ? m[2] || "" : undefined;
    const ch = C.list.find((c) => c.slug === slug);
    if (slug === "" || slug === null || ch) {
      const h = await checkHead(p, rel, slug, lang);
      line += `\n    title "${h.title}" | canonical ${h.canonical || "-"} | og:image ${h.ogImage || "-"} | description ${h.description.length} chars`;
    }
    if (ch || slug === "") {
      const s = await releaseState(p);
      if (s.badLinks.length) fail(`${rel}: links to unpublished chapters ${s.badLinks}`);
      // The switch: every language the page exists in, this one current, each at its own address.
      const langs = langsOf(slug);
      const wantSwitch = langs.length > 1 ? langs.map((l) => [l, (l !== "en" ? `${l}/` : "") + (slug ? `${slug}/` : "") + "index.html", l === lang]) : [];
      if (JSON.stringify(s.langLinks) !== JSON.stringify(wantSwitch)) fail(`${rel}: language switch ${JSON.stringify(s.langLinks)}, expected ${JSON.stringify(wantSwitch)}`);
      wantSwitch.forEach(([, f]) => { if (!fs.existsSync(path.join(site, f))) fail(`${rel}: language switch links ${f}, which doesn't exist`); });
      if (s.lang.length) line += `\n    switch [${s.lang.join(" | ")}]`;
      if (!s.credit) fail(`${rel}: no link to the repo`);
      if (ch) {
        if (ch.published && (s.preview || !s.coming || s.robots)) fail(`${rel}: published, but preview ${s.preview}, notice ${!!s.coming}, robots ${s.robots}`);
        if (!ch.published && (!s.preview || s.coming || s.robots !== "noindex")) fail(`${rel}: unpublished, but preview ${s.preview}, notice ${!!s.coming}, robots ${s.robots}`);
        line += `\n    nav [${s.nav.join(" | ")}]` + (s.coming ? `\n    notice "${s.coming.replace(/\s+/g, " ")}"` : "") + (s.preview ? "\n    preview note, noindex" : "");
      } else {
        const pub = C.list.filter((c) => c.published).map((c) => `${c.n} linked`);
        if (String(s.toc) !== String(pub)) fail(`contents: published list ${s.toc}, expected ${pub}`);
        if (s.later.some((x) => /linked/.test(x))) fail(`contents: a coming chapter is linked ${s.later}`);
        line += `\n    out [${s.toc.join(", ")}] | coming [${s.later.join(", ")}]`;
      }
    }
    console.log(line);
    await ctx.close();
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "requests.txt"), log.join("\n"));
  console.log(`${pages.length} pages, ${total} requests, log in ${path.join(out, "requests.txt")}`);

  // The same pages with chapters.js changed: does everything follow it?
  console.log("\n3b. release scenarios (chapters.js changed in the browser)");
  async function scenario(name, fn, file) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await ctx.addInitScript(tweak(fn));
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(toUrl(path.join(site, file)));
    const s = await releaseState(p);
    errors.forEach((e) => fail(`${name} ${file}: error ${e}`));
    await ctx.close();
    return s;
  }
  // The next chapter to come out, and the last one already out: the scenarios follow chapters.js as it grows.
  const nextI = C.list.findIndex((c) => !c.published);
  const next = C.list[nextI], last = C.list[nextI - 1];
  const lastFile = `${last.slug}/index.html`;
  // tweak() sends these to the browser as text, so the index is written into them, not closed over.
  const dated = new Function("x", `x.list[${nextI}].release = "2026-11-17";`);
  let s = await scenario("dated", dated, "index.html");
  console.log(`  ch${next.n} dated 2026-11-17, contents: coming [${s.later.join(", ")}]`);
  if (!/Tuesday 17 November/i.test(s.later[0])) fail("dated: contents doesn't show the date");
  s = await scenario("dated", dated, lastFile);
  console.log(`  ch${next.n} dated, chapter ${last.n}: notice "${s.coming.replace(/\s+/g, " ")}" | nav [${s.nav.join(" | ")}]`);
  if (!/Coming Tuesday 17 November/i.test(s.coming) || !/Tuesday 17 November/i.test(s.nav.join())) fail(`dated: chapter ${last.n} doesn't show the date`);

  const publishNext = new Function("x", `x.list[${nextI}].published = true;`);
  s = await scenario("next out", publishNext, "index.html");
  console.log(`  ch${next.n} published, contents: out [${s.toc.join(", ")}] | coming [${s.later.join(", ")}]`);
  if (String(s.toc) !== C.list.slice(0, nextI + 1).map((c) => `${c.n} linked`).join(",")) fail("next out: contents not updated");
  s = await scenario("next out", publishNext, lastFile);
  console.log(`  ch${next.n} published, chapter ${last.n}: nav [${s.nav.join(" | ")}] | notice "${s.coming.replace(/\s+/g, " ")}"`);
  if (!s.nav.some((n) => /^link: Next/i.test(n)) || !new RegExp(`Chapter ${next.n + 1}`).test(s.coming)) fail(`next out: chapter ${last.n} not updated`);
  if (fs.existsSync(path.join(site, next.slug, "index.html"))) {
    s = await scenario("next out", publishNext, `${next.slug}/index.html`);
    console.log(`  ch${next.n} published, chapter ${next.n}: preview ${s.preview}, robots ${s.robots}, notice ${!!s.coming}, links to unpublished ${s.badLinks.length}`);
    // A static noindex tag stays in the file until a real release removes it (the published check fails a page that keeps it).
    if (s.preview || !s.coming || s.badLinks.length) fail(`next out: chapter ${next.n} still a preview`);
  }

  // Chapter 3 loses its translation: its switch goes, the zh contents page links the English chapter 3,
  // and the other pages keep theirs.
  const noZh3 = (x) => { x.list[2].langs = ["en"]; };
  for (const f of ["cache/index.html", "loop/index.html", "zh/index.html"]) {
    s = await scenario("no zh ch3", noZh3, f);
    console.log(`  ch3 English only, ${f}: switch [${s.lang.join(" | ")}]${f === "zh/index.html" ? ` | ch3 links ${s.ch3}` : ""}`);
    const wantSwitch = f !== "cache/index.html";
    if (wantSwitch !== (s.lang.length === 2)) fail(`no zh ch3: switch on ${f} is ${s.lang.length ? "shown" : "hidden"}`);
    if (f === "zh/index.html" && !/\/site\/cache\/index\.html$/.test(s.ch3 || "")) fail(`no zh ch3: zh contents links chapter 3 at ${s.ch3}`);
  }

  console.log("\n4. hosting files");
  const want = sitemap(C);
  const have = fs.readFileSync(path.join(site, "sitemap.xml"), "utf8").replace(/\r\n/g, "\n");
  if (have !== want) fail("sitemap.xml is out of date: run node scripts/sitemap.js");
  console.log(`  sitemap.xml: ${(have.match(/<loc>/g) || []).length} urls, ${have === want ? "matches" : "DOESN'T match"} chapters.js`);
  const robots = fs.readFileSync(path.join(site, "robots.txt"), "utf8");
  if (!robots.includes(`Sitemap: ${C.site}/sitemap.xml`)) fail("robots.txt has no Sitemap line");
  // Hosted on Cloudflare Pages (linked to the GitHub repo): the custom domain is set in the Pages project, not a file.
  console.log(`  robots.txt ok, site ${C.site}`);

  await browser.close();
  console.log(problems.length ? `\nFAIL\n${problems.map((x) => "  " + x).join("\n")}` : "\nall checks pass");
  process.exit(problems.length ? 1 : 0);
})();
