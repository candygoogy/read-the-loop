'use strict';

// Reads the bank's CSV export into one object per row, keyed by the header line.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((name, i) => {
      row[name] = (cells[i] || '').trim();
    });
    return row;
  });
}

module.exports = { parseCsv };
