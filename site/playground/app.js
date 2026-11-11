// Chapter 8 page: the harness playground. The playground itself (switches and the two runs) is
// playground.js, shared with embed.html; this file fills the rest of the page. Every number and every
// word the agent wrote or saw comes from the recordings: window.PLAYGROUND (site/data/playground-08.js)
// and the 16 traces in window.TRACES, keyed by name (index.html loads the few the opening text needs;
// playground.js loads the rest). Chapter 1's run is TRACES.ch1 (site/data/trace-02-run2.js), only to check
// that the playground opens on its model and tools. The narration and labels come from window.COPY
// (copy.en.js), escaping and formatting from window.TraceUI, motion from window.Motion.
(() => {
  "use strict";

  const P = window.PLAYGROUND;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const G = window.Playground;
  const TR = window.TRACES;
  const { esc } = U;
  const { fmt, pl, list } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const uniq = (a) => [...new Set(a)];
  const code = (s) => `<code>${esc(s)}</code>`;
  const money = new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const dec1 = new Intl.NumberFormat(C.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateOf = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const hhmm = (ms) => new Date(ms).toLocaleTimeString(C.locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const ROOT = document.body.dataset.root || "../";

  // ---------- the switches, as the summary gives them ----------
  const { KEYS, VALUES } = G;
  const [M0, M1] = VALUES.model;     // opus, haiku
  const [B0, B1] = VALUES.bash;      // bash, nobash
  const [R0, R1] = VALUES.rule;      // norule, rule
  const runs = P.runs;
  const name = (m, b, r, k = 1) => `trace-08-${m}-${b}-${r}-run${k}`;
  const ruleText = P.switches.rule[R1].append_system_prompt;
  const allowOn = P.switches.bash[B0].allowed_tools;
  const flagArgs = (xs) => xs.map((a) => (/[\s*()]/.test(a) ? `"${a}"` : a)).join(" ");
  const modelId = (m) => P.switches.model[m].model;
  const spoken = (s) => KEYS.map((k) => C.play.spoken[k][s[k]]).join(" · ");
  const of = (pred, set = runs) => set.filter(pred).length;
  const per = P.combinations[0].runs.length;
  const allFixed = P.totals.fixed === P.totals.runs;
  if (!allFixed) console.warn("not every run fixed the bug: the overview needs a column for it");

  // What a final answer says about running the tests, if it says it couldn't.
  const sentences = (text) => text.split(/\n+/).flatMap((l) => l.split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter(Boolean);
  const NO_TEST = /\b(couldn['’]t|could not|haven['’]t|have not|can['’]t|cannot)\b[^.]*\b(run|test)/i;
  const saysNoTest = (T) => sentences(T.final_answer || "").find((s) => NO_TEST.test(s)) || "";

  // ---------- the opening ----------
  const first = (k) => (TR[k] && TR[k].calls[0] ? TR[k].calls[0].context_tokens : null);
  const base = name(M0, B0, R0);
  const sz = { base: first(base), nobash: first(name(M0, B1, R0)), rule: first(name(M0, B0, R1)) };
  const ch1 = TR.ch1;
  const ch1Same = !!ch1 && ch1.model === modelId(M0) && [...ch1.tools_available].sort().join() === [...P.switches.bash[B0].tools].sort().join();
  const d = {
    runs: fmt(P.totals.runs), per: fmt(per), combos: fmt(P.combinations.length),
    opus: code(modelId(M0)), haiku: code(modelId(M1)),
    opusName: esc(C.play.value.model[M0]), haikuName: esc(C.play.value.model[M1]),
    bashSaved: sz.base !== null && sz.nobash !== null ? fmt(sz.base - sz.nobash) : "",
    ruleAdded: sz.base !== null && sz.rule !== null ? fmt(sz.rule - sz.base) : "",
    allowOn: code(`--allowedTools ${flagArgs(allowOn)}`),
    rule: esc(ruleText),
    ch1: ch1Same,
    allFixed,
  };
  const fill = (scope = document) => scope.querySelectorAll("[data-c]").forEach((el) => {
    const fn = el.dataset.c.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
    if (typeof fn === "function") el.innerHTML = fn(d);
    else if (typeof fn === "string") el.innerHTML = fn;
  });
  fill();
  const prompt = (TR[base] || {}).prompt;
  if (prompt) $("prompt").textContent = prompt;

  // ---------- the playground ----------
  const snippet = (combo) => {
    const site = (window.CHAPTERS && window.CHAPTERS.site) || "";
    return `<iframe src="${site}/playground/embed.html#${combo}"\n  title="${C.embedNote.frameTitle}"\n  width="100%" height="1500" style="border:0" loading="lazy"></iframe>`;
  };
  const pg = G.mount($("pg"), {
    level: 3,
    hash: true,
    onChange: (combo) => {
      $("embed-code").textContent = snippet(combo);
      $("embed-open").href = `embed.html#${combo}`;
      document.querySelectorAll("#overview tbody tr").forEach((tr) => {
        const on = tr.dataset.combo === combo;
        tr.classList.toggle("is-current", on);
        const a = tr.querySelector("a");
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    },
  });
  // Opened from a link to a setting (#haiku-nobash-rule): go to the playground.
  if (pg.fromHash) requestAnimationFrame(() => $("playground").scrollIntoView({ block: "start" }));
  // A row of the overview, or a link to a setting, shows it in the playground and goes there.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    const combo = a && G.parse(a.getAttribute("href"));
    if (!combo) return;
    e.preventDefault();
    pg.show(combo);
    $("playground").scrollIntoView({ block: "start", behavior: Mo.reduced() ? "auto" : "smooth" });
    $("playground").focus({ preventScroll: true });
  });
  // chapters.js loads after this script; the snippet needs the site's address from it.
  document.addEventListener("DOMContentLoaded", () => { $("embed-code").textContent = snippet(pg.current); });

  // ---------- the overview ----------
  const OV = C.overview;
  const markOf = (yes, k) => `<span class="ov-mk"><i class="mk ${yes ? "mk-yes" : "mk-no"}" aria-hidden="true"></i><span class="sr-only">${esc(OV.runSpoken(fmt(k), yes))}</span></span>`;
  $("overview").innerHTML =
    `<caption>${esc(allFixed ? OV.caption({ runs: fmt(P.totals.runs) }) : "")}</caption>` +
    `<thead><tr><th scope="col">${esc(OV.cols.setting)}</th><th scope="col">${esc(OV.cols.before)}</th><th scope="col">${esc(OV.cols.after)}</th><th scope="col" class="num">${esc(OV.cols.calls)}</th><th scope="col" class="num">${esc(OV.cols.cost)}</th></tr></thead>` +
    `<tbody>${P.combinations.map((c) => {
      const rs = c.runs.map((n) => G.RUNS[n]);
      const s = c.switches;
      const cell = KEYS.map((k) => `<span class="ov-s ov-${k}">${esc(C.play.spoken[k][s[k]])}</span>`).join("");
      return `<tr data-combo="${esc(c.combo)}"><th scope="row"><a href="#${esc(c.combo)}">${cell}</a></th>` +
        `<td>${rs.map((r) => markOf(r.tests_before_first_edit, r.run)).join("")}</td>` +
        `<td>${rs.map((r) => markOf(!!r.tests_after_last_edit, r.run)).join("")}</td>` +
        `<td class="num">${esc(OV.pair(...rs.map((r) => fmt(r.model_calls))))}</td>` +
        `<td class="num">${rs.map((r) => `<span class="ov-cost">${esc(money.format(r.cost_usd))}</span>`).join("")}</td></tr>`;
    }).join("")}</tbody>`;
  // The overview and its links follow the playground from the start.
  document.querySelectorAll("#overview tbody tr").forEach((tr) => {
    if (tr.dataset.combo === pg.current) { tr.classList.add("is-current"); tr.querySelector("a").setAttribute("aria-current", "true"); }
  });

  // ---------- stats (from the summary alone) ----------
  const bashRuns = runs.filter((r) => r.switches.bash === B0);
  const st = {
    runs: fmt(P.totals.runs),
    fixed: fmt(P.totals.fixed),
    rule: esc(C.stats.of(fmt(of((r) => r.tests_before_first_edit, bashRuns.filter((r) => r.switches.rule === R1))), fmt(bashRuns.filter((r) => r.switches.rule === R1).length))),
    norule: esc(C.stats.of(fmt(of((r) => r.tests_before_first_edit, bashRuns.filter((r) => r.switches.rule === R0))), fmt(bashRuns.filter((r) => r.switches.rule === R0).length))),
  };
  document.querySelectorAll("[data-v]").forEach((el) => { if (st[el.dataset.v] !== undefined) el.innerHTML = st[el.dataset.v]; });

  // ---------- everything that needs all 16 traces ----------
  pg.all.then(() => {
    const T = (r) => TR[r.trace];
    const run2 = runs.filter((r) => r.run === per);
    const startMs = (r) => Date.parse(T(r).started_at);
    // Each setting's run 2 after its run 1, in minutes.
    const gaps = P.combinations.map((c) => (startMs(G.RUNS[c.runs[per - 1]]) - startMs(G.RUNS[c.runs[0]])) / 60000);
    const min1 = (xs) => dec1.format(Math.min(...xs)), max1 = (xs) => dec1.format(Math.max(...xs));
    const r2c = run2.map((r) => r.first_call_cached_tokens);
    $("pair-note").innerHTML = C.play.pairNote({ gapMin: min1(gaps), gapMax: max1(gaps), r2CacheMin: fmt(Math.min(...r2c)), r2CacheMax: fmt(Math.max(...r2c)) });
    // The opening's prompt, if every run had the same one.
    const prompts = uniq(runs.map((r) => T(r).prompt));
    if (prompts.length !== 1) console.warn(`${prompts.length} different prompts`);

    // What the switches did.
    const S = C.shows;
    const ruleRuns = bashRuns.filter((r) => r.switches.rule === R1), normRuns = bashRuns.filter((r) => r.switches.rule === R0);
    // Whether the runs that tested before their edit saw a test fail.
    // The test runs before the first edit, in conversation order, and what node reported in each.
    const beforeResults = (r) => {
      const out = [];
      for (const st of G.stepsOf(r, T(r))) for (const x of st.tools) {
        if (x.edit) return out;
        if (x.test) out.push(G.testCounts(x.t.result.text));
      }
      return out;
    };
    const sawFail = (r) => beforeResults(r).some((k) => k.fail > 0 || k.failSeen);
    const firstNorm = normRuns.filter((r) => r.tests_before_first_edit);
    const ruleBefore = ruleRuns.filter((r) => r.tests_before_first_edit);
    const runName = (r) => `${spoken(r.switches)}, ${C.colophon.link(fmt(r.run))}`;
    const ruleText1 = S.rule.text({
      normBefore: fmt(firstNorm.length), normN: fmt(normRuns.length),
      ruleBefore: fmt(ruleBefore.length), ruleN: fmt(ruleRuns.length),
      bashAfter: fmt(of((r) => r.tests_after_last_edit, bashRuns)), bashN: fmt(bashRuns.length),
      sawFail: ruleBefore.length > 0 && ruleBefore.every(sawFail),
      haikuFirst: firstNorm.length === 1 ? S.rule.haikuFirst(esc(runName(firstNorm[0]))) : "",
    });

    const nobash = runs.filter((r) => r.switches.bash === B1);
    const said = nobash.map((r) => saysNoTest(T(r))).filter(Boolean);
    const missingRuns = runs.filter((r) => r.unavailable.length);
    const missingModels = uniq(missingRuns.map((r) => r.switches.model));
    const missingOf = missingModels.length === 1 ? missingModels[0] : null;
    const err = missingRuns.length ? missingRuns[0].unavailable[0].error.replace(/<\/?tool_use_error>/g, "") : "";
    const missingText = missingRuns.length && missingOf ? S.bash.missing({
      all: of((r) => r.switches.model === missingOf, nobash) === missingRuns.length, missingN: fmt(missingRuns.length),
      missingModel: esc(C.play.value.model[missingOf]), error: esc(err), runs: fmt(P.totals.runs),
      othersAsked: false, otherModel: esc(C.play.value.model[missingOf === M0 ? M1 : M0]),
    }) : "";
    const bashText = S.bash.text({
      nobashN: fmt(nobash.length), said: fmt(said.length), saidAll: said.length === nobash.length,
      example: said.length ? inline(said[said.length - 1]) : "", missing: missingText,
    });

    // The cost: each opus run against the haiku run with the same switches and run number.
    const twin = (r) => runs.find((x) => x.switches.model === M1 && x.switches.bash === r.switches.bash && x.switches.rule === r.switches.rule && x.run === r.run);
    const ratios = runs.filter((r) => r.switches.model === M0).map((r) => r.cost_usd / twin(r).cost_usd);
    const outs = (m) => runs.filter((r) => r.switches.model === m).map((r) => T(r).totals.output_tokens);
    const modelText = S.model.text({
      opusName: d.opusName, haikuName: d.haikuName,
      lo: fmt(Math.round(Math.min(...ratios))), hi: fmt(Math.round(Math.max(...ratios))),
      hOutLo: fmt(Math.min(...outs(M1))), hOutHi: fmt(Math.max(...outs(M1))),
      oOutLo: fmt(Math.min(...outs(M0))), oOutHi: fmt(Math.max(...outs(M0))),
    });
    $("pt-rule").innerHTML = ruleText1;
    $("pt-bash").innerHTML = bashText;
    $("pt-model").innerHTML = modelText;
    $("pt-caveat").innerHTML = S.caveat.text({ runs: fmt(P.totals.runs), per: fmt(per) });

    // The notes at the bottom.
    const K = C.colophon;
    const starts = runs.map(startMs), ends = runs.map((r) => startMs(r) + r.duration_s * 1000);
    const alias = (() => {
      for (const r of runs) for (const c of T(r).calls) for (const o of c.output) {
        if (o.kind === "tool" && o.input && o.input.file_path) return o.input.file_path.replace(/\/[^/]+$/, "");
      }
      return "";
    })();
    const fixtureRun = runs.flatMap((r) => beforeResults(r)).find((k) => k.pass !== null);
    const testsN = uniq(runs.map((r) => r.fix.tests));
    const missCmd = missingRuns.length ? missingRuns[0].unavailable[0].command : "";
    const v = {
      date: list(uniq(runs.map((r) => r.date)).map(dateOf)),
      t0: hhmm(Math.min(...starts)), t1: hhmm(Math.max(...ends)),
      ccv: esc(uniq(runs.map((r) => r.claude_code_version)).join(", ")),
      opus: esc(modelId(M0)), haiku: esc(modelId(M1)),
      mode: esc(uniq(runs.map((r) => r.permission_mode)).join(", ")),
      combos: fmt(P.combinations.length),
      tests: fmt(testsN[0]), addedTests: fmt(of((r) => r.files_changed.some((f) => /\.test\.js$/.test(f)))),
      fixed: fmt(P.totals.fixed), runs: fmt(P.totals.runs),
      origPass: fixtureRun ? fmt(fixtureRun.pass) : "", origFail: fixtureRun ? fmt(fixtureRun.fail) : "", origFrom: !!fixtureRun,
      n: fmt(missingRuns.length), model: missingOf ? esc(C.play.value.model[missingOf]) : "", command: esc(missCmd),
      allSaid: missingRuns.every((r) => saysNoTest(T(r))),
      alias: esc(alias),
    };
    ["model", "flags", "order", "fixed", "tested", "missing", "cost", "paths", "traces"].forEach((k) => {
      const el = document.querySelector(`[data-col="${k}"]`);
      if (el) el.innerHTML = K[k](v);
    });
    if (!missingRuns.length) document.querySelector('[data-col="missing"]').hidden = true;
    if (!fixtureRun) console.warn("no test run before an edit had node's summary");
    // How the runs were started (RECORDING-08: the stream doesn't hold every flag). The switches in brackets.
    const alt = (a, b) => `<${a} | ${b}>`;
    const FLAGS = [
      `claude -p "${prompts[0]}"`,
      `--model ${alt(modelId(M0), modelId(M1))}`,
      `--output-format stream-json --verbose --restricted`,
      `--tools ${alt(`"${P.switches.bash[B0].tools.join(",")}"`, `"${P.switches.bash[B1].tools.join(",")}"`)}`,
      `--allowedTools ${alt(flagArgs(allowOn), flagArgs(P.switches.bash[B1].allowed_tools))}`,
      `--strict-mcp-config --setting-sources "" --permission-mode ${uniq(runs.map((r) => r.permission_mode))[0]}`,
      `[--append-system-prompt "${ruleText}"]`,
      `--session-id <id> --max-budget-usd 0.5`,
    ];
    $("flags").innerHTML = FLAGS.map((line) => esc(line)).join("\n");
    $("trace-links").innerHTML = P.combinations.map((c) => `<li>${esc(spoken(c.switches))}: ${c.runs.map((n) => {
      const r = G.RUNS[n];
      return r.site_js ? `<a href="${ROOT}data/${esc(n)}.js">${esc(K.link(fmt(r.run)))}</a>` : esc(K.link(fmt(r.run)));
    }).join(" · ")}</li>`).join("");
    // Links to the repo take its address from chapters.js once release.js has run; these came later.
    if (window.CHAPTERS) document.querySelectorAll("a[data-repo]").forEach((a) => { a.href = window.CHAPTERS.repo + (a.dataset.repo ? `/${a.dataset.repo}` : ""); });
  }, (e) => console.error(e));

  // ---------- motion ----------
  Mo.reveal([$("overview-wrap"), document.querySelector(".points"), document.querySelector(".stats")]);

  // Scroll boxes that scroll at the reader's width can be reached and scrolled by keyboard.
  U.watchScrollBoxes(".card pre, .ov-wrap, .embed-code");
})();
