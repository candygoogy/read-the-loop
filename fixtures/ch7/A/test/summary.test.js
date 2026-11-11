'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { summarize, grandTotal } = require('../src/summary');
const { formatMoney, formatTable } = require('../src/format');

test('adds up amounts per category', () => {
  const totals = summarize([
    { Category: 'Groceries', Amount: '12.40' },
    { Category: 'Travel', Amount: '2.50' },
    { Category: 'Groceries', Amount: '7.60' },
  ]);
  assert.strictEqual(totals.get('Groceries'), 20);
  assert.strictEqual(totals.get('Travel'), 2.5);
  assert.strictEqual(grandTotal(totals), 22.5);
});

test('rows without a category count as Other', () => {
  const totals = summarize([{ Category: '', Amount: '5.00' }]);
  assert.strictEqual(totals.get('Other'), 5);
});

test('formats money with two decimals and thousands separators', () => {
  assert.strictEqual(formatMoney(1234.5), '1,234.50');
  assert.strictEqual(formatMoney(3), '3.00');
});

test('table aligns names and amounts', () => {
  assert.strictEqual(formatTable([['Rent', 950], ['Bus', 2.5]]), 'Rent  950.00\nBus     2.50');
});
