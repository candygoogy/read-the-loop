// Chapter 1 player. Every number and every piece of text the agent wrote or saw comes from
// window.TRACE (data/trace-01.js), the recorded session. The narration is ours.
(() => {
  "use strict";
  const T = window.TRACE;
  const calls = T.calls;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("en-US");

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Light markdown for what the model wrote: code blocks, inline code, bold, paragraphs.
  function md(s) {
    const blocks = [];
    s = s.replace(/```[a-z]*\n([\s\S]*?)```/g, (_, code) => {
      blocks.push(code.replace(/\n$/, ""));
      return `\n\n\u0000${blocks.length - 1}\u0000\n\n`;
    });
    return s.split(/\n{2,}/).filter((para) => para.trim()).map((para) => {
      const m = para.trim().match(/^\u0000(\d+)\u0000$/);
      if (m) return `<pre>${esc(blocks[+m[1]])}</pre>`;
      let h = esc(para.trim());
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
      return `<p class="say">${h}</p>`;
    }).join("");
  }

  // Long outputs keep their head and their tail: errors usually sit at the end.
  function clip(text, head = 7, tail = 4) {
    const NL = "\n";
    const lines = text.replace(/\s+$/, "").split(NL);
    if (lines.length <= head + tail + 1) return { body: lines.join(NL), cut: 0, rest: "" };
    return { body: lines.slice(0, head).join(NL), cut: lines.length - head - tail, rest: lines.slice(-tail).join(NL) };
  }

  const tools = (c) => c.output.filter((o) => o.kind === "tool");
  const texts = (c) => c.output.filter((o) => o.kind === "text");

  // ---------- cards ----------
  function youCard() {
    return `<div class="card you"><div class="card-head"><span>You</span><span class="meta">typed into Claude Code</span></div>
      <p class="say">${esc(T.prompt)}</p></div>`;
  }

  function requestCard(t) {
    let body;
    if (t.tool === "Edit") {
      body = `<pre>file: ${esc(t.input.file_path)}\n<span class="del">- ${esc(t.input.old_string.trim())}</span>\n<span class="add">+ ${esc(t.input.new_string.trim())}</span></pre>`;
    } else if (t.tool === "Bash") {
      const cmd = t.input.command.split(" && ").join(" &&\n  ");
      body = `<pre>${esc(cmd)}</pre>`;
    } else {
      body = `<pre>${esc(JSON.stringify(t.input, null, 2))}</pre>`;
    }
    const why = t.input.description ? `“${esc(t.input.description)}”` : "change a file";
    return `<div class="card model"><div class="card-head"><span>Request · ${esc(t.tool)}</span><span class="meta">${why}</span></div>${body}</div>`;
  }

  const HIGHLIGHT = [/No module named pytest/, /^OK$/m, /has been updated successfully\./];
  function resultCard(t) {
    const r = t.result;
    const { body, cut, rest } = clip(r.text);
    const mark = (x) => HIGHLIGHT.reduce((acc, re) => acc.replace(new RegExp(re.source, re.flags), (m) => `<mark>${m}</mark>`), esc(x));
    let h = mark(body);
    if (cut) h += `\n<span class="more">… ${cut} lines skipped here …</span>\n` + mark(rest);
    const lines = r.text.replace(/\s+$/, "").split("\n").length;
    return `<div class="card result${r.is_error ? " err" : ""}"><div class="card-head"><span>Result · ${esc(t.tool)}</span><span class="meta">${lines} line${lines === 1 ? "" : "s"} pasted back</span></div><pre>${h}</pre></div>`;
  }

  function textCard(o, label) {
    return `<div class="card model"><div class="card-head"><span>${label}</span><span class="meta">plain text</span></div>${md(o.text)}</div>`;
  }

  // ---------- steps ----------
  // Each step: who acts, what the loop diagram, the code and the context bar show.
  const c0 = calls[0], c1 = calls[1], c2 = calls[2], c3 = calls[3];
  const t0 = tools(c0)[0], t1 = tools(c1)[0], [t2a, t2b] = tools(c2);
  const sysTokens = c0.context_tokens;

  const steps = [
    {
      who: "you", title: "You type one sentence",
      text: `Claude Code, the <strong>harness</strong> wrapped around the model, doesn't send your sentence on its own. It puts in front of it the model's instructions, some facts about this computer, and a manual for the ${T.tools_available.length} tools the model may ask for (${T.tools_available.join(", ")}). Together that's <strong>${fmt(sysTokens)} tokens</strong>. A token is a word or a piece of one.`,
      cards: () => youCard(),
      loop: ["n-harness", "e-to-model", "l-to-model"], code: [1], rounds: 0,
      count: () => `The first call will read <b>${fmt(sysTokens)}</b> tokens`,
    },
    {
      who: "model", title: "Call 1: the model writes a request",
      text: `The model reads all ${fmt(c0.context_tokens)} tokens and writes a reply. It can't look at your files, so the reply is a <strong>request</strong>, written in a format the harness understands: “run this command and tell me what happened.”`,
      cards: () => requestCard(t0),
      loop: ["n-model", "e-to-harness", "l-to-harness"], code: [3, 4], rounds: 0, reading: true,
      count: () => `Call 1 read <b>${fmt(c0.context_tokens)}</b> tokens, none from cache. It's the first call.`,
    },
    {
      who: "harness", title: "The harness runs it",
      text: `The <strong>harness</strong> runs the command on your computer, not the model. It pastes the output into the conversation and calls the model again. Between calls the model keeps nothing. Everything it knows is in this growing conversation.`,
      cards: () => resultCard(t0),
      loop: ["n-harness", "n-pc", "e-to-pc", "e-from-pc", "l-pc"], code: [7, 8, 9], rounds: 1,
      count: () => `The conversation is now <b>${fmt(c1.context_tokens)}</b> tokens (+${fmt(c1.added_since_previous)})`,
    },
    {
      who: "model", title: "Call 2: read everything again",
      text: `The model starts over and reads the whole conversation from the top, now ${fmt(c1.context_tokens)} tokens. It asks for three things in one command: show <code>cart.py</code>, show the tests, and run them with <code>pytest</code>.`,
      cards: () => requestCard(t1),
      loop: ["n-model", "e-to-model", "e-to-harness", "l-to-harness"], code: [3, 4], rounds: 1, reading: true,
      count: () => `Call 2 read <b>${fmt(c1.context_tokens)}</b> tokens, ${fmt(c1.cached_tokens)} of them from cache`,
    },
    {
      who: "harness", title: "A wrong guess, pasted back",
      text: `Both files come back, and so does an error: <strong>pytest isn't installed</strong> on this computer. The model guessed wrong. It can only find out because the harness pastes the error in like any other output.`,
      cards: () => resultCard(t1),
      loop: ["n-harness", "n-pc", "e-to-pc", "e-from-pc", "l-pc"], code: [7, 8, 9], rounds: 2,
      count: () => `The conversation is now <b>${fmt(c2.context_tokens)}</b> tokens (+${fmt(c2.added_since_previous)})`,
    },
    {
      who: "model", title: "Call 3: the fix",
      text: `Having read the code, the model names the bug in one sentence. Then it makes two requests in a single reply: change line 6, and run the tests again, this time with Python's built-in runner, which needs nothing installed.`,
      cards: () => textCard(texts(c2)[0], "The model writes") + requestCard(t2a) + requestCard(t2b),
      loop: ["n-model", "e-to-model", "e-to-harness", "l-to-harness"], code: [3, 4], rounds: 2, reading: true,
      count: () => `Call 3 read <b>${fmt(c2.context_tokens)}</b> tokens, ${fmt(c2.cached_tokens)} of them from cache`,
    },
    {
      who: "harness", title: "Edit applied, tests pass",
      text: `The harness makes the edit and runs the tests. All three pass, and that output goes into the conversation too.`,
      cards: () => resultCard(t2a) + resultCard(t2b),
      loop: ["n-harness", "n-pc", "e-to-pc", "e-from-pc", "l-pc"], code: [7, 8, 9], rounds: 3,
      count: () => `The conversation is now <b>${fmt(c3.context_tokens)}</b> tokens (+${fmt(c3.added_since_previous)})`,
    },
    {
      who: "model", title: "Call 4: a reply with no request",
      text: `The model reads everything once more and writes a summary. This reply has <strong>no request</strong> in it, and that's the harness's signal to stop. The loop ends and you see the answer.`,
      cards: () => textCard({ text: T.final_answer }, "The model writes · final answer"),
      loop: ["n-model", "e-to-model"], code: [3, 5, 6, 10], rounds: 3, reading: true,
      count: () => `Call 4 read <b>${fmt(c3.context_tokens)}</b> tokens, ${fmt(c3.cached_tokens)} of them from cache`,
    },
  ];

  // ---------- context bar ----------
  const maxTokens = c3.context_tokens;
  const rounds = calls.slice(1).map((c) => c.added_since_previous);
  const stack = $("stack");
  const pct = (n) => `${(n / maxTokens) * 100}%`;
  stack.innerHTML =
    `<div class="blk sys" style="width:${pct(sysTokens)}"><span>set-up · ${fmt(sysTokens)}</span></div>` +
    rounds.map((n, i) => `<div class="blk round" data-r="${i + 1}" style="width:0" title="round ${i + 1}: +${fmt(n)} tokens"></div>`).join("");
  $("legend").innerHTML =
    `<span><i style="background:var(--sys)"></i>set-up: instructions, tool manual and your message</span>` +
    `<span><i style="background:var(--result);box-shadow:inset 3px 0 0 var(--model)"></i>each round: the model's request + the result (${rounds.map((n) => "+" + fmt(n)).join(", ")})</span>`;

  // ---------- render ----------
  let cur = 0;
  let timer = null;
  const scrub = $("scrub");
  scrub.max = String(steps.length - 1);

  function render(i, fromScrub = false) {
    cur = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[cur];
    $("step-num").textContent = `Step ${cur + 1} / ${steps.length}`;
    const who = $("step-who");
    who.dataset.who = s.who;
    who.textContent = { you: "You", model: "Model", harness: "Harness" }[s.who];
    $("step-title").textContent = s.title;
    $("step-text").innerHTML = s.text;
    $("cards").innerHTML = s.cards();
    $("context-count").innerHTML = s.count();

    document.querySelectorAll("#loop .on").forEach((el) => el.classList.remove("on"));
    s.loop.forEach((id) => $(id).classList.add("on"));
    document.querySelectorAll("#loopcode span[data-l]").forEach((el) =>
      el.classList.toggle("on", s.code.includes(+el.dataset.l)));

    stack.querySelectorAll(".blk.round").forEach((el) => {
      const r = +el.dataset.r;
      const show = r <= s.rounds;
      const was = el.style.width !== "0px" && el.style.width !== "0";
      el.style.width = show ? pct(rounds[r - 1]) : "0";
      el.classList.toggle("fresh", show && !was);
    });
    stack.classList.toggle("reading", !!s.reading);

    if (!fromScrub) scrub.value = String(cur);
    $("prev").disabled = cur === 0;
    $("next").disabled = cur === steps.length - 1;
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    $("play").textContent = "Play";
    $("play").setAttribute("aria-label", "Play");
  }
  function play() {
    if (cur === steps.length - 1) render(0);
    $("play").textContent = "Pause";
    $("play").setAttribute("aria-label", "Pause");
    timer = setInterval(() => {
      if (cur >= steps.length - 1) return stop();
      render(cur + 1);
    }, 4200);
  }

  $("prev").addEventListener("click", () => { stop(); render(cur - 1); });
  $("next").addEventListener("click", () => { stop(); render(cur + 1); });
  $("play").addEventListener("click", () => (timer ? stop() : play()));
  scrub.addEventListener("input", () => { stop(); render(+scrub.value, true); });
  document.addEventListener("keydown", (e) => {
    if (e.target === scrub || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { stop(); render(cur + 1); }
    else if (e.key === "ArrowLeft") { stop(); render(cur - 1); }
  });

  // ---------- static numbers ----------
  const sumRead = calls.reduce((a, c) => a + c.context_tokens, 0);
  $("prompt-quote").textContent = T.prompt;
  $("sum-read").textContent = fmt(sumRead);
  $("sum-cache").textContent = fmt(T.totals.cache_read_tokens);
  $("t-calls").textContent = T.totals.model_calls;
  $("t-time").textContent = T.totals.duration_s;
  $("t-cost").textContent = "$" + T.totals.cost_usd.toFixed(3);
  $("src").textContent = T.source;
  $("model").textContent = T.model;
  $("ccv").textContent = T.claude_code_version;
  $("tools").textContent = T.tools_available.join(", ");

  render(0);
})();
