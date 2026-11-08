// The language of a cut: its strings (i18n.ts) and its font stacks. The Chinese cut puts Noto Serif SC behind the
// serif faces (Fraunces, Source Serif 4) and Noto Sans SC behind IBM Plex Mono, so Latin text and recorded text keep
// the English cut's fonts and only the Chinese characters fall through to Noto, at the same weights.
import { loadFont as loadSans } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerifSC";
import React, { createContext, useContext, useState } from "react";
import { UIS, zhText, type Lang, type UI } from "./i18n";
import { F, trackFont } from "./theme";
import { slicesFor } from "./zhFonts";

// ws: word spacing for our own text in the mono face. Plex Mono's space is a full 0.6em cell, which between Chinese
// characters and numbers ("第 1 次") reads as a gap, so the Chinese cut narrows it. Recorded text never gets it.
export type Fonts = { display: string; body: string; mono: string; ws: string };
const EN: Fonts = { ...F, ws: "normal" };
export type Locale = { lang: Lang; ui: UI; f: Fonts };

const LocaleContext = createContext<Locale>({ lang: "en", ui: UIS.en, f: EN });
export const useLocale = () => useContext(LocaleContext);

const loadZhFonts = (): Fonts => {
  const text = zhText();
  // The slice keys ("[45]" etc.) aren't in the fonts' subset types, but loadFont accepts them.
  // About a dozen slices per weight is the point of slicing, so the "too many requests" warning doesn't apply.
  const opts = { ignoreTooManyRequestsWarning: true };
  const serif = loadSerif("normal", { weights: ["400", "600", "700"], subsets: slicesFor(text, "serif") as "latin"[], ...opts });
  const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: slicesFor(text, "sans") as "latin"[], ...opts });
  trackFont(serif);
  trackFont(sans);
  return {
    display: `${F.display}, ${serif.fontFamily}`,
    body: `${F.body}, ${serif.fontFamily}`,
    mono: `${F.mono}, ${sans.fontFamily}`,
    ws: "-0.3em",
  };
};

export const LocaleProvider: React.FC<{ lang: Lang; children: React.ReactNode }> = ({ lang, children }) => {
  const [f] = useState<Fonts>(() => (lang === "zh" ? loadZhFonts() : EN));
  return <LocaleContext.Provider value={{ lang, ui: UIS[lang], f }}>{children}</LocaleContext.Provider>;
};
