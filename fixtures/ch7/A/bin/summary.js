#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseCsv } = require('../src/csv');
const { summarize, grandTotal } = require('../src/summary');
const { formatTable } = require('../src/format');

const file = process.argv[2];
if (!file) {
  console.error('usage: node bin/summary.js <statement.csv>');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const totals = summarize(rows);
const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
entries.push(['Total', grandTotal(totals)]);

console.log(`${rows.length} transactions in ${file}\n`);
console.log(formatTable(entries));
