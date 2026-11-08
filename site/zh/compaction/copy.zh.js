// 第四章的中文文案：旁白和所有界面标签。这里不出现任何录制数字。每个函数拿到 `d`，即 app.js 从录制记录
// (window.TRACE) 读出并已按 zh-CN 格式化的数值。模型写的摘要、回答和引文，以及命令和录制记录的摘录，
// 都保持英文原文，由 app.js 从录制记录填入。“留下了什么？”按英文原文比对，这里只翻译周围的标签。
// The Chinese copy for chapter 4, loaded instead of ../../compaction/copy.en.js. Same keys, same arguments.
window.COPY = {
  locale: "zh-CN",

  tokens: (n) => `${n} 个 token`,
  gap: (h, m) => `${h} 小时 ${m} 分钟`,
  callN: (n) => `第 ${n} 次调用`,

  why: {
    p1: () => `第二章讲过，智能体每次调用都要把整段对话发给模型，而对话只会越来越长。第三章讲了缓存（cache）怎样让这种反复读取变得便宜。但对话还是在变长，而模型一次调用能读入的内容有上限，这个上限就是它的<strong>上下文窗口（context window）</strong>。`,
    p2: (d) => `<strong>压缩（compaction）</strong>是 Claude Code 让长会话继续下去的办法：它让模型为到目前为止的对话写一份摘要，此后发给模型的就是这份摘要，原来的对话不再发送。对话长到一定大小时，它会自动这样做。这个大小可以设置：我们启动会话时用了 <code>${d.flag}</code>，也就是 ${d.autocompact} 个 token（词元，一个词或词的一部分），这是 Claude Code 帮助文本里允许的最小值（<q lang="en">${d.range}</q>）。`,
    notice: (d) => `<strong>我们做了什么。</strong>这次会话从来没有长到那个大小，它的最后一次调用读了 ${d.last} 个 token。所以我们用 Claude Code 的 <code>/compact</code> 命令手动压缩了它，时间是这次运行最后一条回复之后 ${d.afterRun} 秒。又过了 ${d.gap}，我们恢复这次会话，只问了一个问题，看看智能体还记得什么：<q lang="en">${d.prompt}</q>这两步都是我们做的，不是智能体自己做的。`,
    p3: () => `下面是这次会话最后的那段对话，画法和第二章一样，旁边是压缩之后剩下的部分。可以在两者之间切换。`,
    p4: (d) => `剩下的只有原来的 ${d.pct}：${d.pre} 个 token 里剩下 ${d.post} 个。其余的内容都不在模型收到的对话里了。这几千个 token 留下了什么？`,
  },

  squash: {
    title: "压缩前后的对话",
    mode: "显示哪一段对话",
    before: "压缩前",
    after: "压缩后",
    beforeL: "个 token，压缩前",
    afterL: "个 token，压缩后（Claude Code 的统计）",
    legendSys: "开场设定和 issue",
    legendModel: "模型写的内容",
    legendBack: "返回的结果",
    legendAfter: "剩下的部分",
    legendGone: "已丢弃",
    labelBefore: (d) => `${d.cells} 个方块，每个代表 ${d.unit} 个 token：压缩前对话的 ${d.pre} 个 token，按种类着色。`,
    labelAfter: (d) => `${d.cells} 个方块里有 ${d.cellsAfter} 个是实心的，每个代表 ${d.unit} 个 token：Claude Code 在压缩后统计的 ${d.post} 个 token。其余方块只画了轮廓，代表被丢弃的部分。`,
    note: (d) => `一个方块代表 ${d.unit} 个 token。压缩前：最后一次调用读到的对话，按第二章的方式着色，再加上模型的最后一条回复，这正是 Claude Code 在压缩前报告的大小。压缩后：它在压缩刚完成时报告的大小。录制记录给出了这个数字，但没有说明它由哪些部分组成，所以只用一种颜色。`,
  },

  game: {
    title: "留下了什么？",
    p1: (d) => `读摘要之前，先猜一猜。下面是会话中发生的 ${d.n} 件事。每一件都可能在对话写成摘要时丢失；也可能留在摘要里，却没有出现在对我们问题的回答中；还可能一直留到了回答里。`,
    p2: (d) => `我们选这 ${d.n} 件事，是因为它们关系到修复是怎么来的，其中包括测试中途失败的那两次。这是我们的选择，换一组事件，结果可能不一样。每一条结论都是页面加载时比对摘要和回答的原文得出的，不是来自我们的笔记。`,
    question: "它最后到了哪里？",
    options: {
      lost: "在摘要里丢失了",
      summary: "在摘要里，不在回答里",
      answer: "在回答里",
    },
    stages: ["会话", "摘要", "回答"],
    revealAll: "全部揭晓",
    score: (d) => `${d.n} 件中已揭晓 ${d.done} 件 · 猜对 ${d.right} 件`,
    scoreNone: (d) => `共 ${d.n} 件事，还没有揭晓`,
    right: "猜对了。",
    wrong: (d) => `你选的是：${d.guess}。`,
    verdict: {
      lost: "摘要把它丢掉了。",
      summary: "摘要保留了它，回答没有提到。",
      answer: "它一直留到了回答里。",
    },
    inSummary: "摘要里的原文",
    inAnswer: "回答里的原文",
    notInAnswer: "回答没有提到这件事。",
    instead: "回答里关于这件事的说法",
    keptNote: () => `这次运行自己的最后一条消息没有提到这件事，回答里的这一点来自摘要。`,
    tally: (d) => `这 ${d.n} 件事里，摘要保留了 ${d.inSummary} 件，回答提到了 ${d.inAnswer} 件。${d.leftOut}`,
    tallyLeftOut: (d) => `回答里没有的是：${d.list}。`,
    proof: "录制记录里的内容",
  },

  // 每件事一条：一个短标题，以及用我们的话说发生了什么。`d` 里有调用序号和计数。
  events: {
    refused: {
      title: "它的第一条命令被拒绝了",
      text: (d) => `在第 ${d.call} 次调用中，智能体想在项目文件夹外面建一个测试文件。命令里的这一部分需要批准，而没有人在场批准，于是返回了一个错误。在会话后面，又有 ${d.more} 条命令被拒绝。`,
      short: "被拒绝的命令",
    },
    scratch: {
      title: "它在一个临时文件夹里工作，最后把它删掉",
      text: (d) => `于是，它在第 ${d.call} 次调用中把测试文件写进了项目里它自己建的一个文件夹 <code>${d.dir}</code>。到第 ${d.callEnd} 次调用，也就是快结束的时候，它删掉了这个文件夹。`,
      short: "临时文件夹",
    },
    helper: {
      title: "为只有一项的下标新加的检查",
      text: (d) => `在第 ${d.call} 次调用中，它加了一个函数 <code>${d.name}</code>，让 Black 保留 <code>${d.subCase}</code> 这类写法里的逗号，因为去掉这个逗号会改变代码的含义。`,
      short: "新加的检查",
    },
    fail1: {
      title: "测试失败：它弄坏了一个原有的用例",
      text: (d) => `第 ${d.call} 次调用第一次运行 Black 自己的测试，有一项失败了：<code>${d.test}</code>，这个用例之前是通过的。修复的第一个版本改变了它的预期输出。`,
      short: "第一次失败",
    },
    fail2: {
      title: "测试又失败了：第二遍的结果不同",
      text: (d) => `修好那个问题之后，第 ${d.call} 次调用再次运行测试，<code>${d.test}</code> 失败了。Black 会把代码格式化两遍，检查结果是否不变，而这里第二遍的结果不一样。直到第 ${d.callFix} 次调用，它才找到原因并修好。`,
      short: "第二次失败",
    },
    pass: {
      title: "所有测试都通过了",
      text: (d) => `第 ${d.call} 次调用：<code>${d.line}</code>。再下一次运行加上了针对 issue 中例子的测试用例，结果相同。`,
      short: "通过的测试",
    },
    mypy: {
      title: "它没法做类型检查",
      text: (d) => `在第 ${d.call} 次调用中，它想运行类型检查工具 mypy，但环境里没有安装。`,
      short: "缺少的类型检查工具",
    },
    reformat: {
      title: "最后一次测试之后，Black 又改写了一个文件",
      text: (d) => `最后一次运行测试是在第 ${d.callTest} 次调用。在第 ${d.call} 次调用中，智能体用 Black 格式化自己改过的代码，Black 改写了 <code>${d.file}</code>。之后没有再运行测试。`,
      short: "最后一次测试之后的重新格式化",
    },
  },

  summary: {
    title: "摘要写了什么",
    p1: (d) => `下面是完整的摘要，也就是 Claude Code 放在新对话开头的样子。模型把它写成了 ${d.sections} 个带编号的部分。高亮的段落说的是会话里发生过的事，选中一段，就能看到它说的是哪次调用。代码块已折叠。`,
    p2: (d) => `它写得很全面：列出了每个改动过的文件、两个新函数和新加的测试用例，还为两次测试失败单独写了一节，<q lang="en">${d.errorsName}</q>。也有几处奇怪的地方。它开头说之前的对话已经用完了上下文（<q lang="en">${d.ranOut}</q>），其实并没有。它的 <q lang="en">${d.pendingName}</q> 一节里还有关于提交信息和拉取请求（pull request）的指示，而 issue 和我们的问题都没有提出这些要求。录制记录看不出它们从哪里来。`,
    docLabel: "模型写的摘要",
    head: (d) => `摘要 · 由模型撰写 · ${d.chars} 个字符`,
    code: (n) => `代码，${n} 行`,
    callOf: (n) => `第 ${n} 次调用`,
    notes: {
      ranOut: () => `上下文并没有用完。这次压缩是我们要求的，而且最后一次调用读到的量远低于我们设定的大小。`,
      kept: () => `原样保留的那条消息，是这次运行的最后一个回答。录制记录没有记下是哪一条消息；Claude Code 的会话文件里有，我们为写笔记读过这个文件。`,
      transcript: () => `模型本可以从那个文件里读到旧的对话。我们提问时，它一个工具都没用，所以它没有读。`,
      attribution: () => `这次会话里没有人要求过这一点：issue 没有，我们的问题也没有。录制记录看不出它从哪里来。对我们问题的回答也没有照着它做。`,
    },
  },

  next: {
    title: "随摘要一起发过去的内容",
    p1: (d) => `压缩之后，Claude Code 报告的是 ${d.post} 个 token。回答我们问题的那次调用读了 ${d.next} 个，是它的 ${d.ratio} 倍。相差的 ${d.diff} 个 token，是 Claude Code 附在摘要前后一起发送的内容：开场设定（它的指令和每个工具的说明）、旧对话的最后一条消息（原样保留），以及智能体一直在改的几个文件的副本。`,
    p2: () => `录制记录列出了这些文件。上面这份清单的其余部分来自 Claude Code 的会话文件，我们为写录制笔记读过它。两者都没有把这次调用的 token 按这几部分拆开，所以图里只画了测量到的数字。`,
    figTitle: "三个大小，单位是 token，同一比例",
    rowPre: (d) => `压缩前：${d.pre}`,
    rowPost: (d) => `压缩后，按 Claude Code 的统计：${d.post}`,
    rowNext: (d) => `下一次调用读取的量：${d.next}`,
    legendCached: "从缓存读取",
    legendFresh: "重新写入缓存",
    legendPre: "压缩前",
    label: (d) => `三行方块，每个方块代表 ${d.unit} 个 token。压缩前是 ${d.pre} 个 token。压缩后，按 Claude Code 的统计是 ${d.post} 个。下一次调用读了 ${d.next} 个：${d.cached} 个从缓存读取，${d.fresh} 个是新写入的。`,
    filesTitle: "Claude Code 在摘要之后附上的文件",
    full: (d) => `全文 · ${d.chars} 个字符`,
    stub: "只有文件名，没有内容",
    p3: (d) => `这 ${d.fileCount} 个文件里，有 ${d.fullCount} 个附上了全文，都是智能体加过用例的测试文件。另外 ${d.stubCount} 个只写了文件名，并注明模型需要时可以去读。它没有去读：回答我们的问题时，它一个工具都没用。`,
    p4: (d) => `这 ${d.next} 个 token 里，有 ${d.cached} 个来自缓存。这${d.same}这次运行的第一次调用从缓存读取的量，那时对话里还一轮都没有。在那之后的部分全是新的：${d.fresh} 个 token，几乎全部又重新写入了缓存。`,
    sameExact: () => `恰好等于`,
    sameNear: (d) => `接近 ${d.c1} 个，也就是`,
    p5: (d) => `我们的问题是在压缩之后 ${d.gap}才问的，比这次会话的缓存副本保留的一小时还长（见第三章）。录制记录看不出这 ${d.cached} 个 token 是从哪里缓存下来的。在第三章的小实验里，压缩之后的那个问题完全没有从缓存读到内容。`,
  },

  test: {
    title: "记忆测试",
    p1: (d) => `我们的问题是：<q lang="en">${d.prompt}</q>模型一个文件都没读就回答了。它的完整回答如下：`,
    answerHead: (d) => `回答 · 压缩之后 · ${d.out} 个 token`,
    p2: () => `我们把回答和会话实际做过的事对照了一遍，它说的都对。每一点也都能在模型收到的内容里找到：要么在摘要里，要么在原样保留的旧对话最后一条消息里。下表列出每一点出现在哪里，但说明不了模型用的是哪一份。`,
    matrixCaption: "回答里的各个要点，以及每一点出现在哪里",
    cols: ["回答说", "会话", "摘要", "保留的最后一条消息"],
    yes: "有",
    no: "没有",
    notShown: "可见文本里没有",
    p3: (d) => `回答没有说的，是修复是怎么来的。测试中途失败了两次：先是修复弄坏了一个原有的用例，然后又有一个用例在 Black 的第二遍里结果不同。摘要在 <q lang="en">${d.errorsName}</q> 下面写了这两次失败，所以模型知道这些。回答一次都没有提。它把修好第二次失败的那处改动，列成了修复允许的情况之一：<q lang="en">${d.allowed}</q>录制记录能说明的就是这些，说明不了模型为什么没有提。`,
    keptTitle: "这次运行的最后一条消息，也就是被保留的那条",
    rows: {
      files: (d) => `它改了哪 ${d.n} 个文件`,
      defs: () => `两个新函数的名字`,
      tests: (d) => `最后一次测试的结果：<code>${d.line}</code>`,
      mypy: () => `mypy 没有安装`,
      order: () => `最后一次测试是在 Black 改写一个文件之前运行的`,
      pr: () => `更新日志（changelog）条目为什么没有拉取请求编号`,
      indent: () => `奇怪的缩进是另一个更早就有的问题`,
    },
  },

  cost: {
    title: "花了多少钱",
    p1: (d) => `压缩也要花钱。按 Claude Code 的记录，写这份摘要花了 ${d.compact}。录制记录只给出这个总额，没有给出背后的 token 数。`,
    p2: (d) => `我们的问题花了 ${d.after}。按第三章用的价格算，其中 ${d.writeCost}（${d.writePct}）花在把 ${d.written} 个 token 重新写入缓存上。回答的 ${d.out} 个 token 花了 ${d.outCost}，从缓存读取的 ${d.cached} 个 token 花了 ${d.readCost}。`,
    p3: (d) => `压缩加上一个问题，一共是 ${d.both}。整次运行的 ${d.calls} 次调用加起来是 ${d.run}。`,
    figTitle: "两项费用，单位是美元，同一比例",
    rowCompact: (d) => `写摘要：${d.compact}`,
    rowAfter: (d) => `之后我们的问题：${d.after}`,
    recorded: "录制的总额，未拆分",
    legendCached: "从缓存读取",
    legendFresh: "写入缓存",
    legendOut: "模型写出的内容",
    label: (d) => `同一比例的两根横条。写摘要花了 ${d.compact}。之后的问题花了 ${d.after}：从缓存读取 ${d.readCost}，写入缓存 ${d.writeCost}，回答 ${d.outCost}。`,
    mismatch: () => `按公布的价格算不出这次调用录制的费用，所以本页不拆分它。`,
  },

  stats: {
    pre: "个 token，压缩前",
    post: "个 token，压缩后（Claude Code 的统计）",
    next: "个 token，下一次调用读取",
    cost: "压缩一次，再问一个问题",
  },

  handoff: {
    kicker: "下一章",
    title: `<a href="../tools/index.html">第五章：工具与权限</a>`,
    p1: (d) => `在这次会话里，有 ${d.denied} 条命令需要批准，而没有人在场批准，所以被拒绝了；另一些不在允许列表里的命令却照样运行了。第五章看的是模型拿到的每个工具的说明，以及决定什么可以运行的规则。`,
  },

  colophon: {
    title: "关于录制",
    // d.source is the trace's English note on how it was recorded; it is said here in Chinese.
    model: (d) => `这是一次真实的 Claude Code 会话，用 <code>claude -p --output-format stream-json</code> 录制。路径和本地用户名做了脱敏处理，其他内容没有改动。模型 <code>${d.model}</code>，Claude Code <code>${d.ccv}</code>，推理强度（effort）保持默认。这就是第二章和第三章用的那次会话，只录了一次，没有重录。`,
    flags: "会话启动时用的命令：",
    autocompact: (d) => `<code>${d.flag}</code> 是我们的设置。Claude Code 的帮助文本这样描述这个选项：<q lang="en">${d.help}</q>。会话一直没有长到这个大小，所以它从来没有自己压缩过。`,
    compact: "然后我们手动压缩，用同样的设置恢复这次会话：",
    after: (d) => `过了 ${d.gap}，我们问了那一个问题，同样是用同样的设置恢复会话。在那之前，我们从项目文件夹里删掉了一个文件：运行结束后我们自己的检查写下的一个 Python 缓存文件。智能体的文件都保持它离开时的样子。`,
    sources: () => `各项内容的出处。录制记录里有：摘要、Claude Code 在压缩前后报告的大小、压缩的费用、它附上的文件（及其字符数），以及那个问题的用量和回答。哪条消息被原样保留，以及那个问题的调用还收到了什么，来自 Claude Code 的会话文件。我们为写录制笔记读过这个文件；它没有公开，因为里面有本地路径。`,
    prices: (d) => `价格来源：Anthropic 的定价页面 <a href="${d.url}">${d.urlText}</a>，“${d.row}”这一行，核对于 ${d.checked}，与第三章相同。按这些价格算出的我们这个问题的费用是 ${d.computed}，与录制的 ${d.recorded} 一致。`,
    paths: (d) => `模型看到的是真实的文件夹路径。本页把它显示为 <code>${d.alias}</code>，摘要里指向旧对话的路径也用同样的方式缩短了。`,
    traces: "录制记录：",
    traceName: "会话、压缩和提问",
    json: "同样的数据有 JSON 格式的版本，在仓库的 <code>data/</code> 文件夹里。",
    // The repo's address comes from chapters.js, which this page loads before its copy.
    translated: () => `中文由 Claude 翻译，<a href="${(window.CHAPTERS || {}).repo}/issues">欢迎指正</a>。录制内容保持英文原文。`,
  },
};
