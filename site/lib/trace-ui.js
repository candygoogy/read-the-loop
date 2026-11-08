// Pure helpers for showing a recorded session (a window.TRACE) on any chapter page: escaping, number
// formatting, the light markdown for what the model wrote, line excerpts, and the HTML of the cards
// (request, result, model text). Nothing here reads the page or a particular trace; labels come from
// the chapter's copy file. The one exception is watchScrollBoxes, which keeps the page's scroll
// boxes reachable by keyboard. Classic script, one global: window.TraceUI.
(() => {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const base = (p) => p.split("/").pop();
  const secs = (ms) => (ms / 1000).toFixed(1);

  // m:ss.s, for times in the recording.
  function clock(ms) {
    const s = Math.max(0, ms) / 1000;
    const m = Math.floor(s / 60);
    const rest = (s - m * 60).toFixed(1).padStart(4, "0");
    return `${m}:${rest}`;
  }

  // Number, plural and list formatting for one locale. `pl(forms, n)` picks forms.one / forms.other
  // (each a function of the formatted number).
  function numbers(locale) {
    const nf = new Intl.NumberFormat(locale);
    const fmt = (n) => nf.format(n);
    const plural = new Intl.PluralRules(locale);
    const pl = (forms, n) => (forms[plural.select(n)] || forms.other)(fmt(n));
    const list = (items) => new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
    return { fmt, pl, list };
  }

  // ---------- reading a trace ----------
  const toolsOf = (c) => c.output.filter((o) => o.kind === "tool");
  const textsOf = (c) => c.output.filter((o) => o.kind === "text");
  const lineCount = (s) => s.replace(/\s+$/, "").split("\n").length;
  // Read results prefix each line with its number and a tab.
  const readLines = (s) => s.replace(/\n$/, "").split("\n").map((l) => l.replace(/^\d+\t/, ""));

  // Light markdown for what the model wrote: code blocks, inline code, bold, paragraphs.
  function md(s) {
    const blocks = [];
    s = s.replace(/```[a-z]*\n([\s\S]*?)```/g, (_, code) => {
      blocks.push(code.replace(/\n$/, ""));
      return `\n\n\u0000${blocks.length - 1}\u0000\n\n`;
    });
    return s.split(/\n{2,}/).filter((p) => p.trim()).map((p) => {
      const m = p.trim().match(/^\u0000(\d+)\u0000$/);
      if (m) return `<pre>${esc(blocks[+m[1]])}</pre>`;
      let h = esc(p.trim());
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
      return `<p class="say">${h}</p>`;
    }).join("");
  }

  // Wrap every match of each pattern in already-escaped HTML in <mark>. Highlighting only; the text stays as recorded.
  const mark = (html, patterns) => patterns.reduce((acc, re) => acc.replace(new RegExp(re.source, re.flags), (m) => `<mark>${m}</mark>`), html);

  const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

  // Show only the lines in `keep` (a Set of indexes), numbered, with `skipped(n)` (plain text) where
  // n lines are left out. Lines in `markIdx` are marked.
  function excerpt(lines, keep, markIdx, skipped) {
    const out = [];
    let gap = 0;
    lines.forEach((l, i) => {
      if (!keep.has(i)) { gap++; return; }
      if (gap) out.push(`<span class="more">${esc(skipped(gap))}</span>`);
      gap = 0;
      const n = `<span class="ln">${i + 1}</span>`;
      out.push(markIdx.has(i) ? `${n}<mark>${esc(l)}</mark>` : n + esc(l));
    });
    if (gap) out.push(`<span class="more">${esc(skipped(gap))}</span>`);
    return out.join("\n");
  }

  // ---------- cards ----------
  // `labels` is the chapter's copy for cards: request, result, file, plain, toolMeta.
  // `left` and `meta` are HTML.
  const cardHead = (left, meta) => `<div class="card-head"><span>${left}</span><span class="meta">${meta}</span></div>`;

  function requestBody(t, labels) {
    if (t.tool === "Edit") {
      const del = t.input.old_string.split("\n").map((l) => `<span class="del">- ${esc(l)}</span>`).join("\n");
      const add = t.input.new_string.split("\n").map((l) => `<span class="add">+ ${esc(l)}</span>`).join("\n");
      return `${esc(labels.file)}: ${esc(t.input.file_path)}\n${del}\n${add}`;
    }
    if (t.tool === "Bash") return esc(t.input.command.split(" && ").join(" &&\n  "));
    return esc(JSON.stringify(t.input, null, 2));
  }
  const requestMeta = (t, labels) => (t.input.description ? `“${esc(t.input.description)}”` : esc(labels.toolMeta[t.tool] || ""));
  const requestCard = (t, labels) =>
    `<div class="card model">${cardHead(`${esc(labels.request)} · ${esc(t.tool)}`, requestMeta(t, labels))}<pre>${requestBody(t, labels)}</pre></div>`;

  // `body` is { html, meta }: the chapter decides how much of a result to show (meta is plain text).
  const resultCard = (t, body, labels) =>
    `<div class="card result${t.result.is_error ? " err" : ""}">${cardHead(`${esc(labels.result)} · ${esc(t.tool)}`, esc(body.meta))}<pre>${body.html}</pre></div>`;

  // What the model wrote to the reader, under a plain-text title.
  const textCard = (text, title, labels) => `<div class="card model text">${cardHead(esc(title), esc(labels.plain))}${md(text)}</div>`;

  // Scroll boxes a keyboard can reach (WCAG 2.1.1): every element matching `selector` that scrolls
  // at its current size gets tabindex="0", and loses it again when it stops scrolling. Checked when
  // one is added to the page and whenever it changes size, so it holds for every width and state.
  const SCROLL_TAB = "data-scroll-tab";
  function markScroll(el) {
    const scrolls = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    if (scrolls && !el.hasAttribute("tabindex")) { el.setAttribute("tabindex", "0"); el.setAttribute(SCROLL_TAB, ""); }
    else if (!scrolls && el.hasAttribute(SCROLL_TAB)) { el.removeAttribute("tabindex"); el.removeAttribute(SCROLL_TAB); }
  }
  function watchScrollBoxes(selector = ".card pre") {
    const seen = new WeakSet();
    const ro = window.ResizeObserver ? new ResizeObserver((es) => es.forEach((e) => markScroll(e.target))) : null;
    const scan = () => document.querySelectorAll(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      markScroll(el);
      if (ro) ro.observe(el);
    });
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } })
      .observe(document.body, { childList: true, subtree: true });
    if (!ro) window.addEventListener("resize", () => document.querySelectorAll(selector).forEach(markScroll));
    scan();
  }

  window.TraceUI = {
    esc, base, secs, clock, numbers,
    toolsOf, textsOf, lineCount, readLines,
    md, mark, range, excerpt,
    cardHead, requestBody, requestMeta, requestCard, resultCard, textCard,
    watchScrollBoxes,
  };
})();
