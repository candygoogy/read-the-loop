'use strict';

const { readArgs, ArgError } = require('./args');
const days = require('./days');
const { loadEntries, saveEntries } = require('./store');

function hours(n) {
  return `${Number(n.toFixed(2))}h`;
}

const commands = {
  add: {
    usage: 'add <hours> <project> [note] [--day YYYY-MM-DD]',
    run(argv, out) {
      const { words, opts } = readArgs(argv, { day: 'day' });
      const [h, project, ...note] = words;
      const value = Number(h);
      if (!(value > 0) || !project) throw new ArgError('usage: ' + commands.add.usage);
      const entries = loadEntries();
      const entry = { day: opts.day || days.today(), hours: value, project, note: note.join(' ') };
      entries.push(entry);
      saveEntries(entries);
      out(`Logged ${hours(value)} on ${project} for ${entry.day}`);
    },
  },

  list: {
    usage: 'list [--project NAME]',
    run(argv, out) {
      const { opts } = readArgs(argv, { project: 'text' });
      const entries = loadEntries().filter((e) => !opts.project || e.project === opts.project);
      entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
      for (const e of entries) out(`${e.day}  ${hours(e.hours).padStart(6)}  ${e.project}${e.note ? '  ' + e.note : ''}`);
      if (entries.length === 0) out('No entries.');
    },
  },

  total: {
    usage: 'total [--project NAME]',
    run(argv, out) {
      const { opts } = readArgs(argv, { project: 'text' });
      const entries = loadEntries().filter((e) => !opts.project || e.project === opts.project);
      const perProject = new Map();
      for (const e of entries) perProject.set(e.project, (perProject.get(e.project) || 0) + e.hours);
      for (const [project, sum] of [...perProject].sort()) out(`${project.padEnd(12)} ${hours(sum)}`);
      out(`${'Total'.padEnd(12)} ${hours(entries.reduce((s, e) => s + e.hours, 0))}`);
    },
  },
};

function main(argv, out = console.log) {
  const [name, ...rest] = argv;
  const command = commands[name];
  if (!command) {
    out('usage: worklog <command>\n' + Object.values(commands).map((c) => '  ' + c.usage).join('\n'));
    return name ? 1 : 0;
  }
  try {
    command.run(rest, out);
    return 0;
  } catch (err) {
    if (err instanceof ArgError) {
      out(`worklog ${name}: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

module.exports = { commands, main };
