'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseCsv } = require('../src/csv');

test('reads rows keyed by the header', () => {
  const rows = parseCsv('Date,Description,Category,Amount\n2026-02-01,Coffee,Eating out,3.20\n');
  assert.deepStrictEqual(rows, [
    { Date: '2026-02-01', Description: 'Coffee', Category: 'Eating out', Amount: '3.20' },
  ]);
});

test('handles Windows line endings and blank lines', () => {
  const rows = parseCsv('Date,Description,Category,Amount\r\n2026-02-01,Bus,Travel,2.50\r\n\r\n');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].Amount, '2.50');
});

test('empty file gives no rows', () => {
  assert.deepStrictEqual(parseCsv(''), []);
});
