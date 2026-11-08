// Chapter 2 page. Every number and every piece of text the agent wrote or saw comes from window.TRACE
// (site/data/trace-03.js, recording 03); chapter 1's session comes from window.TRACES.ch1. The
// narration and all labels come from window.COPY (copy.en.js). Escaping, formatting and the light
// markdown come from window.TraceUI (../lib/trace-ui.js). The charts are plain SVG, drawn here.
(() => {
  "use strict";
  const T = window.TRACE;
  const CH1 = (window.TRACES || {}).ch1;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, base, toolsOf, textsOf, lineCount } = U;
  const { fmt, pl, list } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  // The site's root relative to this page: "../" here, "../../" on a translated page (<body data-root>).
  const ROOT = document.body.dataset.root || "../";

  // ---------- settings we chose when recording (RECORDING-03.md); they aren't in the trace ----------
  const AUTOCOMPACT = 100000; // --autocompact 100k
  const FLAGS = `claude -p <prompt> --model ${T.model} --output-format stream-json --verbose --restricted ` +
    `--tools Bash,Read,Edit,Write,Glob,Grep ` +
    `--allowedTools "Bash(python *)" "Bash(git diff *)" "Bash(git status *)" "Bash(git log *)" Read Edit Write Glob Grep ` +
    `--strict-mcp-config --setting-sources "" --permission-mode acceptEdits --autocompact 100k --max-budget-usd 5`;
  const REPO = "https://github.com/psf/black";
  const ISSUE = `${REPO}/issues/5536`;
  const COMMIT = `${REPO}/tree/71ddff88a662a2968ce5e7d21c9572a3acac683d`;
  const UNIT = 100; // tokens per square in the explorer (a drawing choice)

  // ---------- formatting ----------
  const pctFmt = new Intl.NumberFormat(C.locale, { style: "percent", maximumFractionDigits: 0 });
  const pct1Fmt = new Intl.NumberFormat(C.locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dec1 = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dec2f = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dec2 = { format: (v) => dec2f.format(v).replace(/^-/, "−") }; // a true minus sign
  const compact = new Intl.NumberFormat(C.locale, { notation: "compact", maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD" });
  const secs = (ms) => dec1.format(ms / 1000);
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  // ---------- values read from the recording ----------
  const calls = T.calls;
  const N = calls.length;
  const ctx = calls.map((c) => c.context_tokens);
  const first = ctx[0];
  const last = ctx[N - 1];
  const allTools = calls.flatMap(toolsOf);
  const resEnd = calls.map((c) => { const ts = toolsOf(c); return ts.length ? Math.max(...ts.map((t) => t.result.t_ms)) : null; });
  // The wait: from the previous call's last result to this call's first output. Call 1's wait also
  // includes Claude Code starting up, so the speed charts leave it out.
  const wait = calls.map((c, i) => c.t_ms - (i ? resEnd[i - 1] : 0));
  const cumRead = ctx.reduce((acc, x, i) => (acc.push((acc[i - 1] || 0) + x), acc), []);
  const sumRead = cumRead[N - 1];

  const isSuite = (t) => t.tool === "Bash" && /pytest/.test(t.input.command) && /\d+ passed/.test(t.result.text);
  const suiteLine = (t) => {
    const l = (t.result.text.match(/^.*\d+ passed.*$/m) || [""])[0];
    return (l.match(/(\d+ failed, )?\d+ passed(, \d+ skipped)?/) || [l])[0];
  };
  const kindOf = (t) => (t.result.denied ? "refused" : t.tool === "Edit" || t.tool === "Write" ? "edit" : t.tool);

  // ---------- phases ----------
  // The phase list in our recording notes, each found by the first call that does something specific.
  const has = (c, f) => toolsOf(c).some(f);
  const firstCall = (pred) => calls.findIndex(pred);
  const startOf = {
    reproduce: 0,
    diagnose: firstCall((c) => has(c, (t) => t.tool === "Bash" && /_safe_add_trailing_comma/.test(t.input.command))),
    fix1: firstCall((c) => has(c, (t) => t.tool === "Edit")),
    subscript: firstCall((c) => has(c, (t) => t.tool === "Grep" && /magic_trailing_comma/.test(t.input.pattern))),
    suite: firstCall((c) => has(c, (t) => t.tool === "Read" && /[\\/]tests[\\/]/.test(t.input.file_path))),
    // the call after it read the saved test output
    instability: firstCall((c) => has(c, (t) => t.tool === "Read" && /out\.txt$/.test(t.input.file_path))) + 1,
    // the call after the first full test run with no failures
    wrapup: firstCall((c) => has(c, (t) => isSuite(t) && !/failed/.test(suiteLine(t)))) + 1,
    answer: N - 1,
  };
  const phaseKeys = Object.keys(startOf);
  const phases = phaseKeys.map((key, k) => {
    const from = startOf[key];
    const to = k < phaseKeys.length - 1 ? startOf[phaseKeys[k + 1]] - 1 : N - 1;
    const pc = calls.slice(from, to + 1);
    const ts = pc.flatMap(toolsOf);
    const tests = ts.filter(isSuite).map(suiteLine);
    const sentences = pc.flatMap(textsOf).flatMap((o) => o.text.split(/(?<=[.!?])\s+/));
    const edited = [...new Set(ts.filter((t) => t.tool === "Edit" && !t.result.is_error).map((t) => base(t.input.file_path.replace(/\\/g, "/"))))];
    return {
      key, from, to, name: C.phases[key].name,
      firstTest: esc(tests[0] || ""), lastTest: esc(tests[tests.length - 1] || ""),
      edited: edited.map(esc).join("</code>, <code>"),
      say: (re) => inline(sentences.find((s) => re.test(s)) || ""),
    };
  });
  const phaseOf = (i) => phases.find((p) => i >= p.from && i <= p.to);

  // ---------- rounds: what each call added to the conversation ----------
  // Round r is call r's output plus the results of its requests: what call r+1 reads that call r didn't.
  // The model's part is what the API says call r wrote; the rest is what came back, shared out between
  // a round's results by their length in characters (an estimate, said so on the page).
  const rounds = calls.slice(0, -1).map((c, i) => {
    const tokens = ctx[i + 1] - ctx[i];
    const model = Math.min(c.output_tokens, tokens);
    const back = tokens - model;
    const ts = toolsOf(c);
    const chars = ts.map((t) => Math.max(1, t.result.text.length));
    const total = sum(chars);
    return {
      r: i + 1, i, tokens, model, back, tools: ts, texts: textsOf(c), phase: phaseOf(i),
      parts: ts.map((t, j) => ({ kind: kindOf(t), tokens: back * chars[j] / total })),
    };
  });

  const byKind = { sys: first, model: 0 };
  rounds.forEach((r) => {
    byKind.model += r.model;
    r.parts.forEach((p) => { byKind[p.kind] = (byKind[p.kind] || 0) + p.tokens; });
  });
  const backTotal = last - first - byKind.model;
  const deniedTools = allTools.filter((t) => t.result.denied);
  const big = rounds.reduce((a, b) => (b.tokens > a.tokens ? b : a));
  const bigTool = big.tools.reduce((a, b) => (b.result.text.length > a.result.text.length ? b : a));

  // ---------- speed ----------
  const corr = (a, b) => {
    const ma = sum(a) / a.length, mb = sum(b) / b.length;
    let s = 0, sa = 0, sb = 0;
    a.forEach((x, i) => { s += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; });
    return s / Math.sqrt(sa * sb);
  };
  const timed = calls.map((c, i) => ({ i, n: i + 1, wait: wait[i], ctx: c.context_tokens, out: c.output_tokens })).slice(1);
  const rCtx = corr(timed.map((p) => p.wait), timed.map((p) => p.ctx));
  const rOut = corr(timed.map((p) => p.wait), timed.map((p) => p.out));
  const slowest = timed.reduce((a, b) => (b.wait > a.wait ? b : a));

  // ---------- other values ----------
  const toolCounts = Object.entries(allTools.reduce((acc, t) => ((acc[t.tool] = (acc[t.tool] || 0) + 1), acc), {}))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const half = Math.ceil(N / 2);
  const title = (T.prompt.match(/^# (.+)$/m) || [])[1] || "";
  const durS = Math.round(T.totals.duration_s);
  const [durM, durR] = [Math.floor(durS / 60), durS % 60];
  const ch1Calls = CH1 ? CH1.calls.length : 0;
  const ch1Last = CH1 ? CH1.calls[CH1.calls.length - 1].context_tokens : 0;
  const lastSuiteTool = allTools.filter(isSuite).pop();
  const cache1 = calls[0].cached_tokens;
  const bigLines = bigTool.tool === "Read" ? lineCount(bigTool.result.text) : 0;
  const cm = T.compaction || {};
  const aliasPath = (allTools.find((t) => t.input.file_path) || { input: { file_path: "" } }).input.file_path;

  const d = {
    calls: fmt(N), toolCalls: fmt(allTools.length),
    toolCountList: list(toolCounts.map(([k, v]) => C.toolCount(fmt(v), k))),
    durationLong: C.durationLong(fmt(durM), fmt(durR)), duration: C.duration(fmt(durM), fmt(durR)),
    date: new Date(T.recorded + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    model: esc(T.model), ccv: esc(T.claude_code_version), source: esc(T.source), tools: esc(list(T.tools_available)),
    repoUrl: REPO, issueUrl: ISSUE, commitUrl: COMMIT,
    ch1Calls: fmt(ch1Calls), ch1Last: fmt(ch1Last), ch1Ratio: dec1.format(last / ch1Last),
    first: fmt(first), last: fmt(last),
    autocompact: fmt(AUTOCOMPACT), autocompactShort: compact.format(AUTOCOMPACT).toLowerCase(),
    unit: fmt(UNIT), cache1: fmt(cache1),
    symptom: esc(((toolsOf(calls[0]).concat(calls.slice(0, startOf.diagnose).flatMap(toolsOf)))
      .map((t) => (t.result.text.match(/^\+\s*(\).*,)\s*$/m) || [])[1]).find(Boolean)) || ""),
    subCase: esc((T.final_answer.match(/`(\w+\[[^\]`]*\])`/) || [])[1] || ""),
    setupPct: pctFmt.format(first / last), modelPct: pctFmt.format(byKind.model / last), backPct: pctFmt.format(backTotal / last),
    bigRound: fmt(big.r), bigAdd: fmt(big.tokens),
    bigWhat: bigTool.tool === "Read" ? C.fills.bigRead(fmt(bigLines), esc(base(bigTool.input.file_path.replace(/\\/g, "/")))) : esc(bigTool.tool),
    denied: fmt(deniedTools.length), deniedTokens: fmt(Math.round(byKind.refused || 0)),
    sumRead: fmt(sumRead), sumRatio: dec1.format(sumRead / last),
    half: fmt(half), halfSum: fmt(cumRead[half - 1]), secondHalf: fmt(sumRead - cumRead[half - 1]),
    halfRatio: dec1.format((sumRead - cumRead[half - 1]) / cumRead[half - 1]),
    rCtx: dec2.format(rCtx), rOut: dec2.format(rOut),
    maxWait: secs(slowest.wait), maxCall: fmt(slowest.n), maxOut: fmt(slowest.out), lastWait: secs(wait[N - 1]),
    claim: inline((T.final_answer.split(/(?<=[.!?])\s+/)[0]) || ""),
    lastSuite: esc(lastSuiteTool ? suiteLine(lastSuiteTool) : ""),
    keepQuote: inline((T.final_answer.match(/This keeps the existing output[^\n]*/) || [""])[0]),
    cacheTotal: fmt(T.totals.cache_read_tokens), cachePct: pct1Fmt.format(T.totals.cache_read_tokens / sumRead),
    pre: fmt(cm.pre_tokens || 0), post: fmt(cm.post_tokens || 0),
    cost: money.format(T.totals.cost_usd),
    alias: esc((aliasPath.match(/^~\/[^/\\]+/) || [""])[0]),
  };

  // ---------- static text ----------
  function fill() {
    document.querySelectorAll("[data-c]").forEach((el) => {
      const fn = el.dataset.c.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
      if (typeof fn === "function") el.innerHTML = fn(d);
      else if (typeof fn === "string") el.innerHTML = fn;
    });
    document.querySelectorAll("[data-v]").forEach((el) => { if (d[el.dataset.v] !== undefined) el.innerHTML = d[el.dataset.v]; });
    $("issue-title").textContent = title;
    $("prompt-full").textContent = T.prompt;
    // Break only at spaces, never after the hyphens of a flag.
    $("flags").innerHTML = FLAGS.split(" ").map((a) => `<span>${esc(a)}</span>`).join(" ");
  }

  // ---------- SVG helpers ----------
  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, cls, anchor = "start") {
    const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent);
    t.textContent = s;
    return t;
  }
  function niceMax(v, steps = 4) {
    const raw = v / steps;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    return { max: step * Math.ceil(v / step), step };
  }
  const ticks = (max, step) => Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  // Bars: square at the baseline, 4px round at the data end.
  function barPath(x, y, w, h, r = 4) {
    r = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }

  // Redraw a chart when its box changes width (only the width; height follows from it).
  function responsive(box, draw) {
    let w = 0;
    const run = () => { const nw = Math.round(box.clientWidth); if (nw && nw !== w) { w = nw; draw(nw); } };
    new ResizeObserver(() => requestAnimationFrame(run)).observe(box);
    run();
  }

  // A tooltip and a polite live line per chart. Tooltips only repeat what the table holds.
  function tipFor(box) {
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("aria-hidden", "true");
    tip.hidden = true;
    box.appendChild(tip);
    const live = document.createElement("p");
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    box.appendChild(live);
    return {
      show(html, x, y, say) {
        tip.innerHTML = html;
        tip.hidden = false;
        const bw = box.clientWidth, tw = tip.offsetWidth;
        tip.style.left = `${Math.max(0, Math.min(bw - tw, x - tw / 2))}px`;
        tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
        // Spoken only while the chart has focus (keys), not as a pointer sweeps across it.
        if (say !== undefined && box.contains(document.activeElement) && live.textContent !== say) live.textContent = say;
      },
      hide() { tip.hidden = true; },
    };
  }

  // ---------- chart: the last call of each chapter, to one scale ----------
  function drawCompare(w) {
    const box = $("compare-chart");
    box.querySelector("svg")?.remove();
    const pad = { l: 0, r: 8, t: 6 };
    const rowH = 54, barH = 24;
    const rows = [
      { label: C.context.ch1Bar(d), v: ch1Last, cls: "bar-ch1" },
      { label: C.context.ch2Bar(d), v: last, cls: "bar-ch2" },
    ];
    const axisY = pad.t + rows.length * rowH + 6;
    const h = axisY + 44;
    const { step } = niceMax(AUTOCOMPACT);
    const max = AUTOCOMPACT;
    const x = (v) => pad.l + (v / max) * (w - pad.l - pad.r - 2);
    const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": C.context.chartLabel(d) });
    ticks(max, step).forEach((v) => {
      el("line", { x1: x(v), x2: x(v), y1: pad.t, y2: axisY, class: "grid" }, svg);
      text(svg, x(v), axisY + 16, compact.format(v), "tick", v === 0 ? "start" : v === max ? "end" : "middle");
    });
    rows.forEach((r, k) => {
      const y = pad.t + k * rowH;
      text(svg, 0, y + 14, r.label, "label");
      el("path", { d: barPath(x(0), y + 22, x(r.v) - x(0), barH), class: r.cls }, svg);
      const vx = x(r.v) + 8;
      text(svg, vx, y + 22 + barH / 2 + 4, fmt(r.v), "value");
    });
    // where Claude Code was set to compact
    el("line", { x1: x(AUTOCOMPACT), x2: x(AUTOCOMPACT), y1: pad.t, y2: axisY, class: "mark" }, svg);
    text(svg, x(AUTOCOMPACT), axisY + 34, C.context.markLabel(d), "mark-label", "end");
    box.prepend(svg);
  }

  // ---------- the explorer ----------
  const waffle = $("waffle");
  const scrub = $("ex-scrub");
  let cur = N;            // the call shown (1-based): its conversation is the set-up and rounds 1..cur-1
  let pinned = null;      // the round chosen by click or focus (null: the newest)
  let hovered = null;
  let shown = null;       // the call the grid showed before this one
  let cellsOf = [];       // each round's squares, in reading order
  let fills = [];         // the squares animating in right now

  function buildWaffle() {
    // Cells per part by cumulative rounding, so the squares always add up to the total.
    let cum = 0;
    const cells = (tokens) => { const a = Math.round(cum / UNIT); cum += tokens; return Math.round(cum / UNIT) - a; };
    const sq = (cls, n) => `<i class="c ${cls}"></i>`.repeat(Math.max(0, n));
    let html = `<span class="rnd" data-r="0">${sq("s", cells(first))}</span>`;
    rounds.forEach((r) => {
      html += `<span class="rnd" data-r="${r.r}">${sq("m", cells(r.model))}${sq("b", cells(r.back))}</span>`;
    });
    waffle.innerHTML = html;
    cellsOf = [...waffle.querySelectorAll(".rnd")].map((r) => [...r.children]);
  }

  // Moving forward, the squares that just joined the conversation fill in, in reading order: each
  // grows in over 160 ms, the whole run within `spread` ms. A new move cancels the last one at once
  // (the squares are simply there), so scrubbing never queues motion. Moving back is instant.
  function fillIn(from, to, { spread = 240, max = 240 } = {}) {
    fills.forEach((a) => a.cancel());
    fills = [];
    if (from === null || to <= from || Mo.reduced()) return;
    let sq = [];
    for (let k = from; k < to; k++) sq = sq.concat(cellsOf[k] || []);
    sq = sq.slice(-max);
    const span = Math.min(spread, sq.length * 6);
    sq.forEach((c, i) => {
      const a = Mo.play(c, [{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "none" }],
        { duration: 160, delay: sq.length > 1 ? (i / (sq.length - 1)) * span : 0, fill: "backwards", key: "fill" });
      if (a) fills.push(a);
    });
  }

  // The current phase's mark on the strip under the slider: one element, moved with a transform.
  function placeStrip(key) {
    const strip = $("ex-strip");
    const on = strip.querySelector(".ex-strip-on");
    const span = strip.querySelector(`span[data-k="${key}"]`);
    if (!on || !span || !strip.clientWidth) return;
    on.style.transform = `translateX(${span.offsetLeft}px) scaleX(${span.offsetWidth / strip.clientWidth})`;
  }

  const toolNames = (r) => list([...new Set(r.tools.map((t) => t.tool))]);
  function roundLabel(k) {
    if (k === 0) return C.explore.setupLabel(fmt(first));
    const r = rounds[k - 1];
    return C.explore.roundLabel(fmt(r.r), r.phase.name, fmt(r.tokens), fmt(r.model), fmt(r.back), toolNames(r));
  }

  function requestLine(t) {
    let what = "";
    const file = t.input.file_path ? base(t.input.file_path.replace(/\\/g, "/")) : "";
    if (t.tool === "Bash") what = t.input.description || t.input.command;
    else if (t.tool === "Grep" || t.tool === "Glob") what = `<code>${esc(t.input.pattern)}</code>`;
    else if (t.tool === "Read" && t.input.offset) {
      const n = lineCount(t.result.text);
      what = `<code>${esc(file)}</code>, ${C.explore.readRange(fmt(t.input.offset), fmt(t.input.offset + n - 1))}`;
    } else what = `<code>${esc(file)}</code>`;
    if (t.tool === "Bash") what = esc(what);
    const flag = t.result.denied ? `<span class="flag refused">${esc(C.explore.refused)}</span>`
      : t.result.is_error ? `<span class="flag">${esc(C.explore.error)}</span>`
      : `<span class="lines">· ${esc(pl(C.explore.lines, lineCount(t.result.text)))}</span>`;
    return `<li><span class="tool">${esc(t.tool)}</span> <span class="what">${what}</span> ${flag}</li>`;
  }

  function showDetail(k) {
    const box = $("ex-detail");
    if (k === 0) {
      box.innerHTML = `<p class="dt-name"><span class="sw s" aria-hidden="true"></span>${esc(C.explore.setupName)}</p>` +
        `<p class="dt-tokens">${esc(C.tokens(fmt(first)))}</p>` +
        `<p class="dt-note">${C.explore.setupBody(d)}</p>`;
    } else {
      const r = rounds[k - 1];
      const said = r.texts.map((o) => o.text).join(" ");
      box.innerHTML =
        `<p class="dt-name">${esc(C.explore.roundName(fmt(r.r)))}<span class="dt-phase">${esc(r.phase.name)}</span>` +
          (k === cur - 1 ? `<span class="dt-new">${esc(C.explore.newest)}</span>` : "") + `</p>` +
        `<p class="dt-tokens">${esc(C.plusTokens(fmt(r.tokens)))}</p>` +
        `<p class="dt-split"><span class="sw m" aria-hidden="true"></span><span class="sw b" aria-hidden="true"></span>${esc(C.explore.split(fmt(r.model), fmt(r.back)))}</p>` +
        `<ul class="dt-reqs">${r.tools.map(requestLine).join("")}</ul>` +
        (said ? `<p class="dt-said"><span>${esc(C.explore.said)}</span> <q>${inline(said.length > 220 ? said.slice(0, 217).replace(/\s\S*$/, "") + " …" : said)}</q></p>` : "");
    }
    waffle.querySelectorAll(".rnd.on").forEach((e) => e.classList.remove("on"));
    const node = waffle.querySelector(`.rnd[data-r="${k}"]`);
    if (node) node.classList.add("on");
    waffle.classList.toggle("has-on", hovered !== null || pinned !== null);
  }

  const shownRound = () => (hovered !== null ? hovered : pinned !== null ? pinned : cur - 1);

  function setCall(n, opts = {}) {
    cur = Math.max(1, Math.min(N, n));
    const i = cur - 1;
    if (pinned !== null && pinned > cur - 1) pinned = null;
    const p = phaseOf(i);
    waffle.querySelectorAll(".rnd").forEach((e) => {
      const k = +e.dataset.r;
      const on = k <= cur - 1;
      e.classList.toggle("future", !on);
      const isNew = k === cur - 1 && k > 0;
      e.classList.toggle("newest", isNew);
      if (on) {
        e.setAttribute("role", "option");
        e.setAttribute("aria-label", roundLabel(k));
        e.removeAttribute("aria-hidden");
      } else {
        e.removeAttribute("role");
        e.removeAttribute("aria-label");
        e.setAttribute("aria-hidden", "true");
        e.removeAttribute("tabindex");
      }
    });
    rove(pinned !== null ? pinned : cur - 1, false);
    $("ex-call").textContent = C.explore.callOf(fmt(cur), fmt(N));
    $("ex-clock").textContent = C.explore.clock(U.clock(calls[i].t_ms));
    $("ex-reads").innerHTML = C.explore.reads(fmt(ctx[i]));
    $("ex-sofar").textContent = cur === 1 ? C.explore.soFarOne(fmt(cumRead[i])) : C.explore.soFar(fmt(cumRead[i]), fmt(cur));
    waffle.setAttribute("aria-label", C.explore.gridLabel(fmt(cur)));
    if (!opts.fromScrub) scrub.value = String(cur);
    scrub.style.setProperty("--p", String((cur - 1) / (N - 1)));
    scrub.setAttribute("aria-valuetext", C.explore.valueText(fmt(cur), fmt(N), p.name, fmt(ctx[i])));
    $("ex-prev").disabled = cur === 1;
    $("ex-next").disabled = cur === N;
    // the phase
    document.querySelectorAll("#ex-phases button").forEach((b) => {
      if (b.dataset.k === p.key) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    document.querySelectorAll("#ex-strip span").forEach((s) => s.classList.toggle("on", s.dataset.k === p.key));
    placeStrip(p.key);
    if ($("ex-phase-name").dataset.k !== p.key) {
      $("ex-phase-name").dataset.k = p.key;
      $("ex-phase-name").textContent = p.name;
      $("ex-phase-text").innerHTML = C.phases[p.key].text(d, p);
      if (shown !== null) Mo.enter([$("ex-phase-name"), $("ex-phase-text")], { y: 4, stagger: 40 });
    }
    fillIn(shown, cur);
    shown = cur;
    showDetail(shownRound());
  }

  // Roving focus over the rounds that are in the conversation.
  function rove(k, focus) {
    waffle.querySelectorAll(".rnd[tabindex]").forEach((e) => e.setAttribute("tabindex", "-1"));
    const node = waffle.querySelector(`.rnd[data-r="${k}"]`);
    if (!node) return;
    node.setAttribute("tabindex", "0");
    waffle.querySelectorAll(".rnd[aria-selected]").forEach((e) => e.setAttribute("aria-selected", "false"));
    node.setAttribute("aria-selected", "true");
    if (focus) node.focus();
  }

  function initExplorer() {
    buildWaffle();
    scrub.min = "1";
    scrub.max = String(N);
    scrub.setAttribute("aria-label", C.explore.scrub);
    $("ex-prev").setAttribute("aria-label", C.explore.prev);
    $("ex-next").setAttribute("aria-label", C.explore.next);
    $("ex-legend").innerHTML =
      `<span><i class="sw s"></i>${esc(C.explore.legendSys)}</span>` +
      `<span><i class="sw m"></i>${esc(C.explore.legendModel)}</span>` +
      `<span><i class="sw b"></i>${esc(C.explore.legendBack)}</span>` +
      `<span><i class="sw f"></i>${esc(C.explore.legendFuture)}</span>`;
    $("ex-phases").setAttribute("aria-label", C.explore.phases);
    $("ex-phases").innerHTML = phases.map((p, k) =>
      `<button type="button" class="chip" data-k="${p.key}" data-n="${p.from + 1}"><span class="chip-n" aria-hidden="true">${fmt(k + 1)}</span><span class="chip-name">${esc(p.name)}</span></button>`).join("");
    $("ex-strip").innerHTML = phases.map((p) => `<span data-k="${p.key}" style="flex:${p.to - p.from + 1}"></span>`).join("") + `<i class="ex-strip-on"></i>`;
    // Glide between phases, but not while the strip resizes.
    const stripOn = $("ex-strip").querySelector(".ex-strip-on");
    new ResizeObserver(() => {
      stripOn.classList.remove("glide");
      placeStrip(phaseOf(cur - 1).key);
      requestAnimationFrame(() => stripOn.classList.add("glide"));
    }).observe($("ex-strip"));

    scrub.addEventListener("input", () => { pinned = null; setCall(+scrub.value, { fromScrub: true }); });
    $("ex-prev").addEventListener("click", () => { pinned = null; setCall(cur - 1); });
    $("ex-next").addEventListener("click", () => { pinned = null; setCall(cur + 1); });
    $("ex-phases").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      pinned = null;
      setCall(+b.dataset.n);
    });

    const roundAt = (e) => { const n = e.target.closest && e.target.closest(".rnd:not(.future)"); return n ? +n.dataset.r : null; };
    waffle.addEventListener("pointerover", (e) => { const k = roundAt(e); if (k !== null && k !== hovered) { hovered = k; showDetail(k); } });
    waffle.addEventListener("pointerleave", () => { hovered = null; showDetail(shownRound()); });
    waffle.addEventListener("click", (e) => { const k = roundAt(e); if (k !== null) { pinned = k; rove(k, true); showDetail(k); } });
    waffle.addEventListener("focusin", (e) => { const k = roundAt(e); if (k !== null) { pinned = k; rove(k, false); showDetail(k); } });
    waffle.addEventListener("keydown", (e) => {
      const k = roundAt(e);
      if (k === null) return;
      const lastK = cur - 1;
      const to = { ArrowRight: k + 1, ArrowDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, Home: 0, End: lastK }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const nk = Math.max(0, Math.min(lastK, to));
      pinned = nk;
      rove(nk, true);
      showDetail(nk);
    });
    setCall(N);
  }

  // ---------- chart: what fills the last call's conversation ----------
  function drawKinds(w) {
    const box = $("kinds-chart");
    box.querySelector("svg")?.remove();
    const rows = Object.entries(byKind).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ k, v, label: C.fills.kinds[k] || k, cls: k === "sys" ? "k-sys" : k === "model" ? "k-model" : "k-back" }));
    const rowH = 50, barH = 18, valW = 118;
    const h = rows.length * rowH;
    const max = Math.max(...rows.map((r) => r.v));
    const x = (v) => (v / max) * (w - valW);
    const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": C.fills.chartLabel });
    // The --result hatch (style.css --tex-teal) as a pattern: a 1.5px line every 4.5px at 135°.
    const pat = el("pattern", { id: "tex-teal", width: 4.5, height: 4.5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("defs", {}, svg));
    el("rect", { width: 4.5, height: 4.5, class: "tex-bg" }, pat);
    el("rect", { x: 3, width: 1.5, height: 4.5, class: "tex-line" }, pat);
    rows.forEach((r, k) => {
      const y = k * rowH;
      text(svg, 0, y + 15, r.label, "label");
      el("rect", { x: 0, y: y + 23, width: w - valW, height: barH, class: "track" }, svg);
      el("path", { d: barPath(0, y + 23, Math.max(2, x(r.v)), barH), class: r.cls }, svg);
      text(svg, Math.max(2, x(r.v)) + 8, y + 23 + barH / 2 + 4, C.fills.value(fmt(Math.round(r.v)), pctFmt.format(r.v / last)), "value");
    });
    box.prepend(svg);
  }

  // ---------- chart: the conversation and the total read, call by call ----------
  function drawReread(w) {
    const box = $("reread-chart");
    box.querySelector("svg")?.remove();
    const pad = { l: 46, r: 12, t: 14, b: 34 };
    const h = Math.round(Math.min(380, Math.max(240, w * 0.5)));
    const { max, step } = niceMax(sumRead);
    const x = (n) => pad.l + ((n - 1) / (N - 1)) * (w - pad.l - pad.r);
    const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
    const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", tabindex: "0", class: "focusable", "aria-label": C.reread.chartLabel(d) });
    ticks(max, step).forEach((v) => {
      el("line", { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), class: v ? "grid" : "axis" }, svg);
      text(svg, pad.l - 8, y(v) + 4, compact.format(v), "tick", "end");
    });
    const xt = niceMax(N, 5).step;
    [1, ...ticks(N, xt).slice(1).filter((n) => x(N) - x(n) > 34 && x(n) - x(1) > 24), N].forEach((n) => text(svg, x(n), h - pad.b + 18, fmt(n), "tick", "middle"));
    text(svg, w - pad.r, h - 4, C.reread.axisX, "tick", "end");
    const line = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join("");
    el("path", { d: `${line(cumRead)}L${x(N)},${y(0)}L${x(1)},${y(0)}Z`, class: "area-sum" }, svg);
    el("path", { d: line(cumRead), class: "line-sum" }, svg);
    el("path", { d: line(ctx), class: "line-ctx" }, svg);
    el("circle", { cx: x(N), cy: y(sumRead), r: 4, class: "dot-sum" }, svg);
    el("circle", { cx: x(N), cy: y(last), r: 4, class: "dot-ctx" }, svg);
    text(svg, x(N) - 10, y(sumRead) + 4, `${C.reread.seriesSum} · ${fmt(sumRead)}`, "value", "end");
    text(svg, x(N) - 10, y(last) - 10, `${C.reread.seriesCtx} · ${fmt(last)}`, "value", "end");
    // crosshair
    const hair = el("line", { y1: pad.t, y2: h - pad.b, class: "hair", visibility: "hidden" }, svg);
    const d1 = el("circle", { r: 4, class: "dot-sum", visibility: "hidden" }, svg);
    const d2 = el("circle", { r: 4, class: "dot-ctx", visibility: "hidden" }, svg);
    const tip = box._tip || (box._tip = tipFor(box));
    let at = N;
    const show = (n) => {
      at = n;
      const i = n - 1;
      [hair, d1, d2].forEach((e) => e.setAttribute("visibility", "visible"));
      hair.setAttribute("x1", x(n)); hair.setAttribute("x2", x(n));
      d1.setAttribute("cx", x(n)); d1.setAttribute("cy", y(cumRead[i]));
      d2.setAttribute("cx", x(n)); d2.setAttribute("cy", y(ctx[i]));
      const say = C.reread.tip(fmt(n), fmt(cumRead[i]), fmt(ctx[i]));
      tip.show(`<b>${esc(C.explore.callOf(fmt(n), fmt(N)))}</b>` +
        `<span><i class="key k-sum"></i><b>${fmt(cumRead[i])}</b> ${esc(C.reread.seriesSum)}</span>` +
        `<span><i class="key k-ctx"></i><b>${fmt(ctx[i])}</b> ${esc(C.reread.seriesCtx)}</span>`, x(n), y(cumRead[i]), say);
    };
    const hide = () => { [hair, d1, d2].forEach((e) => e.setAttribute("visibility", "hidden")); tip.hide(); };
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const n = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (N - 1)) + 1;
      show(Math.max(1, Math.min(N, n)));
    });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", () => show(at));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (e) => {
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 1, End: N }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      show(Math.max(1, Math.min(N, to)));
    });
    box.prepend(svg);
  }

  // ---------- charts: wait against tokens read, and against tokens written ----------
  const waitMax = niceMax(Math.max(...timed.map((p) => p.wait)) / 1000, 4);
  function drawScatter(boxId, key, r, axisLabel, what) {
    return (w) => {
      const box = $(boxId);
      box.querySelector("svg")?.remove();
      const pad = { l: 40, r: 14, t: 26, b: 40 };
      const h = Math.round(Math.min(300, Math.max(220, w * 0.62)));
      const xm = niceMax(Math.max(...timed.map((p) => p[key])), 3);
      const x = (v) => pad.l + (v / xm.max) * (w - pad.l - pad.r);
      const y = (s) => pad.t + (1 - s / waitMax.max) * (h - pad.t - pad.b);
      const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img", tabindex: "0", class: "focusable", "aria-label": C.speed.chartLabel(what, dec2.format(r)) });
      ticks(waitMax.max, waitMax.step).forEach((v) => {
        el("line", { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), class: v ? "grid" : "axis" }, svg);
        text(svg, pad.l - 8, y(v) + 4, fmt(v), "tick", "end");
      });
      ticks(xm.max, xm.step).forEach((v) => text(svg, x(v), h - pad.b + 18, compact.format(v), "tick", v === 0 ? "start" : "middle"));
      text(svg, w - pad.r, h - 4, axisLabel, "tick", "end");
      text(svg, 0, 11, C.speed.axisY, "tick", "start");
      timed.forEach((p) => el("circle", { cx: x(p[key]), cy: y(p.wait / 1000), r: 4, class: "dot" }, svg));
      const ring = el("circle", { r: 7, class: "dot-on", visibility: "hidden" }, svg);
      const tip = box._tip || (box._tip = tipFor(box));
      let at = timed.length - 1;
      const show = (j) => {
        at = j;
        const p = timed[j];
        ring.setAttribute("cx", x(p[key])); ring.setAttribute("cy", y(p.wait / 1000)); ring.setAttribute("visibility", "visible");
        const say = C.speed.tip(fmt(p.n), secs(p.wait), fmt(p.ctx), fmt(p.out));
        tip.show(`<b>${esc(C.explore.callOf(fmt(p.n), fmt(N)))}</b><span><b>${secs(p.wait)}</b> ${esc(C.speed.axisY)}</span>` +
          `<span><b>${fmt(p.ctx)}</b> ${esc(C.speed.axisCtx)}</span><span><b>${fmt(p.out)}</b> ${esc(C.speed.axisOut)}</span>`,
          x(p[key]), y(p.wait / 1000), say);
      };
      const hide = () => { ring.setAttribute("visibility", "hidden"); tip.hide(); };
      svg.addEventListener("pointermove", (e) => {
        const rc = svg.getBoundingClientRect();
        const px = e.clientX - rc.left, py = e.clientY - rc.top;
        let best = -1, bd = 24 * 24;
        timed.forEach((p, j) => { const dd = (x(p[key]) - px) ** 2 + (y(p.wait / 1000) - py) ** 2; if (dd < bd) { bd = dd; best = j; } });
        if (best >= 0) show(best); else hide();
      });
      svg.addEventListener("pointerleave", hide);
      svg.addEventListener("focus", () => show(at));
      svg.addEventListener("blur", hide);
      svg.addEventListener("keydown", (e) => {
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: timed.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        show(Math.max(0, Math.min(timed.length - 1, to)));
      });
      box.prepend(svg);
    };
  }

  // ---------- the table of every call ----------
  function buildTable() {
    $("calls-caption").textContent = C.table.caption;
    $("calls-head").innerHTML = `<tr>${C.table.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
    $("calls-body").innerHTML = calls.map((c, i) => `<tr><th scope="row">${fmt(i + 1)}</th><td>${esc(phaseOf(i).name)}</td>` +
      `<td>${fmt(c.context_tokens)}</td><td>${fmt(c.cached_tokens)}</td><td>${fmt(c.new_tokens)}</td><td>${fmt(c.output_tokens)}</td>` +
      `<td>${i ? secs(wait[i]) : esc(C.table.firstWait)}</td></tr>`).join("");
  }

  // ---------- go ----------
  fill();
  $("speed-ctx-title").textContent = C.speed.panelCtx(d.rCtx);
  $("speed-out-title").textContent = C.speed.panelOut(d.rOut);
  $("trace-links").innerHTML = `<a href="${ROOT}data/trace-03.js">${esc(C.colophon.traceCh2)}</a>${esc(C.colophon.traceSep)}<a href="${ROOT}data/trace-02-run2.js">${esc(C.colophon.traceCh1)}</a>`;
  initExplorer();
  buildTable();
  responsive($("compare-chart"), drawCompare);
  responsive($("kinds-chart"), drawKinds);
  responsive($("reread-chart"), drawReread);
  responsive($("speed-ctx"), drawScatter("speed-ctx", "ctx", rCtx, C.speed.axisCtx, C.speed.axisCtx));
  responsive($("speed-out"), drawScatter("speed-out", "out", rOut, C.speed.axisOut, C.speed.axisOut));

  // ---------- motion ----------
  // Each figure rises in as it comes into view, and its chart draws in once: bars grow from zero,
  // lines trace from the first call to the last, points arrive left to right. The conversation's
  // squares fill in reading order. A chart redrawn later (a resize) just appears.
  const figOf = (id) => $(id).closest("figure");
  const labelsIn = (box, delay) => Mo.enter([...box.querySelectorAll("svg text.value, svg text.mark-label")], { y: 0, duration: Mo.dur.base, delay });
  Mo.reveal(figOf("compare-chart"), () => {
    const box = $("compare-chart");
    Mo.grow([...box.querySelectorAll(".bar-ch1, .bar-ch2")], { delay: 120, stagger: 80 });
    labelsIn(box, 420);
  });
  Mo.reveal(figOf("kinds-chart"), () => {
    const box = $("kinds-chart");
    Mo.grow([...box.querySelectorAll(".k-sys, .k-model, .k-back")], { delay: 120, stagger: 60 });
    labelsIn(box, 380);
  });
  Mo.reveal(figOf("reread-chart"), () => {
    const box = $("reread-chart");
    box.querySelectorAll(".line-sum, .line-ctx").forEach((l) => Mo.draw(l, { delay: 120 }));
    Mo.enter(box.querySelector(".area-sum"), { y: 0, duration: Mo.dur.base, delay: 400 });
    Mo.enter([...box.querySelectorAll("circle:not([visibility])")], { y: 0, duration: Mo.dur.fast, delay: 520 });
    labelsIn(box, 520);
  });
  Mo.reveal(document.querySelector(".pair"), (el) => {
    el.querySelectorAll(".chart-box").forEach((box) => {
      const dots = [...box.querySelectorAll("circle.dot")].sort((a, b) => a.getAttribute("cx") - b.getAttribute("cx"));
      Mo.pop(dots, { delay: 120 });
    });
  });
  Mo.reveal(document.querySelector(".explorer"), () => fillIn(0, cur, { spread: 450, max: Infinity }));
  Mo.reveal([...document.querySelectorAll(".stats, .table-wrap")]);

  // Any of these that scrolls at the reader's width can be reached and scrolled by keyboard.
  U.watchScrollBoxes(".card pre, .prompt-full");
})();
