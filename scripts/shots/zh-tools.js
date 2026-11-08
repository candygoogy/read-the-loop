// Chapter 5 in Simplified Chinese (site/zh/tools/): the same states, checks and reduced-motion pass as the
// English page (scripts/shots/tools.js), which uses ids, data attributes and the recording, never the
// English text.
const en = require("./tools.js");

module.exports = {
  ...en,
  name: "zh-tools",
  file: "zh/tools/index.html",
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
};
