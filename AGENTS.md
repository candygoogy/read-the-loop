# Inside the Loop: agent instructions

An interactive, illustrated explainer of how AI coding agents work, built on **real recorded sessions**.
8 chapters are planned. Chapter 1 ("An agent is a loop") is a working prototype in `site/`.

## Hard rules

1. **Every number and every word the agent wrote or saw comes from a recording.** Token counts, commands, outputs
   and the model's own text are read from `site/data/trace-*.js` at runtime. Never type them into the HTML by hand.
   Only the narration (step titles, explanations) is hand-written.
2. **Show only what a recording proves.** Make no claims about any vendor's internals, hidden prompts or
   architecture. If a chapter needs a fact the recording can't show, say where the fact comes from on the page.
3. **No build step for the site.** Plain HTML, CSS and JS in `site/`. It must work when opened straight from disk
   (`file://`), which is why traces load as `<script>` files, not via `fetch`.
4. **Redact before anything enters the repo.** `scripts/build-trace.py` replaces the recording folder with `~/cart`
   and the local user name with `you`. Raw recordings (`raw*.jsonl`) never go in the repo.
5. Plain words for a general audience. Explain every term the first time it appears (token, harness, context, cache).

## Layout

| Path | What it is |
|---|---|
| `site/index.html` | Contents page (the 8 chapters) |
| `site/style.css` | Styles shared by every page |
| `site/lib/trace-ui.js` | Shared helpers (`window.TraceUI`): escaping, formatting, markdown, excerpts, card HTML |
| `site/loop/index.html`, `app.js`, `copy.en.js` | Chapter 1 page, step player, narration |
| `site/data/trace-01.js` | Generated trace the page loads (`window.TRACE`) |
| `data/trace-01.json` | The same trace as JSON (generated) |
| `fixtures/cart/` | The buggy project given to the agent in recording 01 |
| `scripts/build-trace.py` | Raw `stream-json` recording → redacted trace (`.json` + `.js`) |
| `scripts/screenshot.js` | Playwright screenshots of every page (desktop, phone, dark), and reports console errors, horizontal overflow and broken local links |
| `.zed/tasks.json` | Zed tasks: open the page, rebuild the trace, take screenshots |

## Design system (chapter 1)

- Fonts: Fraunces (display), Source Serif 4 (body), IBM Plex Mono (code and labels). No thin weights.
- One colour per kind of text in the conversation. Use these everywhere, including in videos:
  `--sys` set-up/instructions, `--you` the user, `--model` what the model writes, `--result` what the harness pastes back.
- Light (warm paper) and dark themes come from `prefers-color-scheme`. Both must be checked.

## Workflow

- Record a session: see `README.md`. Use `--restricted`, `--setting-sources ""` and `--strict-mcp-config` so the
  recording doesn't include personal settings, hooks or MCP servers.
- After any UI change, run the "screenshot check" task and look at the images. It must report `errors []` and
  `overflow 0` at all three sizes.
- Skills to use: Remotion (launch and trailer videos, rendered from the same trace JSON), impeccable or
  design-taste-frontend (design pass), emil-design-eng or animate (player motion), accessibility (before launch).
- Commits: no AI attribution lines. Notes, plans and screenshots go outside the repo (see `CLAUDE.local.md`, local only).
