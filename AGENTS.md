# Read the Loop: agent instructions

An interactive, illustrated explainer of how AI coding agents work, built on **real recorded sessions**.
8 chapters are planned; 1 to 5 are built in `site/`, and `site/chapters.js` says which are published.
Live at https://loop.candygoogy.dev, repo https://github.com/candygoogy/read-the-loop.

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
5. **Nothing loads from outside the site.** Fonts are in `site/fonts/`; no CDNs, analytics or embeds.
   `scripts/check-site.js` fails on any request that isn't `file:`.
6. Plain words for a general audience. Explain every term the first time it appears (token, harness, context, cache).

## Layout

| Path | What it is |
|---|---|
| `site/chapters.js` | Which chapters are out (`window.CHAPTERS`): number, slug, title, `published`, `release` date, `langs`; also the site's name, address and GitHub repo, each in one place |
| `site/lib/release.js` | Draws what `chapters.js` says on every page: the contents lists, each chapter's foot (previous/next, the "coming next" notice), the preview note on unpublished chapters, the language switch; removes links to unpublished chapters |
| `site/index.html`, `contents.js` | Contents page: the 8 chapters, sorted by `release.js`; `contents.js` draws each chapter's small picture from its recording |
| `site/404.html`, `robots.txt`, `sitemap.xml` | Hosting files (Cloudflare Pages serves `404.html` for unknown paths); `sitemap.xml` is written by `scripts/sitemap.js` |
| `site/fonts/` | Self-hosted woff2 files (Fraunces, Source Serif 4, IBM Plex Mono; latin and latin-ext) and their OFL licences; `@font-face` rules are at the top of `style.css` |
| `site/og/`, `favicon.svg`, `apple-touch-icon.png` | Preview cards (1200 × 630) and icons; the cards and the PNG icon are rendered by `scripts/og.js` |
| `site/style.css` | Styles shared by every page, and the fonts |
| `site/lib/trace-ui.js` | Helpers any chapter can use (`window.TraceUI`): escaping, number formatting, the model's markdown, line excerpts, request/result/text cards |
| `site/loop/index.html`, `app.js` | Chapter 1 page, and its step player and live replay |
| `site/loop/copy.en.js` | Chapter 1 narration and UI labels (`window.COPY`); a translated page loads its own copy file |
| `site/context/index.html`, `app.js`, `chapter.css`, `copy.en.js` | Chapter 2 page (the context window), its figures, styles and narration |
| `site/cache/index.html`, `app.js`, `chapter.css`, `copy.en.js` | Chapter 3 page (caching), its figures, styles and narration |
| `site/compaction/index.html`, `app.js`, `chapter.css`, `copy.en.js` | Chapter 4 page (compaction), its figures, styles and narration |
| `site/tools/index.html`, `app.js`, `chapter.css`, `copy.en.js` | Chapter 5 page (tools and permissions), its figures, styles and narration |
| `site/harness-step.js`, `.css` | The "you are the harness" widget for round 1 (demo and check in `tests/`) |
| `site/data/trace-02-runK.js` | Recording 02, runs 1 to 3 (generated); the page shows run 2 and lists all three |
| `site/game/run2/before/`, `after/` | The game as given to the agent, and with the agent's recorded edits replayed (generated) |
| `data/trace-*.json` | The same traces as JSON (generated) |
| `site/data/tools-05.js`, `data/tools-05.json` | Recording 05's tool manual: its shape and sizes, with no private text (generated, `window.TOOLS`) |
| `site/data/trace-05.js`, `data/trace-05.json` | Recording 05, the session whose requests chapter 5 opens (generated) |
| `site/data/trace-01.js`, `data/trace-01.json` | Recording 01 (the shopping-cart bug of chapter 1 v1, tag `ch1-v1`) |
| `fixtures/game/` | The buggy game the agent was given in recording 02 |
| `fixtures/cart/` | The buggy project of recording 01 |
| `scripts/record.py` | Records a command's output byte for byte, with arrival times |
| `scripts/build-trace.py` | Turns a raw recording into the trace files |
| `scripts/leakcheck.py` | The leak check both builders run before writing: recording folder, user name, home folders, drive paths, emails |
| `scripts/local.js`, `local.example.json` | This machine's folders (Playwright's browsers, screenshot output, recordings) from a gitignored `local.json`; without it, output goes to `out/` |
| `scripts/capture-proxy.py` | A local logging proxy that saves the request bodies Claude Code sends the model, never the headers |
| `scripts/extract-tools.py` | Turns the captured request bodies into the tool manual files (`tools-05`), sizes and excerpts only |
| `tests/` | Tests for the build script and the capture proxy (`python -m unittest discover tests`) and the widget check (`node tests/harness-step-check.js`) |
| `scripts/og.js`, `scripts/og/card.html` | Renders the preview cards from a template; the picture and numbers on each come from the chapter's trace |
| `scripts/check-site.js` | Opens every page and fails on any request outside the site, wrong meta tags, links to unpublished chapters, or a stale sitemap; also tries a release date, a release and a second language |
| `scripts/sitemap.js` | Writes `site/sitemap.xml` from `chapters.js` (published pages only) |
| `scripts/screenshot.js` | Screenshots of each page's states at desktop, phone and dark sizes (one entry per page); fails on console errors, horizontal overflow, a local link that doesn't resolve, a request outside the site, or a game frame that doesn't load or take keys |

## Design system (chapter 1)

- Fonts: Fraunces (display), Source Serif 4 (body), IBM Plex Mono (code and labels). No thin weights.
- One colour per kind of text in the conversation. Use these everywhere, including in videos:
  `--sys` set-up/instructions, `--you` the user, `--model` what the model writes, `--result` what the harness pastes back.
- Light (warm paper) and dark themes come from `prefers-color-scheme`. Both must be checked.

## Workflow

- Record a session: see "Record a session" below. Use `--restricted`, `--setting-sources ""` and `--strict-mcp-config` so the
  recording doesn't include personal settings, hooks or MCP servers.
- Release a chapter: set `published: true` (or a `release` date first) in `site/chapters.js`, run
  `node scripts/sitemap.js`, then `node scripts/check-site.js`. Rerun `node scripts/og.js` if a title or a
  contents-page line changed.
- After any UI change, run `node scripts/screenshot.js` and look at the images. It must report `errors []` and
  `overflow 0` at all three sizes.
- Skills to use: Remotion (launch and trailer videos, rendered from the same trace JSON), impeccable or
  design-taste-frontend (design pass), emil-design-eng or animate (player motion), accessibility (before launch).
- Commits: no AI attribution lines. Notes, plans and screenshots go outside the repo (see `CLAUDE.local.md`, local only).

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

## Hosting

Cloudflare Pages project linked to the GitHub repo: every push to `master` deploys `site/` as it is (no build
command, output directory `site`). The custom domain `loop.candygoogy.dev` is set in the Pages project.
