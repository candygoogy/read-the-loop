// 第六章的中文文案：旁白、所有标签，以及带数值的句子。这里不出现任何录制数字。每个函数拿到 `d`，即
// app.js 从录制记录（window.TRACES）读出、已按 zh-CN 格式化并转义的数值。智能体和 Claude Code 写的、
// 看到的内容（提示、任务、报告、交回的结果、命令、文件名、启动参数）保持英文原文，由 app.js 从录制记录填入。
// The Chinese copy for chapter 6, loaded instead of ../../subagents/copy.en.js. Same keys, same arguments.
window.COPY = {
  locale: "zh-CN",

  intro: {
    p1: () => `第一章里，一个智能体修好了一个小游戏里的 bug：球有时会直接穿过球拍。每一次调用都进了同一段和模型的对话，游戏的代码也是智能体自己读的。第二章把这段对话当作<strong>上下文（context）</strong>来测量：模型在一次调用中读到的全部内容，以 <strong>token</strong>（词元，一个词或词的一部分）计数。`,
    p2: () => `下面还是这个 bug，只改了一处。这一次，智能体把一部分工作交给了一个<strong>子智能体（subagent）</strong>：和模型的第二段对话，由智能体自己开启。子智能体从一个属于它自己的全新上下文开始，完成一项旁支任务，然后交回一份报告。主对话拿不到子智能体的那些步骤，只拿到一行列出子智能体用过哪些工具的文字，以及那份报告。`,
    promptHead: "我们输入的话",
    p3: (d) => `${d.samePrompt ? "开头和第一章的提示一字不差。" : ""}最后一句是我们加的：<strong>是提示要求用子智能体的</strong>，并不是智能体自己决定要用。文末的说明讲了我们不提这个要求时发生了什么。`,
    p4: (d) => `智能体开启子智能体的方式，和它做其他所有事情一样：请求一个工具（第五章讲的就是工具）。这个工具叫 <code>${d.agentTool}</code>。请求里有主模型用自己的话写的任务、一个简短的标题（“${d.desc}”），以及子智能体的种类，这里是 <code>${d.subType}</code>。<strong>外壳程序（harness）</strong>是包在模型外面的那个程序，这里就是 Claude Code。它运行子智能体的各次调用，然后把子智能体的报告贴进主对话，作为那个请求的结果。`,
  },

  threads: {
    p1: () => `下面是整次运行，一次调用一行。每根条形是对模型的一次调用，画的是模型在这次调用中读到的全部内容。左边是主对话，右边是子智能体的对话，时间从上往下走。两栏用的是同一比例。`,
    title: "每次调用读了什么（同一比例）",
    mode: "条形的颜色表示",
    modes: { kind: "内容的种类", cache: "缓存" },
    lanes: { main: "主对话", sub: "子智能体" },
    call: (n, tokens) => `第 ${n} 次调用 · ${tokens} 个 token`,
    wrote: (n) => `+ 写出 ${n} 个：报告`,
    send: (d) => `请求发出，附带一个 ${d.promptChars} 个字符的任务`,
    back: (d) => `报告交回：${d.handbackChars} 个字符，外面包着 Claude Code 的说明`,
    waiting: "等待中",
    handbackMark: "交回的内容",
    // 一次调用请求了什么，根据它的请求。
    did: {
      agent: "开启一个子智能体",
      read: (file) => `读取 ${file}`,
      readRange: (file, a, b) => `读取 ${file} 的<span class="nw">第 ${a}–${b} 行</span>`,
      edit: (file) => `修改 ${file}`,
      grep: "搜索代码",
      glob: "按文件名查找文件",
      find: "列出文件",
      tests: "运行测试",
      bash: "运行一条命令",
      answer: "写下它的回答",
      report: "写下它的报告",
      join: "；",
    },
    legend: {
      sys: "开场设定：第一次调用读到的全部内容",
      model: "模型写的内容",
      back: "贴回的结果",
      cached: "从缓存读取",
      fresh: "本次调用新增",
      out: "本次调用写出",
    },
    note: (d) => `两栏用同一比例：一整栏是 ${d.scaleMax} 个 token。按种类着色时和第二章一样：每一步里模型的部分，是 API 报告的上一次调用写出的量，其余是贴回的结果。`,
    readout: (d) => `子智能体的对话达到了 <b>${d.subPeak}</b> 个 token。报告交回前后，主对话增长了 <b>${d.growth}</b> 个。`,
    // 各行的文字替代。
    srCall: (lane, n, tokens, did) => `${lane}，第 ${n} 次调用：读了 ${tokens} 个 token，然后${did}。`,
    srSplit: (setup, model, back) => `其中 ${setup} 个是开场设定，${model} 个是模型写的内容，${back} 个是贴回的结果。`,
    srCache: (cached, fresh) => `${cached} 个从缓存读取，${fresh} 个是新增的。`,
    srWrote: (n) => `它写出了 ${n} 个 token：报告。`,
    p2: (d) => `子智能体的第一次调用读了 ${d.sub1} 个 token，而主对话的第一次调用是 ${d.main1} 个。这是它的开场设定。Claude Code 自己的会话文件（我们不公开）显示了里面装着什么：子智能体自己的一份指令和一份工具说明，再加上任务。本页依据的记录流（stream）里没有这些文字，所以本页只显示它的大小。`,
    p3: (d) => `子智能体工作的时候，主对话一直在等：在录制记录里，从 ${d.sendAt} 到 ${d.backAt}，主对话没有任何调用，这段时间占了整次运行 ${d.runDur} 秒中的 ${d.subDur} 秒。子智能体一共调用了 ${d.subCalls} 次模型，过程中用到了 ${d.subTools}。`,
    p4: (d) => `它的最后一次调用读了 ${d.subLast} 个 token，又写出了 ${d.subOut} 个，就是那份报告。Claude Code 把子智能体的整段对话计为 ${d.subPeak} 个 token。这么多内容里，主对话拿到的只有报告和一段简短的说明。主对话的第二次调用比第一次大了 ${d.growth} 个 token，这里面还包括它自己请求子智能体的那部分（${d.main1Out} 个 token）。`,
  },

  words: {
    p1: () => `下面是主模型写的任务，以及子智能体交回的报告，都是录制下来的原文。`,
    request: "请求",
    inputs: "其他输入",
    task: "任务",
    p2: (d) => `任务没有引用你写的那句话。它要的是文件路径、行号和代码本身。${d.guess ? `它还带着主模型自己的一个猜测：“${d.guess}”。隧穿（tunneling）是指一个快速运动的球在一帧之内走得太远，直接越过了球拍。` : ""}${d.lastAsk ? `它的结尾是：“${d.lastAsk}”` : ""}`,
    report: "报告 · 来自子智能体",
    chars: (n) => `${n} 个字符`,
    more: "显示完整报告",
    less: "收起",
    hiddenNote: (n) => `还有 ${n} 个字符`,
    p3: (d) => `报告指出了 bug：“${d.cause}”${d.noTests ? `它还说：“${d.noTests}”` : ""}`,
    p4: () => `主模型拿到的并不只是那份报告。Claude Code 把它作为那个请求的结果贴了回来，加上一行列出子智能体用过的工具，还有一段它自己的说明，并且报告的每一行都缩进了两个空格。开头是这样的：`,
    result: "结果",
    resultMeta: "主模型拿回的内容",
    moreLines: { other: (n) => `… 报告还有 ${n} 行 …` },
    p5: () => `这段说明告诉主模型该怎么看待这份报告：那是子智能体的话，不带有你的任何授权。录制记录显示了这段说明，但看不出它起了多大作用。`,
  },

  cost: {
    title: "花了多少",
    p1: (d) => `一次运行按 token 付费：每次调用读了多少，又写了多少。这次运行一共调用了 ${d.calls} 次模型，主对话 ${d.mainCalls} 次，子智能体 ${d.subCalls} 次。Claude Code 的记录把 token 分到了这两段对话上：`,
    caption: "token，按对话划分",
    cols: ["", "主对话", "子智能体"],
    rows: { out: "模型写出", read: "从缓存读取", write: "写入缓存" },
    p2: (d) => `${d.mostCached ? "每次调用读到的内容，大部分来自" : "这些调用读到的内容，很多来自"}<strong>缓存（cache）</strong>：模型提供方存下的一份最近见过的文本副本，再读一次会更便宜（第三章）。把上面的图切换到“缓存”，就能一次调用一次调用地看。从第二次调用起，每段对话都从缓存里读回了自己上一次调用的内容。连第一次调用也从缓存读取了：主对话的 ${d.main1} 个 token 里有 ${d.main1Cached} 个，子智能体的 ${d.sub1} 个里有 ${d.sub1Cached} 个。这次运行里没有比它们更早的调用，所以那份副本是更早的会话留下的，最有可能是这次录制的第 1 次运行，它大约在 ${d.gap} 秒前结束。在第 1 次运行里，子智能体的第一次调用从缓存读取了 ${d.r1Sub1Cached} 个 token。`,
    p3: (d) => `两段对话要求的缓存保留时间也不一样。主对话的每一次缓存写入都标记为保留一小时（一共 ${d.main1h} 个 token），子智能体的每一次写入都标记为保留五分钟（${d.sub5m} 个）。`,
    p4: (d) => `整次运行花了 <strong>${d.cost}</strong>。Claude Code 只记录整次运行的费用，所以本页不把它分到两段对话上。`,
  },

  shows: {
    title: "这次运行说明了什么",
    small: {
      title: "主对话一直很小",
      text: (d) => `子智能体读了整个 <code>${d.file}</code>，还搜索了其他文件。主对话拿到了 ${d.reportChars} 个字符的报告，增长了 ${d.growth} 个 token。这正是子智能体的用处：为一项旁支任务做的阅读和搜索，都留在一个单独的上下文里。主对话之后的每次调用都要把它重读一遍，而它拿到的只有那份报告。`,
    },
    trust: {
      title: "没有人看到测试失败",
      readRange: (a, b, file) => `<code>${file}</code> 的第 ${a}–${b} 行`,
      readWhole: (file) => `整个 <code>${file}</code>`,
      text: (d) => `修复之前，主对话自己读了 ${d.mainRead}。它只在修复之后运行了测试，那时测试都通过了（${d.tests} 个中通过 ${d.pass} 个），子智能体也没有运行过测试。所以在这次运行里，改动之前没有任何人看到那个失败的测试${d.allRuns ? `，全部 ${d.runs} 次运行都是这样` : ""}。这一次报告是对的。录制记录看不出报告错了会怎样。`,
    },
    tiny: {
      title: "游戏这么小，省下的几乎看不出来",
      text: (d) => `第一章对同一个 bug 的那次运行没有用子智能体。从第一次调用到最后一次，它的对话增长了 ${d.ch1Growth} 个 token；这里的主对话增长了 ${d.mainGrowth} 个。但这次运行的第一次调用多了 ${d.startDiff} 个 token（${d.main1} 对 ${d.ch1First}），所以两者最后${d.near ? "相差不大" : "拉开了差距"}：这里是 ${d.mainLast} 个 token，第一章是 ${d.ch1Last} 个。这次运行的工具列表多了一项 <code>${d.extraTools}</code>，提示多了一句话，两次运行用的 Claude Code 版本也不同（${d.ccv} 和 ${d.ch1ccv}）。录制记录没有说明这几项各自增加了多少。这次运行还调用了 ${d.calls} 次模型，第一章是 ${d.ch1Calls} 次；花费是 ${d.cost}，第一章是 ${d.ch1Cost}。`,
    },
  },

  stats: {
    peak: "个 token，子智能体的对话",
    growth: "个 token，报告交回前后主对话的增长",
    calls: "次模型调用，主对话 + 子智能体",
    cost: "整次运行的费用",
    callsValue: (main, sub) => `${main} + ${sub}`,
  },

  next: {
    kicker: "下一章",
    title: "第七章：失败模式",
    p1: (d) => `${d.allPassed ? "本章的每一次运行最后都通过了测试。" : ""}智能体并不总能做到这一点。第七章讲的是它们出错的各种方式，以及每一种从循环内部看是什么样子。`,
  },

  colophon: {
    title: "关于录制",
    model: (d) => `录制于 ${d.date}，${d.time}（UTC）开始，模型 <code>${d.model}</code>，Claude Code <code>${d.ccv}</code>。每次运行都从第一章那个有 bug 的游戏的一份全新副本开始，启动命令是：`,
    flags: (d) => `<code>--tools</code> 和 <code>--allowedTools</code> 在第一章的列表上加了 <code>${d.extraTools}</code>。<code>--forward-subagent-text</code> 让 Claude Code 把子智能体自己写的文字也放进它的记录流；不加这个选项，写报告的那次调用就不在记录流里。会话开始时，Claude Code 的工具列表把同一个工具叫作 <code>${d.aliasName}</code>。`,
    runs: (d) => `我们一共录了 ${d.runs} 次运行，一次紧接着一次。规则在第一次运行之前就定好了：展示第 2 次运行，除非它没有用子智能体、没有修好 bug（或者它的录制记录生成失败）；那样的话，就展示编号最小的、通过了的那次。${d.shownLine}`,
    shown: (k) => `第 ${k} 次运行通过了，所以本页展示的就是它。`,
    runLine: (r) => `第 ${r.k} 次运行：主对话 ${r.main} 次调用，子智能体 ${r.sub} 次调用，${r.secs} 秒，${r.cost}。子智能体的对话达到了 ${r.peak} 个 token；报告交回前后，主对话增长了 ${r.growth} 个。修复后的测试：${r.tests} 个中通过 ${r.pass} 个。`,
    runShown: "本页展示的就是这一次。",
    cache: (d) => `这几次运行是紧接着进行的，相邻两次之间相隔约 ${d.gaps} 秒，所以第 2 次和第 3 次运行的第一次调用，可以从缓存读取上一次运行留下的内容。第 1 次运行的第一次主对话调用也从缓存读取了 ${d.r1Main1Cached} 个 token；记录流没有说明这些是哪次更早的会话留下的。`,
    black: () => `录这几次运行之前，我们给智能体布置过第二章的任务，也就是 black 里的那个 bug，工具列表里有 Agent 工具，但一个字也没提子智能体。直到我们把它停下，它都没有开启子智能体。那次运行没有保存为录制记录，所以不在本页上；本页的子智能体是我们要求它用的。`,
    setup: () => `子智能体的开场设定文字和工具列表不在记录流里，所以本页只给出它第一次调用的大小。Claude Code 的会话文件里有这些内容，但也有账号 ID 和真实的文件夹路径，所以我们不公开这些文件。`,
    paths: (d) => `模型看到的是真实的文件夹路径。本页把它显示为 <code>${d.alias}</code>${d.quoted ? `，所以有些命令里写的是带引号的 <code>"${d.alias}"</code>（真正的 shell 不会在引号里展开 <code>~</code>），` : "，"}这也是这里的任务文字比模型写的原文短的原因。`,
    traces: "录制记录：",
    link: (k) => `第 ${k} 次运行`,
    json: "同样的数据也以 JSON 格式放在仓库的 <code>data/</code> 文件夹里。",
  },
};
