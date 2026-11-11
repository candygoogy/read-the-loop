// Chapter 7 in Simplified Chinese (site/zh/failure-modes/): the same states, checks and reduced-motion pass as
// the English page (scripts/shots/failure-modes.js), which uses ids, data attributes and the recordings. One
// check there reads English text: the detail panel's title must hold "Run <k>". On this page the copy says
// "第 <k> 次运行", so that one problem is checked again here against the Chinese label, and kept if it fails.
// (Its stats check formats numbers as en-US; zh-CN groups digits the same way.)
const en = require("./failure-modes.js");

async function states(p, ctx) {
  const mine = [];
  await en.states(p, { ...ctx, problems: mine });
  mine.forEach((m) => {
    const t = m.match(/^detail title "([\s\S]*)" isn't (\S+) run (\d+)$/);
    if (t && t[1].includes(t[2]) && t[1].includes(`第 ${t[3]} 次运行`)) return;
    ctx.problems.push(m);
  });
}

module.exports = {
  ...en,
  name: "zh-failure-modes",
  file: "zh/failure-modes/index.html",
  states,
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
};
