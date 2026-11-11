// Chapter 8's embed in Simplified Chinese (site/zh/playground/embed.html): the same states and checks as the
// English embed (scripts/shots/playground-embed.js), plus the Chinese page's punctuation check
// (scripts/shots/zh-playground.js).
const en = require("./playground-embed.js");
const { punctuation } = require("./zh-playground.js");

async function states(p, ctx) {
  await en.states(p, ctx);
  (await punctuation(p)).forEach((b) => ctx.problems.push(`punctuation: ASCII in ${b}`));
}

module.exports = { ...en, name: "zh-playground-embed", file: "zh/playground/embed.html", states };
