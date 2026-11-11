// 第二章的中文文案：旁白和所有界面标签。这里不出现任何录制数字。每个函数拿到 `d`，即 app.js 从录制记录
// (window.TRACE) 读出并已按 zh-CN 格式化的数值；有些还拿到 `p`，即会话的一个阶段。智能体写的和看到的内容
// （issue、命令、输出、模型原话）保持英文原文，由 app.js 从录制记录填入。
// The Chinese copy for chapter 2, loaded instead of ../../context/copy.en.js. Same keys, same arguments.
window.COPY = {
  locale: "zh-CN",

  duration: (m, s) => `${m} 分 ${s} 秒`,
  durationLong: (m, s) => `${m} 分 ${s} 秒`,
  seconds: (s) => `${s} 秒`,
  tokens: (n) => `${n} 个 token`,
  plusTokens: (n) => `+${n} 个 token`,
  toolCount: (n, tool) => `${n} 次 ${tool}`,

  intro: {
    ch1: (d) => `第一章的智能体修一个小游戏，用了 ${d.ch1Calls} 次调用。这一次是真实的项目：<a href="${d.repoUrl}">black</a>，一个把 Python 代码统一改写成同一种风格的工具。black 是开源的：代码公开，任何人都可以阅读、修改，并提出修复。它的代码放在 GitHub 上，这是很多项目存放代码的网站；人们在那里报告 bug 的帖子叫作 issue。我们把 black 代码的一份副本和其中一个 issue 一字不改地交给了 Claude Code。issue 的标题是：`,
    showPrompt: "模型收到的完整提示",
    plain: () => `说白了：black 只应该改变代码的样子，绝不能改变代码的行为。可在这里它多加了一个逗号，这个逗号把一个小函数（<code>lambda</code>）变成了元组，也就是一组打包在一起的值。之后任何调用这个函数的代码都会崩溃。这个项目后来修复了这个 bug，我们交给智能体的代码取自那次修复之前。`,
    run: (d) => `整个会话用了 ${d.durationLong}。模型被调用了 ${d.calls} 次，发出了 ${d.toolCalls} 个请求：${d.toolCountList}。录制于 ${d.date}，模型是 ${d.model}。这个会话我们只录了一次，下面展示的就是那一次的原貌。`,
  },

  context: {
    define: () => `第一章讲的是循环：模型写出一个请求，由<strong>外壳程序（harness）</strong>执行并把结果贴回去（外壳程序是包在模型外面的程序，这里就是 Claude Code），然后再次调用模型。`,
    define2: () => `每次调用都会把全部内容发过去：开场设定（指令，以及模型可以请求的每个工具的说明）、你的消息，以及到目前为止的每个请求和结果。这些合起来就是模型的<strong>上下文</strong>。上下文以 <strong>token</strong> 计数。token（词元）是一个词或词的一部分。`,
    define3: () => `模型在一次调用中最多能读入多少，就是它的<strong>上下文窗口（context window）</strong>。`,
    compare: (d) => `第一章最后一次调用读了 ${d.ch1Last} 个 token。这个会话的最后一次调用读了 ${d.last} 个，是前者的 ${d.ch1Ratio} 倍。`,
    figTitle: "最后一次调用读了多少 token",
    ch1Bar: (d) => `第一章：小游戏，第 ${d.ch1Calls} 次调用`,
    ch2Bar: (d) => `本章：black，第 ${d.calls} 次调用`,
    markLabel: (d) => `到 ${d.autocompactShort} 时压缩（我们的设置）`,
    caption: (d) => `两个会话按同一比例绘制。${d.autocompact} 个 token 处的竖线，是我们启动 Claude Code 时传给它的一项设置。对话超过这个长度，Claude Code 就会压缩（compaction）它：用一份更短的摘要代替整段对话。第四章专门讲压缩。录制记录里没有模型本身的上限，所以图上没有画。`,
    chartLabel: (d) => `条形图。第一章最后一次调用读了 ${d.ch1Last} 个 token；本章最后一次调用读了 ${d.last} 个。一条竖线标在 ${d.autocompact} 个 token 处，也就是我们设定 Claude Code 压缩的位置。`,
  },

  explore: {
    intro: (d) => `拖动滑块，逐一查看这 ${d.calls} 次调用。方块就是那次调用读到的对话，按比例绘制：一个方块代表 ${d.unit} 个 token。一次调用就是模型的一个回合：读入对话，写出回复。每次调用给对话加上一轮：模型写的内容，加上返回的结果。所以一次调用读到的是开场设定和它之前的每一轮，最新的一块是上一次调用留下的那一轮。把指针移到某一块上，或者用 Tab 键移过去再按方向键，就能看到它装的是哪个请求和结果。各个阶段是我们读录制记录后自己划分的。`,
    title: "逐次浏览整个会话",
    scrub: "调用",
    prev: "上一次调用",
    next: "下一次调用",
    callOf: (n, total) => `第 ${n} 次调用（共 ${total} 次）`,
    clock: (t) => `时刻 ${t}`,
    reads: (tokens) => `读入 <b>${tokens}</b> 个 token`,
    soFar: (sum, n) => `${n} 次调用累计已读 ${sum}`,
    soFarOne: (sum) => `累计已读 ${sum}，这是第一次调用`,
    valueText: (n, total, phase, tokens) => `第 ${n} 次调用，共 ${total} 次，${phase}：读入 ${tokens} 个 token`,
    phases: "跳到某个阶段",
    gridLabel: (n) => `第 ${n} 次调用读到的对话，每一轮一块。用方向键在各块之间移动。`,
    legendSys: "开场设定和 issue",
    legendModel: "模型写的内容",
    legendBack: "返回的结果",
    legendFuture: "之后才加入",
    roundName: (r) => `第 ${r} 轮`,
    setupName: "开场设定和 issue",
    setupBody: (d) => `指令、每个工具的说明，以及 issue 的原文。录制记录给出了这一块的大小，但没有它的文字。第一次调用读它时，其中 ${d.cache1} 个 token 已经在缓存里了，是之前的一次会话留下的。`,
    split: (model, back) => `模型写了 ${model} · 返回了 ${back}`,
    roundLabel: (r, phase, tokens, model, back, tools) => `第 ${r} 轮，${phase}：${tokens} 个 token。模型写了 ${model}，${tools} 返回了 ${back}。`,
    setupLabel: (tokens) => `开场设定和 issue：${tokens} 个 token。`,
    refused: "被拒绝",
    error: "出错",
    lines: { other: (n) => `返回 ${n} 行` },
    readRange: (from, to) => `第 ${from} 到 ${to} 行`,
    said: "模型还写道",
    newest: "最新",
  },

  phases: {
    reproduce: {
      name: "重现 bug",
      text: (d) => `智能体先设法让 bug 出现。它的第一条命令被拒绝了：其中新建文件夹和文件的部分不在允许列表里，需要有人批准，而当时没有人在场。于是它改在那个文件夹里写测试文件，对它运行 black，得到了 issue 里说的那个多余的逗号：<code>${d.symptom}</code>。接着它去读 black 中拆分长行的那部分代码。`,
    },
    diagnose: {
      name: "找原因",
      text: () => `它调出几个添加尾随逗号（列表最后一项后面的逗号）的辅助函数，写了一个小脚本观察 black 怎样拆分一行，又读了 black 记录括号的方式。`,
    },
    fix1: {
      name: "第一次修复",
      text: (d, p) => `对 <code>${p.edited}</code> 做了两处修改，然后用 issue 里的例子和它的两个变体做测试。模型的结论是：<q lang="en">${p.say(/gone/)}</q>不过还有一种情况不对。`,
    },
    subscript: {
      name: "第二种情况",
      text: (d, p) => `加上 <code>-C</code>（一个让 black 忽略最后一项后面那个逗号的选项，这种逗号叫“魔术”尾随逗号）之后，像 <code>${d.subCase}</code> 这样方括号里只有一项的写法，丢掉了它必需的逗号。智能体又读了 black 的更多代码，修改了 <code>${p.edited}</code>，然后报告：<q lang="en">${p.say(/stability/)}</q>`,
    },
    suite: {
      name: "跑测试",
      text: (d, p) => `它运行 black 自己的测试，遇到第一个失败就停下：<code>${p.firstTest}</code>。又做了几处修改，让一个原有的预期结果保持不变，下一次完整运行的结果是 <code>${p.lastTest}</code>。失败的那个测试会对 black 自己的输出再运行一次 black，结果又变了。用模型自己的话说：<q lang="en">${p.say(/instability/)}</q>`,
    },
    instability: {
      name: "追查前后不一致的结果",
      text: (d, p) => `它在新写的辅助函数里加了几行打印语句，观察它怎么运行，找到了原因：<q lang="en">${p.say(/repeated calls/)}</q>再改一次 <code>${p.edited}</code>，完整测试就通过了：<code>${p.lastTest}</code>。`,
    },
    wrapup: {
      name: "测试和收尾",
      text: (d, p) => `它把 issue 里的例子加进 black 的测试文件，再跑一遍测试（<code>${p.lastTest}</code>）。它在变更日志里加了一条，变更日志是项目列出每个版本改了什么的文件。它还想运行类型检查工具（一种找出类型用错的值的工具），但这个工具没有安装。然后它用 black 格式化了自己的代码，最后删掉了临时文件夹。`,
    },
    answer: {
      name: "最终回答",
      text: () => `最后一次调用里没有请求，所以外壳程序停了下来。模型解释了原因和两处修复，说明了它没有修复什么、无法检查什么，并建议把它的修复和 issue 中提到的那个修复对比一下。`,
    },
  },

  fills: {
    title: "对话里装的是什么",
    p1: (d) => `到最后一次调用时，开场设定和 issue 占对话的 ${d.setupPct}。其余部分是一轮一轮加进来的，而且几乎对半分：${d.modelPct} 是模型自己写的内容（它的请求、写给你的说明，以及录制记录计入了数量却没有显示内容的推理），${d.backPct} 是外壳程序贴回来的结果。`,
    p2: (d) => `结果当中，读取的文件和命令输出占得最多。最大的一轮是第 ${d.bigRound} 轮，${d.bigAdd} 个 token，外壳程序贴回了 ${d.bigWhat}。${d.denied} 条被拒绝的命令加起来只增加了 ${d.deniedTokens} 个 token：每条都只返回一个简短的错误，智能体随后换了别的办法。`,
    bigRead: (lines, file) => `<code>${file}</code> 的 ${lines} 行`,
    figTitle: "最后一次调用的对话，按类型划分，单位为 token",
    chartLabel: "条形图：最后一次调用的对话中，各类内容各占多少 token。",
    kinds: {
      sys: "开场设定和 issue",
      model: "模型写的内容",
      Read: "读取的文件（Read）",
      Bash: "命令输出（Bash）",
      Grep: "搜索结果（Grep）",
      Glob: "文件列表（Glob）",
      edit: "确认过的修改和新文件（Edit、Write）",
      refused: "被拒绝的命令",
    },
    value: (n, pct) => `${n} · ${pct}`,
    note: () => `我们是这样划分的：API（程序用来把文本发给模型、再取回回复的服务）会报告每次调用读了多少 token、写了多少 token，但不报告每个结果各占多少。所以一轮中模型的部分，就是 API 说它在那次调用里写出的量；这一轮增长的其余部分，算作返回的结果。一轮有多个结果时，这部分再按各结果的字符数分摊。各部分是估算，总数是准确的。`,
  },

  reread: {
    title: "每次调用都从头再读一遍",
    p1: (d) => `模型不记得上一次调用。每次调用都从头读整段对话，所以早先贴进来的结果，在之后的每次调用里都会被再读一遍。这 ${d.calls} 次调用下来，模型一共读了 <strong>${d.sumRead}</strong> 个 token，是最终对话长度的 ${d.sumRatio} 倍。`,
    p2: (d) => `对话每次只增长一轮，但每次调用都要把整段对话读一遍，所以越往后，累计读取量涨得越快。到第 ${d.half} 次调用，也就是一半的时候，模型已经读了 ${d.halfSum} 个 token。后一半读了 ${d.secondHalf} 个，是前一半的 ${d.halfRatio} 倍。`,
    figTitle: "逐次调用的 token 数",
    seriesSum: "累计已读",
    seriesCtx: "对话长度",
    caption: () => `两条线使用同一比例。在图上移动指针，或者聚焦图表后按方向键，可以读出每次调用的数值。`,
    chartLabel: (d) => `折线图，共 ${d.calls} 次调用。对话增长到 ${d.last} 个 token；累计读取量增长到 ${d.sumRead} 个。`,
    tip: (n, sum, ctxTokens) => `第 ${n} 次调用：对话 ${ctxTokens}，累计已读 ${sum}`,
    axisX: "调用",
  },

  speed: {
    title: "是什么让一次调用变慢",
    p1: () => `人们很容易以为，对话越长，每次调用就越慢，因为要读的更多。这个会话里看不到这种情况。`,
    p2: (d) => `我们给每次调用计时：从上一个结果返回的那一刻，到回复的第一部分到达的那一刻。回复是一段一段整块到达的，不是逐字到达，所以这段时间也包括写出第一段的时间。把这些时间和调用读入的量对照，点散乱分布，看不出规律：相关系数为 ${d.rCtx}。和调用写出的量对照，它们就排成了一条线：${d.rOut}。相关系数接近零，表示两者之间没有直线关系；接近一，表示两者一起上升。`,
    p3: (d) => `等得最久的是第 ${d.maxCall} 次调用，${d.maxWait} 秒，它写了 ${d.maxOut} 个 token。最后一次调用读得最多，${d.last} 个 token，用了 ${d.lastWait} 秒。`,
    p4: () => `这只是一个会话、一个模型，说明不了对话大得多时会怎样。第一次调用没有放进图里，因为它的时间还包括 Claude Code 启动的时间。`,
    panelCtx: (r) => `对照读入的 token · 相关系数 ${r}`,
    panelOut: (r) => `对照写出的 token · 相关系数 ${r}`,
    axisY: "秒",
    axisCtx: "读入的 token",
    axisOut: "写出的 token",
    chartLabel: (what, r) => `散点图：每次调用的等待秒数，对照${what}。相关系数 ${r}。`,
    tip: (n, secs, read, wrote) => `第 ${n} 次调用：${secs} 秒，读入 ${read}，写出 ${wrote}`,
  },

  table: {
    summary: "以表格查看每次调用",
    caption: "录制记录中的每次模型调用。等待时间的测量方式与上面的图相同。",
    cols: ["调用", "阶段", "读入", "来自缓存", "新增", "写出", "等待（秒）"],
    firstWait: "启动",
  },

  outcome: {
    title: "修复有效吗？",
    p1: (d) => `录制记录以智能体自己的回答结束：<q lang="en">${d.claim}</q>下面的检查超出了录制记录的范围。它们是我们事后在文件夹的副本上做的，记在我们的录制笔记里，不在录制记录中。`,
    p2: (d) => `我们在智能体留下的文件夹上又运行了一次 black 的测试，结果和它自己最后一次运行一致：${d.lastSuite}。`,
    p3: (d) => `然后，我们在智能体的代码上运行了 black 自己修复这个 issue 时加入的测试用例。black 的修复在两个测试文件里加了用例，在智能体的代码上，其中一个文件没有通过。问题出在一行上：black 的修复还改了一个原有的预期结果，去掉了一个逗号，而智能体是有意保留这个逗号的。它的回答说明了原因：<q lang="en">${d.keepQuote}</q>把那一行保持原样，black 修复中的所有新用例就都通过了。`,
    p4: () => `智能体的改动也比 black 自己的大。它改的是同样三个源文件，加的代码却比 black 的修复多。测试通过并不能证明多出来的代码是对的，我们也没有进一步检查。一次会话修好一个 bug，不代表智能体能可靠地修 bug；第七章讲的就是它们修不好的时候。`,
  },

  next: {
    kicker: "下一章",
    title: `<a href="../cache/index.html">第三章：缓存</a>`,
    p1: (d) => `模型读的 ${d.sumRead} 个 token 中，有 ${d.cacheTotal} 个（${d.cachePct}）来自<strong>缓存</strong>，也就是模型提供方存下的一份最近见过的文本副本。缓存是什么？什么会让它失效？`,
    p2: (d) => `会话结束后，我们还让 Claude Code 手动压缩了一次对话，它从 ${d.pre} 个 token 变成了 ${d.post} 个。第四章讲压缩会保留什么、丢掉什么。`,
  },

  stats: {
    calls: "次模型调用",
    duration: "从开始到给出回答",
    sumRead: "个 token 被读取",
    cost: "按标价计算",
  },

  colophon: {
    title: "关于这次录制",
    // d.source is the trace's English note on how it was recorded; it is said here in Chinese.
    model: (d) => `这是一次真实的 Claude Code 会话，用 <code>claude -p --output-format stream-json</code> 录制。文件夹路径和本机用户名做了替换，其余内容没有任何改动。模型 <code>${d.model}</code>，Claude Code <code>${d.ccv}</code>，推理强度（effort）保持默认值。`,
    flags: "启动命令：",
    autocompact: (d) => `<code>--autocompact</code> 是我们的设置：它让 Claude Code 在对话达到 ${d.autocompact} 个 token 时压缩，这是它接受的最小值。这个会话一直没到这个量，所以我们在它结束后手动压缩了一次。`,
    oneRun: () => `这个会话我们只录了一次，没有重录，按原样展示。`,
    permissions: (d) => `智能体不用询问就可以运行 Python 和只读的 git 命令，也可以读取和修改文件。其他命令需要批准，而没有人在场批准，所以有 ${d.denied} 条被拒绝。还有一些不在这个列表里的命令照样运行了；录制记录没有说明原因。`,
    setup: (d) => `我们从 <a href="${d.commitUrl}">black 的 GitHub 仓库</a>取了它自己修复之前那个提交的代码，并在一个全新的 Python 环境里装好了它的测试工具。我们还去掉了自己的工具往环境里加的几项设置。其中 <code>NO_COLOR</code> 会让 black 的两个测试失败，那样智能体就会看到和这个 bug 毫无关系的失败。`,
    web: (d) => `<a href="${d.issueUrl}">这个 issue</a> 提到了一个带修复的拉取请求（pull request）。智能体没有联网的工具（它的工具：${d.tools}），也没有去查；它的回答建议把两者对比一下。`,
    paths: (d) => `模型看到的是真实的文件夹路径，本页把它显示为 <code>${d.alias}</code>。`,
    times: () => `token 数是 API 在每次调用时报告的用量。时间是每行输出到达的时刻，从录制程序启动 Claude Code 时开始计算。`,
    traces: "录制记录：",
    traceCh2: "本章的会话",
    traceCh1: "第一章的会话",
    traceSep: "、",
    json: "同样的数据也以 JSON 格式放在仓库的 <code>data/</code> 文件夹里。",
    // The repo's address comes from chapters.js, which this page loads before its copy.
    translated: () => `中文由 Claude 翻译，<a href="${(window.CHAPTERS || {}).repo}/issues">欢迎指正</a>。录制内容保持英文原文。`,
  },
};
