// Chapter 8 (site/playground/) for scripts/screenshot.js: the top, the three switches explained, the
// playground on four settings (switched by keyboard on desk and dark, by tap on the phone, and once through
// the address), a step and the rest of an answer opened, the overview, the points and the end.
// Checks, from PLAYGROUND and the traces (not from the page's own code): each run shows one row per model
// call and the right test marks; switching changes the address; the switches and the pair don't move or
// change height when the setting changes; after a switch every number says what it was and exactly the
// checks whose answer changed (per the data) say their old answer; each switch's thumb sits under the
// chosen option; a step's tool and command share a line and its result never sticks out of it; the runs
// without Bash that asked for it show it; a row of the overview switches the playground; and the opened
// step and answer close again.
const path = require("path");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

// What the page should show for a setting, read straight from the data.
const truth = (p, combo) => p.evaluate((combo) => {
  const P = window.PLAYGROUND;
  const c = P.combinations.find((x) => x.combo === combo);
  return c.runs.map((n) => {
    const r = P.runs.find((x) => x.trace === n);
    return { trace: n, calls: r.model_calls, before: String(r.tests_before_first_edit), after: String(!!r.tests_after_last_edit), missing: r.unavailable.length };
  });
}, combo);

const shown = (p) => p.evaluate(() => {
  const pair = document.querySelector("#playground .pg-pair");
  const sw = document.querySelector("#playground .pg-switches").getBoundingClientRect();
  return {
    combo: pair.dataset.combo,
    hash: location.hash,
    height: Math.round(pair.getBoundingClientRect().height),
    switchesTop: Math.round(sw.top + scrollY),
    runs: [...pair.querySelectorAll(".pg-run")].map((a) => ({
      trace: a.dataset.run,
      calls: a.querySelectorAll(".pg-call").length,
      before: (a.querySelector('.ck[data-k="before"]') || {}).dataset?.yes,
      after: (a.querySelector('.ck[data-k="after"]') || {}).dataset?.yes,
      missing: a.querySelectorAll(".pg-req.is-missing").length,
      was: [...a.querySelectorAll(".pg-was")].map((e) => e.textContent.trim()),
      changed: [...a.querySelectorAll(".ck.is-changed")].map((li) => li.dataset.k).join(),
    })),
  };
});

// The switches' thumbs (where drawn) under the chosen options; each step's tool and command on one line, and
// its tag, result and arrow inside its box.
const layout = (p, root = "#playground") => p.evaluate((root) => {
  const bad = [];
  document.querySelectorAll(`${root} .seg`).forEach((seg) => {
    const th = seg.querySelector(".seg-thumb");
    if (!th || getComputedStyle(th).display === "none") return;
    // The option's label, not its text box, which shrinks a little while pressed.
    const a = th.getBoundingClientRect(), b = seg.querySelector("input:checked").closest(".seg-opt").getBoundingClientRect();
    if (Math.abs(a.left - b.left) > 2 || Math.abs(a.width - b.width) > 2) bad.push(`thumb of ${seg.closest(".pg-sw").dataset.k} at ${Math.round(a.left)}, its option at ${Math.round(b.left)}`);
  });
  document.querySelectorAll(`${root} .pg-pair > .pg-run .pg-req > summary`).forEach((sm, i) => {
    const t = sm.querySelector(".q-tool").getBoundingClientRect(), g = sm.querySelector(".q-arg").getBoundingClientRect();
    const e = sm.querySelector(".q-end").getBoundingClientRect(), b = sm.getBoundingClientRect();
    if (Math.abs(t.top - g.top) > 4) bad.push(`step ${i + 1}: its command is on another line than its tool`);
    if (e.right > b.right + 1 || e.left < b.left - 1) bad.push(`step ${i + 1}: its result sticks out of its box`);
  });
  return bad;
}, root);

async function expectCombo(p, combo, problems, label) {
  await p.waitForFunction((c) => document.querySelector("#playground .pg-pair").dataset.combo === c, combo, { timeout: 3000 }).catch(() => {});
  await settle(p);
  const s = await shown(p);
  const t = await truth(p, combo);
  if (s.combo !== combo) problems.push(`${label}: shows ${s.combo}, expected ${combo}`);
  t.forEach((r, i) => {
    const got = s.runs[i] || {};
    if (got.trace !== r.trace || got.calls !== r.calls || got.before !== r.before || got.after !== r.after || got.missing !== r.missing) {
      problems.push(`${label}: run ${i + 1} shows ${JSON.stringify(got)}, data says ${JSON.stringify(r)}`);
    }
  });
  return s;
}

// Set one switch, by keyboard (arrow keys move within a radio group) or by tap.
async function flip(p, key, value, how) {
  const sel = `#playground .pg-sw[data-k="${key}"]`;
  if (how === "tap") await p.locator(`${sel} input[value="${value}"] + span`).tap();
  else {
    await p.locator(`${sel} input:checked`).focus();
    const values = await p.locator(`${sel} input`).evaluateAll((xs) => xs.map((x) => x.value));
    const at = await p.locator(`${sel} input:checked`).evaluate((x) => x.value);
    await p.keyboard.press(values.indexOf(value) > values.indexOf(at) ? "ArrowRight" : "ArrowLeft");
  }
  await wait(p, 120);
}

async function states(p, { name, shot, problems, dir }) {
  const how = name === "phone" ? "tap" : "keys";
  await shot("top");

  await p.locator(".sw-list").scrollIntoViewIfNeeded();
  await shot("switches", "section:has(> #s-intro)");

  await p.locator("#playground").scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector("#playground .pg-pair").style.minHeight, null, { timeout: 4000 }).catch(() => problems.push("the pair's height was never reserved"));
  const first = await p.evaluate(() => window.PLAYGROUND.combinations[0].combo);
  const s0 = await expectCombo(p, first, problems, "start");
  if (s0.hash) problems.push(`the address got ${s0.hash} before any switch`);
  if (s0.runs.some((r) => r.was.some(Boolean) || r.changed)) problems.push("start: a number or check says what it was before any switch");
  (await layout(p)).forEach((b) => problems.push(`start: ${b}`));
  await shot(`play-${first}`, "#playground");

  // Three switches, one at a time, then a setting through the address. The pair keeps its height.
  const steps = [["model", "haiku"], ["bash", "nobash"], ["rule", "rule"]];
  let want = first.split("-");
  for (const [k, v] of steps) {
    const was = await truth(p, want.join("-"));
    await flip(p, k, v, how);
    want = want.map((x, i) => (i === ["model", "bash", "rule"].indexOf(k) ? v : x));
    const combo = want.join("-");
    const s = await expectCombo(p, combo, problems, `${how} ${k}`);
    const now = await truth(p, combo);
    now.forEach((r, i) => {
      const got = s.runs[i] || { was: [] };
      const exp = ["before", "after"].filter((c) => r[c] !== was[i][c]).join();
      if (got.changed !== exp) problems.push(`after ${k}: run ${i + 1} marks [${got.changed}] as changed, the data says [${exp}]`);
      if (got.was.length !== 3 || !got.was.every(Boolean)) problems.push(`after ${k}: run ${i + 1}'s numbers don't all say what they were: ${JSON.stringify(got.was)}`);
    });
    (await layout(p)).forEach((b) => problems.push(`after ${k}: ${b}`));
    if (s.hash !== `#${combo}`) problems.push(`after ${k}: address ${s.hash}, expected #${combo}`);
    if (s.height !== s0.height) problems.push(`after ${k}: the pair is ${s.height}px tall, was ${s0.height}px`);
    if (s.switchesTop !== s0.switchesTop) problems.push(`after ${k}: the switches moved from ${s0.switchesTop} to ${s.switchesTop}`);
    if (k === "rule") await shot(`play-${combo}`, "#playground");
  }
  await p.evaluate(() => { location.hash = "opus-bash-rule"; });
  await wait(p, 150);
  const sH = await expectCombo(p, "opus-bash-rule", problems, "address");
  if (sH.height !== s0.height) problems.push(`opus-bash-rule: the pair is ${sH.height}px tall, was ${s0.height}px`);
  await shot("play-opus-bash-rule", "#playground");

  // A step opened (the first test run) and closed again, and the rest of an answer.
  const step = p.locator("#playground .pg-run").first().locator(".pg-req.is-test > summary").first();
  await step.scrollIntoViewIfNeeded();
  if (how === "tap") await step.tap(); else { await step.focus(); await p.keyboard.press("Enter"); }
  await wait(p, 120);
  if (!(await p.locator("#playground .pg-run").first().locator(".pg-req.is-test").first().evaluate((d) => d.open))) problems.push("a step didn't open");
  await shot("step-open", "#playground .pg-run >> nth=0");
  if (how === "tap") await step.tap(); else await p.keyboard.press("Enter");
  if (await p.locator("#playground .pg-run").first().locator(".pg-req.is-test").first().evaluate((d) => d.open)) problems.push("a step didn't close");
  const more = p.locator("#playground .pg-run").nth(1).locator(".pg-more > summary");
  if (await more.count()) {
    await more.scrollIntoViewIfNeeded();
    if (how === "tap") await more.tap(); else { await more.focus(); await p.keyboard.press("Enter"); }
    await wait(p, 120);
    await shot("answer-open", "#playground .pg-run >> nth=1");
    if (how === "tap") await more.tap(); else await p.keyboard.press("Enter");
  }

  await p.locator(".embed-note").scrollIntoViewIfNeeded();
  await shot("embed-note", ".embed-note");
  const code = await p.locator("#embed-code").textContent();
  if (!code.includes("embed.html#opus-bash-rule")) problems.push(`embed snippet doesn't follow the setting: ${code}`);

  // The overview: one row per setting; a row switches the playground.
  await p.locator("#overview").scrollIntoViewIfNeeded();
  await shot("overview", "section:has(> #s-all)");
  const rows = await p.locator("#overview tbody tr").count();
  const combos = await p.evaluate(() => window.PLAYGROUND.combinations.length);
  if (rows !== combos) problems.push(`overview has ${rows} rows, data has ${combos} settings`);
  const row = p.locator('#overview tbody tr[data-combo="haiku-bash-rule"] a');
  if (how === "tap") await row.tap(); else { await row.focus(); await p.keyboard.press("Enter"); }
  await wait(p, 400);
  await expectCombo(p, "haiku-bash-rule", problems, "overview row");
  if ((await p.evaluate(() => location.hash)) !== "#haiku-bash-rule") problems.push("overview row didn't set the address");

  await p.locator(".points").scrollIntoViewIfNeeded();
  await shot("points", "section:has(> #s-shows)");

  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(p, 200);
  await shot("end");

  await settle(p);
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
}

// Reduced motion: every switch both ways, a step and an answer opened and closed, an overview row.
async function exercise(p) {
  await p.locator("#playground").scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector("#playground .pg-pair").style.minHeight, null, { timeout: 4000 }).catch(() => {});
  for (const [k, a, b] of [["model", "haiku", "opus"], ["bash", "nobash", "bash"], ["rule", "rule", "norule"]]) {
    await p.locator(`#playground .pg-sw[data-k="${k}"] input[value="${a}"] + span`).click();
    await wait(p, 100);
    await p.locator(`#playground .pg-sw[data-k="${k}"] input[value="${b}"] + span`).click();
    await wait(p, 100);
  }
  const step = p.locator("#playground .pg-req > summary").first();
  await step.click();
  await step.click();
  await p.locator('#overview tbody tr[data-combo="haiku-nobash-rule"] a').click();
  await wait(p, 300);
}

// The change when a switch flips: the numbers count, the steps come in.
async function motion(p, capture) {
  await p.locator("#playground").scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector("#playground .pg-pair").style.minHeight, null, { timeout: 4000 }).catch(() => {});
  await capture("ch8-switch", "#playground", () => p.locator('#playground .pg-sw[data-k="model"] input[value="haiku"] + span').click());
}

module.exports = { layout, name: "playground", file: "playground/index.html", sizes: ["desk", "phone", "dark"], states, exercise, motion };
