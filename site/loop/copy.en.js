// English copy for chapter 1: step narration and every UI label, including the HarnessStep widget's.
// Numbers never appear here. Each function gets `d`, the values app.js reads from the recording
// (window.TRACE), already formatted. A translated page loads its own copy file instead of this one.
window.COPY = {
  locale: "en-US",

  ui: {
    stepOf: (i, n) => `Step ${i} of ${n}`,
    who: { you: "You", model: "Model", harness: "Harness" },
    prev: "Previous step",
    next: "Next step",
    play: "Play",
    pause: "Pause",
    live: "Watch it live",
    livePause: "Pause live",
    clock: (now, total) => `${now} / ${total}`,
    clockLabel: "Time in the recording",
    scrub: "Step",
    skipRound: "Let the harness do it",
    again: "Be the harness again",
    contextLabel: "What the model reads, drawn to scale",
    legendSys: "set-up: instructions, tool descriptions and your message",
    legendRound: (list) => `each round: the model's request and the result (${list})`,
    setupBlock: (d) => `set-up · ${d.setup}`,
    roundTitle: (n, tokens) => `round ${n}: +${tokens} tokens`,
    // The bar's text alternative, for the rounds that have landed so far (list: "+96, +4,893").
    stackLabel: (d, n, list) => n
      ? `Bar drawn to scale: the set-up, ${d.setup} tokens, then ${n === 1 ? "1 round" : `${n} rounds`}: ${list} tokens.`
      : `Bar drawn to scale: the set-up, ${d.setup} tokens. No rounds yet.`,
  },

  // Shown under the clock in "Watch it live".
  status: {
    waitFirst: "Waiting for the model's first reply",
    model: "The model is reading the conversation and writing its reply",
    harness: "The harness is running the request",
    finished: "Finished: the reply had no request",
  },

  count: {
    you: (d) => `The first call will read <b>${d.c[0]}</b> tokens`,
    req: (d, n, i) => `Call ${n} reads <b>${d.c[i]}</b> tokens, ${d.cached[i]} of them from the cache`,
    res: (d, i) => `The conversation is now <b>${d.c[i + 1]}</b> tokens (+${d.added[i + 1]})`,
    pending: (d, i = 0) => `The conversation is <b>${d.c[i]}</b> tokens. The result isn't in it yet.`,
  },

  cards: {
    you: "You",
    youMeta: "typed into Claude Code",
    setup: "Set-up",
    setupMeta: (d) => `${d.setup} tokens with your sentence`,
    setupBody: "The recording shows the size of this block, not its text. Claude Code sends it through Anthropic's API, the service programs use to send text to the model. What a request like this holds (instructions, the tools the model may ask for, the conversation so far) comes from Anthropic's public API documentation, not from this recording.",
    request: "Request",
    result: "Result",
    modelWrites: "The model writes",
    finalAnswer: "The model writes · final answer",
    plain: "plain text",
    file: "file",
    toolMeta: { Glob: "find files", Read: "read a file", Edit: "change a file", Grep: "search files", Bash: "run a command" },
    linesBack: { one: (n) => `${n} line pasted back`, other: (n) => `${n} lines pasted back` },
    excerpt: (shown, total) => `${shown} of ${total} lines shown`,
    skipped: { one: (n) => `… ${n} line not shown here …`, other: (n) => `… ${n} lines not shown here …` },
  },

  // Plain words for each tool, used in the set-up prose.
  toolPlain: { Glob: "find files", Grep: "search inside them", Read: "read a file", Edit: "change a file", Bash: "run a command" },

  steps: {
    // Live mode, on a harness step whose first result hasn't arrived yet.
    waiting: {
      title: () => "The harness runs it",
      text: () => "The harness is running the request. The result isn't back yet.",
    },
    you: {
      title: () => "You type one sentence",
      text: (d) => `Claude Code is the <strong>harness</strong>: the program around the model that sends it text, does what it asks and reports back. A model plus a harness that runs its requests, in a loop, is an <strong>agent</strong>. Your sentence is sent with a set-up in front of it: instructions, and a description of each tool the model may ask for (${d.toolList}). Together that's <strong>${d.setup} tokens</strong>. A token is a word or a piece of one.`,
    },
    c1req: {
      title: (d, n) => `Call ${n}: what's in the folder?`,
      text: (d) => `The model reads all ${d.c[0]} tokens and writes a reply. It can't look at the folder, so the reply is a <strong>request</strong>, written in a format the harness understands. This one asks for every file name: <code>${d.globPattern}</code> matches any file in any folder. ${d.cached[0]} of the tokens came from the <strong>cache</strong>, a stored copy of recent text that is cheaper to read again (chapter 3).`,
    },
    round1: {
      title: (d, n) => `Round ${n}: you are the harness`,
      text: () => `The model can't run anything, so the harness does it. This round, you're the harness. Run the request, then put its output into the conversation: drag it there, or use the paste button.`,
      textDone: (d) => `That's one round of the loop. A <strong>call</strong> is the model reading the conversation and writing one reply; a <strong>round</strong> is the harness running that reply's requests and adding their results. The model will read this result on the next call. The conversation grew by ${d.added[1]} tokens. From here the harness carries on by itself.`,
    },
    c2req: {
      title: (d, n) => `Call ${n}: read the code`,
      text: (d) => `The model starts over and reads the whole conversation from the top, ${d.c[1]} tokens now. In one reply it asks to read ${d.readFiles}. It doesn't ask for ${d.unread}.`,
    },
    c2res: {
      title: () => "The code comes back",
      text: (d) => `The harness pastes both files in whole: ${d.gameLines} lines of <code>${d.mainFile}</code> and ${d.testLines} lines of tests. It's the biggest jump in the session, <strong>+${d.readAdded} tokens</strong>. The bug is in there, unmarked. The model has to find it by reading. The cards show only a few of the lines.`,
    },
    c3req: {
      title: (d, n) => `Call ${n}: run the tests first`,
      text: (d) => `Before it changes anything, the model asks to run the game's tests and keep only the last ${d.tail1} lines of their output. This reply has no words for you, only the request.`,
    },
    c3res: {
      title: () => "A test fails",
      text: (d) => `The result comes back ${d.bashWait} seconds later. It shows a failing test, <q>${d.failName}</q>, and the check that failed, <code>${d.assertion}</code>: after landing, the ball should be moving up. The totals aren't in those ${d.tail1} lines, so the model sees which test failed but not how many passed.`,
    },
    c4req: {
      title: (d, n) => `Call ${n}: the fix, then a check`,
      text: (d) => `Now the model changes <code>${d.mainFile}</code>. It replaces ${d.oldLines} line with ${d.newLines}, so that the check measures from the paddle's centre instead of its left edge. In the same reply it asks to run the tests again.`,
    },
    c4res: {
      title: (d) => `${d.pass} of ${d.tests} tests pass`,
      text: (d) => `The harness changes the file, then runs the tests. This time the last ${d.tail2} lines do include the totals: ${d.tests} tests, ${d.pass} passed, ${d.fail} failed.`,
    },
    final: {
      title: (d, n) => `Call ${n}: a reply with no request`,
      text: (d) => `The model reads everything once more, ${d.c[d.last]} tokens, and writes to you. The reply has <strong>no request</strong> in it, and that's the harness's signal to stop. Its last paragraph says it checked that a fast ball can't skip past the paddle. That check is arithmetic written in the reply. No command ran for it.`,
    },
  },

  // Labels for the "you are the harness" widget (site/harness-step.js).
  harness: {
    conversationTitle: "The conversation",
    computerTitle: "Your computer",
    requestTitle: "Request",
    resultTitle: "Result",
    outputTitle: "Output",
    recordedNote: "recorded output",
    idleNote: "Nothing runs in your browser. Running the request replays the output from the recording.",
    run: "Run the request",
    summaryLabel: "Replaying the recording of",
    drag: "Drag into the conversation",
    paste: "Paste into the conversation",
    slotIdle: "The result will go here",
    dropHint: "Drop the output here",
    pastedNote: "The output is now in the conversation.",
    liveStart: "The model's request is in the conversation. You are the harness: run the request.",
    liveRan: "The recorded output is on your computer. Paste it into the conversation, or drag it there.",
    liveDragStart: "Dragging the output. Drop it at the end of the conversation.",
    liveSnapBack: "Not dropped on the conversation. The output is back on your computer.",
    liveDone: "The result is in the conversation. That was one round of the loop.",
  },

  game: {
    play: "Play the game",
    restart: "Start again",
    stop: "Stop",
  },

  // Computed lines in the static prose.
  prose: {
    otherRuns: (list) => `${list} ran the tests only after their fix.`,
    runsList: (list) => `runs ${list}`,
    runOne: (k) => `run ${k}`,
    runLine: (r) => `Run ${r.k}: ${r.calls} model calls, ${r.secs} seconds, tests run before the fix: ${r.before ? "yes" : "no"}, after: ${r.after ? "yes" : "no"}.`,
    runShown: " This is the run on this page.",
    traceLink: (k) => `run ${k}`,
  },
};
