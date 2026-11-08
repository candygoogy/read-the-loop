// `?raw` imports: webpack hands over the file's bytes as a string and no other loader touches them. Used by
// remotion.config.ts (CLI and Studio) and by scripts/check.ts (which bundles through the Node API).
import type { WebpackOverrideFn } from "@remotion/bundler";

export const webpackOverride: WebpackOverrideFn = (config) => {
  const rules = (config.module?.rules ?? []).map((rule) =>
    rule && typeof rule === "object" ? { ...rule, resourceQuery: { not: [/raw/] } } : rule,
  );
  return {
    ...config,
    module: { ...config.module, rules: [...rules, { resourceQuery: /raw/, type: "asset/source" }] },
  };
};
