'use strict';

const fs = require('fs');
const path = require('path');

function logFile() {
  return process.env.WORKLOG_FILE || path.join(process.cwd(), 'worklog.json');
}

// Entries: { day: 'YYYY-MM-DD', hours: number, project: string, note: string }
function loadEntries(file = logFile()) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).entries;
}

function saveEntries(entries, file = logFile()) {
  fs.writeFileSync(file, JSON.stringify({ version: 1, entries }, null, 2) + '\n');
}

module.exports = { logFile, loadEntries, saveEntries };
