'use strict';

// Totals per category, in the order categories first appear.
function summarize(rows) {
  const totals = new Map();
  for (const row of rows) {
    const category = row.Category || 'Other';
    const amount = parseFloat(row.Amount);
    totals.set(category, (totals.get(category) || 0) + amount);
  }
  return totals;
}

function grandTotal(totals) {
  let sum = 0;
  for (const value of totals.values()) sum += value;
  return sum;
}

module.exports = { summarize, grandTotal };
