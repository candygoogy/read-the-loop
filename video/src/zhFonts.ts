// Google ships Noto Sans SC and Noto Serif SC in ~100 slices by unicode range. Pick only the slices a text needs.
import { getInfo as sansInfo } from "@remotion/google-fonts/NotoSansSC";
import { getInfo as serifInfo } from "@remotion/google-fonts/NotoSerifSC";

export const slicesFor = (text: string, family: "sans" | "serif" = "sans") => {
  const cps = [...new Set([...text].map((ch) => ch.codePointAt(0) ?? 0))];
  const info = family === "sans" ? sansInfo() : serifInfo();
  const ranges = Object.entries(info.unicodeRanges).filter(([k]) => /^\[\d+\]$/.test(k));
  return ranges
    .filter(([, r]) =>
      r.split(",").some((part) => {
        const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
        const lo = parseInt(a, 16);
        const hi = parseInt(b ?? a, 16);
        return cps.some((cp) => cp >= lo && cp <= hi);
      }),
    )
    .map(([k]) => k);
};
