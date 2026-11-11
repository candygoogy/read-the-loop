'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main } = require('../lib/commands');
const { readArgs } = require('../lib/args');

function withLog(entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-')), 'worklog.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, entries }));
  process.env.WORKLOG_FILE = file;
  return file;
}

function run(argv) {
  const lines = [];
  const code = main(argv, (line) => lines.push(line));
  return { code, lines };
}

test('total adds up hours per project', () => {
  withLog([
    { day: '2026-11-02', hours: 2, project: 'acme', note: '' },
    { day: '2026-11-03', hours: 1.5, project: 'internal', note: '' },
    { day: '2026-11-04', hours: 3, project: 'acme', note: 'review' },
  ]);
  const { code, lines } = run(['total']);
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(lines, ['acme         5h', 'internal     1.5h', 'Total        6.5h']);
});

test('total --project keeps one project', () => {
  withLog([
    { day: '2026-11-02', hours: 2, project: 'acme', note: '' },
    { day: '2026-11-03', hours: 1.5, project: 'internal', note: '' },
  ]);
  assert.deepStrictEqual(run(['total', '--project', 'internal']).lines, ['internal     1.5h', 'Total        1.5h']);
});

test('add writes an entry', () => {
  const file = withLog([]);
  assert.strictEqual(run(['add', '2', 'acme', 'API', 'review', '--day', '2026-11-05']).code, 0);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).entries, [
    { day: '2026-11-05', hours: 2, project: 'acme', note: 'API review' },
  ]);
});

test('unknown options are rejected', () => {
  withLog([]);
  const { code, lines } = run(['list', '--projet', 'acme']);
  assert.strictEqual(code, 1);
  assert.deepStrictEqual(lines, ['worklog list: unknown option --projet']);
});

test('readArgs reads switches and values', () => {
  assert.deepStrictEqual(readArgs(['a', '--v', '--day', '2026-11-01'], { v: 'switch', day: 'day' }), {
    words: ['a'],
    opts: { v: true, day: '2026-11-01' },
  });
});
