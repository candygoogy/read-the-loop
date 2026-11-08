// Writes site/sitemap.xml from site/chapters.js: the contents page and every published chapter, nothing
// else. Run it after publishing a chapter. scripts/check-site.js fails when the file is out of date.
// Usage: node scripts/sitemap.js [--check]
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const site = path.resolve(__dirname, "..", "site");

function chapters() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(site, "chapters.js"), "utf8"), sandbox);
  return sandbox.window.CHAPTERS;
}

function sitemap(C) {
  const urls = ["/"].concat(C.list.filter((c) => c.published).map((c) => `/${c.slug}/`));
  const more = C.list.filter((c) => c.published).flatMap((c) => (c.langs || []).filter((l) => l !== "en").map((l) => `/${l}/${c.slug}/`));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.concat(more).map((u) => `  <url><loc>${C.site}${u}</loc></url>\n`).join("") + "</urlset>\n";
}

module.exports = { chapters, sitemap };

if (require.main === module) {
  const file = path.join(site, "sitemap.xml");
  const want = sitemap(chapters());
  if (process.argv.includes("--check")) {
    const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") === want;
    console.log(ok ? "sitemap.xml is up to date" : "sitemap.xml is out of date: run node scripts/sitemap.js");
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(file, want);
  process.stdout.write(want);
}
