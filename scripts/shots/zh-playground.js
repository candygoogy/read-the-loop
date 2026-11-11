// Chapter 8 in Simplified Chinese (site/zh/playground/): the same states, checks and reduced-motion pass as
// the English page (scripts/shots/playground.js), which reads ids, data attributes and the recordings, not
// the page's words. This page also checks that the embed snippet points to the Chinese embed, and that the
// Chinese text uses Chinese punctuation: no ASCII , ; : ! ? ( ) or sentence-ending "." in any text that
// holds Chinese characters, outside what the recordings hold (lang="en", code, pre). A colon between digits
// (a time) and the comma or point inside a number are fine.
const en = require("./playground.js");

const punctuation = (p) => p.evaluate(() => {
  const bad = [];
  const skip = (el) => el.closest('[lang="en"], code, pre, script, style, kbd');
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent;
    if (!/[\u4e00-\u9fff]/.test(t) || skip(n.parentElement)) continue;
    const s = t.replace(/\d[,.:]\d/g, "");
    if (/[,;!?()]|:|\.(\s|$)/.test(s)) bad.push(`"${t.trim().slice(0, 60)}"`);
  }
  return [...new Set(bad)];
});

async function states(p, ctx) {
  await en.states(p, ctx);
  const code = await p.locator("#embed-code").textContent();
  if (!code.includes("/zh/playground/embed.html#")) ctx.problems.push(`embed snippet isn't the Chinese embed: ${code}`);
  (await punctuation(p)).forEach((b) => ctx.problems.push(`punctuation: ASCII in ${b}`));
}

module.exports = {
  ...en,
  name: "zh-playground",
  file: "zh/playground/index.html",
  states,
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
  punctuation,
};
