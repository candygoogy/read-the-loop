// Fills in the page: the month's total, the chart and the table.

const rows = totalsByCategory(TRANSACTIONS);
const total = rows.reduce((sum, r) => sum + r.total, 0);

document.getElementById('total').textContent = formatMoney(total);
drawChart(document.getElementById('chart'), rows);

const table = document.getElementById('table');
for (const row of rows) {
  const tr = document.createElement('tr');
  const name = document.createElement('td');
  const amount = document.createElement('td');
  name.textContent = row.category;
  amount.textContent = formatMoney(row.total);
  tr.append(name, amount);
  table.appendChild(tr);
}
