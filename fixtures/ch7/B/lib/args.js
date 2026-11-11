'use strict';

// A small argument reader for the CLI. Each command declares the options it takes:
//
//   readArgs(['acme', '--day', '2026-11-03'], { day: 'day', verbose: 'switch' })
//   -> { words: ['acme'], opts: { day: '2026-11-03', verbose: false } }
//
// Option kinds: 'text' (takes a value), 'day' (takes a YYYY-MM-DD value), 'switch' (no value; true when
// present, false otherwise). An option the command doesn't declare is an error, so typos don't pass
// silently.

const { isDay } = require('./days');

class ArgError extends Error {}

function readArgs(argv, options = {}) {
  const words = [];
  const opts = {};
  for (const [name, kind] of Object.entries(options)) {
    if (kind === 'switch') opts[name] = false;
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      words.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const kind = options[name];
    if (!kind) throw new ArgError(`unknown option --${name}`);
    if (kind === 'switch') {
      opts[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new ArgError(`--${name} needs a value`);
    if (kind === 'day' && !isDay(value)) throw new ArgError(`--${name} must be a day (YYYY-MM-DD), not ${value}`);
    opts[name] = value;
  }
  return { words, opts };
}

module.exports = { readArgs, ArgError };
