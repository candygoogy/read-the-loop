// Simplified Chinese copy for the caching chapter (site/zh/cache/), loaded instead of copy.en.js. Same keys
// and the same arguments as the English file: chart labels, readouts, the experiment cards and the
// computed sentences in the prose. Numbers never appear here; app.js passes them in already formatted
// for zh-CN. What the agent wrote or saw (answers, model names, flags) stays in English, as recorded.
// Terms follow the shared zh glossary used by every Chinese page.
window.COPY = {
  locale: "zh-CN",

  legend: {
    cached: "从缓存读取",
    fresh: "本次调用新增",
    freshCost: "本次调用新增（写入缓存）",
    freshNoCache: "按正常输入价格读取",
    output: "模型写出的内容",
  },

  reads: {
    title: "每次调用读取了多少 token",
    axis: "token",
    pick: "调用",
    readout: (d) => `第 <b>${d.n}</b> 次调用读取了 <b>${d.ctx}</b> 个 token：${d.cached} 个从缓存读取（${d.pct}），${d.fresh} 个是新增的。`,
    label: (d) => `本次会话 ${d.calls} 次调用的柱状图。每根柱子是一次调用读取的内容，分成从缓存读取的 token 和新增的 token。用下方的滑块可以查看任意一次调用的数字，也可以展开费用图下方的表格。`,
  },

  costs: {
    title: "每次调用的费用，按公布的价格计算",
    axis: "美元",
    pick: "调用",
    mode: "显示哪种费用",
    with: "有缓存",
    without: "没有缓存",
    heroWith: "整个会话的费用，按有缓存计算",
    heroWithout: "同样的 token，全部按正常输入价格读取",
    readoutWith: (d) => `第 <b>${d.n}</b> 次调用：<b>${d.cost}</b>。从缓存读取 ${d.cached} 个 token 花了 ${d.cachedCost}，${d.fresh} 个新增 token 花了 ${d.freshCost}，写出的 ${d.out} 个 token 花了 ${d.outCost}。`,
    readoutWithout: (d) => `第 <b>${d.n}</b> 次调用：<b>${d.cost}</b>。按正常价格读取全部 ${d.ctx} 个 token 花了 ${d.inCost}，写出的 ${d.out} 个 token 花了 ${d.outCost}。`,
    label: (d) => `${d.calls} 次调用各自费用的柱状图，两种视图用同一个刻度。用上方的两个按钮在“有缓存”和“没有缓存”之间切换，用下方的滑块查看任意一次调用的数字。`,
    scaleNote: "两种视图用同一个刻度。",
  },

  table: {
    summary: "用表格查看每次调用",
    caption: "token 数来自录制记录，费用按公布的价格计算。",
    cols: ["调用", "从缓存读取", "新增", "模型写出", "有缓存的费用", "没有缓存的费用"],
  },

  // The prose's computed sentences.
  prose: {
    prevNote: (d) => `每一次，从缓存读取的部分都等于上一次调用读取的全部内容减去 ${d.k} 个 token。`,
    prevNoteMixed: () => "",
    writeNote: (d) => `写入缓存比正常输入贵：这次会话用的那种写入每百万 token ${d.pW1}，正常输入是 ${d.pInput}。按这些价格，一份副本被读取 ${d.breakEven} 次就能回本。第 ${d.two} 次调用写入的内容，在之后的 ${d.after} 次调用里每次都被再读一遍。`,
    gapLonger: (d) => `这段间隔超过了 ${d.ttlShort} 分钟。`,
    gapShorter: () => "",
    spikeList: (list) => list,
    spikeItem: (d) => `${d.title}（${d.model}，UTC ${d.time}）`,
    traceRun: "本次会话",
    traceCh1: (k) => `第一章的第 ${k} 次运行`,
    priceNote: (d) => `价格来源：Anthropic 的定价页面 <a href="${d.url}">${d.urlText}</a>，“${d.row}”这一行，核对于 ${d.checked}。每百万 token：输入 ${d.pInput}，缓存写入 ${d.pW5}（保留 ${d.ttlShort} 分钟）和 ${d.pW1}（保留一小时），缓存读取 ${d.pRead}，输出 ${d.pOutput}。除了录制下来的总费用，本页所有费用都是用这些价格和每次调用记录的用量算出来的。算出的总额 ${d.computed} 和录制的 ${d.recorded} 相差不到一美分。`,
    priceMismatch: (d) => `Anthropic 定价页面上的价格（${d.url}，核对于 ${d.checked}）算不出这次会话录制的费用，所以本页不显示计算出的费用。`,
  },

  // The experiments, in the order they ran.
  trials: {
    same: {
      title: "什么都不改",
      changed: () => "马上恢复对话，模型和设置都不变。",
      outcome: () => "几乎全部从缓存读取。",
    },
    sysprompt: {
      title: "多加一条指令",
      changed: (d) => `我们用 <code>${d.flag}</code> 在开场设定里加了一条指令。`,
      outcome: () => "仍然几乎全部从缓存读取。",
    },
    model: {
      title: "换一个模型",
      changed: (d) => `我们把模型换成了 <code>${d.model}</code>。`,
      outcome: (d) => `大部分是新的：${d.fresh} 个 token 重新写入。它找到的那 ${d.cached} 个从哪里来，录制记录看不出来。`,
    },
    back: {
      title: "换回第一个模型",
      changed: (d) => `我们又换回了 <code>${d.model}</code>。`,
      outcome: (d) => `又从缓存读取了：${d.cached} 个 token，几乎是这个模型上一次调用读取的 ${d.before} 个的全部。`,
    },
    meta: (d) => `${d.model} · UTC ${d.time}`,
    numbers: (d) => `<b>${d.cached}</b> 从缓存读取 · <b>${d.fresh}</b> 新增`,
    answer: "模型的回答",
  },
};
