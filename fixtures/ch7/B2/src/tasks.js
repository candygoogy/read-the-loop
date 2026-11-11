import fs from 'node:fs';
import path from 'node:path';

// tasks.json maps a task name to the Node script it runs:
//   { "build": { "script": "scripts/build.js", "args": ["--minify"] } }
// Paths are relative to the folder that holds tasks.json.

export class TaskError extends Error {}

export function loadTasks(dir = process.cwd()) {
  const file = path.join(dir, 'tasks.json');
  if (!fs.existsSync(file)) throw new TaskError(`no tasks.json in ${dir}`);
  let tasks;
  try {
    tasks = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new TaskError(`tasks.json is not valid JSON: ${err.message}`);
  }
  for (const [name, task] of Object.entries(tasks)) validateTask(name, task);
  return tasks;
}

export function validateTask(name, task) {
  if (typeof task !== 'object' || task === null || Array.isArray(task)) {
    throw new TaskError(`task "${name}" must be an object with a "script"`);
  }
  if (typeof task.script !== 'string' || task.script === '') {
    throw new TaskError(`task "${name}" needs a "script"`);
  }
  if (task.args !== undefined && !(Array.isArray(task.args) && task.args.every((a) => typeof a === 'string'))) {
    throw new TaskError(`task "${name}": "args" must be a list of strings`);
  }
}

// The program and arguments a task runs.
export function commandFor(task) {
  return { file: process.execPath, args: [task.script, ...(task.args || [])] };
}
