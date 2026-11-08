// Chapter 1 page. Every number and every piece of text the agent wrote or saw comes from window.TRACE
// (site/data/trace-02-run2.js), the recorded session; the other runs come from window.TRACES.
// The narration and all labels come from window.COPY (copy.en.js). Escaping, formatting, excerpts
// and the card HTML come from window.TraceUI (../lib/trace-ui.js).
(() => {
  "use strict";
  const T = window.TRACE;
  const RUNS = window.TRACES || {};
  const C = window.COPY;
  const U = window.TraceUI;
  const calls = T.calls;
  const $ = (id) => document.getElementById(id);
  const { fmt, pl, list } = U.numbers(C.locale);
  const { esc, base, secs, clock, toolsOf, textsOf, lineCount, readLines, range } = U;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const allTools = calls.flatMap(toolsOf);

  // ---------- values read from the recording ----------
  const glob = allTools.find((t) => t.tool === "Glob");
  const reads = allTools.filter((t) => t.tool === "Read");
  const edit = allTools.find((t) => t.tool === "Edit");
  const bashes = allTools.filter((t) => t.tool === "Bash");
  const [bashBefore, bashAfter] = [bashes.find((b) => b.t_ms < edit.t_ms), bashes.find((b) => b.t_ms > edit.t_ms)];
  const files = glob.result.text.trim().split("\n");
  const readNames = reads.map((r) => base(r.input.file_path));
  const mainRead = reads.find((r) => base(r.input.file_path) === base(edit.input.file_path));
  const testRead = reads.find((r) => r !== mainRead);
  const mainLines = readLines(mainRead.result.text);
  const oldFirst = edit.input.old_string.split("\n")[0];
  const bugIdx = mainLines.indexOf(oldFirst);
  let fnIdx = bugIdx;
  while (fnIdx > 0 && !/^function\s/.test(mainLines[fnIdx])) fnIdx--;
  const failOut = bashBefore.result.text;
  const failName = (failOut.match(/✖ (.+?) \(\d/) || [])[1] || "";
  const assertion = ((failOut.match(/^[ \t]*(assert\.\w+\(.*\))[ \t]*$/m) || [])[1] || "");
  const afterOut = bashAfter.result.text;
  const num = (re, s) => +((s.match(re) || [])[1] || 0);
  const tailOf = (b) => ((b.input.command.match(/tail -n? ?(\d+)/) || [])[1] || "");
  const testLines = readLines(testRead.result.text);
  const failIdx = testLines.findIndex((l) => failName && l.includes(failName));

  // Run k-1 ended this long before run k started (for the cache sentence).
  const prevRun = RUNS[T.run.index - 1];
  const endOf = (r) => Date.parse(r.started_at) + Math.max(...r.calls.flatMap((c) => c.output.flatMap((o) => [o.t_ms, o.result ? o.result.t_ms : 0])));
  const gapMin = prevRun ? Math.round((Date.parse(T.started_at) - endOf(prevRun)) / 60000) : "";

  const ctx = calls.map((c) => c.context_tokens);
  const first = ctx[0], last = ctx[ctx.length - 1];
  const added = calls.map((c) => c.added_since_previous || 0);
  const bigAdd = Math.max(...added);
  const END = Math.max(...calls.flatMap((c) => c.output.flatMap((o) => [o.t_ms, o.result ? o.result.t_ms : 0])));

  const d = {
    prompt: T.prompt, model: T.model, ccv: T.claude_code_version,
    date: new Date(T.recorded + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    toolList: list(T.tools_available), toolCount: fmt(T.tools_available.length),
    toolPlain: list(T.tools_available.slice().sort((a, b) => ["Glob", "Grep", "Read", "Edit", "Bash"].indexOf(a) - ["Glob", "Grep", "Read", "Edit", "Bash"].indexOf(b)).map((t) => C.toolPlain[t] || t)),
    runIndex: fmt(T.run.index), runOf: fmt(T.run.of), prevRun: prevRun ? fmt(prevRun.run.index) : "", gapMin: fmt(gapMin),
    calls: fmt(calls.length), duration: String(T.totals.duration_s), cost: "$" + T.totals.cost_usd,
    setup: fmt(first), c: ctx.map(fmt), cached: calls.map((c) => fmt(c.cached_tokens)), added: added.map(fmt), last: calls.length - 1,
    globPattern: esc(glob.input.pattern), fileCount: fmt(files.length),
    readFiles: list(readNames.map((n) => `<code>${esc(n)}</code>`)),
    unread: list(files.filter((f) => !readNames.includes(base(f))).map((n) => `<code>${esc(n)}</code>`)),
    mainFile: esc(base(edit.input.file_path)),
    gameLines: fmt(mainLines.length), testLines: fmt(testLines.length),
    testCount: fmt(testLines.filter((l) => /^test\(/.test(l)).length),
    readAdded: fmt(bigAdd),
    tail1: tailOf(bashBefore), tail1cmd: esc((bashBefore.input.command.match(/tail -n? ?\d+/) || [""])[0]),
    alias: esc((bashBefore.input.command.match(/cd "([^"]+)"/) || [])[1] || ""),
    cdPart: esc((bashBefore.input.command.match(/cd "[^"]+"/) || [""])[0]),
    bashWait: secs(bashBefore.result.t_ms - bashBefore.t_ms),
    failName: esc(failName), assertion: esc(assertion),
    bugLine: fmt(bugIdx + 1), fnLine: fmt(fnIdx + 1),
    oldLines: fmt(edit.input.old_string.split("\n").length), newLines: fmt(edit.input.new_string.split("\n").length),
    tail2: tailOf(bashAfter),
    tests: fmt(num(/ℹ tests (\d+)/, afterOut)), pass: fmt(num(/ℹ pass (\d+)/, afterOut)), fail: fmt(num(/ℹ fail (\d+)/, afterOut)),
    loc: esc((T.final_answer.match(/`([\w.]+:\d+)`/) || [])[1] || ""),
    sumRead: fmt(ctx.reduce((a, b) => a + b, 0)), cacheTotal: fmt(T.totals.cache_read_tokens),
    first: fmt(first), lastTokens: fmt(last), ratio: (last / first).toFixed(1),
    source: esc(T.source), tools: esc(T.tools_available.join(", ")),
    clockEnd: "", linesChanged: "",
  };
  d.linesChanged = `${d.oldLines} → ${d.newLines}`;

  // Each run of the batch, and the selection rule applied to it.
  const runInfo = Object.values(RUNS).sort((a, b) => a.run.index - b.run.index).map((r) => {
    const ts = r.calls.flatMap(toolsOf);
    const fix = ts.find((t) => t.tool === "Edit" || t.tool === "Write");
    const tests = ts.filter((t) => t.tool === "Bash" && /node --test/.test(t.input.command));
    return {
      k: fmt(r.run.index), index: r.run.index, calls: fmt(r.totals.model_calls), secs: String(r.totals.duration_s),
      before: !!fix && tests.some((t) => t.t_ms < fix.t_ms), after: !!fix && tests.some((t) => t.t_ms > fix.t_ms),
    };
  });
  const others = runInfo.filter((r) => r.index !== T.run.index && !r.before);
  d.otherRuns = others.length ? C.prose.otherRuns(others.length === 1 ? C.prose.runOne(others[0].k) : C.prose.runsList(list(others.map((r) => r.k)))) : "";

  d.clockEnd = clock(END);

  // Lines worth marking in the outputs. These only highlight; the text is as recorded.
  const MARKS = [/^✖ .+$/m, /^[ \t]*assert\.\w+\(.*\)$/m, /^ℹ (pass|fail) \d+$/gm, /has been updated successfully\./];
  const skipped = (n) => pl(C.cards.skipped, n);

  // ---------- cards ----------
  const head = U.cardHead;
  const requestBody = (t) => U.requestBody(t, C.cards);
  const requestMeta = (t) => U.requestMeta(t, C.cards);
  const requestCard = (t) => U.requestCard(t, C.cards);

  function youCard() {
    return `<div class="card you">${head(esc(C.cards.you), esc(C.cards.youMeta))}<p class="say">${esc(T.prompt)}</p></div>`;
  }
  function setupCard() {
    return `<div class="card sys">${head(esc(C.cards.setup), esc(C.cards.setupMeta(d)))}<p class="note">${esc(C.cards.setupBody)}</p></div>`;
  }
  // How much of each result to show: a Read shows its first lines and the lines that matter here.
  function resultBody(t) {
    const text = t.result.text.replace(/\s+$/, "");
    if (t.tool === "Read") {
      const lines = readLines(text);
      const keep = new Set(range(0, 3));
      const markIdx = new Set();
      if (t === mainRead) {
        range(fnIdx, Math.min(lines.length, fnIdx + 5)).forEach((i) => keep.add(i));
        markIdx.add(bugIdx);
      } else if (failIdx >= 0) {
        range(failIdx, Math.min(lines.length, failIdx + 7)).forEach((i) => keep.add(i));
        markIdx.add(failIdx);
      }
      return { html: U.excerpt(lines, keep, markIdx, skipped), meta: C.cards.excerpt(fmt(keep.size), fmt(lines.length)) };
    }
    return { html: U.mark(esc(text), MARKS), meta: pl(C.cards.linesBack, lineCount(text)) };
  }
  const resultCard = (t) => U.resultCard(t, resultBody(t), C.cards);
  const textCard = (o, final) => U.textCard(o.text, final ? C.cards.finalAnswer : C.cards.modelWrites, C.cards);

  // ---------- steps ----------
  // Each call gives a model step (its requests) and, if it made requests, a harness step (their results).
  // Every card carries the time it arrived, so "Watch it live" can show it at that moment.
  const LOOP = {
    you: ["n-harness", "e-to-model", "l-to-model"],
    req: ["n-model", "e-to-model", "e-to-harness", "l-to-harness"],
    res: ["n-harness", "n-pc", "e-to-pc", "e-from-pc", "l-pc"],
    final: ["n-model", "e-to-model"],
  };
  const steps = [{ key: "you", who: "you", t: 0, n: 0, loop: LOOP.you, code: [1], rounds: 0,
    events: [{ t: 0, side: "req", html: () => youCard() + setupCard() }], lt: 0 }];
  let prevEnd = 0; // when the previous call's last result arrived: the model works from then on

  calls.forEach((c, i) => {
    const n = i + 1;
    const isLast = i === calls.length - 1;
    const ts = toolsOf(c);
    const events = [];
    textsOf(c).forEach((o) => events.push({ t: o.t_ms, side: "req", text: true, html: () => textCard(o, isLast) }));
    ts.forEach((o) => {
      events.push({ t: o.t_ms, side: "req", html: () => requestCard(o) });
      events.push({ t: o.result.t_ms, side: "res", html: () => resultCard(o) });
    });
    events.sort((a, b) => a.t - b.t);
    // Stepping: the model step is dated by the call's first output, the harness step by its first result.
    // Live: the model step starts when the previous results were all back, the harness step when the
    // first request arrived, so the diagram shows who is working at each moment of the recording.
    const firstRes = ts.length ? Math.min(...ts.map((o) => o.result.t_ms)) : Infinity;
    const firstReq = ts.length ? Math.min(...ts.map((o) => o.t_ms)) : Infinity;
    const key = isLast ? "final" : `c${n}req`;
    steps.push({ key, who: "model", side: "req", n, i, t: c.t_ms, lt: prevEnd, events, tools: ts,
      loop: isLast ? LOOP.final : i === 0 ? LOOP.req.filter((x) => x !== "e-to-model") : LOOP.req,
      code: isLast ? [3, 5, 6, 10] : [3, 4], rounds: i, reading: true });
    if (!isLast) {
      steps.push({ key: i === 0 ? "round1" : `c${n}res`, who: "harness", side: "res", n, i, t: firstRes, lt: firstReq, events, tools: ts,
        loop: LOOP.res, code: [7, 8, 9], rounds: i + 1, hands: i === 0, tool: ts[0] });
    }
    if (ts.length) prevEnd = Math.max(...ts.map((o) => o.result.t_ms));
  });
  const ROUND1 = steps.findIndex((s) => s.hands);

  // ---------- context bar ----------
  const stack = $("stack");
  const rounds = added.slice(1);
  const pct = (x) => `${(x / last) * 100}%`;
  stack.innerHTML =
    `<div class="blk sys" style="width:${pct(first)}"><span>${esc(C.ui.setupBlock(d))}</span></div>` +
    rounds.map((x, i) => `<div class="blk round" data-r="${i + 1}" style="width:0" title="${esc(C.ui.roundTitle(fmt(i + 1), fmt(x)))}"></div>`).join("");
  $("context-label").textContent = C.ui.contextLabel;
  $("legend").innerHTML =
    `<span><i class="sw sys"></i>${esc(C.ui.legendSys)}</span>` +
    `<span><i class="sw round"></i>${esc(C.ui.legendRound(rounds.map((x) => "+" + fmt(x)).join(", ")))}</span>`;

  // ---------- icons (decorative; every button has a text label or aria-label) ----------
  const ICON = {
    play: '<svg class="solid" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z"/></svg>',
    pause: '<svg class="solid" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="2.5" width="3" height="11" rx=".8"/><rect x="9.5" y="2.5" width="3" height="11" rx=".8"/></svg>',
  };

  // ---------- player state ----------
  let cur = 0;
  let booted = false;       // the first render doesn't announce itself
  let round1Done = false;
  let hs = null;            // the HarnessStep widget, while mounted
  let playTimer = null;     // reading-pace play
  let live = null;          // { t0, raf } while "Watch it live" runs
  let liveT = 0;            // where live mode is, or was when paused
  let liveShown = -1;       // the step live mode last drew
  let liveWaiting = null;   // whether live mode shows the neutral harness narration
  const scrub = $("scrub");
  scrub.max = String(steps.length - 1);
  scrub.setAttribute("aria-label", C.ui.scrub);
  $("prev").setAttribute("aria-label", C.ui.prev);
  $("next").setAttribute("aria-label", C.ui.next);
  $("clock").setAttribute("aria-label", C.ui.clockLabel);

  function unmountWidget() {
    if (hs) { hs.destroy(); hs = null; }
  }

  function mountWidget(s) {
    const t = s.tool;
    const b = resultBody(t);
    const el = document.createElement("div");
    $("cards").appendChild(el);
    hs = window.HarnessStep.mount(el, {
      request: { tool: t.tool, summary: `${t.tool} ${Object.values(t.input).join(" ")}`, bodyHtml: requestBody(t), meta: requestMeta(t) },
      result: { bodyHtml: b.html, meta: b.meta },
      labels: C.harness,
      onDone: () => {
        round1Done = true;
        $("step-text").innerHTML = C.steps[s.key].textDone(d);
        $("step-actions").innerHTML = "";
        $("context-count").innerHTML = countText(s);
        paintStack(s);
        // Let the reader see the result land, then the session carries on by itself.
        setTimeout(() => { if (cur === ROUND1 && !live) { render(ROUND1 + 1, { focus: true }); play(); } }, 1400);
      },
    });
  }

  function countText(s) {
    if (s.key === "you") return C.count.you(d);
    if (s.side === "req") return C.count.req(d, fmt(s.n), s.i);
    if (s.hands && !round1Done) return C.count.pending(d, s.i);
    return C.count.res(d, s.i);
  }

  function shownRounds(s) {
    return s.hands && !round1Done ? 0 : s.rounds;
  }

  function paintStack(s, r = shownRounds(s)) {
    stack.querySelectorAll(".blk.round").forEach((el) => {
      const k = +el.dataset.r;
      const show = k <= r;
      const was = el.style.width !== "0px" && el.style.width !== "0";
      el.style.width = show ? pct(rounds[k - 1]) : "0";
      el.classList.toggle("fresh", show && !was);
    });
    stack.classList.toggle("reading", !!s.reading);
  }

  // Cards for a step. Stepping shows a call's requests on the model step and its results on the
  // harness step. Live mode shows all of a call's cards on its harness step (the model step only
  // has the model's text, if any), and each card appears when it arrived in the recording.
  function stepEvents(s, isLive) {
    if (isLive) return s.side === "req" ? s.events.filter((e) => e.text) : s.events;
    return s.events.filter((e) => e.side === (s.key === "you" ? "req" : s.side));
  }

  function render(i, opts = {}) {
    cur = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[cur];
    const copy = C.steps[s.key];
    const isLive = !!opts.live;
    unmountWidget();

    $("step-num").textContent = C.ui.stepOf(fmt(cur + 1), fmt(steps.length));
    const who = $("step-who");
    who.dataset.who = s.who;
    who.textContent = C.ui.who[s.who];
    $("step-title").textContent = copy.title(d, fmt(s.n));
    const handsOn = s.hands && !round1Done && !isLive;
    $("step-text").innerHTML = s.hands && !handsOn ? copy.textDone(d) : copy.text(d);

    const actions = $("step-actions");
    actions.innerHTML = "";
    const cards = $("cards");
    if (handsOn) {
      cards.innerHTML = "";
      actions.innerHTML = `<button type="button" class="ghost" id="skip-round">${esc(C.ui.skipRound)}</button>`;
      $("skip-round").addEventListener("click", () => { stopAll(); skipRound(); });
      mountWidget(s);
    } else {
      cards.innerHTML = stepEvents(s, isLive).map((e) => `<div class="card-slot" data-t="${e.t}">${e.html()}</div>`).join("");
      if (s.hands && !isLive) {
        actions.innerHTML = `<button type="button" class="ghost" id="again">${esc(C.ui.again)}</button>`;
        $("again").addEventListener("click", () => { stopAll(); round1Done = false; render(ROUND1); });
      }
    }

    $("context-count").innerHTML = countText(s);
    document.querySelectorAll("#loop .on").forEach((el) => el.classList.remove("on"));
    s.loop.forEach((id) => $(id).classList.add("on"));
    document.querySelectorAll("#loopcode span[data-l]").forEach((el) => el.classList.toggle("on", s.code.includes(+el.dataset.l)));
    paintStack(s);

    if (!opts.fromScrub) scrub.value = String(cur);
    scrub.style.setProperty("--p", String(cur / (steps.length - 1)));
    const where = `${C.ui.stepOf(fmt(cur + 1), fmt(steps.length))}: ${$("step-title").textContent}`;
    scrub.setAttribute("aria-valuetext", where);
    // Buttons and reading-pace play keep focus where it is, so say where the player went. The
    // slider announces its own value, a focused title reads itself, and live mode has its status line.
    if (booted && !isLive && !opts.fromScrub && !opts.focus) $("step-status").textContent = where;
    booted = true;
    $("prev").disabled = cur === 0;
    $("next").disabled = cur === steps.length - 1;
    if (!isLive) setClock(s.t);
    if (opts.focus) $("step-title").focus({ preventScroll: true });
  }

  function skipRound() {
    round1Done = true;
    render(ROUND1 + 1, { focus: true });
  }

  function setClock(t) {
    $("clock").textContent = C.ui.clock(clock(t), clock(END));
  }

  // ---------- reading-pace play ----------
  function dwell(s) {
    const words = (C.steps[s.key].text(d).replace(/<[^>]+>/g, " ").match(/\S+/g) || []).length;
    return Math.min(12000, Math.max(5000, 2500 + words * 160));
  }
  function setPlayLabel() {
    const on = !!playTimer;
    $("play").innerHTML = (on ? ICON.pause : ICON.play) + `<span>${esc(on ? C.ui.pause : C.ui.play)}</span>`;
    $("play").setAttribute("aria-pressed", String(on));
  }
  function stopPlay() {
    clearTimeout(playTimer);
    playTimer = null;
    setPlayLabel();
  }
  function play() {
    stopLive();
    if (cur === steps.length - 1) render(0);
    const tick = () => {
      if (cur >= steps.length - 1) return stopPlay();
      // Round 1 waits for the reader.
      if (cur === ROUND1 && !round1Done) return stopPlay();
      render(cur + 1);
      if (cur === ROUND1 && !round1Done) return stopPlay();
      playTimer = setTimeout(tick, dwell(steps[cur]));
      setPlayLabel();
    };
    if (cur === ROUND1 && !round1Done) return stopPlay();
    playTimer = setTimeout(tick, dwell(steps[cur]));
    setPlayLabel();
  }

  // ---------- watch it live ----------
  const stepAt = (t) => steps.reduce((acc, s, j) => (s.lt <= t ? j : acc), 0);

  function liveStatus(t) {
    const s = steps[cur];
    if (t >= END) return C.status.finished;
    if (s.key === "you") return C.status.waitFirst;
    const running = (s.tools || []).some((o) => o.t_ms <= t && t < o.result.t_ms);
    return running ? C.status.harness : C.status.model;
  }

  function liveFrame(t) {
    if (t >= steps[ROUND1].lt) round1Done = true;
    const i = stepAt(t);
    if (i !== cur || liveShown !== i) { render(i, { live: true }); liveShown = i; liveWaiting = null; }
    // A harness step's narration describes its result, so it waits until the first result has arrived.
    const s = steps[cur];
    const waiting = s.side === "res" && !s.tools.some((o) => o.result.t_ms <= t);
    if (waiting !== liveWaiting) {
      const copy = waiting ? C.steps.waiting : C.steps[s.key];
      $("step-title").textContent = copy.title(d, fmt(s.n));
      $("step-text").innerHTML = waiting ? copy.text(d) : s.hands ? copy.textDone(d) : copy.text(d);
      // The context bar and count also wait: the result isn't in the conversation yet.
      $("context-count").innerHTML = waiting ? C.count.pending(d, s.i) : countText(s);
      paintStack(s, waiting ? s.rounds - 1 : s.rounds);
      liveWaiting = waiting;
    }
    const slots = document.querySelectorAll("#cards .card-slot");
    slots.forEach((el) => { el.hidden = +el.dataset.t > t; });
    const wait = $("cards").querySelector(".card-wait");
    const none = ![...slots].some((el) => !el.hidden);
    if (none && !wait) $("cards").insertAdjacentHTML("afterbegin", `<p class="card-wait">${esc(liveStatus(t))}</p>`);
    else if (!none && wait) wait.remove();
    else if (wait && wait.textContent !== liveStatus(t)) wait.textContent = liveStatus(t);
    setClock(t);
    if ($("live-status").textContent !== liveStatus(t)) $("live-status").textContent = liveStatus(t);
  }

  function setLiveLabel() {
    $("live").innerHTML = `<span class="dot" aria-hidden="true"></span><span>${esc(live ? C.ui.livePause : C.ui.live)}</span>`;
    $("live").setAttribute("aria-pressed", String(!!live));
    $("player").classList.toggle("is-live", !!live);
  }

  function startLive() {
    stopPlay();
    unmountWidget();
    let from = 0;
    if (cur > 0 && cur < steps.length - 1) from = stepAt(liveT) === cur && liveT > 0 ? liveT : steps[cur].lt;
    live = { t0: performance.now() - from, raf: 0 };
    liveShown = -1;
    const loop = () => {
      if (!live) return;
      const t = performance.now() - live.t0;
      liveT = Math.min(t, END);
      liveFrame(liveT);
      if (t >= END) { stopLive(); return; }
      live.raf = requestAnimationFrame(loop);
    };
    setLiveLabel();
    loop();
  }

  function stopLive() {
    if (!live) return;
    cancelAnimationFrame(live.raf);
    live = null;
    setLiveLabel();
    // Back to the stepping view of the same step, with all its cards.
    render(cur);
    setClock(liveT);
  }

  function stopAll() { stopPlay(); stopLive(); }

  // ---------- controls ----------
  $("prev").addEventListener("click", () => { stopAll(); render(cur - 1); });
  $("next").addEventListener("click", () => {
    stopAll();
    if (cur === ROUND1 && !round1Done) return skipRound();
    render(cur + 1);
  });
  $("play").addEventListener("click", () => {
    if (playTimer) return stopPlay();
    stopLive();
    if (cur === ROUND1 && !round1Done) return;
    play();
  });
  $("live").addEventListener("click", () => (live ? stopLive() : startLive()));
  scrub.addEventListener("input", () => { stopAll(); render(+scrub.value, { fromScrub: true }); });

  let playerInView = false;
  new IntersectionObserver((es) => { playerInView = es[0].isIntersecting; }, { threshold: 0.2 }).observe($("player"));
  document.addEventListener("keydown", (e) => {
    if (!playerInView || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t === scrub || (t.closest && t.closest(".hs, input, textarea, select"))) return;
    if (e.key === "ArrowRight") { e.preventDefault(); $("next").click(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); $("prev").click(); }
  });

  // ---------- the games ----------
  // Each game is its own page in an iframe (their globals would clash in one document). Nothing loads
  // until the reader presses play, on any device.
  document.querySelectorAll(".game").forEach((fig) => {
    const box = fig.querySelector(".game-frame");
    const src = `../game/run${T.run.index}/${fig.dataset.game}/index.html`;
    // The still is the first frame the game draws (both games draw the same one), light or dark.
    function poster() {
      box.innerHTML =
        `<button type="button" class="game-poster">` +
          `<picture><source srcset="../img/game-start-dark.webp" media="(prefers-color-scheme: dark)">` +
          `<img class="game-still" src="../img/game-start-light.webp" width="720" height="480" alt="" loading="lazy" decoding="async"></picture>` +
          `<span class="game-play">${ICON.play}<span>${esc(C.game.play)}</span></span>` +
        `</button>`;
      box.querySelector(".game-poster").addEventListener("click", start);
      fig.classList.remove("is-playing");
    }
    function start() {
      box.innerHTML =
        `<iframe src="${src}" title="${esc(fig.dataset.title)}" scrolling="no"></iframe>` +
        `<div class="game-bar"><button type="button" class="ghost game-restart">${esc(C.game.restart)}</button>` +
        `<button type="button" class="ghost game-stop">${esc(C.game.stop)}</button></div>`;
      fig.classList.add("is-playing");
      box.querySelector(".game-restart").addEventListener("click", () => { box.querySelector("iframe").src = src; });
      box.querySelector(".game-stop").addEventListener("click", () => { poster(); box.querySelector(".game-poster").focus(); });
      box.querySelector("iframe").focus();
    }
    poster();
  });

  // ---------- static values ----------
  document.querySelectorAll("[data-v]").forEach((el) => {
    const v = d[el.dataset.v];
    if (v === undefined) return;
    if (el.dataset.v === "prompt") el.textContent = v;
    else el.innerHTML = v;
  });
  $("runs").innerHTML = runInfo.map((r) => `<li>${esc(C.prose.runLine(r))}${r.index === T.run.index ? esc(C.prose.runShown) : ""}</li>`).join("");
  $("trace-links").innerHTML = list(runInfo.map((r) => `<a href="../data/trace-02-run${r.index}.js">${esc(C.prose.traceLink(r.k))}</a>`));

  setPlayLabel();
  setLiveLabel();
  render(0);
})();
