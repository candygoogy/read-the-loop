// Chapter 6 in Simplified Chinese (site/zh/subagents/): the same states, checks and reduced-motion pass as the
// English page (scripts/shots/subagents.js), which uses ids, data attributes and the recording, never the
// English text. (Its readout check formats numbers as en-US; zh-CN groups digits the same way.)
const en = require("./subagents.js");

module.exports = {
  ...en,
  name: "zh-subagents",
  file: "zh/subagents/index.html",
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
};
