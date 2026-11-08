// The contents page: a small picture of each chapter, drawn from the same recording the chapter uses.
// Chapter 1: window.TRACES.loop (site/data/trace-02-run2.js). Chapters 2 and 3: window.TRACES.context
// (site/data/trace-03.js). Every number is read from the trace; only the labels below are written here.
// Without the traces (or without JS) the pictures stay empty and are hidden.
(() => {
  "use strict";
  const U = window.TraceUI;
  const R = window.TRACES || {};
  const LOCALE = "en-US";
  const { fmt } = U.numbers(LOCALE);
  const pct1 = (x) => new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const UNIT = 500; // tokens per square in chapter 2's picture (a drawing choice)

  const COPY = {
    loop: (d) => `${d.calls} calls, each reading the whole conversation: ${d.first} tokens at the start, ${d.last} at the end`,
    context: (d) => `The last of ${d.calls} calls read ${d.last} tokens. One square is ${d.unit}.`,
    cache: (d) => `${d.pct} of what ${d.calls} calls read came from the cache`,
  };

  function figure(id, art, caption) {
    const fig = document.getElementById(id);
    if (!fig) return;
    fig.innerHTML = `<div class="toc-art ${art.cls}" aria-hidden="true">${art.html}</div><figcaption class="toc-cap">${U.esc(caption)}</figcaption>`;
  }

  // Chapter 1: one bar per call, everything that call read, all to one scale.
  if (R.loop) {
    const calls = R.loop.calls;
    const ctx = calls.map((c) => c.context_tokens);
    const first = ctx[0], last = ctx[ctx.length - 1];
    const rounds = calls.map((c) => c.added_since_previous || 0).slice(1);
    const w = (x) => `${(x / last) * 100}%`;
    let html = "";
    calls.forEach((_, i) => {
      let at = first;
      let row = `<i class="s" style="left:0;width:${w(first)}"></i>`;
      rounds.slice(0, i).forEach((x) => { row += `<i class="r" style="left:${w(at)};width:${w(x)}"></i>`; at += x; });
      html += `<span class="row">${row}</span>`;
    });
    figure("viz-loop", { cls: "art-loop", html }, COPY.loop({ calls: fmt(calls.length), first: fmt(first), last: fmt(last) }));
  }

  if (R.context) {
    const T = R.context;
    const calls = T.calls;
    const N = calls.length;
    const ctx = calls.map((c) => c.context_tokens);
    const last = ctx[N - 1];

    // Chapter 2: the last call's conversation as squares in reading order, split the way the chapter
    // splits it: the set-up, then each round's model part and what came back.
    let cum = 0;
    const cells = (tokens) => { const a = Math.round(cum / UNIT); cum += tokens; return Math.round(cum / UNIT) - a; };
    const sq = (cls, n) => `<i class="${cls}"></i>`.repeat(Math.max(0, n));
    let html = sq("s", cells(ctx[0]));
    calls.slice(0, -1).forEach((c, i) => {
      const tokens = ctx[i + 1] - ctx[i];
      const model = Math.min(c.output_tokens, tokens);
      html += sq("m", cells(model)) + sq("b", cells(tokens - model));
    });
    figure("viz-context", { cls: "art-waffle", html }, COPY.context({ calls: fmt(N), last: fmt(last), unit: fmt(UNIT) }));

    // Chapter 3: each call's reading, the part read from the cache and the new part, to one scale.
    const max = Math.max(...ctx);
    const h = (x) => `${(x / max) * 100}%`;
    const cols = calls.map((c) => `<span class="col"><i class="c" style="height:${h(c.cached_tokens)}"></i><i class="f" style="height:${h(c.new_tokens)}"></i></span>`).join("");
    figure("viz-cache", { cls: "art-cache", html: cols }, COPY.cache({ calls: fmt(N), pct: pct1(T.totals.cache_read_tokens / sum(ctx)) }));
  }
})();
