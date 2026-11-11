// Which chapters are out. The contents page, every chapter's foot, the preview cards (scripts/og.js) and
// the sitemap check (scripts/check-site.js) all read this file, so releasing a chapter is one change here:
// set `published: true`, remove the `<meta name="robots" content="noindex">` line from its index.html, and run
// node scripts/sitemap.js and node scripts/check-site.js.
// - published: linked from the contents page and the other chapters. Unpublished pages still exist, but
//   nothing links to them and they show a preview note at the top.
// - release: null for "coming soon", or a date as "YYYY-MM-DD" for "coming <date>".
// - langs: the languages the chapter exists in. "en" lives at site/<slug>/, every other language at
//   site/<lang>/<slug>/. The language switch in the masthead appears once there are two.
// - titles: the chapter's title in each language other than English (the contents page, the chapter
//   navigation and the end notice use it on that language's pages; the page's own <title> must match).
window.CHAPTERS = {
  name: "Read the Loop",
  site: "https://loop.candygoogy.dev",
  repo: "https://github.com/candygoogy/read-the-loop",
  // The contents page's own languages.
  langs: ["en", "zh"],
  // How each language is named in the switch, in its own words.
  langNames: { en: "English", zh: "中文" },
  list: [
    { n: 1, slug: "loop", title: "An agent is a loop", titles: { zh: "智能体就是一个循环" }, published: true, release: null, langs: ["en", "zh"] },
    { n: 2, slug: "context", title: "The context window", titles: { zh: "上下文窗口" }, published: true, release: null, langs: ["en", "zh"] },
    { n: 3, slug: "cache", title: "Caching", titles: { zh: "缓存" }, published: true, release: null, langs: ["en", "zh"] },
    { n: 4, slug: "compaction", title: "Compaction", titles: { zh: "压缩" }, published: true, release: null, langs: ["en", "zh"] },
    { n: 5, slug: "tools", title: "Tools and permissions", titles: { zh: "工具与权限" }, published: true, release: null, langs: ["en", "zh"] },
    { n: 6, slug: "subagents", title: "Subagents", titles: { zh: "子智能体" }, published: false, release: null, langs: ["en", "zh"] },
    { n: 7, slug: "failure-modes", title: "Failure modes", titles: { zh: "失败模式" }, published: false, release: null, langs: ["en", "zh"] },
    { n: 8, slug: "build-your-own", title: "Build your own agent", titles: { zh: "自己动手做一个智能体" }, published: false, release: null, langs: ["en"] },
  ],
};
