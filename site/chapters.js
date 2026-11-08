// Which chapters are out. The contents page, every chapter's foot, the preview cards (scripts/og.js) and
// the sitemap check (scripts/check-site.js) all read this file, so releasing a chapter is one change here:
// set `published: true`, remove the `<meta name="robots" content="noindex">` line from its index.html, and run
// node scripts/sitemap.js and node scripts/check-site.js.
// - published: linked from the contents page and the other chapters. Unpublished pages still exist, but
//   nothing links to them and they show a preview note at the top.
// - release: null for "coming soon", or a date as "YYYY-MM-DD" for "coming <date>".
// - langs: the languages the chapter exists in. "en" lives at site/<slug>/, every other language at
//   site/<lang>/<slug>/. The language switch in the masthead appears once there are two.
window.CHAPTERS = {
  name: "Read the Loop",
  site: "https://loop.candygoogy.dev",
  repo: "https://github.com/candygoogy/read-the-loop",
  // The contents page's own languages.
  langs: ["en"],
  // How each language is named in the switch, in its own words.
  langNames: { en: "English", zh: "中文" },
  list: [
    { n: 1, slug: "loop", title: "An agent is a loop", published: true, release: null, langs: ["en"] },
    { n: 2, slug: "context", title: "The context window", published: true, release: null, langs: ["en"] },
    { n: 3, slug: "cache", title: "Caching", published: true, release: null, langs: ["en"] },
    { n: 4, slug: "compaction", title: "Compaction", published: false, release: null, langs: ["en"] },
    { n: 5, slug: "tools", title: "Tools and permissions", published: false, release: null, langs: ["en"] },
    { n: 6, slug: "subagents", title: "Subagents", published: false, release: null, langs: ["en"] },
    { n: 7, slug: "failure-modes", title: "Failure modes", published: false, release: null, langs: ["en"] },
    { n: 8, slug: "build-your-own", title: "Build your own agent", published: false, release: null, langs: ["en"] },
  ],
};
