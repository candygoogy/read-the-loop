// The contents page: a small picture of each chapter, drawn from the same recording the chapter uses.
// Chapter 1: window.TRACES.loop (site/data/trace-02-run2.js). Chapters 2, 3 and 4: window.TRACES.context
// (site/data/trace-03.js). Chapter 5: window.TOOLS (site/data/tools-05.js). Chapter 6: window.TRACES.sub
// (site/data/trace-06-run2.js). Every number is read from the
// data; only the labels below are written here. Without the data (or without JS) the pictures stay empty
// and are hidden.
(() => {
  "use strict";
  const U = window.TraceUI;
  const R = window.TRACES || {};
  const TO = window.TOOLS;
  const UNIT = 500; // tokens per square in chapter 2's picture (a drawing choice)

  // The captions. A translated contents page sets window.CONTENTS_COPY (same keys, and its locale)
  // before this script.
  const COPY = window.CONTENTS_COPY || {
    locale: "en-US",
    loop: (d) => `${d.calls} calls, each reading the whole conversation: ${d.first} tokens at the start, ${d.last} at the end`,
    context: (d) => `The last of ${d.calls} calls read ${d.last} tokens. One square is ${d.unit}.`,
    cache: (d) => `${d.pct} of what ${d.calls} calls read came from the cache`,
    compaction: (d) => `${d.pre} tokens of conversation before compaction, ${d.post} after. Areas to scale.`,
    tools: (d) => `Of the first request's characters: tools ${d.tools}, system ${d.system}, messages ${d.messages}`,
    subagents: (d) => `The subagent's conversation reached ${d.peak} tokens. The main one grew by ${d.growth} across the hand-back.`,
  };
  const LOCALE = COPY.locale;
  const { fmt } = U.numbers(LOCALE);
  const pct1 = (x) => new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x);
  const sum = (a) => a.reduce((x, y) => x + y, 0);

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

    // Chapter 4: the conversation before compaction and what was left after, as two squares whose
    // areas are to scale.
    if (T.compaction) {
      const { pre_tokens: pre, post_tokens: post } = T.compaction;
      const side = Math.sqrt(post / pre) * 100;
      const sqs = `<i class="pre"></i><i class="post" style="height:${side}%"></i>`;
      figure("viz-compaction", { cls: "art-compact", html: sqs }, COPY.compaction({ pre: fmt(pre), post: fmt(post) }));
    }
  }

  // Chapter 5: the first request as one bar to scale, as the chapter draws it: the tool entries, the
  // system blocks, the message blocks.
  if (TO && TO.call1) {
    const c1 = TO.call1;
    const total = c1.parts_total_chars;
    const parts = [
      { k: "tools", chars: c1.parts_chars.tools, pieces: TO.tools.map((t) => t.tool_json_chars) },
      { k: "system", chars: c1.parts_chars.system, pieces: TO.system.blocks.map((b) => b.chars) },
      { k: "messages", chars: c1.parts_chars.messages, pieces: c1.message_shapes.flatMap((m) => m.blocks.map((b) => b.chars)) },
    ];
    const html = parts.map((p) => `<span class="part p-${p.k}" style="flex:${p.chars} 1 0">${p.pieces.map((x) => `<i style="flex:${x} 1 0"></i>`).join("")}</span>`).join("");
    const share = Object.fromEntries(parts.map((p) => [p.k, pct1(p.chars / total)]));
    figure("viz-tools", { cls: "art-request", html }, COPY.tools(share));
  }

  // Chapter 6: the two conversations to one scale, as the chapter draws them. Top, the main
  // conversation's last call: its set-up, what its first call wrote, the hand-back (outlined) and the
  // rest. Below, the subagent's peak: its set-up, what it gathered, and the report it wrote (outlined).
  if (R.sub && R.sub.subagents && R.sub.subagents.length) {
    const T = R.sub;
    const S = T.subagents[0];
    const at = T.calls.findIndex((c) => c.output.some((o) => o.kind === "tool" && o.id === S.tool_use_id));
    if (at >= 0 && T.calls[at + 1]) {
      const m = T.calls, sc = S.calls;
      const mFirst = m[0].context_tokens, mLast = m[m.length - 1].context_tokens;
      const growth = m[at + 1].added_since_previous;
      const wrote = Math.min(m[at].output_tokens || 0, growth);
      const sFirst = sc[0].context_tokens, sLast = sc[sc.length - 1];
      const peak = S.totals.total_tokens;
      const max = Math.max(mLast, sLast.context_tokens + sLast.output_tokens);
      // One part, to scale; nothing for a part with no tokens.
      const seg = (cls, x) => (x > 0 ? `<i class="${cls}" style="width:${(x / max) * 100}%"></i>` : "");
      const html =
        `<span class="row r-main">${seg("s", mFirst)}${seg("b", m[at].context_tokens - mFirst)}${seg("m", wrote)}${seg("b hb", growth - wrote)}${seg("b", mLast - m[at + 1].context_tokens)}</span>` +
        `<span class="row r-sub">${seg("s", sFirst)}${seg("b", sLast.context_tokens - sFirst)}${seg("m hb out", sLast.output_tokens)}</span>`;
      figure("viz-subagents", { cls: "art-sub", html }, COPY.subagents({ peak: fmt(peak), growth: fmt(growth) }));
    }
  }
})();
