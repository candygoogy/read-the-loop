// 第八章（外壳程序实验场）的中文文案：旁白、所有标签，以及带数值的句子。这里不出现任何录制数字，也不出现
// 智能体写的、看到的内容：每个函数拿到 `d`，即 app.js 和 playground.js 从 window.PLAYGROUND 和录制记录读出、
// 已按 zh-CN 格式化并转义的数值。模型名、命令、模型的原话和测试规则的原文保持英文，规则原文后附中文说明。
// 嵌入版（embed.html）用的也是这个文件。
// The Chinese copy for chapter 8, loaded instead of ../../playground/copy.en.js. Same keys, same arguments.
window.COPY = {
  locale: "zh-CN",

  dek: () => `外壳程序是编程智能体里由你自己来设置的那一部分。这里是它的三个开关，以及同一个 bug 在每一种开关组合下被一遍又一遍修复的录制。拨动一个开关，看看有什么变了。`,

  intro: {
    p1: () => `AI 编程智能体就是一个在循环里运行的语言模型。模型读一遍对话，然后请求一个工具（读一个文件、运行一条命令）。<strong>外壳程序（harness）</strong>是包在模型外面的那个程序（这里是 Claude Code），它执行这个工具，把结果贴回对话，模型再把全部内容重读一遍。第一章到第七章用的都是外壳程序本来的样子。不过它的设置是由你来定的：用哪个模型、给哪些工具，以及在你的消息之前，外壳程序先对模型说些什么。`,
    p2: (d) => `我们把第一章的任务交给智能体做了 ${d.runs} 次，每一种开关组合 ${d.per} 次：同一个小游戏、同一个 bug、同一句话。`,
    promptHead: "每次运行我们输入的话",
    p3: () => `每次运行开始之前，三个开关都已经设好，每个开关有两个选项：`,
    model: {
      name: "模型",
      text: (d) => `外壳程序把对话发给哪个语言模型。两个模型都出自 Anthropic：${d.opus} 和 ${d.haiku}。录制记录显示了每个模型做了什么，以及 Claude Code 报告的每次运行的费用，但显示不了这两个模型在内部有什么不同。`,
    },
    bash: {
      name: "Bash",
      text: (d) => `运行命令的工具，比如运行游戏测试的 <code>node --test</code>。关掉 Bash，它就不在外壳程序每次调用都附带的工具说明里了（第五章），所以智能体仍然可以读文件、改文件，却没有办法运行任何东西，测试也不例外。去掉它之后，${d.opusName} 运行的第一次调用小了 ${d.bashSaved} 个 token。打开 Bash 时，一份允许列表让以 <code>node</code> 开头的命令不用询问就能运行：${d.allowOn}。`,
    },
    rule: {
      name: "测试规则",
      text: (d) => `在外壳程序的开场设定（模型在你的消息之前读到的指令，第二章）里加上一句话：<q lang="en">${d.rule}</q>（意思是：每次改动之前和之后都运行测试。）你的消息一字不改。这条规则让 ${d.opusName} 运行的第一次调用大了 ${d.ruleAdded} 个 token。`,
    },
    p4: () => `录制记录里没有允许列表，也没有开场设定的原文，所以这两样按我们在命令行里输入的原样给出（页面底部的说明里有完整的命令）。每一次带规则的运行，Claude Code 自己的会话文件都显示，这句话就在开场设定的末尾。`,
    p5: (d) => `${d.ch1 ? "实验场一开始显示的是第一章的设置。" : ""}本页的每一次运行都修好了这个 bug。开关改变的，是智能体修好它的过程。`,
  },

  play: {
    title: "外壳程序实验场",
    help: "给每个开关选一个设置，用这组设置录下的两次运行就会并排显示出来。",
    group: "外壳程序的设置",
    legend: { model: "模型", bash: "Bash", rule: "测试规则" },
    hint: {
      model: () => `外壳程序调用哪个模型`,
      bash: () => `运行命令的工具`,
      rule: (d) => `在开场设定里加上 <q lang="en">${d.rule}</q>（改动前后都运行测试）`,
    },
    value: {
      model: { opus: "Opus", haiku: "Haiku" },
      bash: { bash: "开", nobash: "关" },
      rule: { norule: "关", rule: "开" },
    },
    // 屏幕阅读器听到的状态，以及一览表里的设置名称。
    spoken: {
      model: { opus: "Opus", haiku: "Haiku" },
      bash: { bash: "有 Bash", nobash: "无 Bash" },
      rule: { norule: "无测试规则", rule: "有测试规则" },
    },
    spokenJoin: "，",
    status: (setting, runs) => `正在显示：${setting}。${runs}`,
    statusRun: (k, calls, before, after) => `第 ${k} 次运行：${calls}，${before ? "修改前运行了测试" : "修改前没有运行测试"}，${after ? "修改后运行了测试" : "修改后没有运行测试"}。`,
    loading: "正在载入录制记录…",
    failed: "这份录制记录没能载入。",
    run: (k) => `第 ${k} 次运行`,
    // 每次运行卡片的抬头：模型，以及开始的时间（各次运行交错进行，见文末说明）。
    runMeta: (model, time) => `${model} · UTC ${time} 开始`,
    callsWord: { other: (n) => `${n} 次模型调用` },
    facts: {
      calls: "模型调用",
      time: "秒",
      cost: "费用",
      cached: (n, total) => `第一次调用的 ${total} 个 token 里，有 ${n} 个从缓存读取。`,
    },
    checks: {
      before: "第一次修改前运行了测试",
      after: "最后一次修改后运行了测试",
      fixed: "游戏自带的测试，事后由我们运行",
      yes: "是",
      no: "否",
      pass: (p, t) => `通过 ${p}/${t}`,
    },
    stepsHead: "它做了什么，一次调用一行",
    callN: (n) => `第 ${n} 次调用`,
    answer: "模型写道 · 最终回答",
    more: { other: (n) => `显示其余部分（还有 ${n} 段）` },
    // 每个请求展开之前那一行里的结果。
    res: {
      files: { other: (n) => `${n} 个文件` },
      lines: { other: (n) => `${n} 行` },
      edited: "已修改",
      tests: (pass, fail) => `${pass} 个通过，${fail} 个失败`,
      failSeen: "有测试失败",
      error: "出错",
    },
    tag: { test: "运行测试", edit: "修改", missing: "没有这个工具" },
    pairNote: (d) => `每组设置的第 2 次运行，都在第 1 次运行之后 ${d.gapMin} 到 ${d.gapMax} 分钟开始。它的第一次调用有 ${d.r2CacheMin} 到 ${d.r2CacheMax} 个 token 是从第 1 次运行留下的缓存里读取的，所以更便宜（第三章）。两次运行都按录制原样显示。`,
  },

  // 请求展开后里面的卡片（和第一章一样）。
  cards: {
    request: "请求",
    result: "结果",
    plain: "纯文本",
    file: "文件",
    toolMeta: { Glob: "查找文件", Read: "读取文件", Edit: "修改文件", Grep: "搜索文件内容", Bash: "运行命令" },
    shown: (a, b) => `共 ${b} 行，显示 ${a} 行`,
    all: { other: (n) => `${n} 行` },
    skipped: { other: (n) => `…… 此处省略 ${n} 行 ……` },
  },

  embedNote: {
    title: "放到你自己的页面上",
    p1: () => `实验场也可以单独使用，大小正好适合放进一篇博客文章。把下面这段代码粘贴到你想放的位置；<code>#</code> 后面的地址决定它打开时用哪组设置（这里就是你在上面选的那组）。它不会从本站以外加载任何东西。栏宽不到大约 640 像素时，两次运行会上下排列，框里的内容可以滚动。`,
    open: "单独打开嵌入版",
    frameTitle: "外壳程序实验场，来自 Read the Loop",
  },

  overview: {
    title: "全部八组设置一览",
    p1: () => `每一行是一种开关组合，包含它的两次运行。实心圆点表示“是”，空心圆圈表示“否”。选一行，就会在实验场里显示它。`,
    caption: (d) => `每组设置的第 1 次和第 2 次运行。全部 ${d.runs} 次运行都修好了 bug，所以没有为它单列一栏。`,
    cols: { setting: "设置", before: "修改前测试", after: "修改后测试", calls: "调用", cost: "费用" },
    show: "显示",
    shown: "已在上方显示",
    runSpoken: (k, yes) => `第 ${k} 次运行：${yes ? "是" : "否"}。`,
    pair: (a, b) => `${a}、${b}`,
  },

  shows: {
    title: "开关带来了什么变化",
    p1: () => `在这些运行里，开关改变了三件事。没有一件改变了 bug 有没有被修好。`,
    rule: {
      title: "有 Bash 时，规则让第一次测试提前到了修复之前",
      text: (d) => `没有规则时，有 Bash 的 ${d.normN} 次运行中，有 ${d.normBefore} 次在改代码之前运行了测试。有了规则，${d.ruleN} 次中有 ${d.ruleBefore} 次这样做${d.sawFail ? "，而且每一次都在动手修复之前，看到了一个因为这个 bug 而失败的测试" : ""}。改完之后，每一次有 Bash 的运行都运行了测试，不管有没有规则（${d.bashN} 次中有 ${d.bashAfter} 次）。${d.haikuFirst}`,
      haikuFirst: (who) => `唯一一次没人要求就先做测试的运行，是${who}。`,
      runName: (setting, run) => `${run}（${setting}）`,
    },
    bash: {
      title: "没有 Bash 时，没有一次运行做了测试，每个回答也都说了这一点",
      text: (d) => `${d.nobashN} 次没有 Bash 的运行，一次都没有运行测试。${d.saidAll ? `全部 ${d.nobashN} 个最终回答都说` : `${d.nobashN} 个最终回答中有 ${d.said} 个说`}它没法运行测试，比如：<q lang="en">${d.example}</q>${d.missing}`,
      missing: (d) => `${d.all ? `没有 Bash 的 ${d.missingN} 次 ${d.missingModel} 运行全都` : `没有 Bash 的 ${d.missingModel} 运行中有 ${d.missingN} 次`}仍然请求了 Bash。外壳程序回给它的是一个错误，而不是权限检查的拒绝；在全部 ${d.runs} 次运行里，权限检查什么都没有拒绝。那个错误是：<q lang="en">${d.error}</q>${d.othersAsked ? "" : `${d.otherModel} 的运行从没请求过自己没有的工具。`}`,
    },
    model: {
      title: "对费用影响最大的是模型",
      text: (d) => `每一次 ${d.opusName} 运行的费用，都是开关相同的那次 ${d.haikuName} 运行的 ${d.lo} 到 ${d.hi} 倍，尽管 ${d.haikuName} 写得更多：每次运行写出 ${d.hOutLo} 到 ${d.hOutHi} 个 token，而 ${d.opusName} 是 ${d.oOutLo} 到 ${d.oOutHi} 个。费用是 Claude Code 自己给出的每次运行的数字，我们没有拿它和价目表核对过。`,
    },
    caveat: {
      title: "这能说明到什么程度",
      text: (d) => `每组设置 ${d.per} 次运行，是极小的样本：一个任务、一个小游戏、${d.runs} 次运行，都是同一天里一次接一次录下的。这里只发生过一次的事，下一次、换一个任务或换一天，都可能反过来。规则起的作用，只是一句话在这些运行里、在这个任务上起的作用。另外，每组的第 2 次运行更便宜，部分原因是它读取了第 1 次运行留下的缓存（见上文）。`,
    },
  },

  next: {
    kicker: "系列到此结束",
    title: "回到循环",
    p1: () => `这是最后一章。本页的每一次运行，都是<a href="../loop/index.html">第一章</a>里的那个循环：模型请求一个工具，外壳程序执行它，把结果贴回来，整段对话再被读一遍。开关改变的，只是外壳程序给模型提供了什么，以及在你的消息之前对它说了什么。每当你设置一个智能体，这些都在你手里。`,
  },

  colophon: {
    title: "关于录制",
    model: (d) => `录制于 ${d.date}，UTC ${d.t0} 到 ${d.t1}，Claude Code <code>${d.ccv}</code>，模型 <code>${d.opus}</code> 和 <code>${d.haiku}</code>。每次运行都在一个新文件夹里，从第一章那个游戏的一份全新副本开始，启动命令是：`,
    flags: (d) => `尖括号里的部分就是开关。模型和工具列表都在每份录制记录里，构建时会拿它们和运行的名字核对。允许列表（<code>--allowedTools</code>）和规则（<code>--append-system-prompt</code>）不在录制记录里，所以这里是我们输入的原样，和 <a data-repo="blob/master/scripts/summarize-playground.py">scripts/summarize-playground.py</a> 里的一致。每次运行都从权限模式 <code>${d.mode}</code> 开始，所以修改文件不用询问就会执行。`,
    order: (d) => `运行的顺序在第一次运行之前就定好了：先是全部 ${d.combos} 组设置的第 1 次运行，再是全部 ${d.combos} 组的第 2 次运行，两遍顺序相同，一次紧接着一次。所以同一组设置的两次运行之间，总是相隔 ${d.combos} 次运行。没有重做，也没有删掉任何一次：我们录下的每一次运行都在本页上。`,
    fixed: (d) => `我们怎样核对修复：录制结束后，我们在智能体留下的每个游戏上运行了游戏自带的 ${d.tests} 个测试，并先把原来的测试文件放回去，因为有 ${d.addedTests} 次运行往里面加了自己的测试。${d.runs} 次运行中，有 ${d.fixed} 次的 ${d.tests} 个测试全部通过。我们交出去时的游戏通过 ${d.origPass} 个、失败 ${d.origFail} 个${d.origFrom ? "，那些先做测试的运行看到的也是这样" : ""}。保存下来的结果在 <a data-repo="tree/master/data/checks-08">data/checks-08</a> 里。`,
    tested: () => `“运行了测试”是指一个运行 <code>node --test</code> 或某个测试文件的 Bash 步骤，发生在第一次修改之前或最后一次修改之后，不管测试有没有通过。`,
    missing: (d) => `对一个没有的工具的调用：在 ${d.n} 次没有 Bash 的 ${d.model} 运行里，模型仍然请求了 <code>Bash</code>，命令是 <code>${d.command}</code>。录制记录把 Claude Code 的回复标为错误，而每一次运行里，权限检查的拒绝列表都是空的。${d.allSaid ? "这些运行之后都在回答里说，它们没法运行测试。" : ""}`,
    cost: () => `费用是 Claude Code 自己给出的每次运行的数字，四舍五入到小数点后四位。每组的第 2 次运行，第一次调用有一部分是从几分钟前第 1 次运行留下的缓存里读取的，而第 1 次运行是它之前唯一一次模型、工具和开场设定都相同的运行，所以第 2 次运行的费用更低，部分就是这个原因。有些第 1 次运行也从缓存读取了内容，那份缓存来自录制记录没有指明的一次更早的会话。`,
    paths: (d) => `模型看到的是真实的文件夹路径。录制记录把它显示为 <code>${d.alias}</code>，把本机用户名显示为 <code>you</code>，其余内容没有任何改动。所以有些命令写的是带引号的 <code>cd "${d.alias}"</code>，而在真实的 shell 里，引号里的这个路径不会被展开。`,
    traces: () => `每一次运行都以录制记录的形式放在仓库的 <a data-repo="tree/master/data">data/</a> 文件夹里（<code>trace-08-…json</code>），另有一份全部运行的汇总 <code>playground-08.json</code>。本站上的副本：`,
    link: (k) => `第 ${k} 次运行`,
    runLine: (setting, links) => `${setting}：${links}`,
  },

  embed: {
    title: "外壳程序实验场",
    back: "来自 Read the Loop 第八章",
    foot: (d) => `真实的 Claude Code 会话，每组设置 ${d.per} 次，录制于 ${d.date}。每一个数字，以及智能体写下的每一句话，都读自录制记录。中文由 Claude 翻译。`,
  },

  stats: {
    runs: "次运行，修的是同一个 bug",
    fixed: "次修好了 bug",
    rule: "在修复前做了测试，有 Bash 和规则",
    norule: "在修复前做了测试，有 Bash、没有规则",
    of: (a, b) => `${a}/${b}`,
  },
};
