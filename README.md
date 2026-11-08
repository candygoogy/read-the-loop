# Inside the Loop

How an AI coding agent actually works, explained on real recorded sessions.

Chapter 1, "An agent is a loop", steps through a real Claude Code session that fixes a one-line bug.
A loop diagram, the 10-line agent loop and a context window drawn to scale move together, one step at a time.

## Run it

Open `site/index.html` in a browser. There's no build step and no server.

## Layout

| Path | What it is |
|---|---|
| `site/` | The static site (`index.html`, `style.css`, `app.js`) |
| `site/data/trace-01.js` | The chapter 1 trace, loaded by the page (generated) |
| `data/trace-01.json` | The same trace as JSON (generated) |
| `fixtures/cart/` | The buggy project the agent was given |
| `scripts/build-trace.py` | Turns a raw recording into the trace files |
| `scripts/screenshot.js` | Screenshots at desktop, phone and dark sizes, plus an error and overflow check |
| `AGENTS.md` | Rules for coding agents working on this repo |

## Record a session

```sh
cp fixtures/cart/*.py <empty-folder>/ && cd <empty-folder>
claude -p "The tests are failing. Please find the bug and fix it." \
  --output-format stream-json --verbose \
  --restricted --tools "Bash,Read,Edit,Glob,Grep" --allowedTools "Bash(python *)" Read Edit Glob Grep \
  --strict-mcp-config --setting-sources "" --permission-mode acceptEdits --no-session-persistence \
  > raw.jsonl
python scripts/build-trace.py raw.jsonl data/trace-01.json <empty-folder>
```

The raw recording isn't committed, because it holds session IDs and local details. The build script redacts the
recording folder and the local user name and changes nothing else.

## Rules

- Every number and every word the agent wrote or saw comes from a recording. Only the narration is written by hand.
- Show only what a recording proves. Make no claims about any vendor's internals.
