# Read the Loop

[![Chapter 1 in short: a ball falls through the paddle, a real Claude Code session finds and fixes the bug, the ball bounces, and the session's totals](media/hero.gif)](media/hero.mp4)

An illustrated explainer of how an AI coding agent works, built on real recorded Claude Code sessions you can
step through.

## Chapters

1. [An agent is a loop](https://loop.candygoogy.dev/loop/)
2. [The context window](https://loop.candygoogy.dev/context/)
3. [Caching](https://loop.candygoogy.dev/cache/)
4. [Compaction](https://loop.candygoogy.dev/compaction/)
5. [Tools and permissions](https://loop.candygoogy.dev/tools/)

All five are also in Chinese: [中文版](https://loop.candygoogy.dev/zh/).

Three more are coming, one at a time: subagents, failure modes, and building your own agent. To hear when one is
out, choose Watch → Custom → Releases at the top of this page.

## How it's made

Read the Loop was made with Claude Code, and everything it shows comes from recordings of Claude Code. We gave it
real tasks (a bug in a small game, a bug report filed against [Black](https://github.com/psf/black)), recorded
each session as it ran, and built the pages on those recordings.

The rule: every number and every word the agent wrote or saw comes from a recording. Commands, outputs, token
counts and the model's own text are read from the trace files when the page loads; only the explanations are
written by hand. Before a recording goes into the repo, a script replaces the recording folder and the local user
name and changes nothing else.

To run it, open `site/index.html` in a browser. There's no build step and no server. The tests:

```sh
python -m unittest discover tests
node tests/harness-step-check.js
node scripts/screenshot.js <out-dir>   # every page at three sizes, with checks
node scripts/check-site.js             # requests, meta tags, releases, hosting files
```

How the recordings are made, and what's where in the repo, is in [AGENTS.md](AGENTS.md).

## Licence

The code is under the [MIT licence](LICENSE). The text, figures and recordings are under
[CC BY 4.0](LICENSE-CONTENT.md). The fonts are under the SIL Open Font License, and the excerpts of Black's code
in recording 03 under Black's MIT licence: see [NOTICE.md](NOTICE.md).
