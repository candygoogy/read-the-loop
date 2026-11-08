// This machine's folders, read from local.json at the repo root (gitignored; local.example.json shows
// the keys). Every key is optional:
// - playwrightBrowsers: where Playwright's browsers are installed. Set for this process only, and only
//   when PLAYWRIGHT_BROWSERS_PATH isn't set already.
// - shots: the default output folder of screenshot.js, check-site.js and tests/harness-step-check.js
//   (otherwise out/shots, which is gitignored).
// tests/test_build_trace.py reads the same file for `recordings` and `scratch`.
const path = require("path");
const fs = require("fs");

const repo = path.resolve(__dirname, "..");
let local = {};
try {
  local = JSON.parse(fs.readFileSync(path.join(repo, "local.json"), "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw new Error(`local.json: ${e.message}`);
}
if (local.playwrightBrowsers && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = local.playwrightBrowsers;
}

module.exports = {
  shots: path.resolve(repo, local.shots || path.join("out", "shots")),
};
