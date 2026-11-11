// Preload: pins "now" to FAKE_NOW (local time) for the B check. Not shown to the agent.
const Real = Date;
const fixed = new Real(process.env.FAKE_NOW).getTime();
global.Date = class extends Real {
  constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
  static now() { return fixed; }
};
