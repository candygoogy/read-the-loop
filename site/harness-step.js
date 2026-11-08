// "You are the harness" widget for round 1 of chapter 1.
// The reader runs the model's first request and moves the output back into the conversation,
// by dragging it or with a button. Nothing runs here: the output shown is the recorded one.
// Classic script, no dependencies, works from file://. Its only global is window.HarnessStep.
(function () {
  "use strict";

  var DEFAULT_LABELS = {
    conversationTitle: "The conversation",
    computerTitle: "Your computer",
    requestTitle: "Request",
    resultTitle: "Result",
    outputTitle: "Output",
    recordedNote: "recorded output",
    idleNote: "Nothing runs in your browser. Running the request replays the output from the recording.",
    run: "Run the request",
    summaryLabel: "Replaying the recording of",
    drag: "Drag into the conversation",
    paste: "Paste into the conversation",
    slotIdle: "The result will go here",
    dropHint: "Drop the output here",
    pastedNote: "The output is now in the conversation.",
    liveStart: "The model's request is in the conversation. You are the harness: run the request.",
    liveRan: "The recorded output is on your computer. Paste it into the conversation, or drag it there.",
    liveDragStart: "Dragging the output. Drop it at the end of the conversation.",
    liveSnapBack: "Not dropped on the conversation. The output is back on your computer.",
    liveDone: "The result is in the conversation. That was one round of the loop."
  };

  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  var EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
  var DRAG_THRESHOLD = 4;   // px of movement before a press on the handle counts as a drag
  var SLOT_SLOP = 16;       // px around the drop slot that still count as "on the slot"
  var EDGE = 56;            // px from the viewport edge where a drag scrolls the page
  var GRIP = '<svg class="hs-grip" viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" focusable="false">' +
    '<circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/>' +
    '<circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>';

  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function mount(el, opts) {
    if (!el) throw new Error("HarnessStep.mount: no element given");
    opts = opts || {};
    var req = opts.request || {};
    var res = opts.result || {};
    var L = {};
    var k;
    for (k in DEFAULT_LABELS) L[k] = DEFAULT_LABELS[k];
    if (opts.labels) for (k in opts.labels) if (opts.labels[k] != null) L[k] = opts.labels[k];

    var id = "hs" + (++uid);
    var state = "idle";       // idle -> ran -> moving -> done
    var doneFired = false;
    var timers = [];
    var anims = [];
    var drag = null;
    var n = {};               // node refs for the current build
    var destroyed = false;

    function build() {
      el.innerHTML =
        '<div class="hs" data-state="idle">' +
          '<div class="hs-grid">' +
            '<section class="hs-convo" aria-labelledby="' + id + '-ct">' +
              '<h4 class="hs-title" id="' + id + '-ct">' + esc(L.conversationTitle) + "</h4>" +
              '<ol class="hs-list">' +
                '<li class="hs-item"><article class="card model hs-card" aria-labelledby="' + id + '-rq">' +
                  '<div class="card-head"><span id="' + id + '-rq">' + esc(L.requestTitle) + " · " + esc(req.tool) + "</span>" +
                  '<span class="meta">' + esc(req.meta) + "</span></div>" +
                  "<pre>" + (req.bodyHtml || "") + "</pre>" +
                "</article></li>" +
                '<li class="hs-item hs-slot-item"><div class="hs-slot"><span class="hs-slot-text">' + esc(L.slotIdle) + "</span></div></li>" +
              "</ol>" +
            "</section>" +
            '<section class="hs-pc" aria-labelledby="' + id + '-pt">' +
              '<h4 class="hs-title" id="' + id + '-pt">' + esc(L.computerTitle) + "</h4>" +
              '<div class="hs-idle">' +
                '<p class="hs-note">' + esc(L.idleNote) + "</p>" +
                '<button type="button" class="hs-btn hs-btn-primary hs-run">' + esc(L.run) + "</button>" +
              "</div>" +
              '<div class="hs-ran" hidden>' +
                '<p class="hs-summary"><span class="hs-summary-label">' + esc(L.summaryLabel) + "</span>" +
                  '<code class="hs-summary-text">' + esc(req.summary) + "</code></p>" +
                '<article class="card result hs-out" aria-labelledby="' + id + '-ot">' +
                  '<div class="card-head"><span id="' + id + '-ot">' + esc(L.outputTitle) + " · " + esc(req.tool) + "</span>" +
                  '<span class="meta">' + esc(L.recordedNote) + "</span></div>" +
                  "<pre>" + (res.bodyHtml || "") + "</pre>" +
                  '<div class="hs-actions">' +
                    // Pointer-only affordance. The paste button next to it is the keyboard and
                    // screen-reader path, so the handle is hidden from assistive tech.
                    '<div class="hs-btn hs-handle" aria-hidden="true">' + GRIP + "<span>" + esc(L.drag) + "</span></div>" +
                    '<button type="button" class="hs-btn hs-paste">' + esc(L.paste) + "</button>" +
                  "</div>" +
                "</article>" +
                '<p class="hs-pasted" hidden>' + esc(L.pastedNote) + "</p>" +
              "</div>" +
            "</section>" +
          "</div>" +
          '<p class="hs-live" aria-live="polite" aria-atomic="true"></p>' +
        "</div>";

      var q = function (s) { return el.querySelector(s); };
      n = {
        root: q(".hs"), list: q(".hs-list"), slotItem: q(".hs-slot-item"), slot: q(".hs-slot"),
        slotText: q(".hs-slot-text"), idle: q(".hs-idle"), run: q(".hs-run"), ran: q(".hs-ran"),
        summary: q(".hs-summary"), out: q(".hs-out"), handle: q(".hs-handle"), paste: q(".hs-paste"),
        pasted: q(".hs-pasted"), live: q(".hs-live")
      };
      setState("idle");
      later(function () { announce(L.liveStart); }, 150);
    }

    // ---------- helpers ----------
    function setState(s) {
      state = s;
      if (n.root) n.root.setAttribute("data-state", s);
    }
    function later(fn, ms) {
      var t = setTimeout(function () { timers.splice(timers.indexOf(t), 1); fn(); }, ms);
      timers.push(t);
      return t;
    }
    function animate(node, frames, o) {
      var a = node.animate(frames, o);
      anims.push(a);
      a.addEventListener("finish", function () { var i = anims.indexOf(a); if (i >= 0) anims.splice(i, 1); });
      return a;
    }
    function stopMotion() {
      timers.forEach(clearTimeout);
      timers = [];
      anims.slice().forEach(function (a) { a.cancel(); });
      anims = [];
    }
    // Clear first, then set, so the same message can be announced twice in a row.
    function announce(msg) {
      if (!n.live) return;
      n.live.textContent = "";
      later(function () { if (n.live) n.live.textContent = msg; }, 60);
    }
    function pageRect(node) {
      var r = node.getBoundingClientRect();
      return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
    }

    // ---------- run ----------
    function run() {
      if (state !== "idle") return;
      setState("ran");
      n.idle.hidden = true;
      n.ran.hidden = false;
      n.slotText.textContent = L.dropHint;
      if (!reducedMotion()) {
        // Short reveal: the line saying what runs, then the output unrolls from the top.
        animate(n.summary, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
          { duration: 180, easing: EASE_OUT, fill: "backwards" });
        animate(n.out, [{ opacity: 0, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }],
          { duration: 320, delay: 140, easing: EASE_OUT, fill: "backwards" });
      }
      // The run button is gone; the next action is the paste button. Scroll only as far as the
      // bottom of the output, so that when stacked the drop slot above stays in view.
      n.paste.focus({ preventScroll: true });
      var below = n.out.getBoundingClientRect().bottom + 16 - window.innerHeight;
      if (below > 0) window.scrollBy({ top: below, behavior: reducedMotion() ? "auto" : "smooth" });
      announce(L.liveRan);
    }

    // ---------- paste (button) ----------
    function paste() {
      if (state !== "ran") return;
      setState("moving");
      if (reducedMotion()) return commit();
      // The output travels to the slot, so the button path shows the same movement as a drag.
      var from = pageRect(n.out);
      animate(n.out, [{ transform: "none" }, { transform: toSlot(from) }],
        { duration: 320, easing: EASE_IN_OUT, fill: "forwards" }).addEventListener("finish", commit);
      n.out.classList.add("hs-lifted");
    }

    // Transform that puts a card whose untransformed box is `from` onto the drop slot.
    function toSlot(from) {
      var s = pageRect(n.slot);
      var scale = s.width / from.width;
      return "translate(" + (s.left - from.left) + "px, " + (s.top - from.top) + "px) scale(" + scale + ")";
    }

    // ---------- the result enters the conversation ----------
    function commit() {
      if (state === "done" || destroyed) return;
      setState("done");
      stopMotion();
      var li = document.createElement("li");
      li.className = "hs-item";
      li.innerHTML =
        '<article class="card result hs-card hs-result" tabindex="-1" aria-labelledby="' + id + '-rs">' +
          '<div class="card-head"><span id="' + id + '-rs">' + esc(L.resultTitle) + " · " + esc(req.tool) + "</span>" +
          '<span class="meta">' + esc(res.meta) + "</span></div>" +
          "<pre>" + (res.bodyHtml || "") + "</pre>" +
        "</article>";
      n.list.replaceChild(li, n.slotItem);
      n.out.remove();
      n.pasted.hidden = false;
      var card = li.firstChild;
      if (!reducedMotion()) {
        animate(card, [{ opacity: 0.4 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      }
      card.focus({ preventScroll: true });
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) card.scrollIntoView({ block: "nearest" });
      announce(L.liveDone);
      if (!doneFired) {
        doneFired = true;
        if (typeof opts.onDone === "function") opts.onDone();
      }
    }

    // ---------- drag (Pointer Events: mouse, touch, pen) ----------
    function onPointerDown(ev) {
      if (!n.handle || !n.handle.contains(ev.target)) return;
      if (state !== "ran" || drag) return;            // ignore extra fingers once a drag is on
      if (!ev.isPrimary || (ev.pointerType === "mouse" && ev.button !== 0)) return;
      ev.preventDefault();
      try { n.handle.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ }
      var box = pageRect(n.out);
      var doc = document.documentElement;
      drag = {
        id: ev.pointerId, sx: ev.pageX, sy: ev.pageY, cx: ev.clientX, cy: ev.clientY,
        box: box, docH: Math.max(doc.scrollHeight, box.top + box.height), moved: false, over: false, raf: 0
      };
    }

    function onPointerMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      drag.cx = ev.clientX;
      drag.cy = ev.clientY;
      if (!drag.moved) {
        if (Math.abs(ev.pageX - drag.sx) + Math.abs(ev.pageY - drag.sy) < DRAG_THRESHOLD) return;
        drag.moved = true;
        n.root.classList.add("hs-is-dragging");
        n.out.classList.add("hs-lifted");
        announce(L.liveDragStart);
        drag.raf = requestAnimationFrame(autoScroll);
      }
      follow();
    }

    // Move the card with the pointer, kept inside the page so it never causes overflow.
    function follow() {
      var b = drag.box;
      var vw = document.documentElement.clientWidth;
      var dx = drag.cx + window.scrollX - drag.sx;
      var dy = drag.cy + window.scrollY - drag.sy;
      dx = Math.min(Math.max(dx, window.scrollX + 4 - b.left), Math.max(window.scrollX + 4 - b.left, window.scrollX + vw - 4 - b.left - b.width));
      dy = Math.min(Math.max(dy, -b.top), Math.max(-b.top, drag.docH - b.top - b.height));
      n.out.style.transform = "translate(" + dx + "px, " + dy + "px)";
      drag.over = onSlot(drag.cx, drag.cy);
      n.slot.classList.toggle("hs-over", drag.over);
      // On a phone the card covers the slot, so the card shows it's over the slot too.
      n.out.classList.toggle("hs-on-slot", drag.over);
    }

    function onSlot(x, y) {
      var r = n.slot.getBoundingClientRect();
      return x >= r.left - SLOT_SLOP && x <= r.right + SLOT_SLOP && y >= r.top - SLOT_SLOP && y <= r.bottom + SLOT_SLOP;
    }

    // Touch-action is off on the handle, so near the viewport edge the drag scrolls the page itself.
    function autoScroll() {
      if (!drag) return;
      var h = window.innerHeight;
      var v = 0;
      if (drag.cy < EDGE) v = -Math.ceil((EDGE - drag.cy) / 4);
      else if (drag.cy > h - EDGE) v = Math.ceil((drag.cy - (h - EDGE)) / 4);
      if (v) { window.scrollBy(0, v); follow(); }
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function onPointerUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      endDrag(drag.moved && onSlot(ev.clientX, ev.clientY));
    }
    function onPointerCancel(ev) {
      if (drag && ev.pointerId === drag.id) endDrag(false);
    }
    function onKey(ev) {
      if (drag && ev.key === "Escape") endDrag(false);
    }

    function endDrag(dropped) {
      var d = drag;
      drag = null;
      cancelAnimationFrame(d.raf);
      try { if (n.handle.hasPointerCapture(d.id)) n.handle.releasePointerCapture(d.id); } catch (e) { /* ignore */ }
      n.root.classList.remove("hs-is-dragging");
      n.slot.classList.remove("hs-over");
      n.out.classList.remove("hs-on-slot");
      if (!d.moved) return;
      var now = n.out.style.transform;
      n.out.style.transform = "";
      if (dropped) {
        setState("moving");
        if (reducedMotion()) return commit();
        // Settle into the slot, then become the result card.
        animate(n.out, [{ transform: now }, { transform: toSlot(d.box) }],
          { duration: 180, easing: EASE_OUT, fill: "forwards" }).addEventListener("finish", commit);
      } else {
        announce(L.liveSnapBack);
        if (reducedMotion()) { n.out.classList.remove("hs-lifted"); return; }
        var out = n.out;
        animate(out, [{ transform: now }, { transform: "none" }], { duration: 240, easing: EASE_OUT })
          .addEventListener("finish", function () { if (state === "ran") out.classList.remove("hs-lifted"); });
      }
    }

    function onClick(ev) {
      var t = ev.target;
      if (n.run && n.run.contains(t)) run();
      else if (n.paste && n.paste.contains(t)) paste();
    }

    el.addEventListener("click", onClick);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("lostpointercapture", onPointerCancel);
    document.addEventListener("keydown", onKey);

    function abortDrag() {
      if (!drag) return;
      cancelAnimationFrame(drag.raf);
      drag = null;
    }

    build();

    return {
      reset: function () {
        if (destroyed) return;
        abortDrag();
        stopMotion();
        doneFired = false;
        build();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        abortDrag();
        stopMotion();
        el.removeEventListener("click", onClick);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", onPointerCancel);
        el.removeEventListener("lostpointercapture", onPointerCancel);
        document.removeEventListener("keydown", onKey);
        el.innerHTML = "";
        n = {};
      }
    };
  }

  window.HarnessStep = { mount: mount, defaultLabels: DEFAULT_LABELS };
})();
