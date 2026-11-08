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
| `scripts/record.py` | Records a command's output byte for byte, with arrival times |
| `scripts/build-trace.py` | Turns a raw recording into the trace files |
| `tests/` | Tests for the build script (`python -m unittest discover tests`) |
| `scripts/screenshot.js` | Screenshots at desktop, phone and dark sizes, plus an error and overflow check |
| `AGENTS.md` | Rules for coding agents working on this repo |

## Record a session

```sh
cp fixtures/cart/*.py <empty-folder>/ && cd <empty-folder>
python <repo>/scripts/record.py <recordings>/raw-NN.jsonl -- claude -p "The tests are failing. Please find the bug and fix it." \
  --output-format stream-json --verbose \
  --restricted --tools "Bash,Read,Edit,Glob,Grep" --allowedTools "Bash(python *)" Read Edit Glob Grep \
  --strict-mcp-config --setting-sources "" --permission-mode acceptEdits --no-session-persistence
cd <repo>
python scripts/build-trace.py <recordings>/raw-NN.jsonl data/trace-NN.json <empty-folder> \
  --prompt "The tests are failing. Please find the bug and fix it." --alias "~/cart" \
  --times <recordings>/raw-NN.times.json \
  --fixture fixtures/cart --files-out out/files-NN
```

Keep `<recordings>` outside the recording folder, so the agent never sees its own recording.
`record.py` writes claude's output to `raw-NN.jsonl` byte for byte and notes when each line arrived in
`raw-NN.times.json`. With `--times` the trace's `t_ms` values are those arrival times; without it they come from the
events' own timestamps (`time_source` says which). For several runs of one task, add `--run K --runs N`.
`--fixture` replays the recorded Edit and Write calls onto a copy of the fixture (`out/files-NN/before/` and
`after/`) and stops if the result doesn't match the recording folder, for example because Bash changed a file.

The raw recording isn't committed, because it holds session IDs and local details. The build script redacts the
recording folder (it becomes `--alias`) and the local user name, and changes nothing else. Before writing, it fails
if the trace still holds the recording folder, the user name, a home folder or a drive path.

Tests: `python -m unittest discover tests`.

## Rules

- Every number and every word the agent wrote or saw comes from a recording. Only the narration is written by hand.
- Show only what a recording proves. Make no claims about any vendor's internals.
