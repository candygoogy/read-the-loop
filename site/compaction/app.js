// Chapter 4 page. Every number and every word the agent wrote or saw comes from window.TRACE
// (site/data/trace-03.js, recording 03): the run (TRACE.calls), the manual compaction
// (TRACE.compaction: sizes, cost, the summary's full text, the files Claude Code attached) and our one
// question afterwards (TRACE.after_compaction). Narration and labels come from window.COPY
// (copy.en.js); escaping and formatting from window.TraceUI; motion from window.Motion.
//
// "What survived?" and the answer's table are checked against the recorded text when the page loads:
// each event and each point is found in the trace, the summary and the answer by matching text. The
// verdicts shown are the results of that matching. Our own reading of the recording is written down
// as `expect`; if the matching disagrees with it, or a match is missing, the console says so loudly.
(() => {
  "use strict";
  const T = window.TRACE;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, toolsOf, textsOf } = U;
  const { fmt, list } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const fail = (msg) => console.error(`[chapter 4] ${msg}`);

  // ---------- settings we chose when recording (RECORDING-03.md); they aren't in the trace ----------
  const AUTOCOMPACT = 100000;
  const AUTOCOMPACT_FLAG = "--autocompact 100k";
  // `claude --help`, Claude Code 2.1.319: "--autocompact <auto|tokens>  Auto-compact window size (auto, or 100k–1M tokens)"
  const AUTOCOMPACT_HELP = "Auto-compact window size (auto, or 100k–1M tokens)";
  const AUTOCOMPACT_RANGE = "auto, or 100k–1M tokens";
  const COMMON = `--model ${T.model} --output-format stream-json --verbose --restricted ` +
    `--tools Bash,Read,Edit,Write,Glob,Grep ` +
    `--allowedTools "Bash(python *)" "Bash(git diff *)" "Bash(git status *)" "Bash(git log *)" Read Edit Write Glob Grep ` +
    `--strict-mcp-config --setting-sources "" --permission-mode acceptEdits ${AUTOCOMPACT_FLAG}`;
  const CMD_RUN = `claude -p <prompt> ${COMMON} --max-budget-usd 5`;
  const CMD_COMPACT = `claude -p "/compact" --resume <session id> ${COMMON} --max-budget-usd 1`;
  const CMD_AFTER = (prompt) => `claude -p "${prompt}" --resume <session id> ${COMMON} --max-budget-usd 2`;
  const UNIT = 100; // tokens per square, as in chapter 2 (a drawing choice)

  // Published prices for claude-opus-5-5, US dollars per million tokens: the same source and values as
  // chapter 3 (site/cache/app.js). Anthropic's pricing page, row "Claude Opus 5.5", checked 2026-11-08.
  // Used only to split the question's recorded cost, and only if they reproduce it.
  const PRICES = {
    url: "https://platform.claude.com/docs/en/about-claude/pricing",
    model: "claude-opus-5-5", row: "Claude Opus 5.5", checked: "2026-11-08",
    input: 4, write5m: 5, write1h: 8, cacheRead: 0.2, output: 20,
  };

  // ---------- formatting ----------
  const money = (x, digits) => new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
  const pct = (x) => new Intl.NumberFormat(C.locale, { style: "percent", maximumFractionDigits: 0 }).format(x);
  const dec1 = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateOf = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const slash = (p) => p.replace(/\\/g, "/");
  const plain = (html) => html.replace(/<[^>]+>/g, "");
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Inline markdown on raw text: escape, then **bold** and `code`.
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");

  // ---------- the recording ----------
  const calls = T.calls;
  const N = calls.length;
  const ctx = calls.map((c) => c.context_tokens);
  const CM = T.compaction;
  const AF = T.after_compaction;
  const AC = AF.calls[0];
  const S = CM.summary_text;
  const A = AF.final_answer;
  const K = T.final_answer; // the run's last message: the one Claude Code kept word for word (session file)
  const tools = calls.flatMap((c, i) => toolsOf(c).map((t) => ({ t, i })));
  const findTool = (pred, from = 0) => tools.find((x) => x.i >= from && pred(x.t));
  const isSuite = (t) => t.tool === "Bash" && /pytest/.test(t.input.command) && /\d+ passed/.test(t.result.text);
  const suiteLine = (t) => (t.result.text.match(/(\d+ failed, )?\d+ passed(, \d+ skipped)?/) || [""])[0];
  const failedTest = (t) => (t.result.text.match(/FAILED \S+\[(\w+)\]/) || [])[1] || "";
  const lineWith = (text, re) => (text.split("\n").find((l) => re.test(l)) || "").trim();
  const runEnd = Math.max(...calls.flatMap((c) => c.output.flatMap((o) => [o.t_ms, o.result ? o.result.t_ms : 0])));
  const gapMs = AC.t_ms - CM.t_ms;
  const gapH = Math.floor(gapMs / 3600000), gapM = Math.round((gapMs - gapH * 3600000) / 60000);
  const afterUsedTools = AC.output.some((o) => o.kind === "tool");
  if (afterUsedTools) fail("the question after compaction used tools; the copy says it didn't");
  const aliasPath = (tools.find((x) => x.t.input.file_path) || { t: { input: { file_path: "" } } }).t.input.file_path;
  const alias = (aliasPath.match(/^~\/[^/\\]+/) || [""])[0];

  // ---------- finding text ----------
  // Code blocks in a text (``` fences), as [start, end) ranges. Matches inside them don't count: the
  // page highlights and quotes only prose.
  function fences(text) {
    const out = [];
    const re = /^[ \t]*```.*$/gm;
    let m, open = null;
    while ((m = re.exec(text))) {
      if (open === null) open = m.index;
      else { out.push([open, m.index + m[0].length]); open = null; }
    }
    return out;
  }
  const fenceS = fences(S), fenceA = fences(A), fenceK = fences(K);
  const fencesOf = (text) => (text === S ? fenceS : text === A ? fenceA : text === K ? fenceK : fences(text));
  // The first match of `re` in `text` outside code blocks: its index, or -1.
  function findProse(text, re) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    const fs = fencesOf(text);
    let m;
    while ((m = g.exec(text))) {
      const at = m.index;
      if (!fs.some(([a, b]) => at >= a && at < b)) return at;
      if (m[0] === "") g.lastIndex++;
    }
    return -1;
  }
  const has = (text, re) => findProse(text, re) >= 0;
  // The sentence around index `at`, within its line: [start, end). "e.g." and "i.e." don't end one.
  function sentenceRange(text, at) {
    const ls = text.lastIndexOf("\n", at - 1) + 1;
    let le = text.indexOf("\n", at);
    if (le < 0) le = text.length;
    const line = text.slice(ls, le).replace(/\b(e\.g|i\.e)\./g, (m) => m.replace(/\./g, "\u0001"));
    const cuts = [0];
    line.replace(/[.!?](\)|"|”)?\s+(?=\S)/g, (m, _q, i) => { cuts.push(i + m.length); return m; });
    cuts.push(line.length);
    const rel = at - ls;
    let k = 0;
    while (k < cuts.length - 2 && cuts[k + 1] <= rel) k++;
    let a = ls + cuts[k], b = ls + cuts[k + 1];
    // Leave out the list marker and the whitespace around the sentence.
    const lead = text.slice(a, b).match(/^\s*(-\s+)?/)[0].length;
    a += lead;
    while (b > a && /\s/.test(text[b - 1])) b--;
    return [a, b];
  }
  const sentence = (text, re) => {
    const at = findProse(text, re);
    if (at < 0) return null;
    const [a, b] = sentenceRange(text, at);
    return { a, b, text: text.slice(a, b) };
  };
  const quote = (s) => (s ? inline(s.text) : "");

  // ---------- the events for "What survived?" ----------
  // Each: the call where it happened (found in the trace), what the trace shows, how to find it in the
  // summary (`sum`), what would count as a mention in the answer (`ans`), and our reading (`expect`).
  const denied = tools.filter((x) => x.t.result.denied);
  const firstDenied = denied[0];
  const scratchWrite = findTool((t) => t.tool === "Write" && /[\\/]\.\w+[\\/]/.test(t.input.file_path));
  const scratchDir = scratchWrite ? (scratchWrite.t.input.file_path.match(/[\\/](\.\w+)[\\/]/) || [])[1] : "";
  const scratchRm = scratchDir ? findTool((t) => t.tool === "Bash" && new RegExp(`rm -r ${reEsc(scratchDir)}`).test(t.input.command)) : null;
  // New functions: a `def name(` an Edit added that its old text didn't have.
  const newDefs = tools.filter((x) => x.t.tool === "Edit").flatMap((x) =>
    [...x.t.input.new_string.matchAll(/^def (\w+)\(/gm)].map((m) => m[1]).filter((n) => !x.t.input.old_string.includes(`def ${n}(`)).map((name) => ({ name, x })));
  const helperDef = newDefs.find((d) => /nodes\.py$/.test(slash(d.x.t.input.file_path))) || newDefs[0];
  const suites = tools.filter((x) => isSuite(x.t));
  const failing = suites.filter((x) => /failed/.test(suiteLine(x.t)));
  const firstPass = suites.find((x) => !/failed/.test(suiteLine(x.t)));
  const lastSuite = suites[suites.length - 1];
  const fix2 = failing[1] ? findTool((t) => t.tool === "Edit" && /source already has a comma/i.test(t.input.new_string), failing[1].i) : null;
  const mypyRun = findTool((t) => t.tool === "Bash" && /mypy/.test(t.input.command));
  const formatRun = lastSuite ? findTool((t) => t.tool === "Bash" && /^python -m black src\//.test(t.input.command) && /reformatted \S+/.test(t.result.text), lastSuite.i + 1) : null;
  const formatted = formatRun ? (formatRun.t.result.text.match(/^reformatted (\S+)/m) || [])[1] || "" : "";
  const passLine = firstPass ? suiteLine(firstPass.t) : "";

  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, "") + " …" : s);
  const proofLines = (lines) => lines.filter(Boolean).map((l) => esc(l)).join("\n");

  const EVENTS = [
    firstDenied && {
      key: "refused", i: firstDenied.i,
      d: { call: fmt(firstDenied.i + 1), more: fmt(denied.length - 1) },
      proof: proofLines([cut(firstDenied.t.result.text.split("\n")[0], 150)]),
      sum: /Bash commands were blocked for approval/,
      ans: /approval|refused|denied|permission|were blocked|was blocked/i,
      expect: "summary",
    },
    scratchWrite && scratchRm && {
      key: "scratch", i: scratchWrite.i,
      d: { call: fmt(scratchWrite.i + 1), callEnd: fmt(scratchRm.i + 1), dir: esc(scratchDir) },
      proof: proofLines([`${scratchWrite.t.tool} ${slash(scratchWrite.t.input.file_path)}`, `…`, `${scratchRm.t.tool} ${scratchRm.t.input.command}`]),
      sum: new RegExp(`removed the \`${reEsc(scratchDir)}\``),
      ans: new RegExp(`${reEsc(scratchDir)}|scratch`, "i"),
      expect: "summary",
    },
    helperDef && {
      key: "helper", i: helperDef.x.i,
      d: { call: fmt(helperDef.x.i + 1), name: esc(helperDef.name), subCase: esc((K.match(/`(\w+\[[^\]`]*\])`/) || [])[1] || "") },
      proof: proofLines([lineWith(helperDef.x.t.input.new_string, new RegExp(`^def ${helperDef.name}\\(`))]),
      sum: new RegExp(reEsc(helperDef.name)),
      ans: new RegExp(reEsc(helperDef.name)),
      expect: "answer",
    },
    failing[0] && {
      key: "fail1", i: failing[0].i,
      d: { call: fmt(failing[0].i + 1), test: esc(failedTest(failing[0].t)) },
      proof: proofLines([lineWith(failing[0].t.result.text, /^FAILED /), suiteLine(failing[0].t)]),
      sum: new RegExp(`broke the [^.]*${reEsc(failedTest(failing[0].t))}`),
      ans: /\bbr(oke|oken|eaks?)\b|\bfail(ed|ure|ures|ing|s)?\b|regress/i,
      instead: /keeps (the )?existing output/,
      expect: "summary",
    },
    failing[1] && fix2 && {
      key: "fail2", i: failing[1].i,
      d: { call: fmt(failing[1].i + 1), callFix: fmt(fix2.i + 1), test: esc(failedTest(failing[1].t)) },
      proof: proofLines([lineWith(failing[1].t.result.text, /^FAILED /).replace(/ - \.\.\.$/, ""), suiteLine(failing[1].t)]),
      sum: new RegExp(`\`${reEsc(failedTest(failing[1].t))}\` test was unstable`),
      ans: /unstable|instabilit|second pass|differen\w* on the second/i,
      instead: /source already has a comma/,
      expect: "summary",
    },
    firstPass && {
      key: "pass", i: firstPass.i,
      d: { call: fmt(firstPass.i + 1), line: esc(passLine) },
      proof: proofLines([lineWith(firstPass.t.result.text, /\d+ passed/)]),
      sum: new RegExp(reEsc(passLine)),
      ans: new RegExp(reEsc(passLine)),
      expect: "answer",
    },
    mypyRun && {
      key: "mypy", i: mypyRun.i,
      d: { call: fmt(mypyRun.i + 1) },
      proof: proofLines([lineWith(mypyRun.t.result.text, /mypy/)]),
      sum: /mypy isn't installed/,
      ans: /mypy/,
      expect: "answer",
    },
    formatRun && {
      key: "reformat", i: formatRun.i,
      d: { call: fmt(formatRun.i + 1), callTest: fmt(lastSuite.i + 1), file: esc(slash(formatted)) },
      proof: proofLines([lineWith(formatRun.t.result.text, /^reformatted /), lineWith(formatRun.t.result.text, /files? (left )?unchanged/)]),
      sum: /before black reformatted/i,
      ans: /reformat|ran Black over/i,
      keptToo: true, // also check the run's own last message
      expect: "answer",
    },
  ].filter(Boolean);
  // Counts the narration states in words.
  if (failing.length !== 2) fail(`the narration says the tests failed twice; the trace has ${failing.length} failing runs`);
  if (newDefs.length !== 2) fail(`the narration says two new functions; the trace has ${newDefs.length}`);
  if (EVENTS.length !== 8) fail(`expected 8 events, found ${EVENTS.length} in the trace`);

  EVENTS.forEach((e) => {
    e.sumQ = sentence(S, e.sum);
    const at = findProse(A, e.ans);
    e.ansQ = at >= 0 ? (() => { const [a, b] = sentenceRange(A, at); return { a, b, text: A.slice(a, b) }; })() : null;
    e.insteadQ = e.instead ? sentence(A, e.instead) : null;
    if (e.instead && !e.insteadQ) fail(`event "${e.key}": the answer's sentence about it (${e.instead}) wasn't found`);
    e.inKept = e.keptToo ? has(K, e.ans) : null;
    e.outcome = e.sumQ ? (e.ansQ ? "answer" : "summary") : (e.ansQ ? "answer" : "lost");
    if (!e.sumQ) fail(`event "${e.key}": no match in the summary for ${e.sum}`);
    if (e.expect === "answer" && !e.ansQ) fail(`event "${e.key}": no match in the answer for ${e.ans}`);
    if (e.outcome !== e.expect) fail(`event "${e.key}": the text says "${e.outcome}", our reading says "${e.expect}"`);
  });

  // ---------- the answer's points, and where each appears ----------
  const gitStatus = findTool((t) => t.tool === "Bash" && /git status --short/.test(t.input.command) && /^ ?M /m.test(t.result.text));
  const changed = gitStatus ? [...gitStatus.t.result.text.matchAll(/^ ?M (\S+)/gm)].map((m) => m[1].split("/").pop()) : [];
  const hasAll = (text, words) => words.length > 0 && words.every((w) => text.includes(w));
  const runTexts = calls.flatMap(textsOf).map((o) => o.text);
  const indentSaid = calls.findIndex((c) => textsOf(c).some((o) => /indentation is still off/.test(o.text)) && c !== calls[N - 1]);
  const ROWS = [
    { key: "files", d: { n: fmt(changed.length) }, at: gitStatus && gitStatus.i,
      test: (x) => hasAll(x, changed), expect: [true, true, true] },
    { key: "defs", d: {}, at: newDefs.length ? newDefs[newDefs.length - 1].x.i : null,
      test: (x) => hasAll(x, newDefs.map((d) => d.name)), expect: [true, true, true] },
    { key: "tests", d: { line: esc(passLine) }, at: lastSuite && lastSuite.i,
      test: (x) => passLine !== "" && x.includes(passLine), expect: [true, true, true] },
    { key: "mypy", d: {}, at: mypyRun && mypyRun.i,
      test: (x) => /mypy/.test(x) && /installed/.test(x), expect: [true, true, true] },
    { key: "order", d: {}, at: formatRun && formatRun.i,
      test: (x) => /reformat|ran Black over/i.test(x), expect: [true, true, false] },
    // The run's visible text never gives this reason; the summary does.
    { key: "pr", d: {}, at: null, notShown: true,
      test: (x) => /use that number/.test(x), expect: [true, true, false] },
    { key: "indent", d: {}, at: indentSaid >= 0 ? indentSaid : null,
      test: (x) => /cosmetic/.test(x), expect: [true, true, true] },
  ];
  if (runTexts.some((t) => /use that number/.test(t))) fail("the run's own text gives the PR-number reason; the table says it doesn't");
  ROWS.forEach((r) => {
    r.cells = [A, S, K].map((x) => r.test(x));
    if (!r.cells[0]) fail(`answer point "${r.key}": not found in the answer`);
    r.cells.forEach((v, j) => { if (v !== r.expect[j]) fail(`answer point "${r.key}": column ${j} is ${v}, our reading says ${r.expect[j]}`); });
    if (!r.notShown && (r.at === null || r.at === undefined)) fail(`answer point "${r.key}": its call wasn't found in the run`);
  });

  // ---------- costs ----------
  const M = 1e6;
  const written = AC.cache_write_1h + AC.cache_write_5m;
  const cost = {
    read: AC.cached_tokens * PRICES.cacheRead / M,
    write: (AC.cache_write_1h * PRICES.write1h + AC.cache_write_5m * PRICES.write5m + AC.input_tokens * PRICES.input) / M,
    out: AC.output_tokens * PRICES.output / M,
  };
  cost.total = cost.read + cost.write + cost.out;
  const verified = T.model === PRICES.model && Math.abs(cost.total - AF.totals.cost_usd) < 0.005;

  // ---------- values for the copy ----------
  const pre = CM.pre_tokens, post = CM.post_tokens, nextCtx = AC.context_tokens;
  const c1 = calls[0].cached_tokens;
  const sectionName = (n) => (S.match(new RegExp(`^${n}\\. ([^:\\n]+):`, "m")) || [])[1] || "";
  const sectionOf = (re) => { const m = S.match(new RegExp(`^(\\d+)\\. (${re.source}):`, "m")); return m ? m[2] : ""; };
  const errorsName = sectionOf(/Errors[^:\n]*/);
  const pendingName = sectionOf(/Pending[^:\n]*/);
  const ranOut = (S.match(/ran out of context/) || [""])[0];
  const allowed = sentence(A, /source already has a comma/);
  const d = {
    flag: esc(AUTOCOMPACT_FLAG), autocompact: fmt(AUTOCOMPACT), range: esc(AUTOCOMPACT_RANGE), help: esc(AUTOCOMPACT_HELP),
    last: fmt(ctx[N - 1]), afterRun: fmt(Math.round((CM.t_ms - runEnd) / 1000)),
    gap: C.gap(fmt(gapH), fmt(gapM)), prompt: esc(AF.prompt),
    pre: fmt(pre), post: fmt(post), next: fmt(nextCtx), pct: pct(post / pre),
    unit: fmt(UNIT), cells: fmt(Math.round(pre / UNIT)), cellsAfter: fmt(Math.round(post / UNIT)),
    n: fmt(EVENTS.length),
    sections: fmt((S.match(/^\d+\. [^\n]+:$/gm) || []).length),
    errorsName: esc(errorsName), pendingName: esc(pendingName), ranOut: esc(ranOut),
    chars: fmt(S.length),
    ratio: dec1.format(nextCtx / post), diff: fmt(nextCtx - post),
    cached: fmt(AC.cached_tokens), fresh: fmt(AC.new_tokens), written: fmt(written), c1: fmt(c1),
    fullCount: fmt(CM.reattached.filter((f) => f.kind === "full").length),
    stubCount: fmt(CM.reattached.filter((f) => f.kind !== "full").length),
    fileCount: fmt(CM.reattached.length),
    out: fmt(AC.output_tokens),
    allowed: quote(allowed),
    compact: money(CM.cost_usd, 4), after: money(AF.totals.cost_usd, 4), run: money(T.totals.cost_usd, 4),
    both: money(CM.cost_usd + AF.totals.cost_usd, 4), calls: fmt(N),
    writeCost: money(cost.write, 4), writePct: pct(cost.write / cost.total), outCost: money(cost.out, 4), readCost: money(cost.read, 4),
    denied: fmt(denied.length),
    source: esc(T.source), model: esc(T.model), ccv: esc(T.claude_code_version), alias: esc(alias),
    url: esc(PRICES.url), urlText: esc(PRICES.url.replace(/^https:\/\//, "")), row: esc(PRICES.row), checked: dateOf(PRICES.checked),
    computed: money(cost.total, 4), recorded: money(AF.totals.cost_usd, 4),
  };
  d.same = AC.cached_tokens === c1 ? C.next.sameExact(d) : C.next.sameNear(d);
  if (!errorsName || !pendingName || !ranOut || !allowed) fail("a section name or sentence quoted in the prose wasn't found in the recorded text");
  if (!(ctx[N - 1] < AUTOCOMPACT)) fail("the run reached the autocompact size; the prose says it didn't");
  const fullFiles = CM.reattached.filter((f) => f.kind === "full");
  if (fullFiles.length !== 2 || !fullFiles.every((f) => /\/tests\//.test(slash(f.path)) && changed.includes(slash(f.path).split("/").pop())))
    fail("the prose says both files attached in full are test files the agent changed");
  if (!(CM.post_tokens >= 1000 && CM.post_tokens < 10000)) fail("the prose says a few thousand tokens were left");
  if (CM.trigger !== "manual") fail(`the compaction's trigger is "${CM.trigger}", the prose says manual`);
  if (pre - ctx[N - 1] !== calls[N - 1].output_tokens) fail("pre_tokens isn't the last call's reading plus its reply; the figure's last part is mislabelled");

  // ---------- static text ----------
  function fill() {
    document.querySelectorAll("[data-c]").forEach((el) => {
      const fn = el.dataset.c.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
      if (typeof fn === "function") el.innerHTML = fn(d);
      else if (typeof fn === "string") el.innerHTML = fn;
    });
    document.querySelectorAll("[data-v]").forEach((el) => { if (d[el.dataset.v] !== undefined) el.innerHTML = d[el.dataset.v]; });
    const flags = (id, s) => { $(id).innerHTML = s.split(" ").map((a) => `<span>${esc(a)}</span>`).join(" "); };
    flags("flags", CMD_RUN);
    flags("flags-compact", CMD_COMPACT);
    flags("flags-after", CMD_AFTER(AF.prompt));
    $("trace-links").innerHTML = `<a href="../data/trace-03.js">${esc(C.colophon.traceName)}</a>`;
    $("price-note").innerHTML = verified ? C.colophon.prices(d) : "";
  }

  // ---------- squares ----------
  // Squares per part by cumulative rounding, so a figure's squares always add up to its total.
  function squares(parts) {
    let cum = 0;
    return parts.flatMap((p) => {
      const a = Math.round(cum / UNIT);
      cum += p.tokens;
      return Array(Math.max(0, Math.round(cum / UNIT) - a)).fill(p.cls);
    });
  }
  const sq = (cells) => cells.map((cls) => `<i class="c ${cls}"></i>`).join("");
  const legend = (items) => items.map(([cls, label]) => `<span><i class="sw ${cls}" aria-hidden="true"></i>${esc(label)}</span>`).join("");

  // ---------- figure 1: the conversation, before and after ----------
  // Before: the last call's conversation as chapter 2 draws it (set-up, then each round split into
  // what the model wrote and what came back), plus the last reply. After: post_tokens, one colour.
  const beforeParts = [{ cls: "k-sys", tokens: ctx[0] }];
  for (let i = 0; i < N - 1; i++) {
    const grow = ctx[i + 1] - ctx[i];
    const model = Math.min(calls[i].output_tokens, grow);
    beforeParts.push({ cls: "k-model", tokens: model }, { cls: "k-back", tokens: grow - model });
  }
  beforeParts.push({ cls: "k-model", tokens: pre - ctx[N - 1] });
  const beforeCells = squares(beforeParts);
  const afterCells = squares([{ cls: "k-after", tokens: post }]);

  let mode = "before";
  let shownN = pre;
  function buildSquash() {
    const fs = $("squash-mode");
    fs.insertAdjacentHTML("beforeend", ["before", "after"].map((m) =>
      `<label class="seg-opt"><input type="radio" name="squash" value="${m}"${m === mode ? " checked" : ""}><span>${esc(C.squash[m])}</span></label>`).join(""));
    $("squash-grid").innerHTML =
      `<div class="cells gone-layer" aria-hidden="true">${sq(beforeCells.map(() => "k-gone"))}</div>` +
      `<div class="cells live" aria-hidden="true">${sq(beforeCells)}</div>` +
      `<div class="cells after" aria-hidden="true">${sq(afterCells)}</div>`;
    $("squash-legend").innerHTML = legend([["k-sys", C.squash.legendSys], ["k-model", C.squash.legendModel], ["k-back", C.squash.legendBack], ["k-after", C.squash.legendAfter], ["k-gone", C.squash.legendGone]]);
    fs.addEventListener("change", (e) => setSquash(e.target.value, true));
    setSquash(mode, false);
  }
  function setSquash(m, animate) {
    const grid = $("squash-grid");
    const from = mode;
    mode = m;
    grid.dataset.state = m;
    $("squash").dataset.state = m;
    grid.setAttribute("aria-label", m === "before" ? C.squash.labelBefore(d) : C.squash.labelAfter(d));
    const to = m === "before" ? pre : post;
    if (animate) Mo.count($("squash-n"), to, { from: shownN, format: fmt, duration: 700 });
    else $("squash-n").textContent = fmt(to);
    shownN = to;
    $("squash-l").textContent = m === "before" ? C.squash.beforeL : C.squash.afterL;
    if (!animate || from === m || Mo.reduced()) return;
    const live = [...grid.querySelectorAll(".live .c")];
    const after = [...grid.querySelectorAll(".after .c")];
    const L = live.length;
    if (m === "after") {
      // The conversation goes from its newest end back to the start, then the summary fills in.
      const spread = 560;
      live.forEach((c, i) => Mo.play(c, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.6)" }],
        { duration: 220, delay: ((L - 1 - i) / (L - 1)) * spread, easing: Mo.ease.out, fill: "backwards", key: "sq" }));
      after.forEach((c, i) => Mo.play(c, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }],
        { duration: 220, delay: spread + 60 + (after.length > 1 ? (i / (after.length - 1)) * 160 : 0), easing: Mo.ease.out, fill: "backwards", key: "sq" }));
    } else {
      after.forEach((c) => Mo.play(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: Mo.ease.out, fill: "backwards", key: "sq" }));
      live.forEach((c, i) => Mo.play(c, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }],
        { duration: 180, delay: 80 + (i / (L - 1)) * 420, easing: Mo.ease.out, fill: "backwards", key: "sq" }));
    }
  }

  // ---------- "What survived?" ----------
  const OPTIONS = ["lost", "summary", "answer"];
  const reach = { lost: 1, summary: 2, answer: 3 };
  const state = {}; // key -> { guess, done }
  function buildGame() {
    $("events").innerHTML = EVENTS.map((e) => {
      const copy = C.events[e.key];
      const id = `ev-${e.key}`;
      return `<li class="ev" id="${id}" data-k="${e.key}" data-reach="0">` +
        `<div class="ev-main">` +
          `<p class="ev-call">${esc(C.callN(e.d.call))}</p>` +
          `<h3 class="ev-title">${esc(copy.title)}</h3>` +
          `<p class="ev-text">${copy.text(e.d)}</p>` +
          `<div class="ev-proof"><span>${esc(C.game.proof)}</span><pre>${e.proof}</pre></div>` +
        `</div>` +
        `<div class="ev-side">` +
          `<div class="track" aria-hidden="true">${C.game.stages.map((s, j) => (j ? `<i class="tl"><s></s></i>` : "") + `<span class="tn"><b></b>${esc(s)}</span>`).join("")}</div>` +
          `<p class="ev-q" id="${id}-q">${esc(C.game.question)}</p>` +
          `<div class="ev-opts" role="group" aria-labelledby="${id}-q">${OPTIONS.map((o) =>
            `<button type="button" class="opt" data-o="${o}" aria-pressed="false">${esc(C.game.options[o])}</button>`).join("")}</div>` +
          `<div class="ev-reveal" id="${id}-r" hidden></div>` +
        `</div>` +
      `</li>`;
    }).join("");
    $("events").addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b) return;
      const li = b.closest(".ev");
      reveal(li.dataset.k, b.dataset.o, true);
    });
    $("reveal-all").addEventListener("click", () => {
      EVENTS.forEach((e, k) => { if (!state[e.key]) reveal(e.key, null, true, k * 60); });
    });
    updateScore();
  }
  function revealHTML(e, guess) {
    const v = C.game;
    const head = guess === null ? "" : guess === e.outcome ? `<b class="ok">${esc(v.right)}</b> ` : `<b class="no">${esc(v.wrong({ guess: v.options[guess] }))}</b> `;
    let h = `<p class="verdict">${head}${esc(v.verdict[e.outcome])}</p>`;
    if (e.sumQ) h += `<blockquote class="q q-sum"><span>${esc(v.inSummary)}</span>${quote(e.sumQ)}</blockquote>`;
    if (e.ansQ) h += `<blockquote class="q q-ans"><span>${esc(v.inAnswer)}</span>${quote(e.ansQ)}</blockquote>`;
    else {
      h += `<p class="q-none">${esc(v.notInAnswer)}</p>`;
      if (e.insteadQ) h += `<blockquote class="q q-ans"><span>${esc(v.instead)}</span>${quote(e.insteadQ)}</blockquote>`;
    }
    if (e.keptToo && e.inKept === false && e.ansQ) h += `<p class="q-note">${esc(v.keptNote(e.d))}</p>`;
    return h;
  }
  function reveal(key, guess, animate, delay = 0) {
    if (state[key]) return;
    const e = EVENTS.find((x) => x.key === key);
    state[key] = { guess, done: true };
    const li = $(`ev-${key}`);
    li.classList.add("done");
    li.dataset.reach = String(reach[e.outcome]);
    li.dataset.outcome = e.outcome;
    li.querySelectorAll(".opt").forEach((b) => {
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-pressed", String(b.dataset.o === guess));
      b.classList.toggle("is-true", b.dataset.o === e.outcome);
    });
    const r = $(`ev-${key}-r`);
    r.innerHTML = revealHTML(e, guess);
    r.hidden = false;
    if (guess !== null) $("game-live").textContent = plain(r.querySelector(".verdict").innerHTML);
    if (animate) {
      const links = [...li.querySelectorAll(".tl s")].slice(0, reach[e.outcome] - 1);
      const nodes = [...li.querySelectorAll(".tn b")].slice(1, reach[e.outcome]);
      links.forEach((l, j) => Mo.grow(l, { delay: delay + j * 180, duration: Mo.dur.base, stagger: 0 }));
      nodes.forEach((n, j) => Mo.pop(n, { delay: delay + 140 + j * 180, duration: 200, spread: 0 }));
      Mo.enter([...r.children], { y: 4, delay: delay + 80, stagger: 50 });
    }
    updateScore();
  }
  function updateScore() {
    const done = Object.keys(state).length;
    const right = EVENTS.filter((e) => state[e.key] && state[e.key].guess === e.outcome).length;
    $("score").textContent = done ? C.game.score({ done: fmt(done), n: fmt(EVENTS.length), right: fmt(right) }) : C.game.scoreNone({ n: fmt(EVENTS.length) });
    if (done === EVENTS.length) {
      const btn = $("reveal-all");
      const hadFocus = document.activeElement === btn;
      btn.hidden = true;
      const t = $("tally");
      const left = EVENTS.filter((e) => e.outcome !== "answer");
      t.innerHTML = C.game.tally({
        n: fmt(EVENTS.length),
        inSummary: fmt(EVENTS.filter((e) => e.outcome !== "lost").length),
        inAnswer: fmt(EVENTS.filter((e) => e.outcome === "answer").length),
        leftOut: left.length ? C.game.tallyLeftOut({ list: list(left.map((e) => esc(C.events[e.key].short))) }) : "",
      });
      t.hidden = false;
      t.tabIndex = -1;
      if (hadFocus) t.focus();
    }
  }

  // ---------- the summary, and the answers, as documents ----------
  // Line by line: numbered section titles and ## headings, list items (indented by level), plain
  // lines, and ``` code blocks (folded in the summary). `marks` are [a, b) ranges of the raw text to
  // highlight; each opens a box under its line.
  function renderDoc(text, marks = [], { fold = false } = {}) {
    const lines = text.split("\n");
    const bulletIndents = lines.map((l) => (l.match(/^(\s*)- /) || [])[1]).filter((x) => x !== undefined).map((x) => x.length);
    const base = bulletIndents.length ? Math.min(...bulletIndents) : 0;
    let off = 0, html = "", code = null, fenceIn = 0;
    const segs = (a, b) => {
      // The text between a and b, with the marks inside it turned into highlights.
      let out = "", at = a;
      marks.filter((m) => m.b > a && m.a < b).sort((x, y) => x.a - y.a).forEach((m) => {
        const s = Math.max(a, m.a), e = Math.min(b, m.b);
        if (s > at) out += inline(text.slice(at, s));
        out += `<a class="hl hl-${m.kind}" href="#box-${m.key}" role="button" data-k="${m.key}" aria-expanded="false" aria-controls="box-${m.key}">${inline(text.slice(s, e))}</a>`;
        at = e;
      });
      if (at < b) out += inline(text.slice(at, b));
      return out;
    };
    lines.forEach((line) => {
      const a = off, b = off + line.length;
      off = b + 1;
      if (/^\s*```/.test(line)) {
        if (code === null) { code = []; fenceIn = line.match(/^\s*/)[0].length; return; }
        const n = code.length;
        const pre = `<pre class="d-code">${esc(code.join("\n"))}</pre>`;
        html += fold ? `<details class="d-fold"><summary>${esc(C.summary.code(fmt(n)))}</summary>${pre}</details>` : pre;
        code = null;
        return;
      }
      if (code !== null) { code.push(line.slice(Math.min(fenceIn, line.match(/^ */)[0].length))); return; }
      if (!line.trim()) { html += `<div class="d-gap"></div>`; return; }
      const boxes = marks.filter((m) => m.a >= a && m.a < b).map((m) => `<div class="hl-box" id="box-${m.key}" hidden></div>`).join("");
      let m;
      if ((m = line.match(/^(#{1,3} |\d+\. )(.*)$/)) && (m[1].startsWith("#") || /:$/.test(line))) {
        html += `<p class="d-h">${segs(a + (m[1].startsWith("#") ? m[1].length : 0), b)}</p>`;
      } else if ((m = line.match(/^(\s*)- /))) {
        const lvl = Math.max(0, Math.round((m[1].length - base) / 2));
        html += `<p class="d-li" style="--lvl:${lvl}">${segs(a + m[0].length, b)}</p>`;
      } else if (/^\s*<\/?[\w-]+>/.test(line)) {
        html += `<p class="d-tag">${segs(a, b)}</p>`;
      } else {
        const ind = line.match(/^\s*/)[0].length;
        html += `<p class="d-p${ind ? " d-in" : ""}">${segs(a + ind, b)}</p>`;
      }
      html += boxes;
    });
    return html;
  }

  // The summary's highlights: the events' sentences, and four notes of ours on odd passages.
  const NOTES = [
    { key: "ranOut", re: /ran out of context/ },
    { key: "kept", re: /most recent messages from before compaction, kept verbatim/ },
    { key: "transcript", re: /read the full transcript at/ },
    { key: "attribution", re: /Commit attribution:/, toEnd: true },
  ];
  function summaryMarks() {
    const marks = [];
    EVENTS.forEach((e) => { if (e.sumQ) marks.push({ a: e.sumQ.a, b: e.sumQ.b, key: e.key, kind: "event", e }); });
    NOTES.forEach((n) => {
      const at = findProse(S, n.re);
      if (at < 0) { fail(`note "${n.key}": its passage wasn't found in the summary`); return; }
      let [a, b] = sentenceRange(S, at);
      if (n.toEnd) { a = at; b = S.indexOf("\n", at); if (b < 0) b = S.length; }
      marks.push({ a, b, key: `n-${n.key}`, kind: "note", n });
    });
    marks.sort((x, y) => x.a - y.a);
    return marks.filter((m, i) => {
      const clash = marks.slice(0, i).some((p) => p.b > m.a);
      if (clash) fail(`summary highlight "${m.key}" overlaps another one; it's left out`);
      return !clash;
    });
  }
  function boxHTML(m) {
    if (m.kind === "note") return `<p>${C.summary.notes[m.n.key](d)}</p>`;
    const e = m.e;
    return `<p class="box-call">${esc(C.summary.callOf(e.d.call))} · ${esc(C.events[e.key].title)}</p>` +
      `<p>${C.events[e.key].text(e.d)}</p><pre>${e.proof}</pre>`;
  }
  function buildSummary() {
    const marks = summaryMarks();
    $("summary-head").textContent = C.summary.head(d);
    const body = $("summary-body");
    body.innerHTML = renderDoc(S, marks, { fold: true });
    const byKey = Object.fromEntries(marks.map((m) => [m.key, m]));
    const toggle = (a) => {
      const box = $(a.getAttribute("aria-controls"));
      const open = a.getAttribute("aria-expanded") !== "true";
      a.setAttribute("aria-expanded", String(open));
      if (open && !box.innerHTML) box.innerHTML = boxHTML(byKey[a.dataset.k]);
      box.hidden = !open;
      if (open) Mo.enter(box, { y: 4, duration: Mo.dur.base });
    };
    body.addEventListener("click", (ev) => {
      const a = ev.target.closest(".hl");
      if (!a) return;
      ev.preventDefault();
      toggle(a);
    });
    body.addEventListener("keydown", (ev) => {
      const a = ev.target.closest(".hl");
      if (a && ev.key === " ") { ev.preventDefault(); toggle(a); }
    });
  }

  // ---------- figure 2: three sizes to one scale ----------
  function buildSizes() {
    const rows = [
      { label: C.next.rowPre(d), cells: squares([{ cls: "k-pre", tokens: pre }]) },
      { label: C.next.rowPost(d), cells: squares([{ cls: "k-after", tokens: post }]) },
      { label: C.next.rowNext(d), cells: squares([{ cls: "k-cached", tokens: AC.cached_tokens }, { cls: "k-fresh", tokens: AC.new_tokens }]) },
    ];
    const body = $("sizes-body");
    body.setAttribute("aria-label", C.next.label({ ...d, fresh: d.fresh }));
    body.innerHTML = rows.map((r, j) => `<div class="size-row" data-r="${j}" aria-hidden="true"><p class="size-l">${esc(r.label)}</p><div class="cells">${sq(r.cells)}</div></div>`).join("");
    $("sizes-legend").innerHTML = legend([["k-pre", C.next.legendPre], ["k-after", C.squash.legendAfter], ["k-cached", C.next.legendCached], ["k-fresh", C.next.legendFresh]]);
    $("files").innerHTML = CM.reattached.map((f) => {
      const p = slash(f.path);
      const name = p.split("/").pop();
      const dir = p.slice(0, p.length - name.length);
      return `<li class="file ${f.kind === "full" ? "is-full" : "is-stub"}"><span class="file-path"><span class="file-dir">${esc(dir)}</span><code>${esc(name)}</code></span>` +
        `<span class="file-kind">${f.kind === "full" ? esc(C.next.full({ chars: fmt(f.chars) })) : esc(C.next.stub)}</span></li>`;
    }).join("");
  }

  // ---------- the answer and its table ----------
  function buildAnswer() {
    $("answer-head").textContent = C.test.answerHead(d);
    $("answer-body").innerHTML = renderDoc(A);
    $("kept-body").innerHTML = renderDoc(K);
    const yes = `<span class="dot yes" aria-hidden="true"></span><span class="cell-t">${esc(C.test.yes)}</span>`;
    const no = `<span class="dot no" aria-hidden="true"></span><span class="cell-t">${esc(C.test.no)}</span>`;
    const sess = (r) => (r.notShown ? `<span class="dot no" aria-hidden="true"></span><span class="cell-t">${esc(C.test.notShown)}</span>`
      : `<span class="dot yes" aria-hidden="true"></span><span class="cell-t">${esc(C.callN(fmt(r.at + 1)))}</span>`);
    $("matrix").insertAdjacentHTML("beforeend",
      `<thead><tr>${C.test.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>` +
      `<tbody>${ROWS.map((r) => `<tr><th scope="row">${C.test.rows[r.key](r.d)}</th>` +
        `<td data-l="${esc(C.test.cols[1])}">${sess(r)}</td><td data-l="${esc(C.test.cols[2])}">${r.cells[1] ? yes : no}</td><td data-l="${esc(C.test.cols[3])}">${r.cells[2] ? yes : no}</td></tr>`).join("")}</tbody>`);
  }

  // ---------- figure 3: two costs to one scale ----------
  function buildCosts() {
    if (!verified) {
      document.querySelectorAll('[data-needs="prices"]').forEach((el) => { el.hidden = true; });
      $("price-mismatch").hidden = false;
      return;
    }
    const max = Math.max(CM.cost_usd, cost.total);
    const w = (x) => `${(x / max) * 100}%`;
    const body = $("costs-body");
    body.setAttribute("aria-label", C.cost.label(d));
    body.innerHTML =
      `<div class="bar-row" aria-hidden="true"><p class="size-l">${esc(C.cost.rowCompact(d))}</p>` +
        `<div class="bar"><i class="k-pre" style="width:${w(CM.cost_usd)}"></i></div></div>` +
      `<div class="bar-row" aria-hidden="true"><p class="size-l">${esc(C.cost.rowAfter(d))}</p>` +
        `<div class="bar"><i class="k-cached" style="width:${w(cost.read)}"></i><i class="k-fresh" style="width:${w(cost.write)}"></i><i class="k-out" style="width:${w(cost.out)}"></i></div></div>`;
    $("costs-legend").innerHTML = legend([["k-cached", C.cost.legendCached], ["k-fresh", C.cost.legendFresh], ["k-out", C.cost.legendOut], ["k-pre", C.cost.recorded]]);
  }

  // ---------- go ----------
  fill();
  buildSquash();
  buildGame();
  buildSummary();
  buildSizes();
  buildAnswer();
  buildCosts();

  // ---------- motion ----------
  // Figures and documents rise in as they come into view. The sizes figure fills its rows in order;
  // the cost bars grow from zero. The before/after switch and the event reveals move on use.
  Mo.reveal($("squash"));
  Mo.reveal($("sizes"), (el) => {
    el.querySelectorAll(".size-row").forEach((row, j) => {
      const cells = [...row.querySelectorAll(".c")];
      if (j === 0) Mo.enter(row.querySelector(".cells"), { y: 0, duration: Mo.dur.base, delay: 120 });
      else Mo.pop(cells, { delay: 200 + j * 220, spread: Math.min(360, cells.length * 3), duration: 160 });
    });
  });
  Mo.reveal($("costs"), (el) => {
    el.querySelectorAll(".bar").forEach((bar, j) => Mo.grow(bar, { delay: 120 + j * 120 }));
  });
  Mo.reveal([...document.querySelectorAll(".survive, .doc.wide, .matrix-wrap, .stats, .files")]);

  // Any of these that scrolls at the reader's width can be reached and scrolled by keyboard.
  U.watchScrollBoxes(".card pre, .d-code");
})();
