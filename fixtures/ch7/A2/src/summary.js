// Totals per category, largest first. Shared by the page and the tests.

function totalsByCategory(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

function formatMoney(value) {
  return '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

if (typeof module !== 'undefined') module.exports = { totalsByCategory, formatMoney };
