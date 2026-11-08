// What's out and what's coming, from window.CHAPTERS (site/chapters.js). Load it after chapters.js and
// after the page's own scripts, as the last script on the page. It reads <body data-page>:
// - "contents": sorts the chapters on the contents page into the published list (linked, with their
//   pictures) and "Coming next" (not linked, "coming soon" or "coming <date>").
// - a chapter's slug: fills the chapter navigation at the foot; on a published chapter adds the notice
//   about the next chapter to come, on an unpublished one the preview note at the top.
// On every page: removes links to unpublished chapters (wherever the narration has them), and draws the
// language switch in the masthead once the page exists in more than one language.
// Every label is in L below, one entry per language; the page's <html lang> picks it. Chapter titles
// come from chapters.js (`titles` for languages other than English), and links go to the page's own
// language wherever the chapter exists in it, to English otherwise.
(() => {
  "use strict";
  const C = window.CHAPTERS;
  if (!C) return;

  const L = {
    en: {
      locale: "en-GB",
      chapter: (n) => `Chapter ${n}`,
      chapterTitle: (n, t) => `Chapter ${n}: ${t}`,
      soon: "Coming soon",
      on: (date) => `Coming ${date}`,
      prev: "Previous",
      next: "Next",
      start: "Start here",
      read: "Read",
      preview: "Preview: this chapter isn't released yet.",
      out: (a, b) => (a === b ? `Chapter ${a} is out.` : `Chapters ${a} to ${b} are out.`),
      oneAtATime: "New chapters come out one at a time.",
      watch: "Watch → Releases on GitHub",
      watchTail: " to hear when it's out.",
      star: "Star on GitHub",
      allOut: "That's every chapter.",
      language: "Language",
      credit: "Read the Loop was made with Claude Code, from recordings of Claude Code. Code: MIT licence. Text, figures and recordings: CC BY 4.0.",
      source: "Source and credits on GitHub",
      // Between two sentences, and at the end of one.
      gap: " ",
      stop: ".",
      colon: ": ",
    },
    zh: {
      locale: "zh-CN",
      chapter: (n) => `第${zhN(n)}章`,
      chapterTitle: (n, t) => `第${zhN(n)}章：${t}`,
      soon: "即将推出",
      on: (date) => `${date}推出`,
      prev: "上一章",
      next: "下一章",
      start: "从这里开始",
      read: "阅读",
      preview: "预览：这一章还没有正式发布。",
      out: (a, b) => (a === b ? `第${zhN(a)}章已经发布。` : `第${zhN(a)}至${zhN(b)}章已经发布。`),
      oneAtATime: "新章节一章一章地发布。",
      watch: "在 GitHub 上选择 Watch → Releases",
      watchTail: "，新章节发布时就会收到通知。",
      star: "在 GitHub 上加星标",
      allOut: "全部章节都已发布。",
      language: "语言",
      credit: "Read the Loop 用 Claude Code 制作，内容来自 Claude Code 的录制。代码采用 MIT 许可证；文字、图表和录制采用 CC BY 4.0 许可。",
      source: "源代码与致谢在 GitHub 上",
      gap: "",
      stop: "。",
      colon: "：",
    },
  };
  // Chapter numbers in Chinese text: 一 to 十, then digits.
  function zhN(n) {
    return n >= 1 && n <= 10 ? "一二三四五六七八九十"[n - 1] : String(n);
  }
  const lang0 = (document.documentElement.lang || "en").split("-")[0];
  const lang = L[lang0] ? lang0 : "en";
  const T = L[lang];

  // Every page that loads this script loads lib/trace-ui.js first. All attributes below are double-quoted.
  const esc = window.TraceUI.esc;
  const chev = (d) => `<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const CHEV_NEXT = "m6 3 5 5-5 5", CHEV_PREV = "M10 3 5 8l5 5";

  // The site's root, from this script's own address (it lives in <root>/lib/). Links are built from it,
  // so they work the same from file:// and from the server; on the server they end at the folder.
  const self = document.currentScript && document.currentScript.src;
  const root = self ? new URL("../", self) : new URL("./", location.href);
  const served = /^https?:$/.test(root.protocol);
  const pagePath = (slug, l) => (l && l !== "en" ? `${l}/` : "") + (slug ? `${slug}/` : "") + (served ? "" : "index.html");
  const list = C.list;
  const bySlug = Object.fromEntries(list.map((c) => [c.slug, c]));
  // A page's address in a language: the chapter's (or, for slug "", the contents page's) own
  // language if it has it, English otherwise.
  const langsOf = (slug) => (slug ? (bySlug[slug] && bySlug[slug].langs) || ["en"] : C.langs || ["en"]);
  const href = (slug, l = lang) => new URL(pagePath(slug, langsOf(slug).includes(l) ? l : "en"), root).href;
  const titleOf = (c) => (lang !== "en" && c.titles && c.titles[lang]) || c.title;
  const page = document.body.dataset.page;
  const here = bySlug[page];

  // A release date "YYYY-MM-DD", read as a calendar day (no time zone shift).
  function dateText(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return new Intl.DateTimeFormat(T.locale, { weekday: "long", day: "numeric", month: "long" }).format(d);
  }
  const status = (c) => (dateText(c.release) ? T.on(dateText(c.release)) : T.soon);

  // ---------- no links to unpublished chapters ----------
  // A link counts if it resolves to an unpublished chapter's folder, in any language.
  const unpublished = new Set();
  list.filter((c) => !c.published).forEach((c) => {
    const langs = new Set(["en", ...(c.langs || [])]);
    langs.forEach((l) => {
      const base = new URL((l !== "en" ? `${l}/` : "") + `${c.slug}/`, root).href;
      unpublished.add(base);
      unpublished.add(base + "index.html");
    });
  });
  // Links within the page itself (#fragments, on a preview page too) stay.
  function unlink(scope) {
    const thisPage = location.href.split("#")[0];
    scope.querySelectorAll("a[href]").forEach((a) => {
      const url = a.href.split("#")[0];
      if (url === thisPage || !unpublished.has(url)) return;
      const span = document.createElement("span");
      span.className = "unlinked";
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    });
  }

  // ---------- language switch ----------
  function languageSwitch() {
    const langs = langsOf(here ? here.slug : "");
    const head = document.querySelector(".masthead");
    if (!head || langs.length < 2) return;
    const slug = here ? here.slug : "";
    const links = langs.map((l) => {
      const name = esc((C.langNames && C.langNames[l]) || l);
      return l === lang
        ? `<a href="${esc(href(slug, l))}" lang="${esc(l)}" hreflang="${esc(l)}" aria-current="page">${name}</a>`
        : `<a href="${esc(href(slug, l))}" lang="${esc(l)}" hreflang="${esc(l)}">${name}</a>`;
    }).join("");
    head.insertAdjacentHTML("afterbegin", `<nav class="lang-switch" aria-label="${esc(T.language)}">${links}</nav>`);
  }

  // ---------- contents page ----------
  function contents() {
    const out = document.querySelector("ol.toc");
    const later = document.querySelector("ol.toc-later");
    if (!out || !later) return;
    const items = Object.fromEntries([...document.querySelectorAll("li[data-ch]")].map((li) => [li.dataset.ch, li]));
    const front = [], back = [];
    list.forEach((c) => {
      const li = items[c.n];
      if (!li) return;
      const blurb = li.querySelector("p");
      const fig = li.querySelector("figure");
      const go = li.dataset.go || T.read;
      const text = document.createElement("div");
      text.className = "toc-text";
      if (c.published) {
        li.className = "toc-item";
        text.innerHTML = `<span class="toc-n">${esc(T.chapter(c.n))}</span><h3><a href="${esc(href(c.slug))}">${esc(titleOf(c))}</a></h3>`;
        if (blurb) text.appendChild(blurb);
        text.insertAdjacentHTML("beforeend", `<span class="toc-go" aria-hidden="true">${esc(go)}${chev(CHEV_NEXT)}</span>`);
        front.push(li);
      } else {
        li.className = fig ? "toc-soon has-viz" : "toc-soon";
        text.innerHTML = `<span class="toc-n">${esc(T.chapter(c.n))}<span class="toc-when"> · ${esc(status(c))}</span></span><h3>${esc(titleOf(c))}</h3>`;
        if (blurb) text.appendChild(blurb);
        back.push(li);
      }
      li.replaceChildren(text, ...(fig ? [fig] : []));
    });
    out.replaceChildren(...front);
    later.replaceChildren(...back);
    if (back.length) later.setAttribute("start", back[0].dataset.ch);
    const head = document.getElementById(later.getAttribute("aria-labelledby"));
    if (!back.length) { later.hidden = true; if (head) head.hidden = true; }
  }

  // ---------- a chapter page ----------
  function chapterNav() {
    const cn = document.querySelector(".chapter-nav .cn");
    if (!cn || !here) return;
    const i = list.indexOf(here);
    const prev = list[i - 1], next = list[i + 1];
    const card = (c, dir) => {
      const cls = `cn-link cn-${dir}`;
      const label = dir === "prev" ? T.prev : T.next;
      const title = `<span class="cn-title">${esc(T.chapterTitle(c.n, titleOf(c)))}</span>`;
      if (c.published) {
        const d = dir === "prev" ? `<span class="cn-dir">${chev(CHEV_PREV)}${esc(label)}</span>` : `<span class="cn-dir">${esc(label)}${chev(CHEV_NEXT)}</span>`;
        return `<a class="${cls}" href="${esc(href(c.slug))}" rel="${dir}">${d}${title}</a>`;
      }
      return `<span class="${cls} cn-soon"><span class="cn-dir">${esc(label)} · ${esc(status(c))}</span>${title}</span>`;
    };
    cn.insertAdjacentHTML("afterbegin", (prev ? card(prev, "prev") : "") + (next ? card(next, "next") : ""));
  }

  // The notice at the end of a published chapter: the next chapter still to come, and how to hear of it.
  // It goes at the end of the chapter's last "next" section (or of <main>).
  function comingNotice() {
    if (!here || !here.published) return;
    const i = list.indexOf(here);
    const coming = list.slice(i + 1).find((c) => !c.published);
    const sections = document.querySelectorAll("main section.next");
    const host = sections.length ? sections[sections.length - 1] : document.querySelector("main");
    if (!host) return;
    const repo = esc(C.repo);
    const star = `<p class="coming-star"><a href="${repo}">${esc(T.star)}</a></p>`;
    if (!coming) {
      host.insertAdjacentHTML("beforeend", `<aside class="coming" aria-label="${esc(T.star)}"><p>${esc(T.allOut)}</p>${star}</aside>`);
      return;
    }
    // "Chapters 1 to 3 are out" only where the chapter to come isn't the very next one.
    const outN = list.filter((c) => c.published).map((c) => c.n);
    const contiguous = outN.every((n, k) => n === k + 1);
    const lead = coming !== list[i + 1] && contiguous ? `${T.out(1, outN[outN.length - 1])}${T.gap}${T.oneAtATime}` : T.oneAtATime;
    // Where the page's own "Next" section already introduces that chapter, the card doesn't name it again.
    const named = coming === list[i + 1] && sections.length > 0;
    const title = esc(T.chapterTitle(coming.n, titleOf(coming)));
    host.insertAdjacentHTML("beforeend",
      `<aside class="coming" aria-label="${esc(status(coming))}${esc(T.colon)}${title}">` +
        `<p class="coming-when">${esc(status(coming))}</p>` +
        (named ? "" : `<p class="coming-title">${title}</p>`) +
        `<p>${esc(lead)}${esc(T.gap)}<a href="${repo}">${esc(T.watch)}</a>${esc(T.watchTail)}</p>` +
        star +
      `</aside>`);
  }

  // The note at the top of a chapter that isn't released: a reader can open it, nothing links to it,
  // and search engines are asked not to list it.
  function previewNote() {
    if (!here || here.published) return;
    const note = `<div class="preview band" role="note"><p>${esc(T.preview)}</p></div>`;
    const head = document.querySelector(".masthead");
    if (head) head.insertAdjacentHTML("beforebegin", note);
    else document.body.insertAdjacentHTML("afterbegin", note);
    if (!document.querySelector('meta[name="robots"]')) {
      document.head.insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex">');
    }
  }

  // Links to the repo take its address from chapters.js (data-repo="issues" goes to <repo>/issues);
  // every chapter's colophon ends with the credit.
  function repoLinks() {
    const foot = here && document.querySelector("footer.colophon");
    if (foot) foot.insertAdjacentHTML("beforeend", `<p class="site-credit">${esc(T.credit)}${esc(T.gap)}<a data-repo>${esc(T.source)}</a>${esc(T.stop)}</p>`);
    document.querySelectorAll("a[data-repo]").forEach((a) => { a.href = C.repo + (a.dataset.repo ? `/${a.dataset.repo}` : ""); });
  }

  if (page === "contents") contents();
  if (here) { chapterNav(); comingNotice(); previewNote(); }
  repoLinks();
  unlink(document);
  languageSwitch();
})();
