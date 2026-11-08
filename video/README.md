# Hero video

The README video for Read the Loop, made with [Remotion](https://www.remotion.dev). It has its own
`package.json` so that the site stays build-free; nothing under `site/` is built or changed.

- Every number and every word the agent wrote or saw is read from `../data/trace-02-run2.json` (`src/data.ts`).
- The game is the real code: `../site/game/run2/before/game.js` and `after/game.js`, imported as text, byte for byte,
  and run unchanged (`src/game.ts`), one step per frame with the paddle held still.
- Colours come from `../site/style.css` (light theme). Fonts: Fraunces, Source Serif 4, IBM Plex Mono and, for the
  Chinese subtitles, Noto Sans SC, all through `@remotion/google-fonts` (rendering needs a network connection).
- The narration, English on screen and Chinese as subtitles, is in `src/timeline.ts`.

## Commands

Run from this folder.

```sh
npm install
npm run studio                 # preview in Remotion Studio
npm run check                  # the game claims (falls through / bounces) and the totals, from the real files
npm run render -- <out-dir>    # everything below
```

`npm run render -- <out-dir>` (`scripts/render-all.mjs`) writes:

| File | What it is |
|---|---|
| `<out-dir>/hero-16x9.mp4` | 1920×1080, 30 fps, full quality |
| `<out-dir>/hero-16x9-zh.mp4` | The same with Chinese subtitles burned in (Bilibili) |
| `<out-dir>/hero-zh.srt` | The Chinese subtitles as SRT (`scripts/write-srt.ts`) |
| `<out-dir>/hero.gif` | 1280 px wide GIF |
| `../media/hero.mp4` | Compressed copy for the README (budget 4 MB) |
| `../media/hero.gif` | 800 px GIF for the README (budget 8 MB) |

The single steps, if you need one of them:

```sh
npx remotion render Hero <out-dir>/hero-16x9.mp4 --codec=h264 --crf=16 --muted
npx remotion render HeroZh <out-dir>/hero-16x9-zh.mp4 --codec=h264 --crf=16 --muted
node scripts/write-srt.ts <out-dir>/hero-zh.srt
npx remotion render Hero <frames-dir> --frames=31,226,513 --image-format=png   # a few stills to look at
```

ffmpeg must be on PATH for the GIFs and the compressed MP4. Remotion is free for individuals and small teams; see
its licence.
