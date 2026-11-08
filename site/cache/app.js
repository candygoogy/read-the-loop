// Chapter 3 page. Every token count and every word the agent wrote comes from the recordings in
// window.TRACES: `run` is recording 03 (site/data/trace-03.js), `ch1a`/`ch1b` are chapter 1's runs 1
// and 2, the others are our small cache experiments (site/data/trace-spike-*.js). The narration and
// all labels come from window.COPY (copy.en.js); formatting and escaping from window.TraceUI.
// The one outside fact is PRICES, below. Every cost on the page except the recorded total is
// computed from it, and only after it reproduces the recorded total.
(() => {
  "use strict";

  // Published prices for claude-opus-5-5, in US dollars per million tokens.
  // Source: Anthropic's pricing page, https://platform.claude.com/docs/en/about-claude/pricing,
  // row "Claude Opus 5.5" (columns: base input, 5m cache writes, 1h cache writes, cache hits and
  // refreshes, output). Checked on 2026-11-08. The two cache lifetimes are the columns' names.
  const PRICES = {
    url: "https://platform.claude.com/docs/en/about-claude/pricing",
    model: "claude-opus-5-5",
    row: "Claude Opus 5.5",
    checked: "2026-11-08",
    input: 4,
    write5m: 5,
    write1h: 8,
    cacheRead: 0.2,
    output: 20,
    minutes5m: 5,
  };

  // What we changed in the experiment that added an instruction (from our recording notes; the
  // stream doesn't record the flags it was started with).
  const SYS_FLAG = '--append-system-prompt "Always answer in lower case."';

  const R = window.TRACES;
  const T = R.run;
  const C = window.COPY;
  const U = window.TraceUI;
  const Mo = window.Motion;
  const { esc, list } = { esc: U.esc, list: U.numbers(C.locale).list };
  const { fmt } = U.numbers(C.locale);
  const $ = (id) => document.getElementById(id);
  const calls = T.calls;
  const N = calls.length;

  // ---------- formatting ----------
  const money = (x, digits) => new Intl.NumberFormat(C.locale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
  const perM = (x) => money(x, Number.isInteger(x) ? 0 : 2);
  const pct = (x, digits = 0) => new Intl.NumberFormat(C.locale, { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(x);
  const compact = (x) => new Intl.NumberFormat(C.locale, { notation: "compact", maximumFractionDigits: 1 }).format(x);
  const dateOf = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString(C.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const timeOf = (iso) => new Date(iso).toISOString().slice(11, 19);
  const plain = (html) => html.replace(/<[^>]+>/g, "");

  // ---------- the session, per call ----------
  const ctx = calls.map((c) => c.context_tokens);
  const cached = calls.map((c) => c.cached_tokens);
  const fresh = calls.map((c) => c.new_tokens);
  const out = calls.map((c) => c.output_tokens || 0);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const sumRead = sum(ctx);

  // Cost of one call at the published prices, split the way the chart stacks it.
  const M = 1e6;
  function costWith(c) {
    const cachedCost = c.cached_tokens * PRICES.cacheRead / M;
    const freshCost = (c.input_tokens * PRICES.input + c.cache_write_1h * PRICES.write1h + c.cache_write_5m * PRICES.write5m) / M;
    const outCost = (c.output_tokens || 0) * PRICES.output / M;
    return { cached: cachedCost, fresh: freshCost, out: outCost, total: cachedCost + freshCost + outCost };
  }
  function costWithout(c) {
    const inCost = c.context_tokens * PRICES.input / M;
    const outCost = (c.output_tokens || 0) * PRICES.output / M;
    return { cached: 0, fresh: inCost, out: outCost, total: inCost + outCost };
  }
  const cw = calls.map(costWith);
  const cwo = calls.map(costWithout);
  const computed = sum(cw.map((x) => x.total));
  const noCache = sum(cwo.map((x) => x.total));
  // Computed costs are shown only if the prices are for this model and reproduce the recorded total.
  const verified = T.model === PRICES.model && Math.abs(computed - T.totals.cost_usd) < 0.01;

  // Each call read the previous call's whole reading from the cache, less k tokens (if k is the same every time).
  const lag = calls.slice(1).map((c, i) => ctx[i] - c.cached_tokens);
  const k = lag.every((x) => x === lag[0]) ? lag[0] : null;
  const later = fresh.slice(1);

  // A copy written for an hour pays off after this many reads (against reading the same tokens at the input price each time).
  let breakEven = 1;
  while (PRICES.write1h + breakEven * PRICES.cacheRead >= (breakEven + 1) * PRICES.input && breakEven < 100) breakEven++;

  // Chapter 1: run 1's first call, and run 2's start against run 1's end.
  const endOf = (r) => Date.parse(r.started_at) + Math.max(...r.calls.flatMap((c) => c.output.flatMap((o) => [o.t_ms, o.result ? o.result.t_ms : 0])));
  const gapMin = (Date.parse(R.ch1b.started_at) - endOf(R.ch1a)) / 60000;

  // The experiments, in the order they ran.
  const TRIALS = ["same", "sysprompt", "model", "back"].map((key) => ({ key, t: R[key], c: R[key].calls[0] }));
  const firstModel = R.same.model;
  const prevSame = (i) => TRIALS.slice(0, i).reverse().find((x) => x.t.model === TRIALS[i].t.model);

  const d = {
    issueTitle: esc((T.prompt.match(/^# (.+)$/m) || [])[1] || ""),
    calls: fmt(N), duration: String(T.totals.duration_s), date: dateOf(T.recorded), model: esc(T.model), ccv: esc(T.claude_code_version),
    first: fmt(ctx[0]), last: fmt(ctx[N - 1]), sumRead: fmt(sumRead),
    prevNote: k !== null ? C.prose.prevNote({ k: fmt(k) }) : C.prose.prevNoteMixed(),
    minNew: fmt(Math.min(...later)), maxNew: fmt(Math.max(...later)),
    pctCached: pct(T.totals.cache_read_tokens / sumRead, 1),
    c1cached: fmt(cached[0]),
    pInput: perM(PRICES.input), pRead: perM(PRICES.cacheRead), pOutput: perM(PRICES.output), pW5: perM(PRICES.write5m), pW1: perM(PRICES.write1h),
    readPct: pct(PRICES.cacheRead / PRICES.input),
    recorded: "$" + T.totals.cost_usd, computed: money(computed, 5),
    nocache: money(noCache, 2), times: (noCache / computed).toFixed(1),
    outTok: fmt(sum(out)), outPct: pct(sum(cw.map((x) => x.out)) / computed),
    ttlShort: fmt(PRICES.minutes5m),
    w1total: fmt(sum(calls.map((c) => c.cache_write_1h))), w5total: fmt(sum(calls.map((c) => c.cache_write_5m))),
    r1: fmt(R.ch1a.run.index), r2: fmt(R.ch1b.run.index),
    r1cached: fmt(R.ch1a.calls[0].cached_tokens), r1new: fmt(R.ch1a.calls[0].new_tokens),
    r2cached: fmt(R.ch1b.calls[0].cached_tokens), r2ctx: fmt(R.ch1b.calls[0].context_tokens),
    gapMin: fmt(Math.round(gapMin)),
    spikeDate: dateOf(R.same.recorded), spikeModel: `<code>${esc(firstModel)}</code>`,
    otherModel: `<code>${esc(R.model.model)}</code>`,
    cacheTotal: fmt(T.totals.cache_read_tokens), writeTotal: fmt(T.totals.cache_write_tokens),
    pre: fmt(T.compaction.pre_tokens), post: fmt(T.compaction.post_tokens),
    source: esc(T.source), tools: esc(T.tools_available.join(", ")),
    alias: esc((JSON.stringify(T.calls).match(/~\/[\w.-]+/) || [""])[0]),
    sysFlag: esc(SYS_FLAG), modelFlag: esc(`--model ${R.model.model}`),
  };
  d.writeNote = C.prose.writeNote({ pW1: d.pW1, pInput: d.pInput, breakEven: fmt(breakEven), two: fmt(2), after: fmt(N - 2) });
  d.gapNote = gapMin > PRICES.minutes5m ? C.prose.gapLonger(d) : C.prose.gapShorter(d);
  d.spikeList = C.prose.spikeList(list(TRIALS.map((x) => esc(C.prose.spikeItem({ title: C.trials[x.key].title, model: x.t.model, time: timeOf(x.t.started_at) })))));

  // ---------- a column chart, one column per call ----------
  // segs(i) gives the stacked parts of column i, bottom first: [{ key, v }]. Heights are on a fixed
  // scale `top`, so redrawing the same chart with other values keeps the scale.
  function niceTicks(max) {
    const raw = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { top, ticks };
  }

  function columnChart(host, o) {
    const id = host.id;
    const { top, ticks } = niceTicks(o.max);
    host.innerHTML =
      `<div class="viz-plot" role="img" aria-label="${esc(o.label)}">` +
        `<div class="viz-grid" aria-hidden="true">${ticks.map((v) => `<div class="tick" style="bottom:${(v / top) * 100}%"><span>${esc(o.tick(v))}</span></div>`).join("")}</div>` +
        `<div class="viz-cols" aria-hidden="true"><i class="sel-band"></i>${calls.map((_, i) => `<div class="col" data-i="${i}">${o.keys.map((k) => `<i class="seg s-${k}"></i>`).join("")}</div>`).join("")}</div>` +
      `</div>` +
      `<div class="viz-x" aria-hidden="true">${calls.map((_, i) => (i === 0 || i === N - 1 || ((i + 1) % 10 === 0 && N - (i + 1) >= 5))
        ? `<span style="--x:${(i + 0.5) / N}">${fmt(i + 1)}</span>` : "").join("")}</div>` +
      `<div class="viz-pick">` +
        `<label for="${id}-pick">${esc(o.pickLabel)}</label>` +
        `<input type="range" id="${id}-pick" class="pick" min="1" max="${N}" step="1" value="${o.start + 1}">` +
        `<p class="viz-readout" id="${id}-readout"></p>` +
      `</div>`;
    const cols = [...host.querySelectorAll(".col")];
    const band = host.querySelector(".sel-band");
    const pick = host.querySelector(".pick");
    let segs = o.segs;
    let cur = o.start;

    // Each part's place, from the values. With `animate`, every part then moves from where it was on
    // screen (its rect, even mid-way through a move) to its new place, with a transform only: FLIP.
    // A part that goes to zero shrinks into its new base first, then takes its zero place.
    function draw(animate) {
      const moving = animate && !Mo.reduced();
      const plotBox = moving ? cols[0].getBoundingClientRect() : null;
      const before = moving ? cols.map((col) => [...col.children].map((el) => el.getBoundingClientRect())) : null;
      const H = moving ? plotBox.height : 0;
      cols.forEach((col, i) => {
        let base = 0;
        const parts = segs(i);
        const last = parts.map((p) => p.v > 0).lastIndexOf(true);
        parts.forEach((p, j) => {
          const el = col.children[j];
          Mo.stop(el, "flip");
          el.style.bottom = `${(base / top) * 100}%`;
          el.style.height = `${(p.v / top) * 100}%`;
          el.dataset.base = String((base / top) * H);
          el.classList.toggle("zero", !(p.v > 0));
          el.classList.toggle("top", j === last);
          base += p.v;
        });
      });
      if (!moving) return;
      const opts = { duration: Mo.dur.slow, easing: Mo.ease.inOut, key: "flip" };
      cols.forEach((col, i) => [...col.children].forEach((el, j) => {
        const b = before[i][j];
        const fromBottom = plotBox.bottom - b.bottom;
        if (el.classList.contains("zero")) {
          if (b.height < 0.5) return;
          // Hold its old place for the move, shrinking into where its base is now.
          el.classList.remove("zero");
          el.style.bottom = `${(fromBottom / H) * 100}%`;
          el.style.height = `${(b.height / H) * 100}%`;
          const a = Mo.play(el, [{ transform: "none" }, { transform: `translateY(${fromBottom - +el.dataset.base}px) scaleY(0)` }], { ...opts, fill: "forwards" });
          const end = () => { el.style.bottom = `${(+el.dataset.base / H) * 100}%`; el.style.height = "0%"; el.classList.add("zero"); };
          if (!a) return end();
          a.finished.then(() => { end(); a.cancel(); }, () => {});
          return;
        }
        const a = el.getBoundingClientRect();
        if (a.height < 0.5) return;
        const dy = b.bottom - a.bottom;
        const sy = b.height / a.height;
        if (Math.abs(dy) < 0.5 && Math.abs(sy - 1) < 0.01) return;
        Mo.play(el, [{ transform: `translateY(${dy}px) scaleY(${Math.max(sy, 0.001)})` }, { transform: "none" }], opts);
      }));
    }
    // The band behind the picked column glides to it; its size follows the columns.
    function placeBand() {
      const c = cols[cur];
      band.style.width = `${c.offsetWidth + 2}px`;
      band.style.transform = `translateX(${c.offsetLeft - 1}px)`;
    }
    function select(i) {
      cur = Math.max(0, Math.min(N - 1, i));
      cols.forEach((c, j) => c.classList.toggle("sel", j === cur));
      placeBand();
      pick.value = String(cur + 1);
      const html = o.readout(cur);
      $(`${id}-readout`).innerHTML = html;
      pick.setAttribute("aria-valuetext", plain(html));
    }
    pick.addEventListener("input", () => select(+pick.value - 1));
    // Pointer: hover (mouse) or tap/drag (touch, pen) picks the column under it.
    const plot = host.querySelector(".viz-cols");
    const at = (e) => {
      const r = plot.getBoundingClientRect();
      return Math.floor(((e.clientX - r.left) / r.width) * N);
    };
    plot.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) select(at(e)); });
    plot.addEventListener("pointerdown", (e) => select(at(e)));
    draw(false);
    select(cur);
    // Glide only once the band has its first place, and not while the columns resize.
    requestAnimationFrame(() => band.classList.add("glide"));
    new ResizeObserver(() => { band.classList.remove("glide"); placeBand(); requestAnimationFrame(() => band.classList.add("glide")); }).observe(plot);
    return {
      redraw(newSegs, animate) { segs = newSegs; draw(animate); select(cur); },
    };
  }

  // ---------- legends ----------
  const legend = (items) => items.map(([k, label]) => `<span><i class="sw s-${k}" aria-hidden="true"></i>${esc(label)}</span>`).join("");

  // ---------- chart 1: what each call read ----------
  $("reads-title").textContent = C.reads.title;
  $("reads-legend").innerHTML = legend([["cached", C.legend.cached], ["fresh", C.legend.fresh]]);
  // Start on the call with the biggest new part: the one step the reader can see without the slider.
  const biggest = later.indexOf(Math.max(...later)) + 1;
  columnChart($("reads-body"), {
    max: Math.max(...ctx), keys: ["cached", "fresh"], start: biggest,
    tick: (v) => compact(v),
    label: C.reads.label({ calls: fmt(N) }),
    pickLabel: C.reads.pick,
    segs: (i) => [{ key: "cached", v: cached[i] }, { key: "fresh", v: fresh[i] }],
    readout: (i) => C.reads.readout({ n: fmt(i + 1), ctx: fmt(ctx[i]), cached: fmt(cached[i]), fresh: fmt(fresh[i]), pct: pct(cached[i] / ctx[i]) }),
  });

  // ---------- chart 2: what each call cost, with and without the cache ----------
  let mode = "with";
  if (verified) {
    $("costs-title").textContent = C.costs.title;
    const legendFor = (m) => legend(m === "with"
      ? [["cached", C.legend.cached], ["fresh", C.legend.freshCost], ["out", C.legend.output]]
      : [["fresh", C.legend.freshNoCache], ["out", C.legend.output]]);
    const fs = $("cost-mode");
    $("cost-mode-label").textContent = C.costs.mode;
    fs.insertAdjacentHTML("beforeend", ["with", "without"].map((m) =>
      `<label class="seg-opt"><input type="radio" name="cost-mode" value="${m}"${m === mode ? " checked" : ""}><span>${esc(C.costs[m])}</span></label>`).join(""));
    const segsFor = (m) => (i) => { const x = (m === "with" ? cw : cwo)[i]; return [{ key: "cached", v: x.cached }, { key: "fresh", v: x.fresh }, { key: "out", v: x.out }]; };
    const readoutFor = (i) => {
      const c = calls[i];
      if (mode === "with") {
        const x = cw[i];
        return C.costs.readoutWith({ n: fmt(i + 1), cost: money(x.total, 4), cachedCost: money(x.cached, 4), cached: fmt(c.cached_tokens), freshCost: money(x.fresh, 4), fresh: fmt(c.new_tokens), outCost: money(x.out, 4), out: fmt(c.output_tokens || 0) });
      }
      const x = cwo[i];
      return C.costs.readoutWithout({ n: fmt(i + 1), cost: money(x.total, 4), inCost: money(x.fresh, 4), ctx: fmt(c.context_tokens), outCost: money(x.out, 4), out: fmt(c.output_tokens || 0) });
    };
    const chart = columnChart($("costs-body"), {
      max: Math.max(...cwo.map((x) => x.total)), keys: ["cached", "fresh", "out"], start: N - 1,
      tick: (v) => money(v, 2),
      label: C.costs.label({ calls: fmt(N) }),
      pickLabel: C.costs.pick,
      segs: segsFor(mode),
      readout: readoutFor,
    });
    // The total rolls to its new value; screen readers hear only the end of it (Motion.count).
    let heroValue = null;
    function setMode(m, animate) {
      mode = m;
      const to = m === "with" ? computed : noCache;
      $("costs-legend").innerHTML = legendFor(m);
      if (animate) Mo.count($("hero-n"), to, { from: heroValue, format: (x) => money(x, 2), round: (x) => x, easing: Mo.ease.inOut });
      else $("hero-n").textContent = money(to, 2);
      heroValue = to;
      $("hero-l").textContent = m === "with" ? C.costs.heroWith : C.costs.heroWithout;
      if (animate) Mo.enter($("hero-l"), { y: 3, duration: Mo.dur.base });
      $("costs").dataset.mode = m;
      chart.redraw(segsFor(m), animate);
    }
    fs.addEventListener("change", (e) => setMode(e.target.value, true));
    setMode(mode, false);

    // The table: every call, tokens and both costs.
    $("table-summary").textContent = C.table.summary;
    $("table-note").textContent = C.table.caption;
    $("table").innerHTML =
      `<thead><tr>${C.table.cols.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${calls.map((c, i) => `<tr><th scope="row">${fmt(i + 1)}</th><td>${fmt(c.cached_tokens)}</td><td>${fmt(c.new_tokens)}</td><td>${fmt(c.output_tokens || 0)}</td><td>${money(cw[i].total, 4)}</td><td>${money(cwo[i].total, 4)}</td></tr>`).join("")}</tbody>`;
  } else {
    document.querySelectorAll('[data-needs="prices"]').forEach((el) => { el.hidden = true; });
  }

  // ---------- the experiments ----------
  const maxTrial = Math.max(...TRIALS.map((x) => x.c.context_tokens));
  $("trials").innerHTML = TRIALS.map((x, i) => {
    const copy = C.trials[x.key];
    const c = x.c;
    const before = prevSame(i);
    const v = { flag: esc(SYS_FLAG), model: esc(x.t.model), cached: fmt(c.cached_tokens), fresh: fmt(c.new_tokens), before: before ? fmt(before.c.context_tokens) : "" };
    const w = (n) => `${(n / maxTrial) * 100}%`;
    return `<article class="trial" data-k="${x.key}">` +
      `<h3>${esc(copy.title)}</h3>` +
      `<p class="trial-meta">${esc(C.trials.meta({ model: x.t.model, time: timeOf(x.t.started_at) }))}</p>` +
      `<p class="trial-changed">${copy.changed(v)}</p>` +
      `<div class="split" role="img" aria-label="${esc(plain(C.trials.numbers(v)))}">` +
        `<i class="s-cached" style="width:${w(c.cached_tokens)}"></i><i class="s-fresh" style="width:${w(c.new_tokens)}"></i>` +
      `</div>` +
      `<p class="trial-numbers">${C.trials.numbers(v)}</p>` +
      `<p class="trial-outcome">${copy.outcome(v)}</p>` +
      `<div class="trial-answer"><span>${esc(C.trials.answer)}</span>${U.md(x.t.final_answer)}</div>` +
    `</article>`;
  }).join("");

  // ---------- static values ----------
  document.querySelectorAll("[data-v]").forEach((el) => {
    const v = d[el.dataset.v];
    if (v !== undefined) el.innerHTML = v;
  });
  $("price-note").innerHTML = verified
    ? C.prose.priceNote({ url: esc(PRICES.url), urlText: esc(PRICES.url.replace(/^https:\/\//, "")), row: esc(PRICES.row), checked: dateOf(PRICES.checked), pInput: d.pInput, pW5: d.pW5, pW1: d.pW1, pRead: d.pRead, pOutput: d.pOutput, ttlShort: d.ttlShort, computed: d.computed, recorded: d.recorded })
    : C.prose.priceMismatch({ url: esc(PRICES.url), checked: dateOf(PRICES.checked) });

  const links = [
    ["../data/trace-03.js", C.prose.traceRun],
    ["../data/trace-02-run1.js", C.prose.traceCh1(fmt(R.ch1a.run.index))],
    ["../data/trace-02-run2.js", C.prose.traceCh1(fmt(R.ch1b.run.index))],
    ...TRIALS.map((x) => [`../data/trace-spike-a2-${x.key}.js`, C.trials[x.key].title.toLowerCase()]),
  ];
  $("trace-links").innerHTML = list(links.map(([href, t]) => `<a href="${href}">${esc(t)}</a>`));

  // ---------- motion ----------
  // Figures rise in as they come into view. The experiment cards' bars fill once, card by card, the
  // cached part and then the new part.
  Mo.reveal([...document.querySelectorAll(".viz")], (el) => {
    const cols = [...el.querySelectorAll(".col")];
    cols.forEach((col, i) => Mo.grow(col, { axis: "y", delay: 120 + (i / cols.length) * 300 }));
  });
  Mo.reveal([...document.querySelectorAll(".viz-table, .stats")]);
  Mo.reveal($("trials"), (el) => {
    el.querySelectorAll(".trial").forEach((card, i) => {
      const [c, f] = card.querySelectorAll(".split i");
      Mo.grow(c, { delay: 150 + i * 70 });
      Mo.grow(f, { delay: 150 + i * 70 + 160, duration: Mo.dur.slow });
    });
  });
})();
