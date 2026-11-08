// Chapter 4 in Simplified Chinese (site/zh/compaction/) for scripts/screenshot.js: the same states, checks
// and reduced-motion pass as the English page (compaction.js), which uses ids and data attributes, never
// the English text. The motion frames get their own names so they don't overwrite the English ones.
const en = require("./compaction.js");

async function motion(p, capture) {
  await p.locator("#squash").scrollIntoViewIfNeeded();
  await capture("zh-ch4-compact", "#squash", () => p.locator('#squash-mode input[value="after"] + span').click());
  await capture("zh-ch4-restore", "#squash", () => p.locator('#squash-mode input[value="before"] + span').click());
  const ev = p.locator('.ev[data-k="fail2"]');
  await ev.scrollIntoViewIfNeeded();
  await capture("zh-ch4-guess", '.ev[data-k="fail2"]', () => ev.locator('.opt[data-o="answer"]').click());
}

module.exports = { ...en, name: "zh-compaction", file: "zh/compaction/index.html", motion };
