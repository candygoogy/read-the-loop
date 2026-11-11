// English copy for chapter 8, the harness playground: the narration, every label, and the sentences that
// hold values. Numbers from the recordings and the agent's words never appear here: each function gets
// `d`, the values app.js and playground.js read from window.PLAYGROUND and the traces, already formatted
// and escaped. The embed (embed.html) uses the same file, so the playground's labels are written once.
window.COPY = {
  locale: "en-US",

  dek: () => `The harness is the part of a coding agent you set up yourself. Here are three of its switches, and one bug fixed again and again, with every combination of them. Flip a switch to see what changed.`,

  intro: {
    p1: () => `A coding agent is a language model in a loop. The model reads the conversation and asks for a tool (read a file, run a command). The <strong>harness</strong>, the program around the model (here Claude Code), runs the tool and pastes the result back, and the model reads it all again. Chapters 1 to 7 took the harness as it came. Its settings are yours, though: you choose the model, the tools, and what the harness tells the model before your message.`,
    p2: (d) => `We gave chapter 1's task to the agent ${d.runs} times, ${d.per} for each combination of the switches: the same small game with the same bug, and the same message.`,
    promptHead: "What we typed, every run",
    p3: () => `Each run had three switches set before it started, two choices each:`,
    model: {
      name: "The model",
      text: (d) => `Which language model the harness sends the conversation to. Both are made by Anthropic: ${d.opus} and ${d.haiku}. The recordings show what each one did, and what Claude Code says each run cost. They don't show how the two models differ inside.`,
    },
    bash: {
      name: "Bash",
      text: (d) => `The tool that runs commands, such as <code>node --test</code>, which runs the game's tests. With Bash off it isn't in the tool manual the harness sends with every call (chapter 5), so the agent can still read and change files but has no way to run anything, the tests included. Taking it out made the first call of an ${d.opusName} run ${d.bashSaved} tokens smaller. With Bash on, an allow list let commands starting with <code>node</code> run without asking: ${d.allowOn}.`,
    },
    rule: {
      name: "The test rule",
      text: (d) => `One sentence added to the harness's set-up text, the instructions the model reads before your message (chapter 2): <q>${d.rule}</q> Your message stays exactly the same. The rule made the first call of an ${d.opusName} run ${d.ruleAdded} tokens bigger.`,
    },
    p4: () => `The recordings don't hold the allow list or the set-up text, so the two are given here as we typed them on the command line (the notes at the bottom of the page have the whole command). Claude Code's own session file for each run with the rule shows the sentence at the end of its set-up text.`,
    p5: (d) => `${d.ch1 ? "The playground opens on chapter 1's settings. " : ""}Every run on this page fixed the bug. The switches changed how the agent got there.`,
  },

  play: {
    title: "The harness playground",
    help: "Pick a setting for each switch. The two runs recorded with those settings appear side by side.",
    group: "Harness settings",
    legend: { model: "Model", bash: "Bash", rule: "Test rule" },
    hint: {
      model: (d) => `which model the harness calls`,
      bash: () => `the tool that runs commands`,
      rule: (d) => `adds <q>${d.rule}</q> to the set-up text`,
    },
    value: {
      model: { opus: "Opus", haiku: "Haiku" },
      bash: { bash: "On", nobash: "Off" },
      rule: { norule: "Off", rule: "On" },
    },
    // For the status line screen readers hear, and the overview table.
    spoken: {
      model: { opus: "Opus", haiku: "Haiku" },
      bash: { bash: "Bash on", nobash: "Bash off" },
      rule: { norule: "no test rule", rule: "test rule on" },
    },
    status: (setting, runs) => `Showing ${setting}. ${runs}`,
    statusRun: (k, calls, before, after) => `Run ${k}: ${calls}, ${before ? "tested before its edit" : "no test before its edit"}, ${after ? "tested after it" : "no test after it"}.`,
    loading: "Loading the recordings…",
    failed: "This recording couldn't be loaded.",
    run: (k) => `Run ${k}`,
    // The head of each run's card: its model, and when it started (the runs were interleaved, see the notes).
    runMeta: (model, time) => `${model} · started ${time} UTC`,
    callsWord: { one: (n) => `${n} model call`, other: (n) => `${n} model calls` },
    facts: {
      calls: "model calls",
      time: "seconds",
      cost: "cost",
      cached: (n, total) => `Call 1 read ${n} of its ${total} tokens from the cache.`,
    },
    checks: {
      before: "Ran the tests before its first edit",
      after: "Ran the tests after its last edit",
      fixed: "The game's own tests, run by us afterwards",
      yes: "Yes",
      no: "No",
      pass: (p, t) => `${p} of ${t} pass`,
    },
    stepsHead: "What it did, call by call",
    callN: (n) => `Call ${n}`,
    answer: "The model writes · final answer",
    more: { one: (n) => `Read the rest (${n} more paragraph)`, other: (n) => `Read the rest (${n} more paragraphs)` },
    // The one-line result of each request, before it's opened.
    res: {
      files: { one: (n) => `${n} file`, other: (n) => `${n} files` },
      lines: { one: (n) => `${n} line`, other: (n) => `${n} lines` },
      edited: "changed",
      tests: (pass, fail) => `${pass} pass, ${fail} fail`,
      failSeen: "a test fails",
      error: "error",
    },
    tag: { test: "runs the tests", edit: "edit", missing: "not available" },
    pairNote: (d) => `Each run 2 started ${d.gapMin} to ${d.gapMax} minutes after its run 1 and read ${d.r2CacheMin} to ${d.r2CacheMax} of its first call's tokens from the cache run 1 had left, which made it cheaper (chapter 3). Both are shown as recorded.`,
  },

  // The cards inside a step, when it's opened (as chapter 1's).
  cards: {
    request: "Request",
    result: "Result",
    plain: "plain text",
    file: "file",
    toolMeta: { Glob: "find files", Read: "read a file", Edit: "change a file", Grep: "search files", Bash: "run a command" },
    shown: (a, b) => `${a} of ${b} lines shown`,
    all: { one: (n) => `${n} line`, other: (n) => `${n} lines` },
    skipped: { one: (n) => `… ${n} more line …`, other: (n) => `… ${n} more lines …` },
  },

  embedNote: {
    title: "Put this on your page",
    p1: () => `The playground also works on its own, at a size that fits a blog post. Paste this where you want it; the address after <code>#</code> picks the settings it opens on (here, the ones chosen above). It loads nothing from outside this site. In a column narrower than about 640 pixels the two runs stack, and the frame scrolls inside.`,
    open: "Open the embed on its own",
    frameTitle: "The harness playground, from Read the Loop",
  },

  overview: {
    title: "All eight settings at a glance",
    p1: () => `Each row is one combination of the switches, with its two runs. A filled dot means yes, an empty ring no. Pick a row to show it in the playground.`,
    caption: (d) => `Run 1 and run 2 of each setting. All ${d.runs} runs fixed the bug, so there's no column for it.`,
    cols: { setting: "Setting", before: "Tested before the edit", after: "Tested after the edit", calls: "Model calls", cost: "Cost" },
    show: "Show",
    shown: "shown above",
    runSpoken: (k, yes) => `run ${k}: ${yes ? "yes" : "no"}`,
    pair: (a, b) => `${a}, ${b}`,
  },

  shows: {
    title: "What the switches did",
    p1: () => `Three things changed with the switches in these runs. None of them changed whether the bug got fixed.`,
    rule: {
      title: "With Bash on, the rule moved the first test run before the fix",
      text: (d) => `Without the rule, ${d.normBefore} of ${d.normN} runs with Bash ran the tests before changing the code. With it, ${d.ruleBefore} of ${d.ruleN} did${d.sawFail ? ", and each of them saw a test fail because of the bug before it made the fix" : ""}. After the change, every run with Bash ran the tests, rule or no rule (${d.bashAfter} of ${d.bashN}). ${d.haikuFirst}`,
      haikuFirst: (who) => `The one run that tested first without being told was ${who}.`,
    },
    bash: {
      title: "With Bash off, no run tested, and every answer says so",
      text: (d) => `None of the ${d.nobashN} runs without Bash ran the tests, and ${d.saidAll ? `all ${d.nobashN}` : `${d.said} of the ${d.nobashN}`} final answers say they couldn't, for example: <q>${d.example}</q> ${d.missing}`,
      missing: (d) => `${d.all ? `All ${d.missingN}` : d.missingN} ${d.missingModel} runs without Bash still asked for it. The harness answered with an error rather than a refusal from the permission check, which refused nothing in all ${d.runs} runs. The error read: <q>${d.error}</q> ${d.othersAsked ? "" : `The ${d.otherModel} runs never asked for a tool they didn't have.`}`,
    },
    model: {
      title: "The model changed the cost most",
      text: (d) => `Every ${d.opusName} run cost ${d.lo} to ${d.hi} times as much as the ${d.haikuName} run with the same switches, though ${d.haikuName} wrote more: ${d.hOutLo} to ${d.hOutHi} output tokens a run, against ${d.oOutLo} to ${d.oOutHi}. The costs are Claude Code's own figures for each run. We haven't checked them against a price list.`,
    },
    caveat: {
      title: "How far this goes",
      text: (d) => `${d.per} runs per setting is a tiny sample: one task, one small game, ${d.runs} runs recorded on one day, back to back. Something that happened once here could go the other way next time, on another task or another day. What the rule did is what one sentence did in these runs, on this task. And each run 2 was cheaper partly because of its run 1, whose cache it read (above).`,
    },
  },

  next: {
    kicker: "The end of the series",
    title: "Back to the loop",
    p1: () => `This is the last chapter. Every run on this page was the loop from <a href="../loop/index.html">chapter 1</a>: the model asks for a tool, the harness runs it and pastes the result back, and the whole conversation is read again. The switches only changed what the harness offered the model and what it said before your message. That much is in your hands whenever you set up an agent.`,
  },

  colophon: {
    title: "About the recordings",
    model: (d) => `Recorded on ${d.date}, from ${d.t0} to ${d.t1} UTC, with Claude Code <code>${d.ccv}</code> and the models <code>${d.opus}</code> and <code>${d.haiku}</code>. Each run started in a fresh copy of chapter 1's game, in a new folder, with:`,
    flags: (d) => `The parts in angle brackets are the switches. The model and the tool list are in each recording, and the build checks them against the run's name. The allow list (<code>--allowedTools</code>) and the rule (<code>--append-system-prompt</code>) are not, so they're as we typed them, the same as in <a data-repo="blob/master/scripts/summarize-playground.py">scripts/summarize-playground.py</a>. Every run started in permission mode <code>${d.mode}</code>, so file edits went ahead without asking.`,
    order: (d) => `The order was fixed before the first run: run 1 of all ${d.combos} settings, then run 2 of all ${d.combos}, in the same order both times, one straight after another. So the two runs of a setting were always ${d.combos} runs apart. Nothing was redone or left out: every run we recorded is on this page.`,
    fixed: (d) => `How we checked the fix: after the recordings, we ran the game's own ${d.tests} tests on each game as the agent left it, with the original test file put back, since ${d.addedTests} runs had added tests of their own to it. All ${d.tests} passed for ${d.fixed} of ${d.runs} runs. The game as we handed it over passes ${d.origPass} and fails ${d.origFail}${d.origFrom ? `, as the runs that tested first saw` : ""}. The saved results are in <a data-repo="tree/master/data/checks-08">data/checks-08</a>.`,
    tested: () => `“Ran the tests” means a Bash step that ran <code>node --test</code> or a test file, before the first edit or after the last one, whether the tests passed or not.`,
    missing: (d) => `The calls for a missing tool: in the ${d.n} ${d.model} runs without Bash, the model asked for <code>Bash</code> anyway, with the command <code>${d.command}</code>. The recording marks Claude Code's answer as an error, and the permission check's list of refused requests is empty in every run. ${d.allSaid ? "Each of those runs then said in its answer that it couldn't run the tests." : ""}`,
    cost: () => `Costs are Claude Code's own figure for each run, rounded to four decimal places. Each run 2 read part of its first call from the cache its run 1 had left a few minutes earlier, the only earlier run with the same model, tools and set-up text, so run 2 costs are lower partly for that reason. Some run 1s also read from the cache, left by an earlier session the recording doesn't name.`,
    paths: (d) => `The model saw the real folder path. The traces show it as <code>${d.alias}</code> and the local user name as <code>you</code>; nothing else in them is changed. That's why some commands read <code>cd "${d.alias}"</code> in quotes, which a real shell wouldn't expand.`,
    traces: () => `Every run is in the repo's <a data-repo="tree/master/data">data/</a> folder as a trace (<code>trace-08-…json</code>), with the summary of all of them, <code>playground-08.json</code>. On this site:`,
    link: (k) => `run ${k}`,
  },

  embed: {
    title: "The harness playground",
    back: "From Read the Loop, chapter 8",
    foot: (d) => `Real Claude Code sessions, ${d.per} for each setting, recorded on ${d.date}. Every number and every word the agent wrote is read from the recordings.`,
  },

  stats: {
    runs: "runs, on one bug",
    fixed: "fixed the bug",
    rule: "tested before the fix, with Bash and the rule",
    norule: "tested before the fix, with Bash and no rule",
    of: (a, b) => `${a} of ${b}`,
  },
};
