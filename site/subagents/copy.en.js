// English copy for chapter 6: the narration, every label, and the sentences that hold values. Numbers
// and the model's words never appear here. Each function gets `d`, the values app.js read from the
// recordings (window.TRACES), already formatted and escaped. A translated page loads its own copy file
// instead of this one.
window.COPY = {
  locale: "en-US",

  intro: {
    p1: () => `In chapter 1 an agent fixed a bug in a small game: the ball sometimes went straight through the paddle. Every call went into one conversation with the model, and the agent read the game's code itself. Chapter 2 measured that conversation as the <strong>context</strong>: everything the model reads on a call, counted in <strong>tokens</strong> (a token is a word or a piece of one).`,
    p2: () => `Here is the same bug again, with one change. This time the agent handed part of the job to a <strong>subagent</strong>: a second conversation with the model, which the agent starts itself. A subagent begins with a fresh context of its own, does one side task, and sends back a report. The main conversation doesn't get the subagent's steps. It gets a line naming the tools the subagent used, and the report.`,
    promptHead: "What we typed",
    p3: (d) => `${d.samePrompt ? "It starts with chapter 1's prompt, word for word. " : ""}The last sentence is ours: <strong>the prompt asked for a subagent</strong>, so the agent didn't decide to use one by itself. The notes at the end say what happened when we didn't ask.`,
    p4: (d) => `The agent starts a subagent the way it does everything else: it asks for a tool (chapter 5 is about tools). This tool is called <code>${d.agentTool}</code>. The request gives the task in the main model's own words, a short title for it (“${d.desc}”) and a kind of subagent, here <code>${d.subType}</code>. The <strong>harness</strong>, the program around the model (here Claude Code), runs the subagent's calls, then pastes its report into the main conversation as the result of that request.`,
  },

  threads: {
    p1: () => `Here is the whole run, call by call. Each bar is one call to the model, drawn as everything the model read on that call. The main conversation is on the left, the subagent's on the right, and time runs down the page. Both columns use the same scale.`,
    title: "What each call read, to one scale",
    mode: "Colour the bars by",
    modes: { kind: "what it is", cache: "the cache" },
    lanes: { main: "Main conversation", sub: "Subagent" },
    call: (n, tokens) => `Call ${n} · ${tokens} tokens`,
    wrote: (n) => `+ ${n} written: the report`,
    send: (d) => `The request goes out, with a task of ${d.promptChars} characters`,
    back: (d) => `The report comes back: ${d.handbackChars} characters, with Claude Code's note around it`,
    waiting: "waiting",
    handbackMark: "the hand-back",
    // What a call asked for, from its requests.
    did: {
      agent: "starts a subagent",
      read: (file) => `reads ${file}`,
      readRange: (file, a, b) => `reads ${file}, <span class="nw">lines ${a}–${b}</span>`,
      edit: (file) => `edits ${file}`,
      grep: "searches the code",
      glob: "looks for files by name",
      find: "lists the files",
      tests: "runs the tests",
      bash: "runs a command",
      answer: "writes its answer",
      report: "writes its report",
      join: "; ",
    },
    legend: {
      sys: "set-up: everything its first call read",
      model: "what the model wrote",
      back: "results pasted back",
      cached: "read from the cache",
      fresh: "new on this call",
      out: "written on this call",
    },
    note: (d) => `One scale for both columns: a full column is ${d.scaleMax} tokens. Coloured by what it is, as in chapter 2: the model's part of each step is what the API says the call before it wrote, and the rest is the results pasted back.`,
    readout: (d) => `The subagent's conversation reached <b>${d.subPeak}</b> tokens. Across the hand-back, the main conversation grew by <b>${d.growth}</b>.`,
    // Text alternatives for the rows.
    srCall: (lane, n, tokens, did) => `${lane}, call ${n}: read ${tokens} tokens, then ${did}.`,
    srSplit: (setup, model, back) => `Of those, ${setup} were the set-up, ${model} what the model wrote and ${back} results pasted back.`,
    srCache: (cached, fresh) => `${cached} read from the cache, ${fresh} new.`,
    srWrote: (n) => `It wrote ${n} tokens: the report.`,
    p2: (d) => `The subagent's first call read ${d.sub1} tokens, against ${d.main1} for the main conversation's first call. That was its starting set-up. Claude Code's own session files, which we don't publish, show what it holds: instructions and a tool manual of the subagent's own, and the task. The stream this page is built from doesn't hold that text, so the page shows only its size.`,
    p3: (d) => `While the subagent worked, the main conversation waited: no main call ran between ${d.sendAt} and ${d.backAt} in the recording, ${d.subDur} of the run's ${d.runDur} seconds. The subagent made ${d.subCalls} calls and used ${d.subTools} along the way.`,
    p4: (d) => `Its last call read ${d.subLast} tokens and wrote ${d.subOut} more: the report. Claude Code counts the subagent's whole conversation as ${d.subPeak} tokens. Of all that, the main conversation got the report and a short note. Its second call was ${d.growth} tokens bigger than its first, and that includes its own request for the subagent (${d.main1Out} tokens).`,
  },

  words: {
    p1: () => `Here is the task the main model wrote, and the report the subagent sent back, as recorded.`,
    request: "Request",
    inputs: "Its other inputs",
    task: "The task",
    p2: (d) => `The task doesn't quote your sentence. It asks for file paths, line numbers and the code itself.${d.guess ? ` It also carries a guess of the main model's own: “${d.guess}”. Tunneling is when a fast ball moves so far in one frame that it skips past the paddle.` : ""}${d.lastAsk ? ` It ends: “${d.lastAsk}”` : ""}`,
    report: "Report · from the subagent",
    chars: (n) => `${n} characters`,
    more: "Show the whole report",
    less: "Show less",
    hiddenNote: (n) => `${n} more characters`,
    p3: (d) => `The report names the bug: “${d.cause}”${d.noTests ? ` It also says: “${d.noTests}”` : ""}`,
    p4: () => `The main model didn't get the report by itself. Claude Code pasted it back as the result of the request, with a line naming the tools the subagent used, a note of its own, and every line of the report indented by two spaces. This is how it began:`,
    result: "Result",
    resultMeta: "what the main model got back",
    moreLines: { one: (n) => `… ${n} more line of the report …`, other: (n) => `… ${n} more lines of the report …` },
    p5: () => `The note tells the main model how to treat the report: as the subagent's words, which carry no authority from you. The recording shows the note; it doesn't show how much difference it makes.`,
  },

  cost: {
    title: "What it cost",
    p1: (d) => `A run is paid for by the token: what each call reads and what it writes. This run made ${d.calls} calls, ${d.mainCalls} in the main conversation and ${d.subCalls} in the subagent's. Claude Code's record splits the tokens between the two:`,
    caption: "Tokens, by conversation",
    cols: ["", "Main", "Subagent"],
    rows: { out: "written by the model", read: "read from the cache", write: "written to the cache" },
    p2: (d) => `${d.mostCached ? "Most of what each call read came from the " : "Much of what the calls read came from the "}<strong>cache</strong>: a stored copy of text the model's provider saw recently, which costs less to read again (chapter 3). Switch the figure above to “the cache” to see it call by call. From its second call on, each conversation read its own last call back from the cache. Even the first calls read from it: ${d.main1Cached} of the main conversation's ${d.main1} tokens, and ${d.sub1Cached} of the subagent's ${d.sub1}. Nothing in this run came before those calls, so an earlier session left that copy, most likely run 1 of this recording, which had ended about ${d.gap} seconds before. In run 1, the subagent's first call read ${d.r1Sub1Cached} tokens from the cache.`,
    p3: (d) => `The two conversations also asked for different cache lifetimes. Every cache write in the main conversation was marked to be kept for an hour (${d.main1h} tokens in all), and every write in the subagent's for five minutes (${d.sub5m}).`,
    p4: (d) => `The whole run cost <strong>${d.cost}</strong>. Claude Code records the cost only for the whole run, so this page doesn't split it between the two conversations.`,
  },

  shows: {
    title: "What this run shows",
    small: {
      title: "The main conversation stayed small",
      text: (d) => `The subagent read the whole of <code>${d.file}</code> and searched the other files. The main conversation got ${d.reportChars} characters of report and grew by ${d.growth} tokens. That is what a subagent is for: the reading and searching for a side task stay in a context of their own, and the main conversation, which every later call reads again, gets only the report.`,
    },
    trust: {
      title: "Nobody saw the test fail",
      readRange: (a, b, file) => `lines ${a}–${b} of <code>${file}</code>`,
      readWhole: (file) => `all of <code>${file}</code>`,
      text: (d) => `Before its fix the main conversation read ${d.mainRead} itself. It ran the tests only after the fix, when they passed (${d.pass} of ${d.tests}), and the subagent hadn't run them either. So no one in this run saw the failing test before the change${d.allRuns ? `, and the same is true of all ${d.runs} runs` : ""}. Here the report was right. The recording can't show what happens when one isn't.`,
    },
    tiny: {
      title: "On a game this small, the saving hardly shows",
      text: (d) => `Chapter 1's run of the same bug had no subagent. From its first call to its last, its conversation grew by ${d.ch1Growth} tokens; the main conversation here grew by ${d.mainGrowth}. But this run's first call was ${d.startDiff} tokens bigger (${d.main1} against ${d.ch1First}), so the two ended ${d.near ? "close together" : "apart"}: ${d.mainLast} tokens here, ${d.ch1Last} in chapter 1. This run's tool list had one more entry, <code>${d.extraTools}</code>, and its prompt one more sentence, and the two runs used different versions of Claude Code (${d.ccv} and ${d.ch1ccv}). The recordings don't say how much each of those added. This run also made ${d.calls} calls instead of ${d.ch1Calls}, and cost ${d.cost} against ${d.ch1Cost}.`,
    },
  },

  stats: {
    peak: "tokens in the subagent's conversation",
    growth: "tokens the main conversation grew by, across the hand-back",
    calls: "model calls, main + subagent",
    cost: "for the whole run",
    callsValue: (main, sub) => `${main} + ${sub}`,
  },

  next: {
    kicker: "Coming next",
    title: "Chapter 7: Failure modes",
    p1: (d) => `${d.allPassed ? "Every run in this chapter ended with its tests passing. " : ""}Agents don't always get there. Chapter 7 is about the ways they go wrong, and what each one looks like from inside the loop.`,
  },

  colophon: {
    title: "About the recordings",
    model: (d) => `Recorded on ${d.date}, starting at ${d.time} UTC, with model <code>${d.model}</code> and Claude Code <code>${d.ccv}</code>. Each run started in a fresh copy of chapter 1's buggy game, with:`,
    flags: (d) => `<code>--tools</code> and <code>--allowedTools</code> add <code>${d.extraTools}</code> to chapter 1's list. <code>--forward-subagent-text</code> makes Claude Code put the subagent's own text in its stream; without it, the call that writes the report is missing. Claude Code's list of tools at the start of the session names the same tool <code>${d.aliasName}</code>.`,
    runs: (d) => `We recorded ${d.runs} runs, one straight after another. The rule, fixed before the first one: show run 2, unless it has no subagent or doesn't fix the bug (or its trace doesn't build); then the lowest-numbered run that passes. ${d.shownLine}`,
    shown: (k) => `Run ${k} passed, so it's the run on this page.`,
    runLine: (r) => `Run ${r.k}: ${r.main} main calls and ${r.sub} subagent calls, ${r.secs} seconds, ${r.cost}. The subagent's conversation reached ${r.peak} tokens; across the hand-back the main conversation grew by ${r.growth}. Tests after the fix: ${r.pass} of ${r.tests} passed.`,
    runShown: " This is the run on this page.",
    cache: (d) => `The runs were back to back, about ${d.gaps} seconds apart, so the first calls of runs 2 and 3 could read from the cache what the run before had left. Run 1's first main call read ${d.r1Main1Cached} tokens from the cache too; the stream doesn't say which earlier session left them.`,
    black: () => `Before these runs we gave the agent chapter 2's task, the bug in black, with the Agent tool on its list and no word about subagents. It hadn't started a subagent by the time we stopped it. We didn't keep that run as a trace, so it isn't on this page, and the subagent here is one we asked for.`,
    setup: () => `The subagent's set-up text and tool list aren't in the stream, so the page gives only the size of its first call. Claude Code's session files hold them, and also account IDs and real folder paths, so we don't publish those files.`,
    paths: (d) => `The model saw the real folder path. This page shows it as <code>${d.alias}</code>${d.quoted ? `, which is why some commands read <code>"${d.alias}"</code> in quotes (a real shell wouldn't expand <code>~</code> there),` : ","} and why the task text here is shorter than the one the model wrote.`,
    traces: "The traces:",
    link: (k) => `run ${k}`,
    json: "The same data as JSON is in the repo's <code>data/</code> folder.",
  },
};
