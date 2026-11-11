// Chapter 8's embed (site/playground/embed.html) for scripts/screenshot.js: the playground on its own, as
// another page would show it in an iframe. Checks that it opens on the setting in its address, that a switch
// changes the address and the link back to the chapter, that each run shows one row per model call (from
// PLAYGROUND), that after the switch every number says what it was, that the switches' thumbs and the steps'
// lines are drawn right (playground.js's layout check), and that nothing overflows at the narrow widths an
// iframe in a blog post might have.
const path = require("path");
const { layout } = require("./playground.js");

const wait = (p, ms) => p.waitForTimeout(ms);
const settle = (p) => p.evaluate(() => window.Motion && window.Motion.settle());

async function check(p, combo, problems, label) {
  await p.waitForFunction((c) => document.querySelector(".pg-pair").dataset.combo === c, combo, { timeout: 3000 }).catch(() => {});
  const s = await p.evaluate((combo) => {
    const P = window.PLAYGROUND;
    const c = P.combinations.find((x) => x.combo === combo);
    return {
      combo: document.querySelector(".pg-pair").dataset.combo,
      want: c.runs.map((n) => P.runs.find((r) => r.trace === n).model_calls),
      got: [...document.querySelectorAll(".pg-pair:not(.pg-sizer) > .pg-run")].map((a) => a.querySelectorAll(".pg-call").length),
      back: document.getElementById("em-back").getAttribute("href"),
    };
  }, combo);
  if (s.combo !== combo) problems.push(`${label}: shows ${s.combo}, expected ${combo}`);
  if (String(s.got) !== String(s.want)) problems.push(`${label}: rows ${s.got}, data has ${s.want} calls`);
  if (s.back !== `index.html#${combo}`) problems.push(`${label}: link back is ${s.back}`);
}

async function states(p, { name, shot, problems, dir }) {
  const how = name === "phone" ? "tap" : "keys";
  const first = await p.evaluate(() => window.PLAYGROUND.combinations[0].combo);
  await check(p, first, problems, "start");
  await settle(p);
  await shot("top");

  // A switch, by keyboard or tap.
  const sel = '.pg-sw[data-k="bash"]';
  if (how === "tap") await p.locator(`${sel} input[value="nobash"] + span`).tap();
  else { await p.locator(`${sel} input:checked`).focus(); await p.keyboard.press("ArrowRight"); }
  await wait(p, 150);
  const combo = first.replace("-bash-", "-nobash-");
  await check(p, combo, problems, "switch");
  if ((await p.evaluate(() => location.hash)) !== `#${combo}`) problems.push("switch didn't set the address");
  await settle(p);
  const was = await p.evaluate(() => [...document.querySelectorAll(".pg-pair:not(.pg-sizer) .pg-was")].map((e) => e.textContent.trim()));
  if (was.length !== 6 || !was.every(Boolean)) problems.push(`switch: the numbers don't all say what they were: ${JSON.stringify(was)}`);
  (await layout(p, "body")).forEach((b) => problems.push(`switch: ${b}`));
  await p.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });

  // Opened on a setting from the address, as an iframe's src would give it.
  await p.evaluate(() => { history.replaceState(null, "", "#haiku-nobash-rule"); });
  await p.reload();
  await p.evaluate(() => document.fonts.ready);
  await wait(p, 500);
  await check(p, "haiku-nobash-rule", problems, "address");
  await shot("haiku-nobash-rule");

  // Iframe widths: a narrow column and a medium one. Nothing may overflow sideways.
  if (name !== "phone") {
    const vp = p.viewportSize();
    for (const w of [320, 600, 700]) {
      await p.setViewportSize({ width: w, height: 900 });
      await wait(p, 300);
      await settle(p);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) problems.push(`overflow ${over}px at ${w}px wide`);
      (await layout(p, "body")).forEach((b) => problems.push(`${w}px wide: ${b}`));
      await p.screenshot({ path: path.join(dir, `${name}-w${w}.png`), fullPage: true });
    }
    await p.setViewportSize(vp);
    await wait(p, 200);
  }
}

async function exercise(p) {
  await p.waitForFunction(() => document.querySelector(".pg-pair").style.minHeight, null, { timeout: 4000 }).catch(() => {});
  await p.locator('.pg-sw[data-k="model"] input[value="haiku"] + span').click();
  await p.locator('.pg-sw[data-k="rule"] input[value="rule"] + span').click();
  await p.locator(".pg-req > summary").first().click();
  await p.locator(".pg-req > summary").first().click();
  await wait(p, 200);
}

module.exports = { name: "playground-embed", file: "playground/embed.html", sizes: ["desk", "phone", "dark"], states, exercise };
