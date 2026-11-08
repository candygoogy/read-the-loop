// Shared motion for every page: the easing and duration tokens from style.css, interruptible Web
// Animations helpers, reveal-on-scroll, count-ups that screen readers hear only once, and settle()
// for screenshots and printing. Classic script, one global: window.Motion.
//
// Rules every helper keeps:
// - Under prefers-reduced-motion: reduce, nothing animates; every call is an instant state change.
// - Only transform and opacity (and SVG stroke-dashoffset) move.
// - A new call on an element cancels the one before, so fast stepping or scrubbing never queues motion.
// - Nothing is hidden waiting on an animation unless the observer that shows it is already running.
(() => {
  "use strict";

  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const reduced = () => !!mq.matches;
  const canAnimate = () => !reduced() && typeof Element !== "undefined" && !!Element.prototype.animate;

  // ---------- tokens (style.css :root) ----------
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const ms = (name, fallback) => parseFloat(token(name, "")) || fallback;
  const ease = {
    out: token("--ease-out", "cubic-bezier(0.23, 1, 0.32, 1)"),
    inOut: token("--ease-in-out", "cubic-bezier(0.77, 0, 0.175, 1)"),
  };
  const dur = {
    press: ms("--dur-press", 160),
    fast: ms("--dur-fast", 150),
    base: ms("--dur-base", 240),
    slow: ms("--dur-slow", 400),
    reveal: ms("--dur-reveal", 450),
  };

  // A cubic-bezier() string as a function of progress, for motion sampled in JS (a path, a count).
  function bezier(str) {
    const m = String(str).match(/cubic-bezier\(([^)]+)\)/);
    if (!m) return (t) => t;
    const [x1, y1, x2, y2] = m[1].split(",").map(Number);
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = sx(t) - x, d = dx(t);
        if (Math.abs(e) < 1e-5) return sy(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 20; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-5) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }

  // ---------- interruptible animations ----------
  // One running animation per element and channel; starting another cancels it.
  const running = new WeakMap();
  function stop(el, key = "main") {
    const m = el && running.get(el);
    if (m && m[key]) { m[key].cancel(); delete m[key]; }
  }
  function play(el, frames, opts = {}) {
    if (!el) return null;
    const { key = "main", ...timing } = opts;
    stop(el, key);
    if (!canAnimate()) return null;
    const a = el.animate(frames, { duration: dur.base, easing: ease.out, ...timing });
    const m = running.get(el) || {};
    m[key] = a;
    running.set(el, m);
    a.addEventListener("finish", () => { if (m[key] === a) delete m[key]; });
    return a;
  }

  // Fade and rise into place (new text, a changed step). `y` in px.
  function enter(els, { y = 4, duration = dur.base, stagger = 0, delay = 0, key = "enter" } = {}) {
    [].concat(els).filter(Boolean).forEach((el, i) => play(el,
      [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "none" }],
      { duration, delay: delay + i * stagger, fill: "backwards", key }));
  }

  // Bars growing from their baseline: scaleX from the left (or scaleY from the bottom). Works on HTML
  // and SVG; SVG shapes scale about their own box.
  function grow(els, { axis = "x", duration = dur.reveal, stagger = 60, delay = 0, origin } = {}) {
    if (!canAnimate()) return;
    [].concat(els).filter(Boolean).forEach((el, i) => {
      if (el instanceof SVGElement) el.style.transformBox = "fill-box";
      el.style.transformOrigin = origin || (axis === "x" ? "0% 50%" : "50% 100%");
      play(el, [{ transform: axis === "x" ? "scaleX(0)" : "scaleY(0)" }, { transform: "none" }],
        { duration, delay: delay + i * stagger, fill: "backwards", key: "grow" });
    });
  }

  // Points arriving: a small scale-up with a fade, in the order given.
  function pop(els, { duration = 200, spread = 300, delay = 0 } = {}) {
    if (!canAnimate()) return;
    const list = [].concat(els).filter(Boolean);
    list.forEach((el, i) => {
      if (el instanceof SVGElement) el.style.transformBox = "fill-box";
      el.style.transformOrigin = "50% 50%";
      play(el, [{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "none" }],
        { duration, delay: delay + (list.length > 1 ? (i / (list.length - 1)) * spread : 0), fill: "backwards", key: "pop" });
    });
  }

  // An SVG line drawing itself along its length.
  function draw(path, { duration = dur.reveal, delay = 0, easing = ease.out } = {}) {
    if (!canAnimate() || !path || !path.getTotalLength) return null;
    const L = path.getTotalLength();
    return play(path, [
      { strokeDasharray: `${L} ${L}`, strokeDashoffset: L },
      { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 },
    ], { duration, delay, easing, fill: "backwards", key: "draw" });
  }

  // A dot travelling along an SVG path, fading in at the start and out at the end. The path's
  // points are sampled with the easing applied to distance, so the timing itself is linear.
  function along(dot, path, { duration = 380, delay = 0, easing = ease.inOut, key = "along" } = {}) {
    if (!canAnimate() || !dot || !path) return null;
    const L = path.getTotalLength();
    const e = bezier(easing);
    const n = 24;
    const frames = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = path.getPointAtLength(L * e(t));
      frames.push({ offset: t, transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`, opacity: t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1 });
    }
    return play(dot, frames, { duration, delay, easing: "linear", fill: "backwards", key });
  }

  // ---------- numbers ----------
  // Count the number shown in `el` to `to`, from `from` (or from where a running count is now).
  // The moving digits are aria-hidden; screen readers only ever get the final value. The count is
  // driven by a (no-op) Web Animation, so pausing or seeking animations also pauses or seeks it,
  // and it ends exactly on `format(to)`.
  const counts = new WeakMap();
  function count(el, to, { from, format = String, round = Math.round, duration = dur.slow, easing = ease.out } = {}) {
    if (!el) return;
    const final = format(to);
    const prev = counts.get(el);
    if (prev) { from = prev.current; prev.anim.cancel(); counts.delete(el); }
    if (!canAnimate() || from === undefined || from === null || isNaN(from) || from === to) { el.textContent = final; return; }
    const vis = document.createElement("span");
    vis.setAttribute("aria-hidden", "true");
    vis.textContent = format(round(from));
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = final;
    el.replaceChildren(vis, sr);
    const anim = el.animate([{ opacity: 1 }, { opacity: 1 }], { duration });
    const st = { anim, current: from };
    counts.set(el, st);
    const e = bezier(easing);
    const tick = () => {
      if (counts.get(el) !== st) return;
      const t = Math.min(1, (anim.currentTime || 0) / duration);
      st.current = from + (to - from) * e(t);
      if (t >= 1 || anim.playState === "finished" || anim.playState === "idle") {
        counts.delete(el);
        el.textContent = final;
        return;
      }
      vis.textContent = format(round(st.current));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- reveal on scroll ----------
  // Only elements that start below the fold are hidden, and only while an IntersectionObserver is
  // there to show them. `onEnter(el)` runs once, as the element comes into view (charts draw in then).
  const pending = new Map(); // el -> onEnter
  let io = null;
  function show(el) {
    const fn = pending.get(el);
    pending.delete(el);
    if (io) io.unobserve(el);
    el.classList.add("rv-in");
    const done = () => el.classList.remove("rv", "rv-in");
    el.addEventListener("transitionend", (e) => { if (e.target === el) done(); }, { once: true });
    setTimeout(done, dur.reveal + 200);
    if (fn) { try { fn(el); } catch (err) { setTimeout(() => { throw err; }); } }
  }
  function reveal(els, onEnter) {
    if (!canAnimate() || !("IntersectionObserver" in window)) return;
    if (!io) {
      try {
        io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting && pending.has(en.target)) show(en.target); }),
          { rootMargin: "0px 0px -8% 0px" });
      } catch { io = null; return; }
    }
    const fold = window.innerHeight * 0.92;
    [].concat(els).filter(Boolean).forEach((el) => {
      if (pending.has(el)) return;
      if (el.getBoundingClientRect().top < fold) return; // already on screen, or above it: leave it
      el.classList.add("rv");
      pending.set(el, onEnter || null);
      io.observe(el);
    });
  }

  // Everything to its end state at once: pending reveals shown (with their draw-ins skipped), every
  // finite animation finished. For screenshots, printing, and a switch to reduced motion.
  function settle() {
    [...pending.keys()].forEach((el) => {
      pending.delete(el);
      if (io) io.unobserve(el);
      el.classList.remove("rv", "rv-in");
    });
    document.querySelectorAll(".rv").forEach((el) => el.classList.remove("rv", "rv-in"));
    if (document.getAnimations) {
      document.getAnimations().forEach((a) => {
        try { if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish(); } catch {}
      });
    }
  }
  window.addEventListener("beforeprint", settle);
  if (mq.addEventListener) mq.addEventListener("change", () => { if (reduced()) settle(); });

  window.Motion = { reduced, ease, dur, bezier, play, stop, enter, grow, pop, draw, along, count, reveal, settle };
})();
