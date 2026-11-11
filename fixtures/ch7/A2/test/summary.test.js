'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { totalsByCategory, formatMoney } = require('../src/summary.js');
const TRANSACTIONS = require('../data/march.js');

test('adds up each category, largest first', () => {
  const rows = totalsByCategory([
    { category: 'Travel', amount: 2.5 },
    { category: 'Rent', amount: 950 },
    { category: 'Travel', amount: 7.2 },
  ]);
  assert.deepStrictEqual(rows, [
    { category: 'Rent', total: 950 },
    { category: 'Travel', total: 9.7 },
  ]);
});

test('March has one row per category', () => {
  const rows = totalsByCategory(TRANSACTIONS);
  assert.strictEqual(rows.length, 8);
  assert.strictEqual(rows[0].category, 'Shopping');
});

test('formats whole pounds with thousands separators', () => {
  assert.strictEqual(formatMoney(1288.48), '£1,288');
  assert.strictEqual(formatMoney(22.98), '£23');
});
