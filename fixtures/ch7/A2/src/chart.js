// Draws the bar chart: one bar per category, its amount above it and its name below.

const CHART = {
  padding: { top: 28, right: 12, bottom: 44, left: 12 },
  bar: '#3b7a57',
  text: '#2b2b2b',
  font: '12px system-ui, sans-serif',
};

function drawChart(canvas, rows) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const { top, right, bottom, left } = CHART.padding;

  ctx.clearRect(0, 0, width, height);
  if (rows.length === 0) return;

  const max = Math.max(...rows.map((r) => r.total));
  const slot = (width - left - right) / rows.length;
  const barWidth = Math.min(56, slot * 0.7);
  const plotHeight = height - top - bottom;

  ctx.font = CHART.font;
  ctx.textAlign = 'center';

  rows.forEach((row, i) => {
    const h = Math.max(2, (row.total / max) * plotHeight);
    const x = left + i * slot + (slot - barWidth) / 2;
    const y = height - bottom - h;
    ctx.fillStyle = CHART.bar;
    ctx.fillRect(x, y, barWidth, h);

    ctx.fillStyle = CHART.text;
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatMoney(row.total), x + barWidth / 2, y - 4);
    ctx.textBaseline = 'top';
    ctx.fillText(row.category, x + barWidth / 2, height - bottom + 8);
  });
}
