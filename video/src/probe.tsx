// Layout probe, for scripts/check.ts only (Hero's `probe` prop; never on in a real render). Once the fonts have
// loaded, it measures the frame and logs one line, "PROBE {json}", which check.ts reads from the browser log:
// - fit: every [data-fit] text stays inside its own box (no overflow sideways) and inside the frame, takes no more
//   lines than its data-maxlines, doesn't overlap another [data-fit] text, and doesn't run into an [data-obstacle]
//   (the game, a pill, a card, the context bar) unless it sits inside it;
// - tofu: every non-ASCII character of our own text (outside [data-recorded]) is covered by a loaded web font in
//   its element's font stack, so nothing depends on the machine's fonts and no character can render as a box;
// - numbers: every number on screen (outside [data-nonum]), to compare the cuts.
import { useEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { fontsSettled } from "./theme";

type R = { l: number; t: number; r: number; b: number };

const textRects = (el: Element): DOMRect[] => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
};
const union = (rs: DOMRect[]): R | null =>
  rs.length === 0
    ? null
    : {
        l: Math.min(...rs.map((r) => r.left)),
        t: Math.min(...rs.map((r) => r.top)),
        r: Math.max(...rs.map((r) => r.right)),
        b: Math.max(...rs.map((r) => r.bottom)),
      };
const overlap = (a: R, b: R, tol = 2) =>
  Math.min(a.r, b.r) - Math.max(a.l, b.l) > tol && Math.min(a.b, b.b) - Math.max(a.t, b.t) > tol;
const name = (el: Element) => (el.textContent ?? "").trim().slice(0, 40);

// Line count: rects whose vertical centres are more than half a font size apart are on different lines.
const lineCount = (rs: DOMRect[], fontSize: number) => {
  const centres = rs.map((r) => (r.top + r.bottom) / 2).sort((a, b) => a - b);
  let n = 0;
  let last = -Infinity;
  for (const c of centres) {
    if (c - last > fontSize / 2) n++;
    last = c;
  }
  return n;
};

const parseRange = (s: string): [number, number][] =>
  s.split(",").map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");

const measure = (frame: number) => {
  const fit: string[] = [];
  const els = Array.from(document.querySelectorAll("[data-fit]"));
  const obstacles = Array.from(document.querySelectorAll("[data-obstacle]"));
  const boxes: { el: Element; rect: R }[] = [];
  for (const el of els) {
    const rs = textRects(el);
    const u = union(rs);
    if (!u) continue;
    const box = el.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    if (u.l < box.left - 1 || u.r > box.right + 1) fit.push(`overflows its box sideways: "${name(el)}"`);
    if (u.l < -1 || u.t < -1 || u.r > 1921 || u.b > 1081) fit.push(`outside the frame: "${name(el)}"`);
    const max = Number(el.getAttribute("data-maxlines") ?? 0);
    const lines = lineCount(rs, fontSize);
    if (max && lines > max) fit.push(`${lines} lines (max ${max}): "${name(el)}"`);
    for (const ob of obstacles) {
      if (ob.contains(el) || el.contains(ob)) continue;
      const o = ob.getBoundingClientRect();
      if (overlap(u, { l: o.left, t: o.top, r: o.right, b: o.bottom })) fit.push(`runs into a shape: "${name(el)}"`);
    }
    boxes.push({ el, rect: u });
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (overlap(a.rect, b.rect)) fit.push(`texts overlap: "${name(a.el)}" / "${name(b.el)}"`);
    }

  // Fonts: which loaded faces cover which code points.
  const faces: FontFace[] = [];
  document.fonts.forEach((f) => {
    if (f.status === "loaded") faces.push(f);
  });
  const covered = (family: string, cp: number) =>
    faces.some((f) => unquote(f.family) === family && parseRange(f.unicodeRange).some(([lo, hi]) => cp >= lo && cp <= hi));
  const tofu = new Set<string>();
  const numbers: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    const text = n.textContent ?? "";
    if (!parent || !text.trim()) continue;
    if (!parent.closest("[data-nonum]")) numbers.push(...(text.match(/\d+(?:[.,]\d+)*/g) ?? []));
    if (parent.closest("[data-recorded]")) continue;
    const stack = getComputedStyle(parent).fontFamily.split(",").map(unquote);
    for (const ch of new Set(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp <= 0x7f) continue;
      if (!stack.some((family) => covered(family, cp))) tofu.add(`${ch} U+${cp.toString(16).toUpperCase()}`);
    }
  }
  return { frame, fit, tofu: [...tofu], numbers: numbers.sort() };
};

export const LayoutProbe: React.FC = () => {
  const frame = useCurrentFrame();
  // One delayRender per frame, made during render so the screenshot waits for the measurement.
  const pending = useRef<{ frame: number; handle: number } | null>(null);
  if (pending.current?.frame !== frame) pending.current = { frame, handle: delayRender(`probe ${frame}`) };
  useEffect(() => {
    const { handle } = pending.current!;
    fontsSettled().then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          console.log(`PROBE ${JSON.stringify(measure(frame))}`);
          continueRender(handle);
        }),
      ),
    );
  }, [frame]);
  return null;
};
