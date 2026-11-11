// Chinese copy for chapter 1 (site/zh/loop/): step narration and every UI label, including the
// HarnessStep widget's. Same keys as site/loop/copy.en.js. Numbers never appear here: each function gets
// `d`, the values app.js reads from the recording, already formatted for zh-CN. What the agent wrote or
// saw (its text, commands, outputs, file names) is passed in as recorded and stays in English.
window.COPY = {
  locale: "zh-CN",

  ui: {
    stepOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
    who: { you: "你", model: "模型", harness: "外壳程序" },
    prev: "上一步",
    next: "下一步",
    play: "播放",
    pause: "暂停",
    live: "按真实速度观看",
    livePause: "暂停观看",
    clock: (now, total) => `${now} / ${total}`,
    clockLabel: "录制中的时间",
    scrub: "步骤",
    skipRound: "交给外壳程序去做",
    again: "再当一次外壳程序",
    contextLabel: "模型读到的内容，按比例绘制",
    legendSys: "开场设定：指令、工具说明和你的消息",
    legendRound: (list) => `每一轮：模型的请求和结果（${list}）`,
    setupBlock: (d) => `开场设定 · ${d.setup}`,
    roundTitle: (n, tokens) => `第 ${n} 轮：+${tokens} 个 token`,
    // The bar's text alternative, for the rounds that have landed so far (list: "+96, +4,893").
    stackLabel: (d, n, list) => n
      ? `按比例绘制的条形：开场设定 ${d.setup} 个 token，之后 ${n} 轮：${list} 个 token。`
      : `按比例绘制的条形：开场设定 ${d.setup} 个 token，还没有开始任何一轮。`,
  },

  // Shown under the clock in "Watch it live".
  status: {
    waitFirst: "等待模型的第一次回复",
    model: "模型正在读对话、写回复",
    harness: "外壳程序正在执行请求",
    finished: "结束：这次回复里没有请求",
  },

  count: {
    you: (d) => `第一次调用将读入 <b>${d.c[0]}</b> 个 token`,
    req: (d, n, i) => `第 ${n} 次调用读入 <b>${d.c[i]}</b> 个 token，其中 ${d.cached[i]} 个从缓存读取`,
    res: (d, i) => `对话现在是 <b>${d.c[i + 1]}</b> 个 token（+${d.added[i + 1]}）`,
    pending: (d, i = 0) => `对话现在是 <b>${d.c[i]}</b> 个 token，结果还没放进去。`,
  },

  cards: {
    you: "你",
    youMeta: "在 Claude Code 里输入",
    setup: "开场设定",
    setupMeta: (d) => `连同你的那句话共 ${d.setup} 个 token`,
    setupBody: "录制记录里只有这一段的大小，没有它的原文。Claude Code 通过 Anthropic 的 API 把它发出去，API 就是程序用来把文本发给模型的服务。这类请求里装着什么（指令、模型可以请求的工具、到目前为止的对话），出自 Anthropic 公开的 API 文档，而不是这次录制。",
    request: "请求",
    result: "结果",
    modelWrites: "模型写道",
    finalAnswer: "模型写道 · 最终回答",
    plain: "纯文本",
    file: "文件",
    toolMeta: { Glob: "查找文件", Read: "读取文件", Edit: "修改文件", Grep: "搜索文件内容", Bash: "运行命令" },
    linesBack: { one: (n) => `贴回 ${n} 行`, other: (n) => `贴回 ${n} 行` },
    excerpt: (shown, total) => `共 ${total} 行，显示 ${shown} 行`,
    skipped: { one: (n) => `…… 此处省略 ${n} 行 ……`, other: (n) => `…… 此处省略 ${n} 行 ……` },
  },

  // Plain words for each tool, used in the set-up prose.
  toolPlain: { Glob: "查找文件", Grep: "在文件里搜索", Read: "读取文件", Edit: "修改文件", Bash: "运行命令" },

  steps: {
    // Live mode, on a harness step whose first result hasn't arrived yet.
    waiting: {
      title: () => "外壳程序去执行",
      text: () => "外壳程序正在执行请求，结果还没回来。",
    },
    you: {
      title: () => "你输入一句话",
      text: (d) => `Claude Code 是<strong>外壳程序</strong>（harness）：包在模型外面的那个程序，负责把文本发给模型，照模型的要求去做，再把结果报回去。模型加上替它执行请求的外壳程序，一轮一轮地循环下去，就是<strong>智能体</strong>。你的这句话会和一段开场设定一起发出去，开场设定排在前面，里面是指令，以及模型可以请求的每个工具的说明（${d.toolList}）。这些加起来是 <strong>${d.setup} 个 token</strong>。token（词元）指一个词或词的一部分。`,
    },
    c1req: {
      title: (d, n) => `第 ${n} 次调用：文件夹里有什么？`,
      text: (d) => `模型读完全部 ${d.c[0]} 个 token，写出一条回复。它自己看不到文件夹，所以这条回复是一个<strong>请求</strong>，用外壳程序能看懂的格式写成。这个请求要的是所有文件名：<code>${d.globPattern}</code> 能匹配任何文件夹里的任何文件。其中 ${d.cached[0]} 个 token 来自<strong>缓存</strong>（cache），也就是最近文本存下的一份副本，再读一遍更便宜（见第三章）。`,
    },
    round1: {
      title: (d, n) => `第 ${n} 轮：你来当外壳程序`,
      text: () => "模型什么都运行不了，所以由外壳程序来运行。这一轮，你来当外壳程序：先执行请求，再把输出放进对话里，拖过去或者点粘贴按钮都行。",
      textDone: (d) => `循环的一轮就是这样。一次<strong>调用</strong>，是模型读一遍对话、写出一条回复；一<strong>轮</strong>，是外壳程序执行这条回复里的请求，再把结果放进对话。模型会在下一次调用时读到这个结果。对话多了 ${d.added[1]} 个 token。从这里开始，外壳程序自己往下走。`,
    },
    c2req: {
      title: (d, n) => `第 ${n} 次调用：读代码`,
      text: (d) => `模型从头再来，把整段对话从第一行读起，现在是 ${d.c[1]} 个 token。它在一条回复里请求读取 ${d.readFiles}，没有要 ${d.unread}。`,
    },
    c2res: {
      title: () => "代码传回来了",
      text: (d) => `外壳程序把两个文件整个贴了进来：<code>${d.mainFile}</code> 的 ${d.gameLines} 行，和 ${d.testLines} 行测试。这是整个会话里涨得最多的一次，<strong>+${d.readAdded} 个 token</strong>。bug 就在里面，没有任何标记，模型只能靠读把它找出来。卡片里只显示了其中几行。`,
    },
    c3req: {
      title: (d, n) => `第 ${n} 次调用：先跑测试`,
      text: (d) => `动手改之前，模型先请求运行游戏的测试，并且只保留输出的最后 ${d.tail1} 行。这条回复里没有写给你的话，只有请求。`,
    },
    c3res: {
      title: () => "有一个测试没通过",
      text: (d) => `${d.bashWait} 秒后，结果传了回来。输出里有一个失败的测试 <q lang="en">${d.failName}</q>，还有没通过的那条检查 <code>${d.assertion}</code>：球落到球拍上以后，应该往上走。那 ${d.tail1} 行里没有汇总，所以模型知道哪个测试失败了，却不知道通过了几个。`,
    },
    c4req: {
      title: (d, n) => `第 ${n} 次调用：修复，再检查`,
      text: (d) => `这一次，模型修改了 <code>${d.mainFile}</code>。它把 ${d.oldLines} 行换成 ${d.newLines} 行，让检查从球拍的中心量起，原来是从左边缘量起。在同一条回复里，它还请求再跑一遍测试。`,
    },
    c4res: {
      title: (d) => `${d.tests} 个测试，${d.pass} 个通过`,
      text: (d) => `外壳程序先改文件，再跑测试。这一次，最后 ${d.tail2} 行里有汇总：共 ${d.tests} 个测试，${d.pass} 个通过，${d.fail} 个失败。`,
    },
    final: {
      title: (d, n) => `第 ${n} 次调用：没有请求的回复`,
      text: (d) => `模型把所有内容又读了一遍，共 ${d.c[d.last]} 个 token，然后写给你。这条回复里<strong>没有请求</strong>，外壳程序看到这一点就停下来。最后一段说，它检查过快速运动的球不会越过球拍。这项检查是写在回复里的算术，并没有为它运行任何命令。`,
    },
  },

  // Labels for the "you are the harness" widget (site/harness-step.js).
  harness: {
    conversationTitle: "对话",
    computerTitle: "你的电脑",
    requestTitle: "请求",
    resultTitle: "结果",
    outputTitle: "输出",
    recordedNote: "录制的输出",
    idleNote: "你的浏览器里不会运行任何东西。执行请求时，重放的是录制下来的输出。",
    run: "执行请求",
    summaryLabel: "正在重放录制：",
    drag: "拖进对话",
    paste: "粘贴进对话",
    slotIdle: "结果会放在这里",
    dropHint: "把输出放在这里",
    pastedNote: "输出已经放进对话了。",
    liveStart: "模型的请求已经在对话里了。你是外壳程序：去执行这个请求。",
    liveRan: "录制的输出已经在你的电脑上了。把它粘贴进对话，或者拖过去。",
    liveDragStart: "正在拖动输出。把它放到对话的末尾。",
    liveSnapBack: "没有放到对话上。输出回到了你的电脑上。",
    liveDone: "结果已经在对话里了。这就是循环的一轮。",
  },

  game: {
    play: "玩一下",
    restart: "重新开始",
    stop: "停止",
  },

  // Computed lines in the static prose. `runsList` gets the run numbers already joined ("1和3").
  prose: {
    otherRuns: (list) => `${list}都是修复之后才跑的测试。`,
    runsList: (list) => `第 ${list.replace(/([、和])/g, " 次$1第 ")} 次运行`,
    runOne: (k) => `第 ${k} 次运行`,
    runLine: (r) => `第 ${r.k} 次运行：${r.calls} 次模型调用，${r.secs} 秒；修复前跑了测试：${r.before ? "是" : "否"}，修复后：${r.after ? "是" : "否"}。`,
    runShown: "本页展示的就是这一次。",
    traceLink: (k) => `第 ${k} 次运行`,
  },
};
