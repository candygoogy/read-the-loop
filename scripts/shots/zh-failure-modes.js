// Chapter 7 in Simplified Chinese (site/zh/failure-modes/): the same states, checks and reduced-motion pass as
// the English page (scripts/shots/failure-modes.js), which uses ids, data attributes and the recordings. One
// check there reads English text: the detail panel's title must hold "Run <k>". On this page the copy says
// "第 <k> 次运行", so that one problem is checked again here against the Chinese label, and kept if it fails.
// (Its stats check formats numbers as en-US; zh-CN groups digits the same way.) This page also checks that
// the punctuation app.js puts around the copy is Chinese: each case's byline and its sources end with "。",
// "现已下线" sits in full-width brackets, and the label before a refusal's reason ends with "：".
const en = require("./failure-modes.js");

async function states(p, ctx) {
  const mine = [];
  await en.states(p, { ...ctx, problems: mine });
  mine.forEach((m) => {
    const t = m.match(/^detail title "([\s\S]*)" isn't (\S+) run (\d+)$/);
    if (t && t[1].includes(t[2]) && t[1].includes(`第 ${t[3]} 次运行`)) return;
    ctx.problems.push(m);
  });
  const punct = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".mode-by, .mode-src").forEach((e) => { if (!e.textContent.trim().endsWith("。")) bad.push(`"${e.textContent.trim().slice(-24)}" doesn't end with 。`); });
    document.querySelectorAll(".mode-src").forEach((e) => { if (/[()]|\.\s/.test(e.textContent)) bad.push(`ASCII punctuation in "${e.textContent.trim()}"`); });
    document.querySelectorAll(".r-why .r-k").forEach((e) => { if (!e.textContent.endsWith("：")) bad.push(`refusal label "${e.textContent}"`); });
    return bad;
  });
  punct.forEach((b) => ctx.problems.push(`punctuation: ${b}`));
}

module.exports = {
  ...en,
  name: "zh-failure-modes",
  file: "zh/failure-modes/index.html",
  states,
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
};
