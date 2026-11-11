// Chapter 6 page. Every number and every word the agent wrote or saw comes from the recordings:
// TRACES[1..3] (site/data/trace-06-runK.js, the three runs of recording 06, each with its main
// conversation in `calls` and its subagent in `subagents[]`) and TRACES.ch1 (site/data/trace-02-run2.js,
// chapter 1's run of the same bug, with no subagent). The narration and all labels come from
// window.COPY (copy.en.js); escaping and formatting from window.TraceUI, motion from window.Motion.
(() => {
  "use strict";

  const R = window.TRACES;
  const RUNS = Object.keys(R).filter((k) => /^\d+$/.test(k)).map((k) => R[k]).sort((a, b) => a.run.index - b.run.index);
  const CH1 = R.ch1;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, toolsOf, textsOf, lineCount } = U;
  const { fmt, pl, list } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const code = (s) => `<code>${esc(s)}</code>`;
  const plain = (html) => html.replace(/<[^>]+>/g, "");
  const dec1 = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Costs as recorded (total_cost_usd has four decimals).
  const money = new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const dateOf = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const timeOf = (iso) => new Date(iso).toISOString().slice(11, 19);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const fileOf = (t) => U.base(String(t.input.file_path || "").replace(/\\/g, "/"));
  // The site's root relative to this page: "../" here, "../../" on a translated page (<body data-root>).
  const ROOT = document.body.dataset.root || "../";

  // ---------- how the runs were started (RECORDING-06.md; the stream doesn't record it) ----------
  const FLAGS = (T) => `claude -p <prompt> --model ${T.model} --output-format stream-json --verbose --restricted ` +
    `--tools Bash,Read,Edit,Glob,Grep,Agent --allowedTools "Bash(node *)" Read Edit Glob Grep Agent ` +
    `--strict-mcp-config --setting-sources "" --permission-mode acceptEdits --forward-subagent-text ` +
    `--session-id <id> --max-budget-usd 0.5`;

  // ---------- reading one run ----------
  const isTests = (t) => t.tool === "Bash" && /node --test/.test(t.input.command) && /ℹ pass \d+/.test(t.result.text);
  const num = (re, s) => +((s.match(re) || [])[1] || 0);
  function readRun(T) {
    const agentAt = T.calls.findIndex((c) => toolsOf(c).some((t) => t.tool === "Agent"));
    const agent = agentAt >= 0 ? toolsOf(T.calls[agentAt]).find((t) => t.tool === "Agent") : null;
    const sub = (T.subagents || []).find((s) => agent && s.tool_use_id === agent.id) || (T.subagents || [])[0] || null;
    const mainTools = T.calls.flatMap(toolsOf);
    const fix = mainTools.find((t) => (t.tool === "Edit" || t.tool === "Write") && !t.result.is_error);
    const tests = mainTools.filter(isTests);
    const last = tests[tests.length - 1];
    const subTests = sub ? sub.calls.flatMap(toolsOf).filter((t) => t.tool === "Bash" && /node --test/.test(t.input.command)) : [];
    const pass = last ? num(/ℹ pass (\d+)/, last.result.text) : 0;
    const total = last ? num(/ℹ tests (\d+)/, last.result.text) : 0;
    const failN = last ? num(/ℹ fail (\d+)/, last.result.text) : 1;
    return {
      T, agentAt, agent, sub, fix, last, pass, total,
      growth: agentAt >= 0 && T.calls[agentAt + 1] ? T.calls[agentAt + 1].added_since_previous : null,
      // The selection rule (RECORDING-06.md): a subagent ran, and the bug is fixed (the last test run
      // after the fix has no failures). A trace that didn't build isn't in the repo.
      passes: !!sub && sub.status === "completed" && sub.calls.length > 0 && !!fix && !!last && last.t_ms > fix.t_ms && failN === 0 && pass > 0,
      testedBefore: !!fix && tests.some((t) => t.t_ms < fix.t_ms),
      subTested: subTests.length > 0,
    };
  }
  const runs = RUNS.map(readRun);
  const preferred = runs.find((r) => r.T.run.index === 2);
  const S = preferred && preferred.passes ? preferred : runs.find((r) => r.passes) || preferred || runs[0];
  const T = S.T;
  const SUB = S.sub;
  const prev = runs.find((r) => r.T.run.index === T.run.index - 1);
  if (!prev) console.warn("No run before the one shown: the cache paragraph assumes one.");

  // ---------- values ----------
  const main = T.calls;
  const subCalls = SUB.calls;
  const subLast = subCalls[subCalls.length - 1];
  const aliasName = Object.keys(T.tool_aliases || {}).find((k) => T.tool_aliases[k] === "Agent") || "";
  const toolNames = (T.tools_available || []).map((t) => (T.tool_aliases || {})[t] || t);
  const extraTools = CH1 ? toolNames.filter((t) => !CH1.tools_available.includes(t)) : [];
  const allBash = main.concat(subCalls).flatMap(toolsOf).filter((t) => t.tool === "Bash");
  const aliasPath = (main.flatMap(toolsOf).find((t) => t.input.file_path) || { input: { file_path: "" } }).input.file_path;
  const alias = (aliasPath.match(/^~\/[^/\\]+/) || [""])[0];
  const subTools = [...new Set(subCalls.flatMap(toolsOf).map((t) => t.tool))];
  const subReads = subCalls.flatMap(toolsOf).filter((t) => t.tool === "Read" && !t.input.offset);
  const fixAt = S.fix ? S.fix.t_ms : Infinity;
  const mainReads = main.flatMap(toolsOf).filter((t) => t.tool === "Read" && t.t_ms < fixAt);
  const readText = (t) => {
    if (!t.input.offset) return C.shows.trust.readWhole(esc(fileOf(t)));
    return C.shows.trust.readRange(fmt(t.input.offset), fmt(t.input.offset + lineCount(t.result.text) - 1), esc(fileOf(t)));
  };
  // Sentences of the model's own text, found by what they say (each is hidden if it isn't there).
  const sentenceWith = (text, re) => {
    const flat = text.replace(/```[\s\S]*?```/g, " ");
    return (flat.split(/(?<=[.!?])\s+/).find((s) => re.test(s)) || "").trim();
  };
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const promptSentences = SUB.prompt.split(/(?<=[.!?])\s+/);
  const guess = (SUB.prompt.match(/\(([^)]*tunnel[^)]*)\)/i) || [])[1] || "";
  const cacheWrites = (calls, k) => sum(calls.map((c) => c[k] || 0));
  const main1h = cacheWrites(main, "cache_write_1h"), main5m = cacheWrites(main, "cache_write_5m");
  const sub1h = cacheWrites(subCalls, "cache_write_1h"), sub5m = cacheWrites(subCalls, "cache_write_5m");
  const endOf = (X) => new Date(X.started_at).getTime() + X.totals.duration_s * 1000;
  const gapAfter = (a, b) => Math.max(0, Math.round((new Date(b.started_at).getTime() - endOf(a)) / 1000));
  const mainFirst = main[0].context_tokens, mainLast = main[main.length - 1].context_tokens;
  const ch1First = CH1 ? CH1.calls[0].context_tokens : 0, ch1Last = CH1 ? CH1.calls[CH1.calls.length - 1].context_tokens : 0;

  const d = {
    samePrompt: !!CH1 && T.prompt.startsWith(CH1.prompt),
    agentTool: esc(S.agent.tool), desc: esc(S.agent.input.description || SUB.description), subType: esc(SUB.subagent_type),
    promptChars: fmt(SUB.prompt.length), handbackChars: fmt(S.agent.result.text.length), reportChars: fmt(SUB.report.length),
    main1: fmt(mainFirst), main1Out: fmt(main[S.agentAt].output_tokens), sub1: fmt(subCalls[0].context_tokens),
    subLast: fmt(subLast.context_tokens), subOut: fmt(subLast.output_tokens), subPeak: fmt(SUB.totals.total_tokens),
    growth: fmt(S.growth),
    sendAt: U.clock(SUB.t_ms), backAt: U.clock(SUB.end_t_ms), subDur: dec1.format(SUB.totals.duration_s), runDur: dec1.format(T.totals.duration_s),
    subCalls: fmt(subCalls.length), mainCalls: fmt(main.length), calls: fmt(T.totals.model_calls),
    subTools: list(subTools.map(esc)),
    guess: inline(guess), lastAsk: inline(promptSentences.length > 1 ? promptSentences[promptSentences.length - 1] : ""),
    cause: inline(sentenceWith(SUB.report, /as if it were the/)), noTests: inline(sentenceWith(SUB.report, /haven't run the tests/i)),
    main1Cached: fmt(main[0].cached_tokens), sub1Cached: fmt(subCalls[0].cached_tokens),
    gap: prev ? fmt(gapAfter(prev.T, T)) : "", r1Sub1Cached: fmt(runs[0].sub ? runs[0].sub.calls[0].cached_tokens : 0),
    main1h: fmt(main1h), sub5m: fmt(sub5m),
    mostCached: main.concat(subCalls).every((c) => c.cached_tokens > c.context_tokens / 2),
    cost: esc(money.format(T.totals.cost_usd)),
    file: esc(subReads.length ? fileOf(subReads[0]) : ""),
    mainRead: list(mainReads.map(readText)),
    pass: fmt(S.pass), tests: fmt(S.total), runs: fmt(runs.length),
    allRuns: runs.every((r) => !r.testedBefore && !r.subTested),
    ch1Growth: fmt(ch1Last - ch1First), mainGrowth: fmt(mainLast - mainFirst), startDiff: fmt(mainFirst - ch1First),
    ch1First: fmt(ch1First), ch1Last: fmt(ch1Last), mainLast: fmt(mainLast),
    near: CH1 ? Math.abs(mainLast - ch1Last) / ch1Last < 0.05 : false,
    extraTools: extraTools.map(esc).join("</code>, <code>"),
    ccv: esc(T.claude_code_version), ch1ccv: CH1 ? esc(CH1.claude_code_version) : "",
    ch1Calls: CH1 ? fmt(CH1.totals.model_calls) : "", ch1Cost: CH1 ? esc(money.format(CH1.totals.cost_usd)) : "",
    callsBoth: esc(C.stats.callsValue(fmt(main.length), fmt(subCalls.length))),
    allPassed: runs.every((r) => r.passes),
    date: dateOf(T.recorded), time: timeOf(RUNS[0].started_at), model: esc(T.model), aliasName: esc(aliasName),
    shownLine: C.colophon.shown(fmt(T.run.index)),
    gaps: list(runs.slice(1).map((r, i) => fmt(gapAfter(runs[i].T, r.T)))),
    r1Main1Cached: fmt(runs[0].T.calls[0].cached_tokens),
    alias: esc(alias), quoted: allBash.some((t) => t.input.command.includes(`"${alias}`)),
  };

  // ---------- static text ----------
  document.querySelectorAll("[data-c]").forEach((el) => {
    const fn = el.dataset.c.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
    if (typeof fn === "function") el.innerHTML = fn(d);
    else if (typeof fn === "string") el.innerHTML = fn;
  });
  document.querySelectorAll("[data-v]").forEach((el) => { if (d[el.dataset.v] !== undefined) el.innerHTML = d[el.dataset.v]; });
  $("prompt").textContent = T.prompt;
  if (!CH1) $("point-tiny").hidden = true;
  if (main5m || sub1h) $("cost-p3").hidden = true;
  // Break the flags only at spaces, never after the hyphens of a flag.
  $("flags").innerHTML = FLAGS(T).split(" ").map((a) => `<span>${esc(a)}</span>`).join(" ");
  $("runs").innerHTML = runs.map((r) => `<li>${esc(C.colophon.runLine({
    k: fmt(r.T.run.index), main: fmt(r.T.calls.length), sub: fmt(r.sub ? r.sub.calls.length : 0), secs: dec1.format(r.T.totals.duration_s),
    cost: money.format(r.T.totals.cost_usd), peak: fmt(r.sub ? r.sub.totals.total_tokens : 0), growth: fmt(r.growth || 0), pass: fmt(r.pass), tests: fmt(r.total),
  }))}${r === S ? esc(C.colophon.runShown) : ""}</li>`).join("");
  $("trace-links").innerHTML = list(runs.map((r) => `<a href="${ROOT}data/trace-06-run${r.T.run.index}.js">${esc(C.colophon.link(fmt(r.T.run.index)))}</a>`));

  // ---------- figure: the two conversations, to one scale ----------
  const TH = C.threads;
  const D = TH.did;
  function didOf(c, lane) {
    const ts = toolsOf(c);
    if (!ts.length) return lane === "main" ? D.answer : D.report;
    return ts.map((t) => {
      if (t.tool === "Agent") return D.agent;
      if (t.tool === "Read") return t.input.offset ? D.readRange(code(fileOf(t)), fmt(t.input.offset), fmt(t.input.offset + lineCount(t.result.text) - 1)) : D.read(code(fileOf(t)));
      if (t.tool === "Edit" || t.tool === "Write") return D.edit(code(fileOf(t)));
      if (t.tool === "Grep") return D.grep;
      if (t.tool === "Glob") return D.glob;
      if (t.tool === "Bash") return /node --test/.test(t.input.command) ? D.tests : /(^|&& |; )find /.test(t.input.command) ? D.find : D.bash;
      return esc(t.tool);
    }).join(esc(D.join));
  }

  // One bar's parts. "kind": the set-up, then each step's model part and what came back, as chapter 2
  // splits them (the model's part is what the call before wrote, the rest is results). "cache": what
  // the call read from the cache and what was new. The subagent's last call also shows what it wrote.
  function partsOf(calls, i, mode, isReport, lane) {
    const c = calls[i];
    const parts = [];
    if (mode === "cache") {
      const cached = Math.min(c.cached_tokens, c.context_tokens);
      parts.push({ cls: "k-cached", tokens: cached }, { cls: "k-fresh", tokens: c.context_tokens - cached });
    } else {
      parts.push({ cls: "k-sys", tokens: calls[0].context_tokens });
      for (let r = 1; r <= i; r++) {
        const delta = Math.max(0, calls[r].context_tokens - calls[r - 1].context_tokens);
        const model = Math.min(calls[r - 1].output_tokens || 0, delta);
        parts.push({ cls: "k-model", tokens: model }, { cls: "k-back", tokens: delta - model, hb: lane === "main" && r - 1 === S.agentAt });
      }
    }
    if (isReport) parts.push({ cls: mode === "cache" ? "k-out" : "k-wrote", tokens: c.output_tokens, wrote: true });
    return parts;
  }

  // The rows, in the order they happened: main calls, the request going out, the subagent's calls,
  // the report coming back.
  const rows = [];
  main.forEach((c, i) => rows.push({ t: c.t_ms, o: 0, kind: "call", lane: "main", calls: main, i }));
  rows.push({ t: S.agent.t_ms, o: 1, kind: "send" });
  subCalls.forEach((c, i) => rows.push({ t: c.t_ms, o: 2, kind: "call", lane: "sub", calls: subCalls, i, report: i === subCalls.length - 1 }));
  rows.push({ t: SUB.end_t_ms, o: 3, kind: "back" });
  rows.sort((a, b) => a.t - b.t || a.o - b.o);

  const peakOf = (r) => r.calls[r.i].context_tokens + (r.report ? r.calls[r.i].output_tokens : 0);
  const MAX = Math.ceil(Math.max(...rows.filter((r) => r.kind === "call").map(peakOf)) / 1000) * 1000;
  d.scaleMax = fmt(MAX);
  document.querySelector('#threads [data-c="threads.note"]').innerHTML = TH.note(d);
  $("threads-readout").innerHTML = TH.readout(d);
  const sendIdx = rows.findIndex((r) => r.kind === "send"), backIdx = rows.findIndex((r) => r.kind === "back");

  const tl = $("tl");
  function barHTML(r, mode) {
    const parts = partsOf(r.calls, r.i, mode, r.report, r.lane);
    let at = 0, mark = "";
    const segs = parts.map((p) => {
      const left = at;
      at += p.tokens;
      if (p.hb && r.i === S.agentAt + 1) {
        const mid = (left + p.tokens) / MAX;
        mark = `<span class="hb-mark${mid > 0.5 ? " end" : ""}" style="${mid > 0.5 ? `right:${(1 - mid) * 100}%` : `left:${(left / MAX) * 100}%`}">${esc(TH.handbackMark)}</span>`;
      }
      return `<i class="seg ${p.cls}${p.hb ? " is-hb" : ""}${p.wrote ? " is-wrote" : ""}${p.tokens ? "" : " is-zero"}" style="width:${(p.tokens / MAX) * 100}%"></i>`;
    }).join("");
    // The hand-back is drawn only when the bars are coloured by kind, but its row keeps its place in
    // both modes, so switching colours never moves the rows below it.
    if (!mark && r.lane === "main" && r.i === S.agentAt + 1) mark = `<span class="hb-mark"></span>`;
    return `<div class="bar" aria-hidden="true">${segs}</div>${mark ? `<div class="bar-marks${mode === "kind" ? "" : " is-off"}" aria-hidden="true">${mark}</div>` : ""}`;
  }
  function srOf(r, mode) {
    const c = r.calls[r.i];
    let s = TH.srCall(TH.lanes[r.lane], fmt(r.i + 1), fmt(c.context_tokens), plain(didOf(c, r.lane)), U.clock(c.t_ms));
    if (mode === "cache") s += " " + TH.srCache(fmt(Math.min(c.cached_tokens, c.context_tokens)), fmt(c.context_tokens - Math.min(c.cached_tokens, c.context_tokens)));
    else {
      const parts = partsOf(r.calls, r.i, "kind", false, r.lane);
      s += " " + TH.srSplit(fmt(parts[0].tokens), fmt(sum(parts.filter((p) => p.cls === "k-model").map((p) => p.tokens))), fmt(sum(parts.filter((p) => p.cls === "k-back").map((p) => p.tokens))));
    }
    if (r.report) s += " " + TH.srWrote(fmt(c.output_tokens));
    return s;
  }
  function slotHTML(r, mode) {
    const c = r.calls[r.i];
    // The label breaks only between its halves ("Call 1 ·" / "9,322 tokens"), never inside one.
    const label = TH.call(fmt(r.i + 1), fmt(c.context_tokens)).split(" · ").map(esc).join(" ·</span> <span class=\"nw\">");
    return `<p class="row-l" aria-hidden="true"><span class="row-n"><span class="nw">${label}</span></span><span class="row-t">${esc(U.clock(c.t_ms))}</span></p>` +
      `<div class="bar-wrap">${barHTML(r, mode)}</div>` +
      (r.report ? `<p class="row-wrote" aria-hidden="true">${esc(TH.wrote(fmt(c.output_tokens)))}</p>` : "") +
      `<p class="row-did" aria-hidden="true">${didOf(c, r.lane)}</p>` +
      `<span class="sr-only" data-sr>${esc(srOf(r, mode))}</span>`;
  }
  function draw(mode) {
    tl.dataset.mode = mode;
    let waitShown = false;
    tl.innerHTML = rows.map((r, k) => {
      if (r.kind === "send") return `<li class="row r-arrow to-sub"><p class="arrow"><span>${esc(TH.send(d))}</span></p></li>`;
      if (r.kind === "back") return `<li class="row r-arrow to-main"><p class="arrow"><span>${esc(TH.back(d))}</span></p></li>`;
      const waiting = k > sendIdx && k < backIdx;
      const mainSlot = r.lane === "main" ? slotHTML(r, mode)
        // The "waiting" label is only drawn: read aloud, it would run into the subagent's row beside it,
        // and the arrows and the paragraph below the figure say that the main conversation waited.
        : waiting ? `<span class="wait" aria-hidden="true">${waitShown ? "" : esc(TH.waiting)}</span>` : "";
      if (waiting && r.lane === "sub") waitShown = true;
      const subSlot = r.lane === "sub" ? slotHTML(r, mode) : "";
      return `<li class="row r-call" data-lane="${r.lane}"><div class="slot s-main${waiting ? " is-wait" : ""}">${mainSlot}</div><div class="slot s-sub">${subSlot}</div></li>`;
    }).join("");
  }
  // Switching colours keeps the rows; only each bar's parts and its spoken text change.
  function recolour(mode) {
    tl.dataset.mode = mode;
    const callRows = rows.filter((r) => r.kind === "call");
    tl.querySelectorAll(".r-call").forEach((li, j) => {
      const r = callRows[j];
      const slot = li.querySelector(`.s-${r.lane}`);
      const wrap = slot.querySelector(".bar-wrap");
      // The old parts stay on top as a copy and fade out over the new ones, row after row: a dissolve
      // from one colouring to the other, with nothing moving. Under reduced motion the swap is instant.
      const ghost = Mo.reduced() ? null : document.createElement("div");
      if (ghost) {
        ghost.className = "bar-ghost";
        ghost.setAttribute("aria-hidden", "true");
        [...wrap.children].filter((el) => !el.classList.contains("bar-ghost")).forEach((el) => ghost.appendChild(el));
      }
      wrap.innerHTML = barHTML(r, mode);
      slot.querySelector("[data-sr]").textContent = srOf(r, mode);
      if (!ghost) return;
      wrap.appendChild(ghost);
      const a = Mo.play(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: Mo.dur.slow, delay: j * 30, easing: Mo.ease.inOut, fill: "both" });
      if (a) a.finished.then(() => ghost.remove(), () => ghost.remove());
      else ghost.remove();
    });
    legend(mode, true);
  }
  // Both keys are drawn in the same place and only the current one shows, so the figure keeps its
  // height whichever is longer at the reader's width.
  const L = TH.legend;
  const KEYS = { kind: [["k-sys", L.sys], ["k-model", L.model], ["k-back", L.back]], cache: [["k-cached", L.cached], ["k-fresh", L.fresh], ["k-out", L.out]] };
  $("threads-legend").innerHTML = Object.keys(KEYS).map((m) => `<div class="lg" data-mode="${m}">${KEYS[m].map(([k, label]) =>
    `<span><i class="sw ${k}" aria-hidden="true"></i>${esc(label)}</span>`).join("")}</div>`).join("");
  function legend(mode, animate) {
    $("threads-legend").querySelectorAll(".lg").forEach((g) => {
      const on = g.dataset.mode === mode;
      g.classList.toggle("is-off", !on);
      if (on) g.removeAttribute("aria-hidden"); else g.setAttribute("aria-hidden", "true");
      if (on && animate) Mo.enter(g, { y: 0, duration: Mo.dur.slow });
    });
  }
  $("threads-mode").insertAdjacentHTML("beforeend", ["kind", "cache"].map((m, i) =>
    `<label class="seg-opt"><input type="radio" name="threads-mode" value="${m}"${i ? "" : " checked"}><span>${esc(TH.modes[m])}</span></label>`).join(""));
  $("threads-mode").addEventListener("change", (e) => { if (e.target.name === "threads-mode") recolour(e.target.value); });
  draw("kind");
  legend("kind");

  // ---------- the handoff, in the model's words ----------
  const W = C.words;
  const a = S.agent;
  const other = Object.keys(a.input).filter((k) => k !== "prompt" && k !== "description");
  $("task-card").innerHTML = U.cardHead(`${esc(W.request)} · ${esc(a.tool)}`, a.input.description ? `“${esc(a.input.description)}”` : "") +
    `<p class="task-k">${esc(W.task)}</p>` + U.md(a.input.prompt) +
    (other.length ? `<p class="task-k">${esc(W.inputs)}</p><ul class="task-in">${other.map((k) => `<li><code>${esc(k)}</code> <span>${esc(JSON.stringify(a.input[k]))}</span></li>`).join("")}</ul>` : "");

  // The report: line by line, with ## headings, list items and ``` code blocks.
  function renderDoc(text) {
    let html = "", codeLines = null;
    text.split("\n").forEach((line) => {
      if (/^\s*```/.test(line)) {
        if (codeLines === null) { codeLines = []; return; }
        html += `<pre>${esc(codeLines.join("\n"))}</pre>`;
        codeLines = null;
        return;
      }
      if (codeLines !== null) { codeLines.push(line); return; }
      if (!line.trim()) return;
      let m;
      if ((m = line.match(/^#{1,4}\s+(.*)$/))) html += `<p class="say d-h">${inline(m[1])}</p>`;
      else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) html += `<p class="say d-li">${inline(m[1])}</p>`;
      else html += `<p class="say">${inline(line.trim())}</p>`;
    });
    if (codeLines) html += `<pre>${esc(codeLines.join("\n"))}</pre>`;
    return html;
  }
  // Where to fold it: the first blank line outside a code block after about this many characters.
  const FOLD_AT = 650;
  function foldPoint(text) {
    const lines = text.split("\n");
    let at = 0, inCode = false;
    for (let k = 0; k < lines.length; k++) {
      if (/^\s*```/.test(lines[k])) inCode = !inCode;
      if (!inCode && !lines[k].trim() && at >= FOLD_AT) return at;
      at += lines[k].length + 1;
    }
    return text.length;
  }
  const rep = SUB.report;
  const cut = foldPoint(rep);
  const restChars = rep.slice(cut).trim().length;
  const repCard = $("report-card");
  repCard.innerHTML = U.cardHead(esc(W.report), esc(W.chars(fmt(rep.length)))) +
    `<div class="report-body">${renderDoc(rep.slice(0, cut))}</div>` +
    (restChars ? `<div class="report-rest" id="report-rest" hidden>${renderDoc(rep.slice(cut))}</div>` +
      `<div class="card-foot"><button type="button" class="btn" id="report-more" aria-expanded="false" aria-controls="report-rest">` +
        `<span class="bl">${esc(W.more)}</span><span class="bn">${esc(W.hiddenNote(fmt(restChars)))}</span></button></div>` : "");
  if (restChars) {
    const btn = $("report-more"), rest = $("report-rest");
    repCard.classList.add("is-folded");
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      rest.hidden = !open;
      repCard.classList.toggle("is-folded", !open);
      btn.querySelector(".bl").textContent = open ? W.less : W.more;
      btn.querySelector(".bn").hidden = open;
      if (open) Mo.enter(rest, { y: 4 });
      else if (repCard.getBoundingClientRect().top < 0) repCard.scrollIntoView({ block: "start" });
    });
  }
  if (!d.cause) document.querySelector('[data-c="words.p3"]').hidden = true;

  // The hand-back as the main model got it: everything before the report, then its first lines.
  const hb = a.result.text;
  const marker = "The report follows:";
  const at = hb.indexOf(marker);
  let hbHTML;
  if (at >= 0) {
    const head = hb.slice(0, at + marker.length);
    const repLines = hb.slice(at + marker.length).replace(/^\n/, "").split("\n");
    const show = 3;
    hbHTML = esc(head) + "\n" + repLines.slice(0, show).map(esc).join("\n") +
      (repLines.length > show ? `\n<span class="more">${esc(pl(W.moreLines, repLines.length - show))}</span>` : "");
  } else {
    const ls = hb.split("\n");
    hbHTML = ls.slice(0, 8).map(esc).join("\n") + (ls.length > 8 ? `\n<span class="more">${esc(pl(W.moreLines, ls.length - 8))}</span>` : "");
  }
  $("handback-card").innerHTML = U.cardHead(`${esc(W.result)} · ${esc(a.tool)}`, esc(W.resultMeta)) + `<pre>${hbHTML}</pre>`;

  // ---------- the tokens by conversation ----------
  const K = C.cost;
  const tm = T.totals.main, ts = T.totals.subagents;
  const splitRows = [["out", "output_tokens"], ["read", "cache_read_tokens"], ["write", "cache_write_tokens"]];
  $("split").insertAdjacentHTML("beforeend",
    `<thead><tr>${K.cols.map((c, i) => (i ? `<th scope="col">${esc(c)}</th>` : `<td></td>`)).join("")}</tr></thead>` +
    `<tbody>${splitRows.map(([k, f]) => {
      const vals = [tm[f], ts[f]];
      const max = Math.max(...vals, 1);
      return `<tr><th scope="row">${esc(K.rows[k])}</th>${vals.map((v, j) =>
        `<td><span class="sv">${fmt(v)}</span><span class="sb ${j ? "is-sub" : "is-main"}" aria-hidden="true"><i style="width:${(v / max) * 100}%"></i></span></td>`).join("")}</tr>`;
    }).join("")}</tbody>`);

  // ---------- motion ----------
  // The rows arrive in the order they happened: each bar grows from its left edge, the arrows after it.
  Mo.reveal($("threads"), (el) => {
    const items = [...el.querySelectorAll(".row")];
    items.forEach((li, k) => {
      const bar = li.querySelector(".bar");
      if (bar) Mo.grow(bar, { delay: 120 + k * 70, duration: Mo.dur.reveal });
      else Mo.enter(li.querySelector(".arrow"), { y: 0, delay: 120 + k * 70 });
      const rest = li.querySelectorAll(".row-did, .row-wrote, .bar-marks, .wait");
      Mo.enter([...rest], { y: 2, delay: 220 + k * 70 });
    });
  });
  Mo.reveal([document.querySelector(".handoff"), $("handback-card"), document.querySelector(".stats")]);
  // The token table's bars grow from their left edge, row by row, as it comes into view.
  Mo.reveal(document.querySelector(".split-wrap"), (el) => {
    el.querySelectorAll("tbody tr").forEach((tr, k) => Mo.grow([...tr.querySelectorAll(".sb i")], { delay: 160 + k * 90, stagger: 50, duration: Mo.dur.reveal }));
  });

  // Any of these that scrolls at the reader's width can be reached and scrolled by keyboard.
  U.watchScrollBoxes(".card pre");
})();
