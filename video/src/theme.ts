// Colours come from the site's own stylesheet (the light theme, the first :root block), read as text.
import css from "../../site/style.css?raw";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const root = css.match(/:root\s*\{([^}]*)\}/);
if (!root) throw new Error("No :root block in site/style.css");
const tokens = Object.fromEntries([...root[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const need = ["paper", "paper-2", "card", "ink", "ink-2", "ink-3", "rule", "sys", "you", "model", "result"] as const;
for (const k of need) if (!tokens[k]) throw new Error(`site/style.css has no --${k}`);

export const C = {
  paper: tokens.paper,
  paper2: tokens["paper-2"],
  card: tokens.card,
  ink: tokens.ink,
  ink2: tokens["ink-2"],
  ink3: tokens["ink-3"],
  rule: tokens.rule,
  sys: tokens.sys,
  you: tokens.you,
  model: tokens.model,
  result: tokens.result,
};

const latin = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };
export const F = {
  display: loadFraunces("normal", { weights: ["600", "700"], ...latin }).fontFamily,
  body: loadSerif("normal", { weights: ["400", "600"], ...latin }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "500", "600"], ...latin }).fontFamily,
};
