// Renders every file of the hero video.
//
//   node scripts/render-all.mjs <full-quality-dir>
//
// Full quality, into <full-quality-dir>: hero-16x9.mp4, hero-16x9-zh.mp4 (Chinese subtitles burned in),
// hero-16x9-zh-ui.mp4 (our on-screen text in Chinese), hero-zh.srt, hero.gif and hero-zh.gif (from the zh-UI cut).
// Compressed copies, into the repo's media/: hero.mp4 (budget 4 MB), hero.gif and hero-zh.gif (budget 8 MB each).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const video = path.join(here, "..");
const media = path.join(video, "../media");
const out = path.resolve(process.argv[2] ?? path.join(video, "out"));
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(media, { recursive: true });

const run = (cmd, args) => {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: video, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`${cmd} failed with ${r.status}`);
};
const q = (p) => (process.platform === "win32" ? `"${p}"` : p);
const gif = (src, dst, width, fps, colours) =>
  run("ffmpeg", [
    "-y", "-loglevel", "error", "-i", q(src),
    "-vf", q(`fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colours}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`),
    "-loop", "0", q(dst),
  ]);

const full = path.join(out, "hero-16x9.mp4");
const zh = path.join(out, "hero-16x9-zh.mp4");
const zhUi = path.join(out, "hero-16x9-zh-ui.mp4");

run("node", ["scripts/check.ts"]);
run("npx", ["remotion", "render", "Hero", q(full), "--codec=h264", "--crf=16", "--muted"]);
run("npx", ["remotion", "render", "HeroZh", q(zh), "--codec=h264", "--crf=16", "--muted"]);
run("npx", ["remotion", "render", "HeroZhUI", q(zhUi), "--codec=h264", "--crf=16", "--muted"]);
run("node", ["scripts/write-srt.ts", q(path.join(out, "hero-zh.srt"))]);
gif(full, path.join(out, "hero.gif"), 1280, 15, 256);
gif(zhUi, path.join(out, "hero-zh.gif"), 1280, 15, 256);

run("ffmpeg", [
  "-y", "-loglevel", "error", "-i", q(full),
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  q(path.join(media, "hero.mp4")),
]);
gif(full, path.join(media, "hero.gif"), 800, 15, 256);
gif(zhUi, path.join(media, "hero-zh.gif"), 800, 15, 256);

const budget = { "hero.mp4": 4, "hero.gif": 8, "hero-zh.gif": 8 };
let over = false;
console.log("");
for (const [dir, names] of [
  [out, ["hero-16x9.mp4", "hero-16x9-zh.mp4", "hero-16x9-zh-ui.mp4", "hero-zh.srt", "hero.gif", "hero-zh.gif"]],
  [media, ["hero.mp4", "hero.gif", "hero-zh.gif"]],
]) {
  for (const name of names) {
    const mb = fs.statSync(path.join(dir, name)).size / 1e6;
    const limit = dir === media ? budget[name] : null;
    if (limit && mb > limit) over = true;
    console.log(`${mb.toFixed(2).padStart(7)} MB  ${path.join(dir, name)}${limit ? `  (budget ${limit} MB${mb > limit ? ", OVER" : ""})` : ""}`);
  }
}
if (over) process.exit(1);
