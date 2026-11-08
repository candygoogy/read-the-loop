// English copy for chapter 3: chart labels, readouts, the experiment cards and the computed
// sentences in the prose. Numbers never appear here. Each function gets values app.js read from the
// recordings (window.TRACES) or computed from the published prices (PRICES in app.js), already
// formatted. A translated page loads its own copy file instead of this one.
window.COPY = {
  locale: "en-US",

  legend: {
    cached: "read from the cache",
    fresh: "new on this call",
    freshCost: "new on this call (written to the cache)",
    freshNoCache: "read at the normal input price",
    output: "what the model wrote",
  },

  reads: {
    title: "What each call read, in tokens",
    axis: "tokens",
    pick: "Call",
    readout: (d) => `Call <b>${d.n}</b> read <b>${d.ctx}</b> tokens: ${d.cached} from the cache (${d.pct}) and ${d.fresh} new.`,
    label: (d) => `Bar chart of the ${d.calls} calls of the session. Each bar is what one call read, split into tokens read from the cache and new tokens. Use the slider below to read any call's numbers, or open the table under the cost chart.`,
  },

  costs: {
    title: "What each call cost, computed from the published prices",
    axis: "US dollars",
    pick: "Call",
    mode: "Which cost to show",
    with: "With the cache",
    without: "Without a cache",
    heroWith: "the whole session, computed with the cache",
    heroWithout: "the same tokens, all read at the normal input price",
    readoutWith: (d) => `Call <b>${d.n}</b>: <b>${d.cost}</b>. ${d.cachedCost} for ${d.cached} tokens from the cache, ${d.freshCost} for ${d.fresh} new ones, ${d.outCost} for the ${d.out} tokens it wrote.`,
    readoutWithout: (d) => `Call <b>${d.n}</b>: <b>${d.cost}</b>. ${d.inCost} to read all ${d.ctx} tokens at the normal price, ${d.outCost} for the ${d.out} tokens it wrote.`,
    label: (d) => `Bar chart of what each of the ${d.calls} calls cost, on one scale for both views. Use the two buttons above to switch between the cost with the cache and without one, and the slider below to read any call's numbers.`,
    scaleNote: "Both views share one scale.",
  },

  table: {
    summary: "Every call as a table",
    caption: "Tokens are from the recording. Costs are computed from the published prices.",
    cols: ["Call", "Read from the cache", "New", "The model wrote", "Cost with the cache", "Cost without one"],
  },

  // The prose's computed sentences.
  prose: {
    prevNote: (d) => `On every one, the part read from the cache was the previous call's whole reading minus ${d.k} tokens.`,
    prevNoteMixed: () => "",
    writeNote: (d) => `A write costs more than normal input: ${d.pW1} per million tokens for this session's kind, against ${d.pInput}. At these prices it pays off once the copy has been read ${d.breakEven} times. What call ${d.two} wrote was read again on each of the ${d.after} calls after it.`,
    gapLonger: (d) => `That gap was longer than ${d.ttlShort} minutes.`,
    gapShorter: () => "",
    spikeList: (list) => list,
    spikeItem: (d) => `${d.title.toLowerCase()} (${d.model}, ${d.time} UTC)`,
    traceRun: "the session",
    traceCh1: (k) => `chapter 1 run ${k}`,
    priceNote: (d) => `Prices: Anthropic's pricing page, <a href="${d.url}">${d.urlText}</a>, row ${d.row}, checked on ${d.checked}. Per million tokens: input ${d.pInput}, cache writes ${d.pW5} (${d.ttlShort} minutes) and ${d.pW1} (an hour), cache reads ${d.pRead}, output ${d.pOutput}. Every cost on this page except the recorded total is computed from these prices and the usage recorded on each call. The computed total, ${d.computed}, matches the recorded ${d.recorded} to within a cent.`,
    priceMismatch: (d) => `The prices on Anthropic's pricing page (${d.url}, checked on ${d.checked}) don't reproduce this session's recorded cost, so this page shows no computed costs.`,
  },

  // The experiments, in the order they ran.
  trials: {
    same: {
      title: "Nothing changed",
      changed: () => "Resumed straight away, with the same model and the same settings.",
      outcome: () => "Nearly all of it came from the cache.",
    },
    sysprompt: {
      title: "An extra instruction",
      changed: (d) => `With <code>${d.flag}</code> we added an instruction to the set-up.`,
      outcome: () => "Still nearly all from the cache.",
    },
    model: {
      title: "A different model",
      changed: (d) => `We switched the model to <code>${d.model}</code>.`,
      outcome: (d) => `Mostly new: ${d.fresh} tokens written again. The recording doesn't show where the ${d.cached} it did find came from.`,
    },
    back: {
      title: "Back to the first model",
      changed: (d) => `We switched back to <code>${d.model}</code>.`,
      outcome: (d) => `From the cache again: ${d.cached} tokens, nearly all of the ${d.before} the last call on this model read.`,
    },
    meta: (d) => `${d.model} · ${d.time} UTC`,
    numbers: (d) => `<b>${d.cached}</b> read from the cache · <b>${d.fresh}</b> new`,
    answer: "The model answered",
  },
};
