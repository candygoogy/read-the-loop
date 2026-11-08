// Chapter 5 page. Every number and every word the agent wrote or saw comes from the recordings:
// window.TOOLS (site/data/tools-05.js: what Claude Code sent in each request of the captured run, sizes
// and tool excerpts only), TRACES.capture (site/data/trace-05.js, the same run's calls), TRACES.ch1
// (site/data/trace-02-run2.js, chapter 1's session) and TRACES.black (site/data/trace-03.js, the Black
// session). The narration and all labels come from window.COPY (copy.en.js); escaping and formatting
// from window.TraceUI, motion from window.Motion.
(() => {
  "use strict";

  const TO = window.TOOLS;
  const R = window.TRACES;
  const CAP = R.capture;
  const B = R.black;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, toolsOf, lineCount } = U;
  const { fmt, pl, list } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const pct = (x) => new Intl.NumberFormat(C.locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x);
  const dateOf = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const timeOf = (iso) => new Date(iso).toISOString().slice(11, 19);
  const code = (s) => `<code>${esc(s)}</code>`;
  const plain = (html) => html.replace(/<[^>]+>/g, "");

  // ---------- how the two sessions were started (our recording notes; the streams don't record it) ----------
  // The captured run (RECORDING-05.md): chapter 1's task, through the logging proxy on this machine.
  const FLAGS_CAPTURE = `ANTHROPIC_BASE_URL=http://127.0.0.1:8765 claude -p <prompt> --model ${CAP.model} --output-format stream-json --verbose --restricted ` +
    `--tools Bash,Read,Edit,Glob,Grep --allowedTools "Bash(node *)" Read Edit Glob Grep ` +
    `--strict-mcp-config --setting-sources "" --permission-mode acceptEdits --no-session-persistence --max-budget-usd 1`;
  // The Black session (RECORDING-03.md). ALLOW_BLACK is its --allowedTools list, as typed.
  const ALLOW_BLACK = ["Bash(python *)", "Bash(git diff *)", "Bash(git status *)", "Bash(git log *)", "Read", "Edit", "Write", "Glob", "Grep"];
  const FLAGS_BLACK = `claude -p <prompt> --model ${B.model} --output-format stream-json --verbose --restricted ` +
    `--tools Bash,Read,Edit,Write,Glob,Grep --allowedTools ${ALLOW_BLACK.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")} ` +
    `--strict-mcp-config --setting-sources "" --permission-mode acceptEdits --autocompact 100k --max-budget-usd 5`;

  // ---------- the captured request ----------
  const tools = TO.tools;
  const c1 = TO.call1;
  const total = c1.parts_total_chars;
  const big = tools.reduce((a, t) => (t.tool_json_chars > a.tool_json_chars ? t : a), tools[0]);
  const placeholder = tools.find((t) => TO.tools_not_in_init.includes(t.name));
  const used = {};
  CAP.calls.forEach((c) => toolsOf(c).forEach((t) => { used[t.tool] = (used[t.tool] || 0) + 1; }));
  // Which block of the first user message is the prompt: the one exactly the size of the prompt as a text block.
  const promptJson = JSON.stringify({ type: "text", text: CAP.prompt }).length;
  const userMsg = c1.message_shapes.find((m) => m.role === "user");
  const sysMsg = c1.message_shapes.find((m) => m.role === "system");
  const promptIdx = userMsg ? userMsg.blocks.findIndex((b) => b.chars === promptJson) : -1;

  // ---------- the Black session's Bash requests ----------
  const bash = B.calls.flatMap((c, i) => toolsOf(c).filter((t) => t.tool === "Bash").map((t) => ({ t, i, cmd: t.input.command, denied: !!t.result.denied })));
  const denied = bash.filter((x) => x.denied);

  // The quiz: our pick of ten, each found by what its command says (in the session's order).
  const PICKS = [
    /mkdir -p \/tmp\//,
    /^python -m black --version;/,
    /^grep -n "def _safe_add_trailing_comma/,
    /^cat > \.repro\/dbg\.py <</,
    /^sed -i /,
    /^grep -n "\^    LN,/,
    /\| sed -n '\/\+\+\+ second pass/,
    /git stash -q/,
    /&& ls CHANGES\.md && head /,
    /^rm -r \.repro/,
  ];
  const picks = [...new Set(PICKS.map((re) => bash.find((x) => re.test(x.cmd))).filter(Boolean))].sort((a, b) => bash.indexOf(a) - bash.indexOf(b));

  // The parts a refusal message names ("… require approval: a, b, c"), as they appear in the command.
  function namedParts(x) {
    const m = x.t.result.text.match(/approval:\s*([\s\S]+)$/);
    if (!m) return [];
    const pieces = m[1].split(", ");
    const out = [];
    let cur = pieces[0];
    for (let k = 1; k < pieces.length; k++) {
      const joined = `${cur}, ${pieces[k]}`;
      if (x.cmd.includes(cur) && !x.cmd.includes(joined)) { out.push(cur); cur = pieces[k]; } else cur = joined;
    }
    out.push(cur);
    return out.filter((p) => x.cmd.includes(p));
  }
  // The command as escaped HTML, with the named parts marked.
  function markedCommand(x) {
    let html = esc(x.cmd);
    if (x.denied) namedParts(x).forEach((p) => { const e = esc(p); html = html.replace(e, () => `<mark>${e}</mark>`); });
    return html;
  }
  // A long command, shortened for the quiz: its first lines and its last, with a note of how many are left out.
  function shortCommand(cmd) {
    const lines = cmd.split("\n");
    if (lines.length <= 8) return esc(cmd);
    const head = lines.slice(0, 5).map(esc);
    const tail = lines.slice(-2).map(esc);
    return [...head, `<span class="more">${esc(pl(C.check.more, lines.length - 7))}</span>`, ...tail].join("\n");
  }

  // Commands outside the allowlist that ran, by what they do (our reading; see the page).
  const RAN_KINDS = {
    rm: /(^|&& |; )rm /m,
    heredoc: /^cat > \S+ <<'EOF'/m,
    grepHead: /(^|; )grep [^;\n]*\| head/m,
    lsHead: /\bls \S+ && head /,
    echo: /(^|; )echo /m,
  };
  const SHOW = { rm: "rm -r …", heredoc: "cat > … <<'EOF'", grepHead: "grep … | head", lsHead: "ls … && head …", echo: "echo …" };
  const ranKinds = Object.entries(RAN_KINDS).map(([k, re]) => ({ k, calls: [...new Set(bash.filter((x) => !x.denied && re.test(x.cmd)).map((x) => x.i + 1))] })).filter((x) => x.calls.length);
  const grepRan = bash.find((x) => !x.denied && RAN_KINDS.grepHead.test(x.cmd));
  const grepRefused = denied.find((x) => RAN_KINDS.grepHead.test(x.cmd) && (() => { const p = namedParts(x); return p.length === 1 && /^grep /.test(p[0]); })());

  // After each refusal: what the model asked for on the next call.
  const nextOf = (x) => (B.calls[x.i + 1] ? toolsOf(B.calls[x.i + 1]) : []);
  const allOther = denied.every((x) => nextOf(x).length > 0);
  const noneRefused = denied.every((x) => nextOf(x).every((t) => !t.result.denied));

  const aliasOf = (T) => (JSON.stringify(T.calls).match(/~\/[\w.-]+/) || [""])[0];

  const d = {
    ch1Setup: fmt(R.ch1.calls[0].context_tokens),
    date: dateOf(CAP.recorded), requests: fmt(TO.requests),
    nTools: fmt(tools.length), toolsChars: fmt(TO.tools_json_chars), toolsPct: pct(c1.parts_chars.tools / total),
    big: code(big.name), bigChars: fmt(big.tool_json_chars), bigDesc: fmt(big.description_chars),
    placeholder: placeholder ? esc(placeholder.name) : "", initTools: list(TO.init_tools.map(code)),
    m0: fmt(TO.across_requests.messages_count[0]), mLast: fmt(TO.across_requests.messages_count[TO.across_requests.messages_count.length - 1]),
    c2cached: fmt(CAP.calls[1].cached_tokens), c2ctx: fmt(CAP.calls[1].context_tokens),
    notes: fmt(userMsg ? userMsg.blocks.length - (promptIdx >= 0 ? 1 : 0) : 0),
    effort: esc(TO.settings.output_config.effort), thinking: esc(TO.settings.thinking.type), maxTokens: fmt(TO.settings.max_tokens),
    cm: esc(TO.settings.context_management.edits[0].type), cmKeep: esc(TO.settings.context_management.edits[0].keep),
    wholeTools: list(ALLOW_BLACK.filter((a) => !a.startsWith("Bash(")).map((a) => a)),
    nGit: fmt(ALLOW_BLACK.filter((a) => a.startsWith("Bash(git ")).length),
    bash: fmt(bash.length), denied: fmt(denied.length),
    picks: fmt(picks.length), pDenied: fmt(picks.filter((x) => x.denied).length), pRan: fmt(picks.filter((x) => !x.denied).length),
    allOther, noneRefused,
    a: grepRan ? fmt(grepRan.i + 1) : "", b: grepRefused ? fmt(grepRefused.i + 1) : "",
    source05: esc(CAP.source), date05: dateOf(CAP.recorded), time05: timeOf(CAP.started_at), model05: esc(CAP.model), ccv05: esc(CAP.claude_code_version), calls05: fmt(CAP.calls.length),
    c1: fmt(c1.context_tokens),
    date03: dateOf(B.recorded), model03: esc(B.model), ccv03: esc(B.claude_code_version), calls03: fmt(B.calls.length),
    aliases: list([aliasOf(CAP), aliasOf(B)].filter(Boolean).map(code)),
  };

  // ---------- static text ----------
  document.querySelectorAll("[data-c]").forEach((el) => {
    const fn = el.dataset.c.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
    if (typeof fn === "function") el.innerHTML = fn(d);
    else if (typeof fn === "string") el.innerHTML = fn;
  });
  document.querySelectorAll("[data-v]").forEach((el) => { if (d[el.dataset.v] !== undefined) el.innerHTML = d[el.dataset.v]; });
  if (!placeholder) $("tools").parentElement.querySelector('[data-c="manual.p4"]').hidden = true;
  if (!grepRan || !grepRefused) document.querySelector('[data-c="puzzle.p2"]').hidden = true;
  // Break the flags only at spaces, never after the hyphens of a flag.
  const flags = (s) => s.split(" ").map((a) => `<span>${esc(a)}</span>`).join(" ");
  $("flags-05").innerHTML = flags(FLAGS_CAPTURE);
  $("flags-03").innerHTML = flags(FLAGS_BLACK);
  $("trace-links").innerHTML = list([
    ["../data/tools-05.js", C.colophon.links.tools],
    ["../data/trace-05.js", C.colophon.links.ch5],
    ["../data/trace-03.js", C.colophon.links.black],
    ["../data/trace-02-run2.js", C.colophon.links.ch1],
  ].map(([href, t]) => `<a href="${href}">${esc(t)}</a>`));

  // ---------- figure 1: the tool entries ----------
  const legend = (items) => items.map(([k, label]) => `<span><i class="sw ${k}" aria-hidden="true"></i>${esc(label)}</span>`).join("");
  $("tools-legend").innerHTML = legend([["t-desc", C.tools.desc], ["t-rest", C.tools.rest]]) + `<span><code>${esc(C.tools.reqSample)}</code>${esc(C.tools.reqKey)}</span>`;
  const maxChars = big.tool_json_chars;
  $("tool-grid").innerHTML = tools.map((t) => {
    const rest = t.tool_json_chars - t.description_chars;
    const w = (n) => `${(n / maxChars) * 100}%`;
    const inputs = t.properties.length
      ? `<ul class="tool-inputs" aria-label="${esc(C.tools.inputs)}">${t.properties.map((p) => t.required.includes(p)
        ? `<li class="req-in"><code>${esc(p)}</code><span class="sr-only"> (${esc(C.tools.required)})</span></li>`
        : `<li><code>${esc(p)}</code></li>`).join("")}</ul>`
      : `<p class="tool-none">${esc(C.tools.noInputs)}</p>`;
    const off = TO.tools_not_in_init.includes(t.name);
    return `<article class="tool${off ? " is-off" : ""}" data-k="${esc(t.name)}">` +
      `<header class="tool-head"><h3>${esc(t.name)}</h3><span class="tool-size">${esc(C.tools.size({ chars: fmt(t.tool_json_chars) }))}</span></header>` +
      `<div class="tool-bar" role="img" aria-label="${esc(C.tools.sizeLabel({ chars: fmt(t.tool_json_chars), desc: fmt(t.description_chars), rest: fmt(rest) }))}">` +
        `<i class="t-desc" style="width:${w(t.description_chars)}"></i><i class="t-rest" style="width:${w(rest)}"></i></div>` +
      `<blockquote class="tool-excerpt">${esc(t.excerpt)}${t.excerpt_truncated ? "…" : ""}</blockquote>` +
      `<div class="tool-in"><span class="tool-k">${esc(C.tools.inputs)}</span>${inputs}</div>` +
      `<p class="tool-used">${esc(off ? C.tools.notInit : (used[t.name] ? pl(C.tools.used, used[t.name]) : C.tools.used.zero()))}</p>` +
    `</article>`;
  }).join("");

  // ---------- figure 2: the first request, to scale ----------
  const A = C.anatomy;
  const parts = [
    { k: "tools", chars: c1.parts_chars.tools, tokens: c1.estimate.tools_tokens, pieces: tools.map((t) => ({ chars: t.tool_json_chars, cls: "" })) },
    { k: "system", chars: c1.parts_chars.system, tokens: c1.estimate.system_tokens, pieces: TO.system.blocks.map((b) => ({ chars: b.chars, cls: "" })) },
    { k: "messages", chars: c1.parts_chars.messages, tokens: c1.estimate.messages_tokens, pieces: c1.message_shapes.flatMap((m) => m.blocks.map((b, j) => ({ chars: b.chars, cls: m === userMsg && j === promptIdx ? "p-prompt" : "" }))) },
  ];
  // Your sentence's place, pointed at from above the bar (it's a sliver at this scale).
  let above = "";
  if (promptIdx >= 0) {
    const before = parts[0].chars + parts[1].chars + userMsg.blocks.slice(0, promptIdx).reduce((s, b) => s + b.chars, 0);
    const mid = (before + userMsg.blocks[promptIdx].chars / 2) / total;
    above = `<span class="req-prompt" style="right:${(1 - mid) * 100}%">${esc(A.prompt)}</span>`;
  }
  let at = 0;
  $("req").innerHTML =
    `<div class="req-above" aria-hidden="true">${above}</div>` +
    `<div class="req-bar" role="img" aria-label="${esc(A.label({
      total: fmt(total), tools: fmt(parts[0].chars), toolsPct: pct(parts[0].chars / total), system: fmt(parts[1].chars), systemPct: pct(parts[1].chars / total),
      messages: fmt(parts[2].chars), messagesPct: pct(parts[2].chars / total), prompt: promptIdx >= 0 ? fmt(userMsg.blocks[promptIdx].chars) : "",
    }))}">` +
      parts.map((p) => `<span class="req-part p-${p.k}" data-k="${p.k}" style="flex:${p.chars} 1 0">${p.pieces.map((x) => `<i class="${x.cls}" style="flex:${x.chars} 1 0"></i>`).join("")}</span>`).join("") +
    `</div>` +
    `<div class="req-labels" aria-hidden="true">${parts.map((p, i) => {
      const left = at / total;
      at += p.chars;
      const last = i === parts.length - 1;
      return `<span class="req-label${last ? " end" : ""}" data-k="${p.k}" style="${last ? "right:0" : `left:${left * 100}%`}"><b>${esc(A.parts[p.k])}</b>${esc(pct(p.chars / total))}</span>`;
    }).join("")}</div>`;
  $("req-total").innerHTML = A.total({ chars: fmt(total), tokens: fmt(c1.context_tokens) });

  const head = (p) => `<h3><i class="sw p-${p.k}" aria-hidden="true"></i>${esc(A.parts[p.k])}</h3>` +
    `<p class="part-head">${esc(A.head({ chars: fmt(p.chars), pct: pct(p.chars / total) }))}</p>` +
    `<p class="part-est">${esc(A.est({ tokens: fmt(p.tokens) }))}</p>`;
  const toolsList = `<p class="part-k">${esc(A.toolsList)}</p><ol class="part-list">${tools.map((t) => `<li><code>${esc(t.name)}</code><span>${fmt(t.tool_json_chars)}</span></li>`).join("")}</ol>`;
  const systemList = `<ol class="part-list">${TO.system.blocks.map((b, i) => `<li><span class="pl-main">${esc(A.systemBlock({ n: fmt(i + 1), chars: fmt(b.chars) }))}</span><span class="pl-sub">${esc(b.cache_control ? A.cacheMark : A.noCacheMark)}</span></li>`).join("")}</ol><p class="part-k">${esc(A.systemNote)}</p>`;
  const msgList = (userMsg ? `<p class="part-k">${esc(A.userMsg({ blocks: fmt(userMsg.blocks.length) }))}</p><ol class="part-list">${userMsg.blocks.map((b, j) =>
    `<li class="${j === promptIdx ? "is-prompt" : ""}"><span class="pl-main">${esc(j === promptIdx ? A.promptBlock({ chars: fmt(b.chars) }) : A.noteBlock({ chars: fmt(b.chars) }))}</span></li>`).join("")}</ol>` : "") +
    (sysMsg ? `<p class="part-k">${esc(A.sysMsg({ chars: fmt(sysMsg.chars) }))}: ${esc(A.sysBlock)}</p>` : "");
  $("req-parts").innerHTML = parts.map((p) => `<div class="part" data-k="${p.k}">${head(p)}${p.k === "tools" ? toolsList : p.k === "system" ? systemList : msgList}</div>`).join("");
  // Pointing at a part's list lights its place in the bar.
  const reqFig = $("anatomy");
  reqFig.querySelectorAll(".part").forEach((el) => {
    el.addEventListener("pointerenter", () => { reqFig.dataset.hl = el.dataset.k; });
    el.addEventListener("pointerleave", () => { delete reqFig.dataset.hl; });
  });

  // ---------- the allowlist ----------
  const bashRules = ALLOW_BLACK.filter((a) => a.startsWith("Bash("));
  const whole = ALLOW_BLACK.filter((a) => !a.startsWith("Bash("));
  $("allowlist").innerHTML =
    `<p class="allow-title">${esc(C.decide.allowTitle)}</p>` +
    `<div class="allow-group"><span class="allow-k">${esc(C.decide.bash)}</span><ul>${bashRules.map((a) => `<li><code>${esc(a)}</code></li>`).join("")}</ul></div>` +
    `<div class="allow-group"><span class="allow-k">${esc(C.decide.tools)}</span><ul>${whole.map((a) => `<li><code>${esc(a)}</code></li>`).join("")}</ul></div>`;

  // ---------- the quiz: you are the permission check ----------
  const Q = C.check;
  const quiz = $("quiz");
  const n = picks.length;
  const state = { i: 0, answers: new Array(n).fill(null), done: false, skipped: false };
  const actual = (x) => (x.denied ? "ask" : "allow");
  quiz.innerHTML =
    `<div class="q-top">` +
      `<ol class="q-dots" aria-hidden="true">${picks.map(() => "<li></li>").join("")}</ol>` +
      `<button type="button" class="ghost q-skip" id="q-skip">${esc(Q.skip)}</button>` +
    `</div>` +
    `<div class="q-stage" id="q-stage"></div>` +
    `<p class="sr-only" aria-live="polite" id="q-live"></p>`;
  const stage = $("q-stage");
  const dots = [...quiz.querySelectorAll(".q-dots li")];

  function paintDots(pop) {
    dots.forEach((li, k) => {
      const a = state.answers[k];
      li.className = [k === state.i && !state.done ? "cur" : "", a ? (a === actual(picks[k]) ? "hit" : "miss") : "", state.done && !a ? "seen" : ""].join(" ").trim();
    });
    if (pop !== undefined) Mo.pop(dots[pop], { duration: Mo.dur.base });
  }

  // The model's own one-line note on its request (Bash's `description` input), when it gave one.
  const noteOf = (x) => (x.t.input.description ? `<p class="card-note"><span>${esc(Q.note)}</span> “${esc(x.t.input.description)}”</p>` : "");

  function verdictHTML(x, a) {
    const r = x.t.result;
    const same = a === actual(x);
    return `<div class="q-verdict" data-actual="${x.denied ? "refused" : "ran"}">` +
      `<p class="q-stamp">${esc(x.denied ? Q.refused : Q.ran)}</p>` +
      `<p class="q-match ${same ? "hit" : "miss"}">${esc(same ? Q.same : Q.differ)}</p>` +
      (x.denied
        ? `<div class="card result err">${U.cardHead(esc(Q.harnessSaid), "")}<pre>${esc(r.text)}</pre></div>`
        : `<p class="q-out">${esc(pl(Q.output, lineCount(r.text)))}</p>`) +
      `<button type="button" class="q-next" id="q-next">${esc(state.i === n - 1 ? Q.finish : Q.next)}<svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 3 5 5-5 5"/></svg></button>` +
    `</div>`;
  }

  function renderItem(focus) {
    const x = picks[state.i];
    const a = state.answers[state.i];
    stage.innerHTML =
      `<article class="q-item" data-state="${a ? "shown" : "ask"}">` +
        `<header class="q-head"><h3 id="q-h" tabindex="-1">${esc(Q.progress(fmt(state.i + 1), fmt(n)))}</h3><span class="q-call">${esc(Q.call(fmt(x.i + 1), fmt(B.calls.length)))}</span></header>` +
        `<div class="card model q-req">${U.cardHead(esc(C.refusals.request), "")}${noteOf(x)}<pre>${a && x.denied ? markedCommand(x) : shortCommand(x.cmd)}</pre></div>` +
        `<div class="q-choose" role="group" aria-labelledby="q-ask">` +
          `<span class="q-ask" id="q-ask">${esc(Q.ask)}</span>` +
          ["allow", "ask"].map((k) => `<button type="button" class="q-btn" data-a="${k}" aria-pressed="${a === k}"${a ? " disabled" : ""}>` +
            `<b>${esc(k === "allow" ? Q.allow : Q.askFirst)}</b><span>${esc(k === "allow" ? Q.allowHint : Q.askHint)}</span></button>`).join("") +
        `</div>` +
        (a ? verdictHTML(x, a) : "") +
      `</article>`;
    paintDots();
    if (focus === "head") $("q-h").focus({ preventScroll: true });
    if (focus === "next") $("q-next").focus({ preventScroll: true });
  }

  function answer(a) {
    if (state.answers[state.i]) return;
    const x = picks[state.i];
    state.answers[state.i] = a;
    renderItem("next");
    paintDots(state.i);
    $("q-live").textContent = `${x.denied ? Q.refused : Q.ran} ${a === actual(x) ? Q.same : Q.differ}`;
    const v = stage.querySelector(".q-verdict");
    Mo.play(v.querySelector(".q-stamp"), [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: Mo.dur.base, fill: "backwards" });
    Mo.enter([...v.children].slice(1), { y: 4, stagger: 40, delay: 60 });
  }

  function renderSummary(focus) {
    const k = picks.filter((x, j) => state.answers[j] === actual(x)).length;
    stage.innerHTML =
      `<div class="q-summary">` +
        `<h3 id="q-h" tabindex="-1">${state.skipped ? esc(Q.skipped) : Q.score({ k: fmt(k), n: fmt(n) })}</h3>` +
        `<ol class="q-list">${picks.map((x, j) => {
          const a = state.answers[j];
          const cls = a ? (a === actual(x) ? "hit" : "miss") : "";
          return `<li class="${cls}">` +
            `<span class="ql-call">${esc(Q.call(fmt(x.i + 1), fmt(B.calls.length)))}</span>` +
            `<code class="ql-cmd">${esc(x.cmd.split("\n")[0])}</code>` +
            `<span class="ql-you"><span class="ql-k">${esc(Q.cols[2])}</span> ${esc(Q.yours[a || "none"])}</span>` +
            `<span class="ql-cc" data-actual="${x.denied ? "refused" : "ran"}"><span class="ql-k">${esc(Q.cols[3])}</span> ${esc(Q.actual[x.denied ? "refused" : "ran"])}</span>` +
          `</li>`;
        }).join("")}</ol>` +
        `<div class="q-end"><button type="button" class="ghost" id="q-again">${esc(Q.again)}</button><a href="#s-refusals">${esc(Q.toRefusals)}</a></div>` +
      `</div>`;
    paintDots();
    if (focus) $("q-h").focus({ preventScroll: true });
    Mo.enter([...stage.querySelectorAll(".q-list li")], { y: 4, stagger: 30 });
  }

  function render(focus) {
    $("q-skip").hidden = state.done;
    if (state.done) renderSummary(focus);
    else renderItem(focus);
  }

  quiz.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    if (btn.dataset.a) return answer(btn.dataset.a);
    if (btn.id === "q-next") {
      if (state.i < n - 1) { state.i++; render("head"); Mo.enter(stage.querySelector(".q-item"), { y: 6 }); }
      else { state.done = true; render("head"); }
      return;
    }
    if (btn.id === "q-skip") { state.done = true; state.skipped = true; render("head"); return; }
    if (btn.id === "q-again") {
      state.i = 0; state.answers.fill(null); state.done = false; state.skipped = false;
      render("head");
      Mo.enter(stage.querySelector(".q-item"), { y: 6 });
    }
  });
  render();

  // ---------- the refusals ----------
  const target = (t) => {
    if (t.tool === "Bash") return t.input.command.split("\n")[0];
    if (t.tool === "Grep") return t.input.pattern;
    return t.input.file_path || t.input.pattern || "";
  };
  $("refusals").innerHTML = denied.map((x) => {
    const next = nextOf(x);
    return `<li class="refusal">` +
      `<p class="ref-call">${esc(C.refusals.call(fmt(x.i + 1)))}</p>` +
      `<div class="card model">${U.cardHead(esc(C.refusals.request), "")}${noteOf(x)}<pre>${markedCommand(x)}</pre></div>` +
      `<div class="card result err">${U.cardHead(esc(C.refusals.message), "")}<pre>${esc(x.t.result.text)}</pre></div>` +
      (next.length ? `<div class="ref-next"><span class="ref-k">${esc(C.refusals.next)}</span><ul>${next.map((t) => `<li><b>${esc(t.tool)}</b> <code>${esc(target(t))}</code></li>`).join("")}</ul></div>` : "") +
    `</li>`;
  }).join("");

  // ---------- commands that ran anyway ----------
  $("ran-anyway").innerHTML = ranKinds.map((x) => {
    const nums = list(x.calls.map((c) => fmt(c)));
    return `<li><code>${esc(SHOW[x.k])}</code><span class="ra-what">${esc(C.puzzle.kinds[x.k])}</span><span class="ra-calls">${esc(x.calls.length > 1 ? C.puzzle.callsMany(nums) : C.puzzle.calls(nums))}</span></li>`;
  }).join("");

  // ---------- motion ----------
  // The tool bars grow in, entry by entry, as the figure arrives; the request's parts fill left to
  // right in reading order; the refusals rise in one by one.
  Mo.reveal($("tools"), (el) => {
    el.querySelectorAll(".tool").forEach((card, i) => {
      const [dsc, rest] = card.querySelectorAll(".tool-bar i");
      Mo.grow(dsc, { delay: 120 + i * 60 });
      Mo.grow(rest, { delay: 120 + i * 60 + 140, duration: Mo.dur.slow });
    });
  });
  Mo.reveal($("anatomy"), (el) => {
    Mo.grow([...el.querySelectorAll(".req-part")], { delay: 120, stagger: 160, duration: Mo.dur.reveal });
    Mo.enter([...el.querySelectorAll(".req-label, .req-prompt")], { y: 3, delay: 300, stagger: 120 });
  });
  Mo.reveal([...document.querySelectorAll(".refusal, .stats")]);

  // Any of these that scrolls at the reader's width can be reached and scrolled by keyboard.
  U.watchScrollBoxes(".card pre");
})();
