'use strict';

function formatMoney(value) {
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Two columns: names on the left, amounts right-aligned.
function formatTable(entries) {
  const width = Math.max(...entries.map(([name]) => name.length));
  const amounts = entries.map(([, value]) => formatMoney(value));
  const amountWidth = Math.max(...amounts.map((a) => a.length));
  return entries
    .map(([name], i) => name.padEnd(width) + '  ' + amounts[i].padStart(amountWidth))
    .join('\n');
}

module.exports = { formatMoney, formatTable };
