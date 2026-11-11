'use strict';

const test = require('node:test');
const assert = require('node:assert');
const days = require('../lib/days');

test('recognises valid days only', () => {
  assert.ok(days.isDay('2026-02-28'));
  assert.ok(!days.isDay('2026-02-30'));
  assert.ok(!days.isDay('26-2-28'));
});

test('shift crosses month and year ends', () => {
  assert.strictEqual(days.shift('2026-11-30', 1), '2026-12-01');
  assert.strictEqual(days.shift('2026-01-01', -1), '2025-12-31');
});

test('weekday uses 1 for Monday and 7 for Sunday', () => {
  assert.strictEqual(days.weekday('2026-11-09'), 1);
  assert.strictEqual(days.weekday('2026-11-15'), 7);
});
