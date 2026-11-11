// The harness playground widget, shared by the chapter page (index.html) and the embed (embed.html):
// three switches, and the two runs recorded with the chosen settings side by side, call by call.
// Every number and every word the agent wrote or saw comes from the recordings: window.PLAYGROUND
// (site/data/playground-08.js, written by scripts/summarize-playground.py) and the 16 traces
// (site/data/trace-08-<combo>-run<K>.js, written by scripts/build-trace.py). Each trace file sets
// window.TRACE, so they are loaded one at a time: a page may load some itself (a <script> tag followed by
// TRACES[name] = TRACE), and the rest are loaded here when needed, by adding a <script> tag, which works from
// file:// too. Labels come from window.COPY.play and .cards (copy.en.js), escaping and the cards from
// window.TraceUI, motion from window.Motion. Classic script, one global: window.Playground.
(() => {
  "use strict";

  const P = window.PLAYGROUND;
  const C = window.COPY;
  const L = C.play;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, toolsOf, textsOf } = U;
  const { fmt, pl } = U.numbers(C.locale);
  const ROOT = document.body.dataset.root || "../";
  const TRACES = (window.TRACES = window.TRACES || {});
  const money = new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const dec1 = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const hhmm = (iso) => new Date(iso).toLocaleTimeString(C.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" });

  // ---------- the switches and the runs ----------
  // The switches and their values, in the order the summary lists them (which is the page's order).
  const KEYS = Object.keys(P.switches);
  const VALUES = Object.fromEntries(KEYS.map((k) => [k, Object.keys(P.switches[k])]));
  const comboOf = (s) => KEYS.map((k) => s[k]).join("-");
  const COMBOS = Object.fromEntries(P.combinations.map((c) => [c.combo, c]));
  const RUNS = Object.fromEntries(P.runs.map((r) => [r.trace, r]));
  const ruleText = P.switches.rule.rule.append_system_prompt;
  const parse = (s) => {
    const m = String(s || "").replace(/^#/, "");
    return COMBOS[m] ? m : null;
  };

  // ---------- loading the traces ----------
  const pending = {};
  let queue = Promise.resolve();
  function load(name) {
    if (TRACES[name]) return Promise.resolve(TRACES[name]);
    if (pending[name]) return pending[name];
    const p = queue.then(() => TRACES[name] || new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${ROOT}data/${name}.js`;
      s.onload = () => {
        const T = window.TRACE;
        window.TRACE = undefined;
        s.remove();
        if (!T || !T.calls) { reject(new Error(`${name}: no trace in the file`)); return; }
        TRACES[name] = T;
        resolve(T);
      };
      s.onerror = () => { s.remove(); reject(new Error(`couldn't load ${s.src}`)); };
      document.head.appendChild(s);
    }));
    queue = p.catch(() => {});
    pending[name] = p;
    return p;
  }
  const loadAll = () => Promise.all(P.runs.map((r) => load(r.trace)));

  // ---------- reading a run ----------
  const lines = (s) => (String(s).replace(/\s+$/, "") ? String(s).replace(/\s+$/, "").split("\n").length : 0);
  // The test counts the harness pasted back, where the output still holds node's summary.
  function testCounts(text) {
    const pass = text.match(/ℹ pass (\d+)/), fail = text.match(/ℹ fail (\d+)/);
    if (pass && fail) return { pass: +pass[1], fail: +fail[1] };
    return { pass: null, fail: null, failSeen: /✖|not ok \d/.test(text) };
  }
  // Each call's steps, with what the summary says about them: test runs, edits, the tool that wasn't there.
  function stepsOf(r, T) {
    const tests = new Set(r.test_runs.map((x) => `${x.call}\u0000${x.command}`));
    const missing = new Set(r.unavailable.map((x) => `${x.call}\u0000${x.tool}`));
    return T.calls.map((c, i) => {
      const n = i + 1;
      const last = i === T.calls.length - 1;
      return {
        n,
        last,
        texts: textsOf(c).map((o) => o.text),
        tools: toolsOf(c).map((t) => ({
          t,
          test: t.tool === "Bash" && tests.has(`${n}\u0000${t.input.command}`),
          edit: (t.tool === "Edit" || t.tool === "Write") && !t.result.is_error,
          missing: missing.has(`${n}\u0000${t.tool}`),
        })),
      };
    });
  }

  // ---------- drawing a run ----------
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  // What the agent wrote or ran is marked as English, for screen readers and the Chinese page's type.
  const REC = ' lang="en"';
  const mdRec = (s) => U.md(s).replace(/<p class="say">/g, `<p class="say"${REC}>`);
  function arg(t) {
    const i = t.input || {};
    if (t.tool === "Read" || t.tool === "Edit" || t.tool === "Write") return U.base(i.file_path || "");
    // On the one line, a leading "cd <folder> &&" is left out; the opened step shows the whole command.
    if (t.tool === "Bash") return (i.command || "").replace(/^cd\s+("[^"]*"|\S+)\s*&&\s*/, "");
    if (t.tool === "Glob" || t.tool === "Grep") return i.pattern || "";
    return JSON.stringify(i);
  }
  function resShort(x) {
    const { t } = x;
    const text = (t.result && t.result.text) || "";
    if (t.result.is_error) return { html: esc(L.res.error), err: true };
    if (x.test) {
      const k = testCounts(text);
      if (k.pass !== null) return { html: esc(L.res.tests(fmt(k.pass), fmt(k.fail))), fail: k.fail > 0 };
      if (k.failSeen) return { html: esc(L.res.failSeen), fail: true };
    }
    if (t.tool === "Edit" || t.tool === "Write") return { html: esc(L.res.edited) };
    if (t.tool === "Glob") return { html: esc(pl(L.res.files, lines(text))) };
    if (t.tool === "Read") return { html: esc(pl(L.res.lines, U.readLines(text).length)) };
    return { html: esc(pl(L.res.lines, lines(text))) };
  }
  // The opened step: the request and the result as chapter 1 draws them, the result cut to a few lines.
  function opened(x) {
    const { t } = x;
    const text = (t.result && t.result.text) || "";
    const all = t.tool === "Read" ? U.readLines(text) : text.replace(/\s+$/, "").split("\n");
    const max = t.tool === "Read" ? 12 : 16;
    const keep = new Set(U.range(0, Math.min(max, all.length)));
    const html = t.tool === "Read"
      ? U.excerpt(all, keep, new Set(), (n) => pl(C.cards.skipped, n))
      : esc(all.slice(0, max).join("\n")) + (all.length > max ? `\n<span class="more">${esc(pl(C.cards.skipped, all.length - max))}</span>` : "");
    const meta = all.length > max ? C.cards.shown(fmt(max), fmt(all.length)) : pl(C.cards.all, all.length);
    return U.requestCard(t, C.cards) + U.resultCard(t, { html, meta }, C.cards);
  }
  function stepHTML(x) {
    const r = resShort(x);
    const tag = x.missing ? L.tag.missing : x.test ? L.tag.test : x.edit ? L.tag.edit : "";
    const cls = ["pg-req", x.test ? "is-test" : "", x.edit ? "is-edit" : "", x.missing ? "is-missing" : ""].filter(Boolean).join(" ");
    return `<li><details class="${cls}"><summary>` +
      `<span class="q-tool">${esc(x.t.tool)}</span>` +
      `<span class="q-arg"${REC}>${esc(arg(x.t))}</span>` +
      (tag ? `<span class="q-tag">${esc(tag)}</span>` : "") +
      `<span class="q-res${r.err ? " is-err" : ""}${r.fail ? " is-fail" : ""}">${r.html}</span>` +
      `</summary><div class="q-open">${opened(x)}</div></details></li>`;
  }
  function answerHTML(text) {
    const paras = text.split(/\n{2,}/).filter((p) => p.trim());
    const first = paras[0] || "";
    const rest = paras.slice(1).join("\n\n");
    return `<div class="card model text pg-answer">${U.cardHead(esc(L.answer), "")}${mdRec(first)}` +
      (rest ? `<details class="pg-more"><summary>${esc(pl(L.more, paras.length - 1))}</summary>${mdRec(rest)}</details>` : "") + `</div>`;
  }
  const mark = (yes) => `<i class="mk ${yes ? "mk-yes" : "mk-no"}" aria-hidden="true"></i>`;
  function runHTML(r, T, ids, level) {
    const steps = stepsOf(r, T);
    const h = `h${level}`;
    const call1 = T.calls[0] || { context_tokens: 0 };
    const check = (k, yes, val) => `<li class="ck" data-k="${k}" data-yes="${yes}">${mark(yes)}<span class="ck-l">${esc(L.checks[k])}</span><b class="ck-v">${esc(val)}</b></li>`;
    const callRows = steps.map((s) => {
      const says = s.last ? "" : s.texts.map((x) => `<p class="pg-say"${REC}>${inline(x)}</p>`).join("");
      const reqs = s.tools.length ? `<ul class="pg-reqs">${s.tools.map(stepHTML).join("")}</ul>` : "";
      const answer = s.last && T.final_answer ? answerHTML(T.final_answer) : "";
      return `<li class="pg-call${s.last ? " is-last" : ""}"><span class="pg-cn">${esc(L.callN(fmt(s.n)))}</span><div class="pg-cb">${says}${reqs}${answer}</div></li>`;
    }).join("");
    return `<div class="pg-run-head"><${h} class="pg-run-title" id="${ids}-t">${esc(L.run(fmt(r.run)))}</${h}><span class="meta">${esc(L.runMeta(r.model, hhmm(T.started_at)))}</span></div>` +
      `<dl class="pg-facts">` +
        `<div><dt>${esc(L.facts.calls)}</dt><dd data-f="calls">${fmt(r.model_calls)}</dd></div>` +
        `<div><dt>${esc(L.facts.time)}</dt><dd data-f="time">${dec1.format(r.duration_s)}</dd></div>` +
        `<div><dt>${esc(L.facts.cost)}</dt><dd data-f="cost">${money.format(r.cost_usd)}</dd></div>` +
      `</dl>` +
      `<p class="pg-cache">${esc(L.facts.cached(fmt(r.first_call_cached_tokens), fmt(call1.context_tokens)))}</p>` +
      `<ul class="pg-checks">` +
        check("before", r.tests_before_first_edit, r.tests_before_first_edit ? L.checks.yes : L.checks.no) +
        check("after", !!r.tests_after_last_edit, r.tests_after_last_edit ? L.checks.yes : L.checks.no) +
        check("fixed", r.fix.correct, L.checks.pass(fmt(r.fix.passed), fmt(r.fix.tests))) +
      `</ul>` +
      `<p class="pg-k" id="${ids}-s">${esc(L.stepsHead)}</p>` +
      `<ol class="pg-steps" aria-labelledby="${ids}-s">${callRows}</ol>`;
  }

  // ---------- the widget ----------
  // mount(root, { level, hash, onChange }): draws the switches and the two runs into `root`.
  // level: the heading level of each run's title. hash: keep the settings in the address (#opus-bash-rule).
  let uid = 0;
  function mount(root, opts = {}) {
    const id = `pg${++uid}`;
    const level = opts.level || 3;
    const d = { rule: esc(ruleText) };
    let current = null;
    let shown = null;

    const switches = KEYS.map((k) => {
      const opts = VALUES[k].map((v) =>
        `<label class="seg-opt"><input type="radio" name="${id}-${k}" value="${esc(v)}"><span>${esc(L.value[k][v])}</span></label>`).join("");
      return `<fieldset class="pg-sw" data-k="${k}" aria-describedby="${id}-h-${k}"><legend>${esc(L.legend[k])}</legend>` +
        `<div class="seg">${opts}</div><p class="pg-hint" id="${id}-h-${k}">${L.hint[k](d)}</p></fieldset>`;
    }).join("");
    root.innerHTML =
      `<div class="pg-switches" role="group" aria-label="${esc(L.group)}">${switches}</div>` +
      `<p class="sr-only" role="status" id="${id}-status"></p>` +
      `<div class="pg-pair" id="${id}-pair" aria-live="off">` +
        [1, 2].map((k) => `<article class="pg-run" data-slot="${k - 1}" aria-labelledby="${id}-r${k}-t"><p class="pg-wait">${esc(L.loading)}</p></article>`).join("") +
      `</div>`;
    const pair = root.querySelector(".pg-pair");
    const slots = [...pair.querySelectorAll(".pg-run")];
    const status = root.querySelector(`#${id}-status`);

    const setRadios = (combo) => {
      const s = COMBOS[combo].switches;
      KEYS.forEach((k) => root.querySelectorAll(`input[name="${id}-${k}"]`).forEach((inp) => { inp.checked = inp.value === s[k]; }));
    };
    const spoken = (combo) => {
      const s = COMBOS[combo].switches;
      return KEYS.map((k) => L.spoken[k][s[k]]).join(L.spokenJoin);
    };

    // The numbers a run shows, to count from when the settings change.
    const numbers = (r) => ({ calls: r.model_calls, time: r.duration_s, cost: r.cost_usd });
    const FORMAT = { calls: (x) => fmt(Math.round(x)), time: (x) => dec1.format(x), cost: (x) => money.format(x) };
    const ROUND = { calls: Math.round, time: (x) => Math.round(x * 10) / 10, cost: (x) => Math.round(x * 1e4) / 1e4 };

    function draw(combo, Ts, animate) {
      const c = COMBOS[combo];
      const runs = c.runs.map((name) => RUNS[name]);
      const before = shown ? COMBOS[shown].runs.map((name) => RUNS[name]) : null;
      const oldChecks = slots.map((el) => Object.fromEntries([...el.querySelectorAll(".ck")].map((li) => [li.dataset.k, li.dataset.yes])));
      runs.forEach((r, i) => {
        slots[i].innerHTML = runHTML(r, Ts[i], `${id}-r${i + 1}`, level);
        slots[i].dataset.run = r.trace;
      });
      pair.dataset.combo = combo;
      shown = combo;
      status.textContent = L.status(spoken(combo), runs.map((r) => L.statusRun(fmt(r.run), pl(L.callsWord, r.model_calls), r.tests_before_first_edit, r.tests_after_last_edit)).join(" "));
      if (!animate) return;
      runs.forEach((r, i) => {
        const el = slots[i];
        if (before) {
          const from = numbers(before[i]), to = numbers(r);
          el.querySelectorAll("[data-f]").forEach((dd) => {
            const k = dd.dataset.f;
            Mo.count(dd, to[k], { from: from[k], format: FORMAT[k], round: ROUND[k], duration: Mo.dur.slow });
          });
        }
        // A check whose answer changed lands again; the steps come in one after the other.
        el.querySelectorAll(".ck").forEach((li) => { if (oldChecks[i][li.dataset.k] !== li.dataset.yes) Mo.pop(li.querySelector(".mk"), { duration: 240 }); });
        Mo.enter([...el.querySelectorAll(".pg-cache, .pg-call")], { y: 6, stagger: 35, delay: i * 40, duration: Mo.dur.base });
      });
    }

    // Show a combination: its two traces load first (the old runs stay until they're in).
    function show(combo, { animate = true, from = "user" } = {}) {
      if (!COMBOS[combo]) return;
      current = combo;
      setRadios(combo);
      if (opts.hash && from === "user" && location.hash !== `#${combo}`) {
        try { history.replaceState(null, "", `#${combo}`); } catch { location.hash = combo; }
      }
      pair.setAttribute("aria-busy", "true");
      Promise.all(COMBOS[combo].runs.map(load)).then((Ts) => {
        if (current !== combo) return;
        pair.removeAttribute("aria-busy");
        draw(combo, Ts, animate && shown !== null);
        if (opts.onChange) opts.onChange(combo);
      }, (err) => {
        pair.removeAttribute("aria-busy");
        slots.forEach((el) => { el.innerHTML = `<p class="pg-wait">${esc(L.failed)}</p>`; });
        console.error(err);
      });
    }

    root.addEventListener("change", (e) => {
      const inp = e.target;
      if (!inp.name || !inp.name.startsWith(`${id}-`)) return;
      const s = { ...COMBOS[current].switches, [inp.name.slice(id.length + 1)]: inp.value };
      show(comboOf(s));
    });
    if (opts.hash) {
      window.addEventListener("hashchange", () => {
        const c = parse(location.hash);
        if (c && c !== current) show(c, { from: "hash" });
      });
    }

    // Keep the pair as tall as the tallest combination at this width (all steps closed), so switching never
    // moves what comes after it. Measured on a hidden copy once every trace is in, and again when the width
    // or the fonts change.
    let sizer = null;
    function reserve() {
      if (!P.runs.every((r) => TRACES[r.trace])) return;
      if (!sizer) {
        sizer = document.createElement("div");
        sizer.className = pair.className + " pg-sizer";
        sizer.setAttribute("aria-hidden", "true");
        sizer.setAttribute("inert", "");
        sizer.innerHTML = slots.map(() => `<article class="pg-run"></article>`).join("");
        pair.parentNode.insertBefore(sizer, pair.nextSibling);
      }
      sizer.style.width = `${pair.getBoundingClientRect().width}px`;
      const arts = [...sizer.children];
      let max = 0;
      P.combinations.forEach((c) => {
        c.runs.forEach((name, i) => { arts[i].innerHTML = runHTML(RUNS[name], TRACES[name], `${id}-z${i}`, level); });
        max = Math.max(max, sizer.getBoundingClientRect().height);
      });
      arts.forEach((a) => { a.innerHTML = ""; });
      pair.style.minHeight = `${Math.ceil(max)}px`;
    }
    let lastW = 0;
    const ro = window.ResizeObserver ? new ResizeObserver(() => {
      const w = Math.round(pair.getBoundingClientRect().width);
      if (w !== lastW) { lastW = w; reserve(); }
    }) : null;

    const start = parse(location.hash) || opts.initial || P.combinations[0].combo;
    show(start, { animate: false, from: "start" });
    const all = loadAll();
    all.then(() => {
      reserve();
      if (ro) ro.observe(pair);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
    }, (err) => console.error(err));

    return { show, get current() { return current; }, all, started: start, fromHash: !!parse(location.hash) };
  }

  window.Playground = { mount, load, loadAll, parse, comboOf, KEYS, VALUES, COMBOS, RUNS, testCounts, stepsOf, TRACES };
})();
