# Hero video

The README video for Read the Loop, made with [Remotion](https://www.remotion.dev). It has its own
`package.json` so that the site stays build-free; nothing under `site/` is built or changed.

- Every number and every word the agent wrote or saw is read from `../data/trace-02-run2.json` (`src/data.ts`).
- The game is the real code: `../site/game/run2/before/game.js` and `after/game.js`, imported as text, byte for byte,
  and run unchanged (`src/game.ts`), one step per frame with the paddle held still.
- Colours come from `../site/style.css` (light theme). Fonts: Fraunces, Source Serif 4, IBM Plex Mono and, for
  Chinese, Noto Serif SC (headlines, behind the serif faces) and Noto Sans SC (labels and subtitles, behind Plex
  Mono), all through `@remotion/google-fonts`, loading only the slices the text needs (rendering needs a network
  connection).
- The narration is in `src/timeline.ts` (English, and Chinese for the subtitles); every other word of ours on screen
  is in `src/i18n.ts`, in English and Chinese.
- Three cuts: `Hero` (English), `HeroZh` (English with Chinese subtitles burned in) and `HeroZhUI` (our on-screen
  text in Simplified Chinese, following `zh-glossary.md`; the prompt, requests, commands, outputs, file names and the
  model id stay in English, as recorded).

## Commands

Run from this folder.

```sh
npm install
npm run studio                 # preview in Remotion Studio
npm run check                  # the game claims and totals from the real files, then the layout of the cuts
npm run check -- --no-layout   # only the first part (no bundling, no network)
npm run render -- <out-dir>    # everything below
```

`npm run render -- <out-dir>` (`scripts/render-all.mjs`) writes:

| File | What it is |
|---|---|
| `<out-dir>/hero-16x9.mp4` | 1920×1080, 30 fps, full quality |
| `<out-dir>/hero-16x9-zh.mp4` | The same with Chinese subtitles burned in (Bilibili) |
| `<out-dir>/hero-16x9-zh-ui.mp4` | Our on-screen text in Chinese, no subtitles (`HeroZhUI`) |
| `<out-dir>/hero-zh.srt` | The Chinese subtitles as SRT (`scripts/write-srt.ts`) |
| `<out-dir>/hero.gif` | 1280 px wide GIF |
| `<out-dir>/hero-zh.gif` | 1280 px wide GIF of the zh-UI cut |
| `../media/hero.mp4` | Compressed copy for the README (budget 4 MB) |
| `../media/hero.gif` | 800 px GIF for the README (budget 8 MB) |
| `../media/hero-zh.gif` | 800 px GIF of the zh-UI cut (budget 8 MB) |

The layout part of `npm run check` renders a few settled frames of `Hero` and `HeroZhUI` with a probe on
(`src/probe.tsx`) and fails if the Chinese cut shows other numbers than the English one, if any of our texts
overflows its box, wraps past its lines, overlaps another text or runs into a shape, or if any Chinese character
lacks a loaded web font (tofu).

The single steps, if you need one of them:

```sh
npx remotion render Hero <out-dir>/hero-16x9.mp4 --codec=h264 --crf=16 --muted
npx remotion render HeroZh <out-dir>/hero-16x9-zh.mp4 --codec=h264 --crf=16 --muted
npx remotion render HeroZhUI <out-dir>/hero-16x9-zh-ui.mp4 --codec=h264 --crf=16 --muted
ffmpeg -i <out-dir>/hero-16x9-zh-ui.mp4 -vf "fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 ../media/hero-zh.gif
node scripts/write-srt.ts <out-dir>/hero-zh.srt
npx remotion render Hero <frames-dir> --frames=31,226,513 --image-format=png   # a few stills to look at
```

ffmpeg must be on PATH for the GIFs and the compressed MP4. Remotion is free for individuals and small teams; see
its licence.
