// 第五章的中文文案：旁白、所有标签，以及带数值的句子。这里不出现任何录制数字。每个函数拿到 `d`，即
// app.js 从录制记录（window.TOOLS 和 window.TRACES）读出、已按 zh-CN 格式化并转义的数值。智能体和
// Claude Code 写的、看到的内容（工具名和摘录、命令、外壳程序的拒绝消息、允许列表里的模式、启动参数）
// 保持英文原文，由 app.js 从录制记录填入。
// The Chinese copy for chapter 5, loaded instead of ../../tools/copy.en.js. Same keys, same arguments.
window.COPY = {
  locale: "zh-CN",

  manual: {
    p1: (d) => `第一章里，模型请求列出文件、读代码、改一个文件、运行测试。这些事它一件都没有亲手做。每一项都是一个<strong>工具（tool）</strong>：模型可以使用的一种请求格式，由外壳程序来执行。<strong>外壳程序（harness）</strong>是包在模型外面的那个程序，这里就是 Claude Code。它执行请求，再把结果贴回对话里。第一章把每次调用的开头画成一整块，也就是开场设定，长 ${d.ch1Setup} 个 token（词元，一个词或词的一部分），但没法显示里面装了什么。`,
    p2: (d) => `为了看看里面有什么，我们在 ${d.date} 把第一章的任务又跑了一遍，模型相同，设置也几乎相同（文末的说明列出了不同之处）。这次运行经过我们自己写的一个小程序，它位于 Claude Code 和 Anthropic 的服务器之间，在每个请求发出时把它存下来。它保存的是每个请求的内容，从不保存随请求一起发送的请求头（header）。这次会话一共调用了 ${d.requests} 次模型。结果发现，每个请求里最大的部分是一份工具说明：每个工具一条，写着它的名字、一段描述，以及请求这个工具时可以给出哪些输入。`,
    p3: (d) => `一共 ${d.nTools} 条，${d.toolsChars} 个字符的 JSON（请求所用的文本格式），占第一次调用发送内容的 ${d.toolsPct}。最长的是 ${d.big} 这一条，${d.bigChars} 个字符，其中 ${d.bigDesc} 个是它的描述。每一条还列出了它的输入，并注明哪些是请求必须给出的。`,
    p4: (d) => `有一条与众不同。会话开始时 Claude Code 报告了自己的工具列表（${d.initTools}），<code>${d.placeholder}</code> 不在其中。它不接受任何输入，描述里写着永远不要调用它。录制记录看不出它是做什么用的。`,
    p5: (d) => `工具说明在整个会话里没有变过。我们把这 ${d.requests} 个请求逐字节比较了一遍：所有请求里的工具都一样，系统指令也一样。只有对话在增长，从第一次调用时的 ${d.m0} 条消息，到最后一次的 ${d.mLast} 条。第二次调用的 ${d.c2ctx} 个 token 里，有 ${d.c2cached} 个是从缓存读取的。缓存是模型提供方存下的一份最近见过的文本副本（第三章专门讲缓存）。`,
  },

  tools: {
    title: "工具说明，逐条来看",
    desc: "描述",
    rest: "输入，以及外围的 JSON",
    size: (d) => `${d.chars} 个字符`,
    sizeLabel: (d) => `${d.chars} 个字符：描述占 ${d.desc} 个，输入和外围的 JSON 占 ${d.rest} 个。`,
    inputs: "输入",
    noInputs: "没有输入",
    required: "必须给出",
    reqSample: "输入",
    reqKey: "请求必须给出的输入",
    used: { zero: () => "本次会话中没有被请求过", other: (n) => `本次会话中被请求了 ${n} 次` },
    notInit: "不在 Claude Code 自己的工具列表里",
    scaleNote: "所有条形使用同一比例：最长的一条占满整行。",
  },

  anatomy: {
    p1: () => `下面是完整的第一个请求，首尾相接排成一条，按字符数的比例绘制。除了工具，它还有两个部分。<strong>系统（system）</strong>是 Claude Code 给模型的指令；我们公布它的大小，不公布它的文字。<strong>消息（messages）</strong>是到目前为止的对话，在第一次调用时，就是你写的那句话，加上 Claude Code 附带的几条说明。`,
    title: "第一个请求，按字符数",
    parts: { tools: "工具", system: "系统", messages: "消息" },
    share: (d) => `${d.pct}`,
    total: (d) => `总共 ${d.chars} 个字符，模型把它们读成了 <b>${d.tokens}</b> 个 token。录制记录没有把这个数分到各个部分，所以下面各部分的 token 数是估算：按每部分所占的字符比例分摊。`,
    head: (d) => `${d.chars} 个字符 · ${d.pct}`,
    est: (d) => `约 ${d.tokens} 个 token（估算）`,
    toolsList: "每个工具一条，按发送顺序",
    systemBlock: (d) => `第 ${d.n} 块：${d.chars} 个字符`,
    cacheMark: "标记了缓存",
    noCacheMark: "没有标记缓存",
    systemNote: "文字不予显示。",
    userMsg: (d) => `来自用户，分 ${d.blocks} 块`,
    sysMsg: (d) => `系统角色的消息，${d.chars} 个字符`,
    noteBlock: (d) => `Claude Code 附带的说明：${d.chars} 个字符`,
    promptBlock: (d) => `你写的那句话：${d.chars} 个字符`,
    sysBlock: "不予显示",
    colon: "：",
    prompt: "你写的那句话",
    label: (d) => `按比例绘制的条形。第一个请求共 ${d.total} 个字符，其中工具占 ${d.tools}（${d.toolsPct}），系统占 ${d.system}（${d.systemPct}），消息占 ${d.messages}（${d.messagesPct}）。你写的那句话是其中的 ${d.prompt} 个字符。下面三个列表分别列出各部分由哪些块组成。`,
    // 请求还携带了哪些本页没有展示的内容。只列种类，不列任何值。
    identity: (d) => `请求携带的内容里，有一些没有出现在本页上。来自用户的第一条消息以 Claude Code 附带的 ${d.notes} 条说明开头，其中一条给出了账号的电子邮件地址。一条系统角色的消息给出了工作文件夹、操作系统、日期，以及本次会话的预算还剩多少；每个工具结果之后，还有一条同样的消息给出剩下的预算。在对话之外，一个名叫 <code>metadata</code> 的字段里有一个设备 ID 和一个账号 ID。我们在这里只列出这些信息的种类，不列出它们的值。录制记录没有说明每一项为什么在那里。`,
    settings: (d) => `每个请求还带着同样的设置：推理强度（effort）<code>${d.effort}</code>，思考（thinking）<code>${d.thinking}</code>，<code>max_tokens</code> ${d.maxTokens}（允许的最长回复，以 token 计），以及一个 <code>context_management</code> 条目 <code>${d.cm}</code>，设为保留 <code>${d.cmKeep}</code>。这些设置的含义见 Anthropic 的 API 文档；本页只展示发送了什么。`,
  },

  decide: {
    p1: () => `所以模型从头到尾都只是在请求。它写出一个请求，由外壳程序决定执行不执行。<strong>权限（permission）</strong>是你交给外壳程序的规则，规定哪些请求它可以不先问你就执行。规则没有覆盖到的请求，需要有人批准。`,
    p2: () => `第二章和第三章的那次会话里就能看到这一点。那一次，我们把 Black（一个格式化 Python 代码的工具）的一份真实 bug 报告交给 Claude Code，连同 Black 的源代码，还有下面这份<strong>允许列表（allowlist）</strong>，列出它不用询问就可以做的事：`,
    allowTitle: "无需询问即可执行",
    tools: "整个工具",
    bash: "Bash 命令，写成模式",
    p3: (d) => `${d.wholeTools} 这几项放行的是整个工具。<code>Bash(…)</code> 这几项则是 shell 命令的模式：Python，以及 ${d.nGit} 个只报告项目状况的 git 命令（<code>diff</code>、<code>status</code> 和 <code>log</code>）。`,
    p4: (d) => `我们用 <code>claude -p</code> 运行这次会话。这种方式执行一个任务时，键盘前没有人，所以需要批准的请求得不到批准。模型一共发出了 ${d.bash} 个 Bash 请求，外壳程序拒绝了其中 ${d.denied} 个。每一次，模型拿回的都只有外壳程序的一条消息，标记为错误，没有任何输出。然后它接着往下做。`,
  },

  check: {
    p1: (d) => `下面是那 ${d.bash} 个 Bash 请求中的 ${d.picks} 个，按模型发出的顺序排列。每一个都请你根据上面的列表来决定外壳程序该怎么做：允许，还是先询问。然后看看 Claude Code 实际是怎么做的。`,
    p2: (d) => `这 ${d.picks} 个是我们自己挑的：${d.pDenied} 个被拒绝，${d.pRan} 个运行了，其中包括让我们意外的那几个。测验之后列出了每一次拒绝。`,
    progress: (k, n) => `第 ${k} 个请求（共 ${n} 个）`,
    call: (n, total) => `第 ${n} 次调用（共 ${total} 次）`,
    note: "模型的备注",
    lines: { other: (n) => `${n} 行` },
    more: { other: (n) => `… 省略 ${n} 行 …` },
    ask: "你的决定",
    allow: "允许",
    allowHint: "不用询问，直接运行",
    askFirst: "先询问",
    askHint: "需要有人批准",
    ran: "Claude Code 没有询问就运行了它。",
    refused: "Claude Code 拒绝了它。",
    same: "和你的决定一致。",
    differ: "和你的决定不同。",
    harnessSaid: "外壳程序的消息",
    output: { other: (n) => `返回了 ${n} 行输出。` },
    next: "下一个请求",
    finish: "看看你的结果",
    skip: "跳过测验，直接看结果",
    score: (d) => `${d.n} 个请求里，你有 <b>${d.k}</b> 个和 Claude Code 的做法一致。`,
    skipped: "下面是 Claude Code 对每个请求的处理。",
    again: "重新开始",
    toRefusals: "查看每一次拒绝",
    cols: ["调用", "请求", "你的决定", "Claude Code"],
    yours: { allow: "允许", ask: "先询问", none: "没有作答" },
    actual: { ran: "运行了", refused: "拒绝了" },
    dotLabel: (k, n) => `第 ${k} 个请求（共 ${n} 个）`,
  },

  refusals: {
    title: "外壳程序拒绝了什么",
    p1: (d) => `下面是全部 ${d.denied} 次拒绝。外壳程序的消息大多会点出命令里需要批准的部分，这些部分在命令中做了标记。模型拿回的结果只有这条消息，命令的任何部分都没有输出。`,
    call: (n) => `第 ${n} 次调用`,
    request: "请求 · Bash",
    message: "结果 · 被拒绝",
    next: "下一次调用中它请求的是",
    p2: (d) => `${d.allOther ? "每一次，下一次调用都换了一种方式请求同样的事" : "大多数时候，下一次调用都换了一种方式请求同样的事"}：shell 命令想创建文件的地方改用 Write 工具，用 Grep 工具代替 <code>grep</code>，或者换一条更短的 Bash 命令。${d.noneRefused ? "这些请求都没有被拒绝。" : ""}`,
  },

  puzzle: {
    title: "录制记录没有回答的问题",
    p1: (d) => `列表之外的命令，并不是都被拒绝了。下面每条命令里都有一部分不是以 <code>python</code> 或那 ${d.nGit} 个 git 命令开头的，而它们都没有询问就运行了：`,
    calls: (list) => `第 ${list} 次调用`,
    callsMany: (list) => `第 ${list} 次调用`,
    p2: (d) => `其中有两条和一次拒绝看起来很像。第 ${d.a} 次调用里，<code>grep … | head</code> 运行了。第 ${d.b} 次调用里，另一条 <code>grep … | head</code> 被拒绝了，外壳程序的消息只点出了 <code>grep</code> 那一部分。`,
    p3: () => `Claude Code 输出的记录流（stream）没有说明为什么一条运行了、另一条没有，本页也不去猜它的匹配规则。不管原因是什么，决定都是外壳程序在模型提出请求之后做出的：两次模型写的都是同一类请求。`,
    kinds: {
      rm: "删除一个文件夹",
      heredoc: "从 shell 写入一个文件",
      grepHead: "搜索，然后只留前几行",
      lsHead: "列出一个文件，再显示它的开头",
      echo: "打印一行字",
    },
  },

  stats: {
    tools: "条工具说明，每个请求都带着",
    chars: "个字符的工具说明",
    bash: "个 Bash 请求（Black 会话）",
    denied: "个被拒绝",
  },

  next: {
    kicker: "下一章",
    title: "第六章：子智能体",
    p1: () => `这两次会话里的每个请求都发给了同一个模型，在同一段对话里。智能体也可以把一项旁支任务交给它自己新开的一段对话，那段对话有自己的上下文，最后只把答案交回来。这第二段对话就是<strong>子智能体（subagent）</strong>。它能看到什么，又会交回什么？`,
  },

  colophon: {
    title: "关于录制",
    // d.source05 is the trace's English note on how it was recorded; it is said here in Chinese.
    capture: (d) => `<strong>捕获的请求。</strong>这是一次真实的 Claude Code 会话，用 <code>claude -p --output-format stream-json</code> 录制。文件夹路径和本机用户名做了替换，其余内容没有任何改动。任务是第一章的那个，于 ${d.date05} ${d.time05}（UTC）重新运行，模型 <code>${d.model05}</code>，Claude Code <code>${d.ccv05}</code>，共 ${d.calls05} 次调用。启动命令：`,
    proxy: () => `请求由 <code>scripts/capture-proxy.py</code> 保存，这是本项目仓库里的一个小代理程序。只在那一条命令里，我们用 <code>ANTHROPIC_BASE_URL</code> 让 Claude Code 把请求发给它，它再把每个请求原样转发给 Anthropic。它只保存请求体，从不保存请求头。之后 <code>scripts/extract-tools.py</code> 从中取出工具名称、大小、输入名称、每段描述的第一句话、其他部分的大小，以及各项设置。请求里的其他文字一概不公布。`,
    differ: (d) => `这次运行的第一次调用读了 ${d.c1} 个 token，而第一章运行同一个任务时是 ${d.ch1Setup} 个。我们没有查明两者为什么不同，所以这些请求准确描述的是这次运行；对第一章那次运行，它们很接近，但不完全一样。这次运行的预算上限也更小，还多了让请求经过代理的那项设置。`,
    est: () => `字符数按发送时的 JSON 计算。各部分的 token 数是估算：把第一次调用准确的 token 数，按各部分的字符数分摊。JSON 的标点、代码和普通文字换算成 token 的比率并不相同，所以这些数只能作粗略参考。`,
    black: (d) => `<strong>Black 会话。</strong>录制于 ${d.date03}，模型 <code>${d.model03}</code>，Claude Code <code>${d.ccv03}</code>，共 ${d.calls03} 次调用，和第二章、第三章用的是同一次会话。启动命令：`,
    denied: () => `这里说的拒绝，是 Claude Code 在它的记录流里标记为 denied 的工具结果；它的文字就是模型收到的那条外壳程序消息。`,
    paths: (d) => `模型看到的是真实的文件夹路径，本页把它们显示为 ${d.aliases}。`,
    traces: "数据：",
    links: { tools: "请求大小和工具条目", ch5: "捕获请求的那次会话", black: "Black 会话", ch1: "第一章的会话" },
    json: "同样的数据也以 JSON 格式放在仓库的 <code>data/</code> 文件夹里。",
  },
};
