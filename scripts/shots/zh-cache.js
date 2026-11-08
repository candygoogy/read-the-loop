// Chapter 3 in Simplified Chinese (site/zh/cache/) for scripts/screenshot.js: the same states, checks and
// reduced-motion pass as the English page (cache.js), which this reuses. The motion frames get their own
// names so they don't overwrite the English ones.
const cache = require("./cache.js");

async function motion(p, capture) {
  await p.locator("#costs").scrollIntoViewIfNeeded();
  await capture("zh-ch3-toggle", "#costs", () => p.locator('#cost-mode input[value="without"] + span').click());
  await capture("zh-ch3-toggle-back", "#costs", () => p.locator('#cost-mode input[value="with"] + span').click());
}

module.exports = { ...cache, name: "zh-cache", file: "zh/cache/index.html", motion };
