// Chapter 2 in Chinese (site/zh/context/): the same states, checks and motion as the English page
// (scripts/shots/context.js), which uses ids and the recording, never the English text.
const en = require("./context.js");

module.exports = {
  ...en,
  name: "zh-context",
  file: "zh/context/index.html",
  // The English page's motion frames would overwrite theirs (same file names), so this page has none.
  motion: undefined,
};
