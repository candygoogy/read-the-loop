// The video imports three files from the site as plain text, unchanged: the two game.js files (run as they are)
// and style.css (for the colour tokens). A `?raw` import bypasses every other loader, so webpack hands over the
// file's bytes as a string.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);

Config.overrideWebpackConfig((config) => {
  const rules = (config.module?.rules ?? []).map((rule) =>
    rule && typeof rule === "object" ? { ...rule, resourceQuery: { not: [/raw/] } } : rule,
  );
  return {
    ...config,
    module: { ...config.module, rules: [...rules, { resourceQuery: /raw/, type: "asset/source" }] },
  };
});
