// English copy for chapter 2: narration and every UI label. Numbers never appear here. Each function
// gets `d`, the values app.js reads from the recording (window.TRACE), already formatted, and some get
// `p`, one phase of the session. A translated page loads its own copy file instead of this one.
window.COPY = {
  locale: "en-US",

  duration: (m, s) => `${m} min ${s} s`,
  durationLong: (m, s) => `${m} minutes and ${s} seconds`,
  seconds: (s) => `${s} s`,
  tokens: (n) => `${n} tokens`,
  plusTokens: (n) => `+${n} tokens`,
  toolCount: (n, tool) => `${n} ${tool}`,

  // What the model was asked, in plain words.
  intro: {
    ch1: (d) => `Chapter 1's agent fixed a toy game in ${d.ch1Calls} calls. This time the project is real: <a href="${d.repoUrl}">black</a>, a tool that rewrites Python code in one consistent style. black is open source: its code is public, and anyone may read it, change it and suggest fixes. The code is kept on GitHub, a website where many projects keep theirs, and people report bugs there in posts called issues. We gave Claude Code a copy of black's code and one of those issues, word for word. The issue's title:`,
    showPrompt: "The whole prompt, as the model got it",
    plain: () => `In plain words: black is meant to change how code looks, never what it does. Here it added one comma, and that comma turned a small function (a <code>lambda</code>) into a tuple, a bundle of values. Any code that called the function would then crash. The project fixed this bug later. The code we gave the agent is from just before that fix.`,
    run: (d) => `The session took ${d.durationLong}. The model was called ${d.calls} times and made ${d.toolCalls} requests: ${d.toolCountList}. It was recorded on ${d.date} with ${d.model}. We recorded it once and show that one run as it happened.`,
  },

  context: {
    define: () => `In chapter 1 you saw the loop. The model writes a request, the <strong>harness</strong> (the program around the model, here Claude Code) runs it and pastes the result back, and the model is called again.`,
    define2: () => `Each call sends everything: the set-up (instructions and a description of each tool the model may ask for), your message, and every request and result so far. All of that is the model's <strong>context</strong>. It is counted in <strong>tokens</strong>. A token is a word or a piece of one.`,
    define3: () => `The most a model can take in on one call is its <strong>context window</strong>.`,
    compare: (d) => `Chapter 1's last call read ${d.ch1Last} tokens. This session's last call read ${d.last}, ${d.ch1Ratio} times as many.`,
    figTitle: "What the last call read, in tokens",
    ch1Bar: (d) => `Chapter 1: the game, call ${d.ch1Calls}`,
    ch2Bar: (d) => `This chapter: black, call ${d.calls}`,
    markLabel: (d) => `compact at ${d.autocompactShort} (our setting)`,
    caption: (d) => `Both sessions drawn to the same scale. The line at ${d.autocompact} tokens is a setting we passed when we started Claude Code. Past that point, Claude Code would compact the conversation: replace it with a shorter summary. Chapter 4 is about compaction. The model's own limit isn't in the recording, so it isn't drawn here.`,
    chartLabel: (d) => `Bar chart. Chapter 1's last call read ${d.ch1Last} tokens; this chapter's last call read ${d.last}. A line marks ${d.autocompact} tokens, where we set Claude Code to compact.`,
  },

  explore: {
    intro: (d) => `Drag the slider through the ${d.calls} calls. The squares are the conversation that call reads, drawn to scale: one square is ${d.unit} tokens. A call is one turn of the model: it reads the conversation and writes a reply. Each call adds one round to the conversation: what the model wrote, and the results that came back. So a call reads the set-up and every round before it, and its newest block is the round from the call before. Point at a block, or Tab to it and use the arrow keys, to see which request and result it holds. The phases are our grouping, from reading the recording.`,
    title: "Scrub through the session",
    scrub: "Call",
    prev: "Previous call",
    next: "Next call",
    callOf: (n, total) => `Call ${n} of ${total}`,
    clock: (t) => `at ${t}`,
    reads: (tokens) => `reads <b>${tokens}</b> tokens`,
    soFar: (sum, n) => `${sum} read so far, over ${n} calls`,
    soFarOne: (sum) => `${sum} read so far, on this first call`,
    valueText: (n, total, phase, tokens) => `Call ${n} of ${total}, ${phase}: reads ${tokens} tokens`,
    phases: "Jump to a phase",
    gridLabel: (n) => `The conversation call ${n} reads, one block per round. Use the arrow keys to move between blocks.`,
    legendSys: "set-up and the issue",
    legendModel: "what the model wrote",
    legendBack: "what came back",
    legendFuture: "still to come",
    roundName: (r) => `Round ${r}`,
    setupName: "Set-up and the issue",
    setupBody: (d) => `Instructions, a description of each tool, and the issue text. The recording gives the size of this block, not its text. ${d.cache1} of these tokens were already in the cache when the first call read them, left there by an earlier session.`,
    split: (model, back) => `the model wrote ${model} · ${back} came back`,
    roundLabel: (r, phase, tokens, model, back, tools) => `Round ${r}, ${phase}: ${tokens} tokens. The model wrote ${model}, and ${back} came back from ${tools}.`,
    setupLabel: (tokens) => `Set-up and the issue: ${tokens} tokens.`,
    refused: "refused",
    error: "error",
    lines: { one: (n) => `${n} line back`, other: (n) => `${n} lines back` },
    readRange: (from, to) => `lines ${from} to ${to}`,
    said: "The model also wrote",
    newest: "newest",
  },

  // One per phase. Names are short; texts describe what the agent did in that stretch of calls.
  phases: {
    reproduce: {
      name: "Reproduce the bug",
      text: (d) => `The agent first tries to make the bug happen. Its first command is refused: the parts that make a folder and a file weren't on the list of allowed commands, so they needed approval, and no one was there to give it. It writes the test file inside the folder instead, runs black on it and gets the stray comma from the issue, <code>${d.symptom}</code>. Then it reads the part of black that splits long lines.`,
    },
    diagnose: {
      name: "Find the cause",
      text: () => `It pulls up the helper functions that add a trailing comma (a comma after the last item in a list), writes a small script to watch black split a line, and reads how black keeps track of brackets.`,
    },
    fix1: {
      name: "First fix",
      text: (d, p) => `Two edits to <code>${p.edited}</code>, then a test on the issue's example and two variants of it. The model's verdict: <q>${p.say(/gone/)}</q> One case is still wrong, though.`,
    },
    subscript: {
      name: "A second case",
      text: (d, p) => `With <code>-C</code>, an option that tells black to ignore a comma left after the last item (a "magic" trailing comma), square brackets holding one item, like <code>${d.subCase}</code>, lost the comma they need. The agent reads more of black and edits <code>${p.edited}</code>, then reports: <q>${p.say(/stability/)}</q>`,
    },
    suite: {
      name: "Run the tests",
      text: (d, p) => `It runs black's own tests, stopping at the first failure: <code>${p.firstTest}</code>. More edits keep an older expected result as it was, and the next full run gives <code>${p.lastTest}</code>. The failing test runs black a second time on its own output, and the result changes again. In the model's words: <q>${p.say(/instability/)}</q>`,
    },
    instability: {
      name: "Chase a result that won't settle",
      text: (d, p) => `It adds print lines to its new helper function to watch it work, and finds out why: <q>${p.say(/repeated calls/)}</q> One more edit to <code>${p.edited}</code>, and the full run passes: <code>${p.lastTest}</code>.`,
    },
    wrapup: {
      name: "Tests and tidy-up",
      text: (d, p) => `It adds the issue's examples to black's test files and runs the tests again (<code>${p.lastTest}</code>). It adds an entry to the changelog, the file where the project lists what changed in each release. It tries to run a type checker, a tool that catches values of the wrong kind, but the checker isn't installed. Then it formats its own code with black and deletes its scratch folder.`,
    },
    answer: {
      name: "The answer",
      text: () => `The last call has no request in it, so the harness stops. The model explains the cause and both fixes, says what it didn't fix and what it couldn't check, and suggests comparing its fix with the one the issue mentions.`,
    },
  },

  fills: {
    title: "What fills the conversation",
    p1: (d) => `By the last call, the set-up and the issue were ${d.setupPct} of the conversation. The rest came in round by round, and it split almost evenly: ${d.modelPct} was the model's own writing (its requests, its notes to you, and reasoning the recording counts but doesn't show), and ${d.backPct} was results the harness pasted back.`,
    p2: (d) => `Among the results, files it read and command output weigh the most. The biggest single round was round ${d.bigRound}, ${d.bigAdd} tokens, when the harness pasted back ${d.bigWhat}. The ${d.denied} refused commands added only ${d.deniedTokens} tokens between them: each came back as a short error, and the agent found another way.`,
    bigRead: (lines, file) => `${lines} lines of <code>${file}</code>`,
    figTitle: "The last call's conversation, by kind, in tokens",
    chartLabel: "Bar chart of the tokens in the last call's conversation, by kind.",
    kinds: {
      sys: "Set-up and the issue",
      model: "What the model wrote",
      Read: "Files it read (Read)",
      Bash: "Command output (Bash)",
      Grep: "Search results (Grep)",
      Glob: "File lists (Glob)",
      edit: "Edits and new files confirmed (Edit, Write)",
      refused: "Refused commands",
    },
    value: (n, pct) => `${n} · ${pct}`,
    note: () => `How we split it. The API (the service programs use to send text to the model and get its reply) reports how many tokens each call read and wrote, not what each result weighed. So the model's part of a round is what the API says it wrote on that call, and the rest of the round's growth counts as what came back. When a round has several results, that rest is shared out by their length in characters. The parts are estimates; the totals are exact.`,
  },

  reread: {
    title: "Every call reads it all again",
    p1: (d) => `The model doesn't remember the call before. Every call reads the conversation from the top, so a result pasted in early is read again on every call after it. Over the ${d.calls} calls, the model read <strong>${d.sumRead}</strong> tokens, ${d.sumRatio} times the size of the final conversation.`,
    p2: (d) => `The conversation grows one round at a time, but every call reads all of it, so the total read climbs faster as the session goes on. By call ${d.half}, halfway, the model had read ${d.halfSum} tokens. The second half read ${d.secondHalf}, ${d.halfRatio} times as much.`,
    figTitle: "Tokens, call by call",
    seriesSum: "read so far",
    seriesCtx: "the conversation",
    caption: () => `Both lines use the same scale. Move along the chart, or focus it and use the arrow keys, to read each call.`,
    chartLabel: (d) => `Line chart over ${d.calls} calls. The conversation grows to ${d.last} tokens; the total read grows to ${d.sumRead}.`,
    tip: (n, sum, ctxTokens) => `Call ${n}: ${ctxTokens} in the conversation, ${sum} read so far`,
    axisX: "call",
  },

  speed: {
    title: "What made a call slow",
    p1: () => `It's easy to assume each call takes longer as the conversation grows, since there's more to read. This session doesn't show that.`,
    p2: (d) => `We timed each call from the moment the last result came back to the moment the first part of the reply arrived. Replies arrive in whole pieces, not word by word, so that time includes writing the first piece. Against how much the call read, the times scatter with no pattern: a correlation of ${d.rCtx}. Against how much the call wrote, they line up: ${d.rOut}. A correlation near zero means no straight-line link; near one, the two rise together.`,
    p3: (d) => `The longest wait, ${d.maxWait} seconds, was call ${d.maxCall}, which wrote ${d.maxOut} tokens. The last call read the most, ${d.last} tokens, and took ${d.lastWait} seconds.`,
    p4: () => `This is one session, on one model. It doesn't tell you what happens with much bigger conversations. The first call is left out of the charts because its time also includes Claude Code starting up.`,
    panelCtx: (r) => `Against tokens read · correlation ${r}`,
    panelOut: (r) => `Against tokens written · correlation ${r}`,
    axisY: "seconds",
    axisCtx: "tokens read",
    axisOut: "tokens written",
    chartLabel: (what, r) => `Scatter plot of each call's wait in seconds against ${what}. Correlation ${r}.`,
    tip: (n, secs, read, wrote) => `Call ${n}: ${secs} s, read ${read}, wrote ${wrote}`,
  },

  table: {
    summary: "Every call as a table",
    caption: "Each model call in the recording. Waits are measured as in the charts above.",
    cols: ["Call", "Phase", "Reads", "From the cache", "New", "Wrote", "Wait (s)"],
    firstWait: "start-up",
  },

  outcome: {
    title: "Did the fix work?",
    p1: (d) => `The recording ends with the agent's own answer: <q>${d.claim}</q> The checks below go beyond the recording. We ran them afterwards, on copies of the folder; they're in our recording notes, not in the trace.`,
    p2: (d) => `We ran black's tests again on the folder the agent left. The result matched its own last run: ${d.lastSuite}.`,
    p3: (d) => `Then we ran the test cases from black's own fix for this issue on the agent's code. Black's fix adds cases to two test files, and on the agent's code one of them failed. The failure comes down to one line: black's fix also changed an existing expected result, dropping a comma, and the agent had kept that comma on purpose. Its answer says why: <q>${d.keepQuote}</q> With that one line as it was before, every new case in black's fix passes.`,
    p4: () => `The agent's change is also bigger than black's own. It touches the same three source files and adds more code to them than black's fix does. Passing the tests doesn't show that the extra code is right, and we didn't check it further. One working fix in one session doesn't mean agents fix bugs reliably; chapter 7 is about when they don't.`,
  },

  next: {
    kicker: "Next",
    title: `<a href="../cache/index.html">Chapter 3: Caching</a>`,
    p1: (d) => `Of the ${d.sumRead} tokens the model read, ${d.cacheTotal} (${d.cachePct}) came from a <strong>cache</strong>, a stored copy of text the model's provider had seen recently. What is it, and what breaks it?`,
    p2: (d) => `After the run, we also asked Claude Code to compact the conversation by hand. It went from ${d.pre} tokens to ${d.post}. Chapter 4 is about what a compaction keeps and what it drops.`,
  },

  stats: {
    calls: "model calls",
    duration: "from start to answer",
    sumRead: "tokens read",
    cost: "at list price",
  },

  colophon: {
    title: "About the recording",
    model: (d) => `${d.source} Model <code>${d.model}</code>, Claude Code <code>${d.ccv}</code>, effort left at its default.`,
    flags: "Started with:",
    autocompact: (d) => `<code>--autocompact</code> is our setting: it tells Claude Code to compact the conversation at ${d.autocompact} tokens, the smallest size it accepts. This session never got there, so we compacted it by hand after it finished.`,
    oneRun: () => `We recorded this session once, with no re-runs, and show it as it is.`,
    permissions: (d) => `Without asking, the agent could run Python and read-only git commands, and read and edit files. Other commands needed approval, and with no one there to give it, ${d.denied} were refused. Some other commands outside that list ran anyway; the recording doesn't say why.`,
    setup: (d) => `We took black's code from <a href="${d.commitUrl}">its GitHub repository</a> at the commit just before its own fix, with its test tools installed in a fresh Python environment. We removed a few settings that our own tools add to the environment. One of them, <code>NO_COLOR</code>, makes two of black's tests fail, so the agent would have seen failures that had nothing to do with the bug.`,
    web: (d) => `<a href="${d.issueUrl}">The issue</a> names a pull request with a fix. The agent had no web tool (its tools: ${d.tools}) and didn't look it up; its answer suggests comparing the two.`,
    paths: (d) => `The model saw the real folder path. This page shows it as <code>${d.alias}</code>.`,
    times: () => `Token counts are the usage the API reported on each call. Times are when each line of output arrived, counted from when the recorder started Claude Code.`,
    traces: "The traces:",
    traceCh2: "this session",
    traceCh1: "chapter 1's session",
    traceSep: ", ",
    json: "The same data as JSON is in the repo's <code>data/</code> folder.",
  },
};
